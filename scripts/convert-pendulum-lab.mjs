// Convert the pendulum-lab report chapters (GitHub Markdown) to this site's MDX.
//
//   node scripts/convert-pendulum-lab.mjs [path/to/pendulum-lab/docs]
//
// Figures become <Figure>, GIFs become looping MP4s, links into the (private)
// repository are flattened to plain text, and the live demos are inserted at
// fixed anchors. Media must be copied separately:
//   cp docs/media/*.png docs/media/*.mp4 public/media/pendulum-lab/
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = process.argv[2] ?? 'C:/Users/vikto/dev/personal/pendulum-lab/docs';
const OUT = join(HERE, '..', 'src', 'content', 'chapters', 'pendulum-lab');
const BASE = '/projects/pendulum-lab';
const MEDIA = '/media/pendulum-lab';

const chapters = [
  { file: '01_simple_pendulum.md', slug: '01-simple-pendulum', summary: 'The forward problem: equation of motion, the small-angle approximation and where it breaks, state space, fixed points and the phase flow.' },
  { file: '02_measurements_and_identification.md', slug: '02-measurements-and-identification', summary: 'A sensor model with outliers, then four ways to recover the parameters from a recording: regression, SINDy, output-error least squares and Bayesian inference with MCMC.' },
  { file: '03_learning_based_identification.md', slug: '03-learning-based-identification', summary: 'The same question with flexible model classes: a plain network, a physics-informed neural network, a Neural ODE, and physics with a learned residual.' },
  { file: '04_identification_benchmark.md', slug: '04-identification-benchmark', summary: 'All identification methods on the same frozen data, then stress tests: shorter recordings, more noise, more outliers, and a model that is wrong.' },
  { file: '05_state_estimation.md', slug: '05-state-estimation', summary: 'Real-time estimates from angle measurements: Kalman, extended and unscented filters, outlier gating, consistency, online parameters and the RTS smoother.' },
  { file: '06_furuta_pendulum.md', slug: '06-furuta-pendulum', summary: 'The same questions for an underactuated system: equations of motion, a fixed-step simulator, experiment design, identification, model mismatch and estimation for control.' },
  { file: '07_control.md', slug: '07-control-with-guarantees', summary: 'Why simple control fails, then LQR and LQG with a region of attraction, energy-based swing-up, trajectory optimisation with TVLQR, robustness and adaptation, constrained and nonlinear MPC, and safety filters.' },
  { file: '08_hybrid_learning_control.md', slug: '08-hybrid-learning-and-control', summary: 'Reinforcement learning from scratch and made safe, learning-enhanced MPC, residual RL, certifying a learned controller, learning to tune, and the step from the pendulum to underwater manipulation.' },
  { file: '09_underwater_manipulator.md', slug: '09-underwater-manipulator', summary: 'The whole programme on a harder system: a thruster-driven underwater manipulator, its model and identification, model-based control, safety, learning, and what scaled and what did not.' },
  { file: 'gallery.md', slug: 'controller-gallery', number: 10, summary: 'Every controller of chapters 7 and 8 side by side on the same pendulum: swinging up, balancing through a push, and carrying a 50 g payload.' },
];

/**
 * Live demos. Each is inserted just before the first occurrence of `before`
 * that follows the anchor `after` (a media file name) in the chapter text.
 */
const inserts = {
  '01_simple_pendulum.md': [
    {
      after: 'damping_tweak.mp4',
      before: '## 1.6 Phase flow',
      component: 'PhasePortraitDemo',
      intro: "The report's animation sweeps μ once. Here the field is live: change the damping or the natural frequency, and release your own pendulums from any state.",
    },
  ],
  '05_state_estimation.md': [
    {
      after: 'gating_lockout.png',
      before: '### What we learned',
      component: 'KalmanDemo',
      intro: 'Sections 5.2 to 5.4 in one live loop: a pendulum measured at 100 Hz through a noisy, outlier-prone angle sensor, and a filter estimating its state. Try the linear filter on a large swing, raise the outlier rate with the gate off, and push q to both extremes.',
    },
  ],
};

const slugFor = (file) => chapters.find((c) => c.file === file)?.slug;
const warnings = [];

for (const ch of chapters) {
  let md = readFileSync(join(SRC, ch.file), 'utf8').replace(/^\uFEFF/, '');

  // title from the H1 "N · Title" (or a plain title)
  const h1 = md.match(/^# (?:(\d+) · )?(.+)$/m);
  if (!h1) throw new Error(`no H1 in ${ch.file}`);
  const number = ch.number ?? Number(h1[1]);
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
      const srcAttr = ext === 'gif' ? `video="${MEDIA}/${name}.mp4"` : `src="${MEDIA}/${name}.png"`;
      const body = caption ? `\n\n${caption}\n\n` : '';
      return `<Figure ${srcAttr} width={${width}} alt="${safeAlt}">${body}</Figure>`;
    },
  );

  // links
  md = md.replace(/\]\(README\.md#the-storyline[^)]*\)/g, `](${BASE}/#the-storyline-one-problem-four-questions)`);
  md = md.replace(/\]\(README\.md\)/g, `](${BASE}/)`);
  md = md.replace(/\]\(gallery\.md(#[^)]*)?\)/g, (m, anchor) => `](${BASE}/controller-gallery/${anchor ?? ''})`);
  md = md.replace(/\[([^\]]+)\]\((\d\d_[a-z_]+\.md)(#[^)]*)?\)/g, (m, text, file, anchor) => {
    const s = slugFor(file);
    if (!s) { warnings.push(`${ch.file}: unknown chapter link ${file}`); return m; }
    return `[${text}](${BASE}/${s}/${anchor ?? ''})`;
  });
  // links into the (private) repository: keep the text, drop the link
  md = md.replace(/\[([^\]]+)\]\(\.\.\/[^)]*\)/g, '$1');
  // sentence that no longer applies
  md = md.replace(/Every animation is also available as a 1080p MP4 \(linked under each GIF\)\.\s*/g, '');
  md = md.replace(/\s*\(linked under each GIF\)/g, '');

  // live demos
  const extraImports = [];
  for (const ins of inserts[ch.file] ?? []) {
    const a = md.indexOf(ins.after);
    const b = a >= 0 ? md.indexOf(ins.before, a) : -1;
    if (b < 0) { warnings.push(`${ch.file}: anchor not found for ${ins.component}`); continue; }
    md = `${md.slice(0, b)}${ins.intro}\n\n<${ins.component} />\n\n${md.slice(b)}`;
    extraImports.push(`import ${ins.component} from '../../../components/${ins.component}.astro';`);
  }

  // leftovers
  for (const tag of ['<img', '<div', '<a ']) {
    const n = (md.match(new RegExp(tag, 'g')) || []).length;
    if (n) warnings.push(`${ch.file}: ${n} leftover ${tag}`);
  }
  if (/\]\(\.\.\//.test(md)) warnings.push(`${ch.file}: leftover ../ link`);
  if (/\]\((README|gallery|\d\d_)/.test(md)) warnings.push(`${ch.file}: leftover report link`);

  const imports = ["import Figure from '../../../components/Figure.astro';", ...extraImports].join('\n');
  const fm = `---\nproject: pendulum-lab\nnumber: ${number}\ntitle: "${title.replace(/"/g, '\\"')}"\nsummary: "${ch.summary.replace(/"/g, '\\"')}"\n---\n${imports}\n\n`;
  writeFileSync(join(OUT, `${ch.slug}.mdx`), fm + md.trimEnd() + '\n');
  console.log(`${String(number).padStart(2, '0')} ${ch.slug}: ${md.length} chars, ${(md.match(/<Figure/g) || []).length} figures${extraImports.length ? `, ${extraImports.length} demo` : ''}`);
}
if (warnings.length) { console.log('WARNINGS'); warnings.forEach((w) => console.log(' -', w)); process.exitCode = 1; } else { console.log('no warnings'); }
