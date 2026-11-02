import { getCollection, type CollectionEntry } from 'astro:content';

/**
 * The chapters that are on the site. A teaser project (`status: soon`) may already have its
 * chapters in src/content/chapters, ready for the day it is published; until then they get no
 * page, no link, no search entry, no sitemap entry and no social card.
 */
export async function publishedChapters(project?: string): Promise<CollectionEntry<'chapters'>[]> {
  const teasers = new Set((await getCollection('projects', (p) => p.data.status === 'soon')).map((p) => p.id));
  return getCollection('chapters', (c) => !teasers.has(c.data.project) && (!project || c.data.project === project));
}
