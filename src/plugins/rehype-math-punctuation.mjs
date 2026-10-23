/**
 * Keeps punctuation attached to inline math, so "$L = 1$;" never leaves the ";" alone at the
 * start of the next line (or a "(" alone at the end of the previous one).
 *
 * A browser may always break between KaTeX's inline-block pieces and the text around them,
 * and neither `white-space: nowrap` on a wrapper nor a word joiner prevents it. So the
 * punctuation is moved inside the first or last piece of the formula, in a span that
 * global.css sets back to the body font and size. Runs after rehype-katex.
 */
const TRAILING = /^[.,;:!?)\]’”…]+/;
const LEADING = /[(\[‘“]+$/;

const hasClass = (node, name) => node?.type === 'element' && (node.properties?.className ?? []).includes(name);
const punct = (value) => ({ type: 'element', tagName: 'span', properties: { className: ['math-punct'] }, children: [{ type: 'text', value }] });

/** The visible pieces ("bases") of an inline formula: span.katex > span.katex-html > span.base */
function bases(katex) {
  const html = katex.children.find((c) => hasClass(c, 'katex-html'));
  return html ? html.children.filter((c) => hasClass(c, 'base')) : [];
}

function walk(node) {
  if (!node.children || hasClass(node, 'katex-display')) return;
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    if (!hasClass(child, 'katex')) { walk(child); continue; }
    const pieces = bases(child);
    if (!pieces.length) continue;
    const next = node.children[i + 1];
    const trail = next?.type === 'text' && next.value.match(TRAILING);
    if (trail) {
      pieces[pieces.length - 1].children.push(punct(trail[0]));
      next.value = next.value.slice(trail[0].length);
    }
    const prev = node.children[i - 1];
    const lead = prev?.type === 'text' && prev.value.match(LEADING);
    if (lead) {
      pieces[0].children.unshift(punct(lead[0]));
      prev.value = prev.value.slice(0, -lead[0].length);
    }
  }
}

export default function rehypeMathPunctuation() {
  return (tree) => walk(tree);
}
