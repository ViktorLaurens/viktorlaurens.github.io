// Convert the cuas-lab report chapters (GitHub Markdown) to this site's MDX.
//
//   node scripts/convert-cuas-lab.mjs [path/to/cuas-lab/docs]
//
// The same figure-block contract as the other projects: figures become <Figure>. A figure
// whose caption links the MP4 of the same name is the key frame of an animation: it becomes
// a looping video with a .webp poster. A figure that links another MP4 (the plots that
// point to approach.mp4) stays a figure, and the video follows it as a player with controls
// and its own poster (approach.webp, a frame of the video).
// Citations link to the references chapter. Media must be copied separately:
//   cp docs/media/*.png docs/media/*.jpg docs/media/*.mp4 public/media/three-pixels-in-the-sky/
// and every animation needs a poster next to it (the PNG key frames themselves are not used
// by the site and need not be copied):
//   ffmpeg -i docs/media/<name>.png -c:v libwebp -quality 85 public/media/three-pixels-in-the-sky/<name>.webp
// The hero and the card under showcase/ are cut from the sky panel of real_tracks_video:
//   ffmpeg -i real_tracks_video.mp4 -vf crop=1152:648:24:90 -an -c:v libx264 -crf 24 showcase/hero.mp4
//   ffmpeg -ss 15.5 -i real_tracks_video.mp4 -frames:v 1 -vf crop=1152:648:24:90 -c:v libwebp -quality 85 showcase/hero.webp
//   (the same frame, scaled to 1280x720, is showcase/cards/hero.webp)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
// By default the report repository is expected next to this one.
const SRC = process.argv[2] ?? join(HERE, '..', '..', 'cuas-lab', 'docs');
const OUT = join(HERE, '..', 'src', 'content', 'chapters', 'three-pixels-in-the-sky');
const BASE = '/projects/three-pixels-in-the-sky';
const MEDIA = '/media/three-pixels-in-the-sky';
mkdirSync(OUT, { recursive: true });

const chapters = [
  { file: '01_a_tower_that_detects_drones.md', slug: '01-how-to-detect-and-locate-a-drone', summary: 'What a drone gives away, how far each sensor reaches, the four questions from a first alert to a position, and what Norway adds: darkness, weather, terrain and distance.' },
  { file: '02_seeing_a_small_drone.md', slug: '02-seeing-a-small-drone', summary: 'Two cameras on a Jetson and a real sky: a detector for targets of a few pixels with its mathematics, false alarms on an empty sky, detection against size and range, what the video encoder costs, and a classifier that did not transfer.' },
  { file: '03_hearing_a_small_drone.md', slug: '03-hearing-a-small-drone', summary: 'A Crazyflie recorded with two phones: its comb of rotor tones, a model of sound over distance, how far a detector would hear it, a bearing from two microphones, and what a dish or an array would add.' },
  { file: '04_radar_radio_and_heat.md', slug: '04-radar-radio-and-heat', summary: 'The sensors that were not available, from their physics: the radar equation and blade flashes, the link budget and how a drone\'s radio signal is found and located, and what a thermal camera sees.' },
  { file: '05_from_an_alert_to_a_position.md', slug: '05-from-an-alert-to-a-position', summary: 'Adding up weak evidence from sensors that each fail in some weather, a Kalman filter whose uncertainty is tested on real aircraft and bird tracks, and one flight followed from 3 km to the site.' },
  { file: '06_closing_in.md', slug: '06-closing-in', summary: 'Getting closer to answer what it is and exactly where: two cameras that can be pointed, a friendly drone that flies to the rough position and looks, and what comes next.' },
  { file: 'references.md', slug: 'references', number: 7, summary: 'The sources cited in the six chapters.' },
];

// Figure widths in percent of the text column. The source has every figure at 100 %; these
// follow the widths set by hand in the PDF report (report/main.tex), where a figure at half
// the page width is 70 % here and one at two thirds is 85 %. Anything not listed stays at
// the width of the source.
const WIDTH = {
  approach_sound: 70, crazyflie: 70, crazyflie_sound: 70, flyby_crazyflie: 70, hover_hold: 70,
  pasted_targets: 70, pd_by_kind: 70, pd_range_4k: 70,
  bitrate: 85, fusion_ranges: 85, reach: 85, sky_mask: 85,
};
// Animations that are not 16:9, as width / height of the MP4.
const RATIO = {
  evidence: '1600 / 760', passby: '1600 / 700', micro_doppler_rotor: '1600 / 640',
  tracker_blackout: '1680 / 800',
};

// A plot that links a video of another name keeps its place, and the video follows it as a
// player with controls, because it has sound. Its caption, by the name of the plot.
const PLAYER = {
  pd_range: 'One of these clips as a video: three drones, one per contrast, drawn into the recording and flying in. Circles mark where each drone really is and green boxes where the detector has confirmed it.',
  approach_sound: 'The same approach with its sound track: the recorded hover, carried along each flight by the model. The tones stay faint until the last hundred metres. Press play to hear it.',
};

const slugFor = (file) => chapters.find((c) => c.file === file)?.slug;
const warnings = [];

for (const ch of chapters) {
  let md = readFileSync(join(SRC, ch.file), 'utf8').replace(/^\uFEFF/, '');

  const h1 = md.match(/^# (?:(\d+) · )?(.+)$/m);
  if (!h1) throw new Error(`no H1 in ${ch.file}`);
  const number = ch.number ?? Number(h1[1]);
  const title = h1[2].trim();
  md = md.replace(/^# .+\r?\n(\r?\n)*/m, '');

  // figure blocks
  md = md.replace(
    /<div align="center">\s*<img src="media\/([^"]+)\.(png|jpg)" width="(\d+)%" alt="([^"]*)">\s*([\s\S]*?)<\/div>/g,
    (_, name, ext, width, alt, caption) => {
      const mp4 = caption.match(/<a href="media\/([^"]+)\.mp4">MP4<\/a>/);
      const animated = mp4 && mp4[1] === name;
      caption = caption.replace(/\s*·\s*<a href="media\/[^"]+\.mp4">MP4<\/a>/g, '').trim();
      const player = mp4 && !animated
        ? `

<Figure video="${MEDIA}/${mp4[1]}.mp4" poster="${MEDIA}/${mp4[1]}.webp" controls width={100} alt="The sky recording with three small drones drawn in, each marked by a circle, and a green box where the detector has confirmed one">

${PLAYER[name] ?? "The video of this figure."}

</Figure>`
        : "";
      const safeAlt = alt.replace(/"/g, '&quot;');
      const ratio = animated && RATIO[name] ? ` ratio="${RATIO[name]}"` : '';
      const srcAttr = animated
        ? `video="${MEDIA}/${name}.mp4" poster="${MEDIA}/${name}.webp"${ratio}`
        : `src="${MEDIA}/${name}.${ext}"`;
      const body = caption ? `\n\n${caption}\n\n` : '';
      return `<Figure ${srcAttr} width={${animated ? 100 : WIDTH[name] ?? width}} alt="${safeAlt}">${body}</Figure>${player}`;
    },
  );

  // links
  md = md.replace(/\[Back to the index\]\(README\.md\)\s*$/m, `**Back to the [project page](${BASE}/).**`);
  md = md.replace(/\]\(README\.md(#[^)]*)?\)/g, (m, anchor) => `](${BASE}/${anchor ?? ''})`);
  md = md.replace(/\]\(references\.md\)/g, `](${BASE}/references/)`);
  md = md.replace(/\[([^\]]+)\]\((\d\d_[a-z_]+\.md)(#[^)]*)?\)/g, (m, text, file, anchor) => {
    const s = slugFor(file);
    if (!s) { warnings.push(`${ch.file}: unknown chapter link ${file}`); return m; }
    return `[${text}](${BASE}/${s}/${anchor ?? ''})`;
  });
  // bare URLs in angle brackets (the reference list) are not valid MDX
  md = md.replace(/<(https?:\/\/[^>\s]+)>/g, '[$1]($1)');

  // MDX: a bare "<" before a digit or a space is parsed as JSX
  md = md.replace(/(^|[^\\$`<])<(?=\s|\d)/gm, '$1\\<');

  for (const tag of ['<img', '<div', '<a ']) {
    const n = (md.match(new RegExp(tag, 'g')) || []).length;
    if (n) warnings.push(`${ch.file}: ${n} leftover ${tag}`);
  }
  if (/\]\((README|\d\d_|references\.md)/.test(md)) warnings.push(`${ch.file}: leftover report link`);

  const imports = "import Figure from '../../../components/Figure.astro';";
  const fm = `---\nproject: three-pixels-in-the-sky\nnumber: ${number}\ntitle: "${title.replace(/"/g, '\\"')}"\nsummary: "${ch.summary.replace(/"/g, '\\"')}"\n---\n${imports}\n\n`;
  writeFileSync(join(OUT, `${ch.slug}.mdx`), fm + md.trimEnd() + '\n');
  console.log(`${String(number).padStart(2, '0')} ${ch.slug}: ${md.length} chars, ${(md.match(/<Figure/g) || []).length} figures`);
}
if (warnings.length) { console.log('WARNINGS'); warnings.forEach((w) => console.log(' -', w)); process.exitCode = 1; } else { console.log('no warnings'); }
