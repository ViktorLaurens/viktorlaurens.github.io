import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeMathPunctuation from './src/plugins/rehype-math-punctuation.mjs';

export default defineConfig({
  site: 'https://viktorlaurens.github.io',
  integrations: [mdx()],
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex, rehypeMathPunctuation],
    shikiConfig: { theme: 'github-dark-default' },
  },
});
