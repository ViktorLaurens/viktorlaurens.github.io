/**
 * Social preview images, one per page, rendered at build time with satori + resvg.
 * /og/home.png, /og/about.png, /og/projects.png, /og/projects/<project>.png,
 * /og/projects/<project>/<chapter>.png, /og/404.png
 */
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const W = 1200, H = 630;
const C = { bg: '#0a0b0e', panel: '#000000', fg: '#ececec', muted: '#9a9a9a', faint: '#5a5f68', line: '#22262e', accent: '#58c4dd', yellow: '#f7d96f' };

// Read from the project root: at build time this module runs from a bundled chunk in dist/.
const ROOT = process.cwd();
const fontFile = (name: string) => readFileSync(join(ROOT, 'src', 'assets', 'fonts', name));
const fonts = [
  { name: 'Plex', data: fontFile('IBMPlexSans-Regular.ttf'), weight: 400 as const, style: 'normal' as const },
  { name: 'Plex', data: fontFile('IBMPlexSans-SemiBold.ttf'), weight: 600 as const, style: 'normal' as const },
  { name: 'Mono', data: fontFile('IBMPlexMono-Regular.ttf'), weight: 400 as const, style: 'normal' as const },
];

interface Card { eyebrow: string; title: string; summary: string; image?: string }

const publicImage = (path: string): string | undefined => {
  const file = join(ROOT, 'public', path);
  if (!existsSync(file)) return undefined;
  return `data:image/png;base64,${readFileSync(file).toString('base64')}`;
};
const portrait = `data:image/jpeg;base64,${readFileSync(join(ROOT, 'src', 'assets', 'portrait.jpg')).toString('base64')}`;
const PHASE = '/media/pendulum-lab/phase_portrait.png';

const firstPng = (body: string | undefined): string | undefined => body?.match(/src="(\/media\/[^"]+\.png)"/)?.[1];
const clamp = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s);

export async function getStaticPaths() {
  const projects = await getCollection('projects');
  const chapters = await getCollection('chapters');
  const cards: Array<{ params: { slug: string }; props: Card }> = [
    { params: { slug: 'home' }, props: { eyebrow: 'Viktor Laurens De Groote · Brussels', title: 'Engineer in control, learning, perception and robotics.', summary: 'Identifying dynamics from data, estimating state in real time, and designing controllers you can trust. With a live pendulum.', image: publicImage(PHASE) } },
    { params: { slug: 'about' }, props: { eyebrow: 'About', title: 'Viktor Laurens De Groote', summary: 'From the Lorenz attractor at sixteen to visual-inertial SLAM on building sites: control, learning, perception and robotics.', image: portrait } },
    { params: { slug: 'projects' }, props: { eyebrow: 'Projects', title: 'Case studies', summary: 'Each project is a question, a method, and the results it found, shown in figures you can see and play with.', image: publicImage(PHASE) } },
    { params: { slug: '404' }, props: { eyebrow: '404 · unstable equilibrium', title: 'This one fell over.', summary: 'The page you asked for is not a fixed point of this site.', image: publicImage(PHASE) } },
  ];
  for (const p of projects) {
    const cover = p.data.coverVideo?.replace(/\.mp4$/, '.png');
    cards.push({ params: { slug: `projects/${p.id}` }, props: { eyebrow: `Project · ${p.data.date.getFullYear()}`, title: p.data.title, summary: p.data.summary, image: (cover && publicImage(cover)) || publicImage(PHASE) } });
  }
  for (const c of chapters) {
    const [projectId, chapterSlug] = c.id.split('/');
    const project = projects.find((p) => p.id === projectId);
    const num = String(c.data.number).padStart(2, '0');
    cards.push({ params: { slug: `projects/${projectId}/${chapterSlug}` }, props: { eyebrow: `${project?.data.title ?? projectId} · ${c.data.number < 10 ? `Chapter ${num}` : 'Gallery'}`, title: c.data.title, summary: c.data.summary, image: publicImage(firstPng(c.body) ?? PHASE) } });
  }
  return cards;
}

const el =(type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}) => ({ type, props: { style, children, ...extra } });

function card({ eyebrow, title, summary, image }: Card) {
  const long = title.length > 34;
  const mark = el('svg', { width: 44, height: 44 }, [
    el('line', {}, undefined, { x1: 22, y1: 7, x2: 32, y2: 31, stroke: C.fg, strokeWidth: 2.4, strokeLinecap: 'round' }),
    el('circle', {}, undefined, { cx: 22, cy: 7, r: 2.8, fill: C.fg }),
    el('circle', {}, undefined, { cx: 32, cy: 31, r: 6.5, fill: C.accent }),
  ], { viewBox: '0 0 44 44' });

  return el('div', { width: W, height: H, display: 'flex', background: C.bg, color: C.fg, fontFamily: 'Plex', padding: 56 }, [
    el('div', { display: 'flex', flexDirection: 'column', flex: 1, paddingRight: 48, justifyContent: 'space-between' }, [
      el('div', { display: 'flex', flexDirection: 'column' }, [
        el('div', { fontFamily: 'Mono', fontSize: 21, letterSpacing: 3, textTransform: 'uppercase', color: C.accent, marginBottom: 26 }, clamp(eyebrow, 46)),
        el('div', { fontSize: long ? 52 : 64, fontWeight: 600, lineHeight: 1.08, letterSpacing: -1.5, marginBottom: 24 }, clamp(title, 70)),
        el('div', { fontSize: 25, lineHeight: 1.4, color: C.muted }, clamp(summary, 165)),
      ]),
      el('div', { display: 'flex', alignItems: 'center' }, [
        mark,
        el('div', { display: 'flex', flexDirection: 'column', marginLeft: 14 }, [
          el('div', { fontSize: 22, fontWeight: 600 }, 'Viktor Laurens De Groote'),
          el('div', { fontFamily: 'Mono', fontSize: 18, color: C.faint }, 'viktorlaurens.github.io'),
        ]),
      ]),
    ]),
    el('div', { display: 'flex', width: 480, height: H - 112, borderRadius: 18, border: `1px solid ${C.line}`, background: C.panel, overflow: 'hidden' },
      image ? [el('img', { width: 480, height: H - 112, objectFit: 'cover' }, undefined, { src: image })] : []),
  ]);
}

export const GET: APIRoute = async ({ props }) => {
  const svg = await satori(card(props as Card) as never, { width: W, height: H, fonts });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' } });
};
