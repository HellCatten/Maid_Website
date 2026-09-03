import fs from 'node:fs/promises';
import path from 'node:path';

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

if (!BOT_TOKEN || !CHANNEL_ID) {
  console.error('Ошибка: не заданы переменные окружения DISCORD_BOT_TOKEN или DISCORD_CHANNEL_ID');
  process.exit(1);
}

const STATE_FILE = path.resolve('scripts/sync-state.json');
const NEWS_DIR = path.resolve('src/content/news');
const IMAGES_DIR = path.resolve('public/news-images');

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function ensureDirs() {
  await fs.mkdir(NEWS_DIR, { recursive: true });
  await fs.mkdir(IMAGES_DIR, { recursive: true });
}

async function getLastMessageId() {
  try {
    const data = await fs.readFile(STATE_FILE, 'utf-8');
    return JSON.parse(data).lastMessageId || null;
  } catch {
    return null;
  }
}

async function saveLastMessageId(lastMessageId) {
  await fs.writeFile(STATE_FILE, JSON.stringify({ lastMessageId }, null, 2));
}

async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Ошибка загрузки: ${res.statusText}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(destPath, buffer);
}

// Запрос с защитой от Rate Limit (429)
async function fetchBatch(params = {}) {
  const url = new URL(`https://discord.com/api/v10/channels/${CHANNEL_ID}/messages`);
  url.searchParams.set('limit', '100');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bot ${BOT_TOKEN}` }
  });

  if (res.status === 429) {
    const data = await res.json();
    const retryAfter = (data.retry_after || 1) * 1000;
    console.warn(`Discord Rate Limit. Ждем ${retryAfter}ms...`);
    await sleep(retryAfter);
    return fetchBatch(params);
  }

  if (!res.ok) {
    throw new Error(`Discord API error: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

// 1. Первый запуск: выкачиваем ВСЮ историю назад по ID
async function fetchAllHistory() {
  console.log('Первый запуск: выкачиваем всю историю канала...');
  const allMessages = [];
  let before = null;

  while (true) {
    const params = before ? { before } : {};
    const batch = await fetchBatch(params);
    if (!batch.length) break;

    allMessages.push(...batch);
    before = batch[batch.length - 1].id;
    console.log(`Загружено ${allMessages.length} сообщений из истории...`);

    if (batch.length < 100) break;
    await sleep(200);
  }

  return allMessages;
}

// 2. Последующие запуски: забираем только новые
async function fetchIncremental(lastId) {
  console.log(`Инкрементальный запуск: забираем новые сообщения после ID ${lastId}...`);
  const allMessages = [];
  let after = lastId;

  while (true) {
    const batch = await fetchBatch({ after });
    if (!batch.length) break;

    allMessages.push(...batch);
    const maxId = batch.reduce((max, msg) => (BigInt(msg.id) > BigInt(max) ? msg.id : max), batch[0].id);
    after = maxId;

    if (batch.length < 100) break;
    await sleep(200);
  }

  return allMessages;
}

function isImageAttachment(att) {
  if (att.content_type && att.content_type.startsWith('image/')) return true;
  const ext = path.extname(att.filename || '').toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

async function run() {
  await ensureDirs();
  const lastId = await getLastMessageId();

  const rawMessages = lastId ? await fetchIncremental(lastId) : await fetchAllHistory();

  if (!rawMessages.length) {
    console.log('Новых сообщений не найдено.');
    return;
  }

  // Сортируем от старых к новым по Snowflake ID
  const sortedMessages = rawMessages.sort((a, b) => (BigInt(a.id) > BigInt(b.id) ? 1 : -1));

  let newestId = lastId;
  let savedCount = 0;

  for (const msg of sortedMessages) {
    // Обновляем курсор самого свежего сообщения
    newestId = msg.id;

    // Пропускаем ботов и пустые системные оповещения
    if (msg.author.bot) continue;
    if (!msg.content && (!msg.attachments || msg.attachments.length === 0)) continue;

    const date = new Date(msg.timestamp);
    const dateFormatted = date.toISOString().split('T')[0];
    const slug = `${dateFormatted}-${msg.id}`;

    // Фильтруем картинки, если они есть
    const imageAttachments = (msg.attachments || []).filter(isImageAttachment);
    const localImages = [];

    // Выкачиваем картинки локально (если присутствуют)
    for (const [index, att] of imageAttachments.entries()) {
      const ext = path.extname(att.filename) || '.jpg';
      const localFilename = `${msg.id}_${index}${ext}`;
      const localFilePath = path.join(IMAGES_DIR, localFilename);

      console.log(`Скачивание картинки: ${att.filename} -> ${localFilename}`);
      await downloadFile(att.url, localFilePath);
      localImages.push(`/news-images/${localFilename}`);
    }

    // Формируем заголовок из первой строки (или дефолтный по дате, если сообщение только из картинок)
    const lines = (msg.content || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const rawTitle = lines[0] || `Новость от ${dateFormatted}`;
    const cleanTitle = rawTitle.slice(0, 100).replace(/["#*`]/g, '').trim();

    // Формируем Markdown файл с Frontmatter
    let mdContent = `---
title: "${cleanTitle}"
date: "${msg.timestamp}"
author: "${msg.author.global_name || msg.author.username}"
id: "${msg.id}"
images: ${JSON.stringify(localImages)}
---

${msg.content || ''}
`;

    // Если в посте были картинки — добавляем их в разметку в конец текста
    if (localImages.length > 0) {
      mdContent += '\n\n' + localImages.map((src) => `![](${src})`).join('\n\n');
    }

    const mdFilePath = path.join(NEWS_DIR, `${slug}.md`);
    await fs.writeFile(mdFilePath, mdContent, 'utf-8');
    savedCount++;
    console.log(`[Создана новость] ${slug}.md (картинок: ${localImages.length})`);
  }

  if (newestId) {
    await saveLastMessageId(newestId);
  }

  console.log(`Синхронизация завершена. Всего обработано и создано новостей: ${savedCount}.`);
}

run().catch((err) => {
  console.error('Критическая ошибка:', err);
  process.exit(1);
});