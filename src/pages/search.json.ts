/**
 * Search index for the command palette: every page and every section heading.
 * Built once at build time; fetched lazily the first time the palette opens.
 */
import type { APIRoute } from 'astro';
import { getCollection, render } from 'astro:content';

export interface SearchEntry {
  /** What is shown in bold. */
  title: string;
  /** Where it lives: page or chapter name. */
  group: string;
  /** Route, with #anchor for sections. */
  url: string;
  /** page | section | action */
  kind: 'page' | 'section' | 'action';
  /** Extra words that should match but are not shown. */
  keywords?: string;
}

const strip = (s: string) => s.replace(/\s+/g, ' ').trim();

export const GET: APIRoute = async () => {
  const entries: SearchEntry[] = [
    { title: 'Home', group: 'Pages', url: '/', kind: 'page', keywords: 'start pendulum hero' },
    { title: 'Projects', group: 'Pages', url: '/projects/', kind: 'page', keywords: 'case studies' },
    { title: 'About', group: 'Pages', url: '/about/', kind: 'page', keywords: 'bio cv experience education viktor' },
  ];

  const projects = (await getCollection('projects')).sort((a, b) => a.data.order - b.data.order);
  for (const p of projects) {
    const url = `/projects/${p.id}/`;
    entries.push({ title: p.data.title, group: 'Projects', url, kind: 'page', keywords: p.data.tags.join(' ') });
    const { headings } = await render(p);
    for (const h of headings.filter((h) => h.depth === 2)) {
      entries.push({ title: strip(h.text), group: p.data.title, url: `${url}#${h.slug}`, kind: 'section' });
    }
  }

  const chapters = (await getCollection('chapters')).sort((a, b) => a.data.number - b.data.number);
  for (const c of chapters) {
    const [projectId, slug] = c.id.split('/');
    const project = projects.find((p) => p.id === projectId);
    const url = `/projects/${projectId}/${slug}/`;
    const num = String(c.data.number).padStart(2, '0');
    const label = c.data.number < 10 ? `${num} · ${c.data.title}` : c.data.title;
    entries.push({ title: label, group: project?.data.title ?? projectId, url, kind: 'page', keywords: c.data.summary });
    const { headings } = await render(c);
    for (const h of headings.filter((h) => h.depth === 2 || h.depth === 3)) {
      entries.push({ title: strip(h.text), group: `${project?.data.title ?? projectId} · ${label}`, url: `${url}#${h.slug}`, kind: 'section' });
    }
  }

  return new Response(JSON.stringify(entries), { headers: { 'Content-Type': 'application/json' } });
};
