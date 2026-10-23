/**
 * sitemap.xml: every page a search engine should index, including each chapter.
 * Built from the content collections, so new projects and chapters appear automatically.
 */
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL('https://viktorlaurens.github.io');
  const paths = ['/', '/projects/', '/about/'];
  for (const p of await getCollection('projects')) paths.push(`/projects/${p.id}/`);
  for (const c of await getCollection('chapters')) {
    const [project, chapter] = c.id.split('/');
    paths.push(`/projects/${project}/${chapter}/`);
  }
  const urls = paths.map((p) => `  <url><loc>${new URL(p, base).href}</loc></url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
