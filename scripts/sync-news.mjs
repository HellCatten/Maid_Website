import fs from 'node:fs/promises';
import path from 'node:path';

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
// Флаг принудительной полной пересинхронизации (опционально)
const FORCE_RESYNC = process.env.FORCE_RESYNC === 'true';

if (!BOT_TOKEN || !CHANNEL_ID) {
  console.error('Ошибка: не заданы переменные окружения DISCORD_BOT_TOKEN или DISCORD_CHANNEL_ID');
  process.exit(1);
}

const NEWS_DIR = path.resolve('src/content/news');
const IMAGES_DIR = path.resolve('public/news-images');
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function ensureDirs() {
  await fs.mkdir(NEWS_DIR, { recursive: true });
  await fs.mkdir(IMAGES_DIR, { recursive: true });
}

// Определяем последний обработанный ID прямо по файлам в папке!
async function getLastMessageIdFromFiles() {
  if (FORCE_RESYNC) {
    console.log('Включен FORCE_RESYNC: выгружаем историю заново.');
    return null;
  }

  try {
    const files = await fs.readdir(NEWS_DIR);
    let maxId = null;

    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      // Имя файла: YYYY-MM-DD-<id>.md
      const parts = file.replace('.md', '').split('-');
      const id = parts[parts.length - 1];

      // Проверяем, что это Snowflake ID (число)
      if (/^\d+$/.test(id)) {
        if (!maxId || BigInt(id) > BigInt(maxId)) {
          maxId = id;
        }
      }
    }
    return maxId;
  } catch {
    return null;
  }
}

async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Ошибка загрузки: ${res.statusText}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(destPath, buffer);
}

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

async function fetchAllHistory() {
  console.log('Выгружаем всю историю канала...');
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

async function fetchIncremental(lastId) {
  console.log(`Инкрементальный запуск: ищем сообщения новее ID ${lastId}...`);
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

function isImage(filename = '', contentType = '') {
  if (contentType && contentType.startsWith('image/')) return true;
  const ext = path.extname(filename.split('?')[0] || '').toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

async function run() {
  await ensureDirs();
  const lastId = await getLastMessageIdFromFiles();
  console.log(`Текущий lastId из существующих файлов: ${lastId || 'НЕТ (будет загружена вся история)'}`);

  const rawMessages = lastId ? await fetchIncremental(lastId) : await fetchAllHistory();

  if (!rawMessages.length) {
    console.log('Новых сообщений в канале нет.');
    return;
  }

  // Сортируем от старых к новым
  const sortedMessages = rawMessages.sort((a, b) => (BigInt(a.id) > BigInt(b.id) ? 1 : -1));
  let savedCount = 0;

  for (const msg of sortedMessages) {
    console.log(`\nОбработка сообщения ID: ${msg.id} от [${msg.author.username}]...`);

    // 1. Собираем текст: из обычного content + из embeds (если есть)
    let fullText = msg.content || '';
    let embedTitle = '';

    if (msg.embeds && msg.embeds.length > 0) {
      for (const embed of msg.embeds) {
        if (embed.title && !embedTitle) embedTitle = embed.title;
        if (embed.description) {
          fullText += (fullText ? '\n\n' : '') + embed.description;
        }
      }
    }

    // 2. Собираем картинки: из attachments + из embeds
    const imageUrls = [];

    // Из вложений
    for (const att of msg.attachments || []) {
      if (isImage(att.filename, att.content_type)) {
        imageUrls.push({ url: att.url, name: att.filename });
      }
    }

    // Из Embeds
    for (const embed of msg.embeds || []) {
      if (embed.image?.url && isImage(embed.image.url)) {
        imageUrls.push({ url: embed.image.url, name: 'embed.jpg' });
      }
      if (embed.thumbnail?.url && isImage(embed.thumbnail.url)) {
        imageUrls.push({ url: embed.thumbnail.url, name: 'thumb.jpg' });
      }
    }

    // Если сообщение абсолютно пустое (системное сообщение без текста и медиа)
    if (!fullText.trim() && imageUrls.length === 0) {
      console.log(`[Пропуск] Сообщение ${msg.id} пустое (нет текста, embed и картинок).`);
      continue;
    }

    const date = new Date(msg.timestamp);
    const dateFormatted = date.toISOString().split('T')[0];
    const slug = `${dateFormatted}-${msg.id}`;

    // 3. Выкачиваем картинки
    const localImages = [];
    for (const [index, img] of imageUrls.entries()) {
      const ext = path.extname(img.name.split('?')[0]) || '.jpg';
      const localFilename = `${msg.id}_${index}${ext}`;
      const localFilePath = path.join(IMAGES_DIR, localFilename);

      console.log(`  -> Скачивание изображения: ${localFilename}`);
      try {
        await downloadFile(img.url, localFilePath);
        localImages.push(`/news-images/${localFilename}`);
      } catch (err) {
        console.warn(`  Не удалось скачать ${img.url}: ${err.message}`);
      }
    }

    // 4. Формируем заголовок
    const lines = fullText.split('\n').map((l) => l.trim()).filter(Boolean);
    const rawTitle = embedTitle || lines[0] || `Новость от ${dateFormatted}`;
    const cleanTitle = rawTitle.slice(0, 100).replace(/["#*`\\]/g, '').trim();

    // 5. Генерируем .md
    let mdContent = `---
title: "${cleanTitle}"
date: "${msg.timestamp}"
author: "${msg.author.global_name || msg.author.username}"
id: "${msg.id}"
images: ${JSON.stringify(localImages)}
---

${fullText}
`;

    if (localImages.length > 0) {
      mdContent += '\n\n' + localImages.map((src) => `![](${src})`).join('\n\n');
    }

    const mdFilePath = path.join(NEWS_DIR, `${slug}.md`);
    await fs.writeFile(mdFilePath, mdContent, 'utf-8');
    savedCount++;
    console.log(`  [УСПЕХ] Создан файл ${slug}.md`);
  }

  console.log(`\nГотово! Всего сохранено новостей: ${savedCount}.`);
}

run().catch((err) => {
  console.error('Критическая ошибка:', err);
  process.exit(1);
});