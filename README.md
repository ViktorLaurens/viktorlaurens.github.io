# viktorlaurens.github.io

Personal site of Viktor Laurens De Groote: case studies in control, learning and robotics.
Live at <https://viktorlaurens.github.io>. Concept and design rules: [CONCEPT.md](CONCEPT.md).

## Stack

Astro + MDX, KaTeX for math, hand-written CSS with design tokens, vanilla TypeScript canvas
simulations. Deployed to GitHub Pages by the workflow in `.github/workflows/deploy.yml` on every
push to `main`.

## Develop

Requires Node 20+ (this machine uses [fnm](https://github.com/Schniz/fnm)).

```
npm install
npm run dev       # http://localhost:4321
npm run build     # static output in dist/
npm run preview   # serve dist/
npm run check     # type-check .astro and .ts
```

## Structure

```
src/pages/           routes (index, projects, about, 404)
src/content/projects case studies, one MDX file each (schema in src/content.config.ts)
src/components/      Nav, Footer, ProjectCard, PendulumHero
src/sim/             physics + rendering for the live simulations
src/styles/          tokens.css (colours, type, spacing) and global.css
public/              static files: cv.pdf, favicon.svg
```
