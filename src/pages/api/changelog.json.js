// src/pages/api/changelog.json.js
import fs from 'node:fs';
import { load } from 'js-yaml';

export async function GET() {
  try {
    const fileContents = fs.readFileSync('src/data/changelog.yml', 'utf8');
    const parsed = load(fileContents);
    
    if (!parsed || !parsed.Entries) {
      return new Response(JSON.stringify([]), { status: 200 });
    }

    // Сортируем все записи (новые сверху)
    const sortedEntries = parsed.Entries.sort((a, b) => 
      new Date(b.time).getTime() - new Date(a.time).getTime()
    );

    // Возвращаем полный массив
    return new Response(JSON.stringify(sortedEntries), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (e) {
    return new Response(JSON.stringify([]), { status: 500 });
  }
}