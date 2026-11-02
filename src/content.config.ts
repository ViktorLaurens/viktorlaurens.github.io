import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/projects' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      summary: z.string(),
      date: z.coerce.date(),
      tags: z.array(z.string()).default([]),
      featured: z.boolean().default(false),
      order: z.number().default(0),
      repo: z.string().url().optional(),
      cover: image().optional(),
      coverAlt: z.string().optional(),
      coverVideo: z.string().optional(),
      coverPoster: z.string().optional(),
      heroVideo: z.string().optional(),
      heroPoster: z.string().optional(),
      heroAlt: z.string().optional(),
      /** Shorter summary for the social preview card, where the full one would be cut off. */
      cardSummary: z.string().optional(),
      /** 'soon': a teaser. The page shows the overview and the planned chapters, not links to them.
          'wip': published but still being written. The chapters are readable, under a notice. */
      status: z.enum(['published', 'soon', 'wip']).default('published'),
      /** The planned chapters of a teaser, shown as an outline. */
      outline: z.array(z.object({ title: z.string(), summary: z.string() })).default([]),
      /** Shown under the outline of a teaser, for the chapters still being planned. */
      outlineNote: z.string().optional(),
    }),
});

/** Long-form projects are split into chapters: src/content/chapters/<project>/<chapter>.mdx */
const chapters = defineCollection({
  loader: glob({ pattern: '*/*.mdx', base: './src/content/chapters' }),
  schema: z.object({
    project: z.string(),
    number: z.number(),
    title: z.string(),
    summary: z.string(),
  }),
});

export const collections = { projects, chapters };
