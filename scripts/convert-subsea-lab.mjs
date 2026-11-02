// Convert the subsea-lab report chapters (GitHub Markdown) to this site's MDX.
//
//   node scripts/convert-subsea-lab.mjs [path/to/subsea-lab/docs]
//
// The same figure-block contract as pendulum-lab: figures become <Figure>, GIFs become
// looping MP4s, links into the (private) repository are flattened to plain text, chapter
// links are rewritten. Media must be copied separately:
//   cp docs/media/*.png docs/media/*.mp4 public/media/subsea-lab/
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = process.argv[2] ?? 'C:/Users/vikto/dev/personal/subsea-lab/docs';
const OUT = join(HERE, '..', 'src', 'content', 'chapters', 'subsea-lab');
const BASE = '/projects/subsea-lab';
const MEDIA = '/media/subsea-lab';

const chapters = [
  { file: '01_the_system.md', slug: '01-the-system', summary: 'The vehicle and the arm in three dimensions: Fossen per body, Kane over the chain, a compiled CasADi twin; why yaw has no spring, why the textbook model is twice too fast, and which coefficients the tip is sensitive to.' },
  { file: '02_identification.md', slug: '02-identification', summary: 'Safe active identification: experiments designed to stay inside a box in a current, output error against regression against the Cramér–Rao bound, and what a held-out mission says about the model.' },
  { file: '03_navigation.md', slug: '03-navigation', summary: 'One manifold Kalman filter, two error maps: position, heading without a compass, the current and the force at the jaws, under a gust, an outage and a wrong heading; the tip floor the estimate sets.' },
  { file: '04_camera.md', slug: '04-camera', summary: 'What the camera buys: a pose relative to the structure from a rendered underwater image, a conformal error bound by apparent size and turbidity, and a gate that makes the bound usable in the filter.' },
  { file: '05_wholebody.md', slug: '05-whole-body-control', summary: 'Who should move: a stock autopilot, a set-based task-priority scheme and a whole-body NMPC on one mission, the solve time against the budget, and the grasp as a MuJoCo contact beside the plant.' },
  { file: '06_barriers.md', slug: '06-barriers', summary: 'Safety when the safe state moves: barriers in the structure frame under a current, the reach budget, the perception bound as a breathing margin, and what breaks the barrier.' },
  { file: '07_learned.md', slug: '07-learning-inside-the-physics', summary: 'The residual after identification is the object: three numbers, a free network, a passive-by-construction model with a certificate and a Gaussian process, off the data and inside an optimizer.' },
  { file: '08_adaptation.md', slug: '08-adapting-after-the-grasp', summary: 'Physics, structure or context: four adapters on a stream from the raw sensors, on objects inside and outside a training distribution, and inside the NMPC.' },
  { file: '09_gallery.md', slug: '09-controller-gallery', summary: 'How much model safe underwater manipulation needs: eight controllers, from no model to a model re-identified online and three learned policies, on one mission and a grid of what none was told.' },
  { file: '10_monitors.md', slug: '10-finding-out-the-model-is-wrong', summary: 'Monitors with a detection time against a time to harm: a gust from the filter\'s innovations, an object heavier than planned from the energy balance and the adapter, and the closing summary of the report.' },
];

const slugFor = (file) => chapters.find((c) => c.file === file)?.slug;
const warnings = [];

for (const ch of chapters) {
  let md = readFileSync(join(SRC, ch.file), 'utf8').replace(/^\uFEFF/, '');

  const h1 = md.match(/^# (?:(\d+) · )?(.+)$/m);
  if (!h1) throw new Error(`no H1 in ${ch.file}`);
  const number = Number(h1[1]);
  const title = h1[2].trim();
  md = md.replace(/^# .+\r?\n(\r?\n)*/m, '');

  // figure blocks
  md = md.replace(
    /<div align="center">\s*<img src="media\/([^"]+)\.(gif|png)" width="(\d+)%" alt="([^"]*)">\s*([\s\S]*?)<\/div>/g,
    (_, name, ext, width, alt, caption) => {
      caption = caption
        .replace(/\s*·\s*<a href="media\/[^"]+\.mp4">MP4<\/a>/g, '')
        .replace(/<a href="media\/[^"]+\.mp4">MP4<\/a>/g, '')
        .trim();
      const safeAlt = alt.replace(/"/g, '&quot;');
      const srcAttr = ext === 'gif'
        ? `video="${MEDIA}/${name}.mp4" poster="${MEDIA}/${name}_poster.webp"`
        : `src="${MEDIA}/${name}.png"`;
      const body = caption ? `\n\n${caption}\n\n` : '';
      return `<Figure ${srcAttr} width={${width}} alt="${safeAlt}">${body}</Figure>`;
    },
  );

  // links
  md = md.replace(/\]\(README\.md(#[^)]*)?\)/g, (m, anchor) => `](${BASE}/${anchor ?? ''})`);
  md = md.replace(/\[([^\]]+)\]\((\d\d_[a-z_]+\.md)(#[^)]*)?\)/g, (m, text, file, anchor) => {
    const s = slugFor(file);
    if (!s) { warnings.push(`${ch.file}: unknown chapter link ${file}`); return m; }
    return `[${text}](${BASE}/${s}/${anchor ?? ''})`;
  });
  // links into the (private) repository: keep the text, drop the link
  md = md.replace(/\[([^\]]+)\]\(\.\.\/[^)]*\)/g, '$1');
  md = md.replace(/\[`([^`]+)`\]\(\.\.\/[^)]*\)/g, '`$1`');
  // the final "Back to the report index" line becomes a link to the project page
  md = md.replace(/\*\*Back to the \[report index\]\([^)]*\)\.\*\*\s*$/m, `**Back to the [project page](${BASE}/).**`);

  // MDX: a bare "<" before a digit or a space is parsed as JSX; the chapters write "< 0.3"
  md = md.replace(/(^|[^\\$`<])<(?=\s|\d)/gm, '$1\\<');

  for (const tag of ['<img', '<div', '<a ']) {
    const n = (md.match(new RegExp(tag, 'g')) || []).length;
    if (n) warnings.push(`${ch.file}: ${n} leftover ${tag}`);
  }
  if (/\]\(\.\.\//.test(md)) warnings.push(`${ch.file}: leftover ../ link`);
  if (/\]\((README|\d\d_)/.test(md)) warnings.push(`${ch.file}: leftover report link`);

  const imports = "import Figure from '../../../components/Figure.astro';";
  const fm = `---\nproject: subsea-lab\nnumber: ${number}\ntitle: "${title.replace(/"/g, '\\"')}"\nsummary: "${ch.summary.replace(/"/g, '\\"')}"\n---\n${imports}\n\n`;
  writeFileSync(join(OUT, `${ch.slug}.mdx`), fm + md.trimEnd() + '\n');
  console.log(`${String(number).padStart(2, '0')} ${ch.slug}: ${md.length} chars, ${(md.match(/<Figure/g) || []).length} figures`);
}
if (warnings.length) { console.log('WARNINGS'); warnings.forEach((w) => console.log(' -', w)); process.exitCode = 1; } else { console.log('no warnings'); }
