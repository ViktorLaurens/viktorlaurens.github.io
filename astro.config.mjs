import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeMathPunctuation from './src/plugins/rehype-math-punctuation.mjs';

import { readdirSync } from 'node:fs';

// The projects were renamed; the old URLs keep working.
const RENAMED = {
  'pendulum-lab': 'furuta-pendulum',
  'arm-lab': 'manipulation',
  'subsea-lab': 'underwater-manipulation',
  'thermal-lab': 'where-the-heat-is',
};
// Only pendulum-lab had published chapters under its old name.
const OLD_CHAPTERS = readdirSync('./src/content/chapters/furuta-pendulum')
  .filter((f) => f.endsWith('.mdx'))
  .map((f) => f.replace(/\.mdx$/, ''));
const redirects = Object.fromEntries([
  ...Object.entries(RENAMED).map(([from, to]) => [`/projects/${from}`, `/projects/${to}/`]),
  ...OLD_CHAPTERS.map((c) => [`/projects/pendulum-lab/${c}`, `/projects/furuta-pendulum/${c}/`]),
]);

export default defineConfig({
  site: 'https://viktorlaurens.github.io',
  redirects,
  integrations: [mdx()],
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex, rehypeMathPunctuation],
    shikiConfig: { theme: 'github-dark-default' },
  },
});
