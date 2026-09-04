import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders'; // Новый загрузчик в Astro 5

const news = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/news' }),
  schema: z.object({
    title: z.string(),
    date: z.string().or(z.date()),
    author: z.string(),
    authorAvatar: z.string().optional(),
    id: z.string(),
    images: z.array(z.string()).default([]),
  }),
});

export const collections = { news };