/**
 * Interactive phase portrait of the damped pendulum (Pendulum Lab, chapter 1).
 * Click anywhere in the unwrapped state space to release a trajectory; the sliders
 * change μ and ω₀² and the vector field re-draws at once.
 */
import { readPalette, type Palette } from './pendulum';

export interface PhaseHandle {
  setMu(mu: number): void;
  setW0sq(w: number): void;
  addTrajectory(theta: number, omega: number): void;
  seedRandom(n: number): void;
  clear(): void;
  destroy(): void;
}

const TH_RANGE = 2 * Math.PI; // half range of θ shown (unwrapped)
const OM_RANGE = 8; // half range of θ̇ shown
const DT = 1 / 240;
const MAX_TRAJ = 14;
const MAX_PTS = 2400;
const FIELD_STOPS = [
  [0x23, 0x6b, 0x8e],
  [0x58, 0xc4, 0xdd],
  [0x5c, 0xd0, 0xb3],
  [0xf7, 0xd9, 0x6f],
];

function fieldColor(t: number, alpha = 1): string {
  const x = Math.min(1, Math.max(0, t)) * (FIELD_STOPS.length - 1);
  const i = Math.min(FIELD_STOPS.length - 2, Math.floor(x));
  const f = x - i;
  const a = FIELD_STOPS[i], b = FIELD_STOPS[i + 1];
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * f));
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}

interface Traj { pts: Array<[number, number]>; th: number; om: number; alive: boolean; born: number }

export function mountPhase(canvas: HTMLCanvasElement): PhaseHandle {
  const ctx = canvas.getContext('2d')!;
  let mu = 0.25, w0sq = 9.81;
  let palette: Palette = readPalette(canvas);
  let width = 0, height = 0, dpr = 1;
  let plot = { x: 0, y: 0, w: 0, h: 0 };
  let field: HTMLCanvasElement | null = null;
  let running = true, visible = true, last = 0;
  const trajs: Traj[] = [];
  let paintTimer = 0;
  let painting = false;

  const accel = (th: number, om: number) => -w0sq * Math.sin(th) - mu * om;

  function step(t: Traj, dt: number) {
    const { th, om } = t;
    const k1t = om, k1w = accel(th, om);
    const k2t = om + 0.5 * dt * k1w, k2w = accel(th + 0.5 * dt * k1t, om + 0.5 * dt * k1w);
    const k3t = om + 0.5 * dt * k2w, k3w = accel(th + 0.5 * dt * k2t, om + 0.5 * dt * k2w);
    const k4t = om + dt * k3w, k4w = accel(th + dt * k3t, om + dt * k3w);
    t.th = th + (dt / 6) * (k1t + 2 * k2t + 2 * k3t + k4t);
    t.om = om + (dt / 6) * (k1w + 2 * k2w + 2 * k3w + k4w);
  }

  function toPx(th: number, om: number): [number, number] {
    return [plot.x + ((th + TH_RANGE) / (2 * TH_RANGE)) * plot.w, plot.y + ((OM_RANGE - om) / (2 * OM_RANGE)) * plot.h];
  }
  function toState(px: number, py: number): [number, number] {
    return [((px - plot.x) / plot.w) * 2 * TH_RANGE - TH_RANGE, OM_RANGE - ((py - plot.y) / plot.h) * 2 * OM_RANGE];
  }

  function layout() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, Math.round(rect.width));
    height = Math.round(Math.max(260, Math.min(520, width * 0.56)));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    plot = { x: 40, y: 14, w: width - 54, h: height - 46 };
    buildField();
  }

  function buildField() {
    field = document.createElement('canvas');
    field.width = Math.round(plot.w * dpr);
    field.height = Math.round(plot.h * dpr);
    const f = field.getContext('2d')!;
    f.setTransform(dpr, 0, 0, dpr, 0, 0);
    const nx = Math.max(16, Math.round(plot.w / 24));
    const ny = Math.max(10, Math.round(plot.h / 24));
    // speed normalisation: largest |f| on the grid
    let vmax = 1e-9;
    const cells: Array<[number, number, number, number]> = [];
    for (let i = 0; i <= nx; i++) {
      for (let j = 0; j <= ny; j++) {
        const th = -TH_RANGE + (2 * TH_RANGE * i) / nx;
        const om = OM_RANGE - (2 * OM_RANGE * j) / ny;
        const vx = (om / (2 * TH_RANGE)) * plot.w;
        const vy = (-accel(th, om) / (2 * OM_RANGE)) * plot.h;
        const n = Math.hypot(vx, vy);
        vmax = Math.max(vmax, n);
        cells.push([i, j, vx, vy]);
      }
    }
    f.lineWidth = 1.1;
    f.lineCap = 'round';
    for (const [i, j, vx, vy] of cells) {
      const n = Math.hypot(vx, vy) || 1e-9;
      const t = Math.sqrt(n / vmax);
      const len = 5 + 6 * t;
      const x = (i / nx) * plot.w, y = (j / ny) * plot.h;
      const ux = vx / n, uy = vy / n;
      const col = fieldColor(t, 0.55);
      f.strokeStyle = col; f.fillStyle = col;
      f.beginPath(); f.moveTo(x - ux * len * 0.5, y - uy * len * 0.5); f.lineTo(x + ux * len * 0.5, y + uy * len * 0.5); f.stroke();
      // arrow head
      const hx = x + ux * len * 0.5, hy = y + uy * len * 0.5;
      f.beginPath();
      f.moveTo(hx, hy);
      f.lineTo(hx - ux * 3.5 - uy * 2.2, hy - uy * 3.5 + ux * 2.2);
      f.lineTo(hx - ux * 3.5 + uy * 2.2, hy - uy * 3.5 - ux * 2.2);
      f.closePath(); f.fill();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    const { x, y, w, h } = plot;
    if (field) ctx.drawImage(field, x, y, w, h);
    const mono = getComputedStyle(canvas).getPropertyValue('--font-mono') || 'monospace';

    // axes and ticks
    ctx.strokeStyle = palette.line; ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    const [ox, oy] = toPx(0, 0);
    ctx.beginPath(); ctx.moveTo(x, oy); ctx.lineTo(x + w, oy); ctx.moveTo(ox, y); ctx.lineTo(ox, y + h); ctx.stroke();
    ctx.fillStyle = palette.muted; ctx.font = `500 11px ${mono}`; ctx.textAlign = 'center';
    for (const [v, label] of [[-2 * Math.PI, '−2π'], [-Math.PI, '−π'], [0, '0'], [Math.PI, 'π'], [2 * Math.PI, '2π']] as Array<[number, string]>) {
      const [tx] = toPx(v, 0);
      ctx.fillText(label, tx, y + h + 15);
    }
    ctx.fillText('θ  [rad]', x + w / 2, y + h + 29);
    ctx.textAlign = 'right';
    for (const v of [-8, -4, 0, 4, 8]) { const [, ty] = toPx(0, v); ctx.fillText(String(v), x - 6, ty + 4); }
    ctx.save(); ctx.translate(11, y + h / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillText('θ̇  [rad/s]', 0, 0); ctx.restore();

    // fixed points
    for (let k = -2; k <= 2; k++) {
      const [fx, fy] = toPx(k * Math.PI, 0);
      ctx.beginPath(); ctx.arc(fx, fy, 4.5, 0, Math.PI * 2);
      if (k % 2 === 0) { ctx.fillStyle = palette.fg; ctx.fill(); }
      else { ctx.strokeStyle = palette.red; ctx.lineWidth = 1.6; ctx.stroke(); }
    }

    // trajectories
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const t of trajs) {
      const n = t.pts.length;
      if (n < 2) continue;
      const stride = Math.max(1, Math.floor(n / 600));
      for (let i = stride; i < n; i += stride) {
        const [a, b] = t.pts[i - stride], [c, d] = t.pts[i];
        const [ax, ay] = toPx(a, b), [cx, cy] = toPx(c, d);
        ctx.globalAlpha = 0.12 + 0.88 * (i / n) ** 1.5;
        ctx.strokeStyle = palette.accent;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(cx, cy); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const [hx, hy] = toPx(t.th, t.om);
      ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2); ctx.fillStyle = palette.yellow; ctx.fill();
    }
    ctx.restore();

    // pendulum inset for the newest trajectory
    const newest = trajs[trajs.length - 1];
    const r = Math.min(34, h * 0.14), cx = x + w - r - 16, cy = y + r + 16;
    ctx.beginPath(); ctx.arc(cx, cy, r + 8, 0, Math.PI * 2); ctx.fillStyle = palette.bg; ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.strokeStyle = palette.line; ctx.setLineDash([2, 4]); ctx.stroke(); ctx.setLineDash([]);
    if (newest) {
      const bx = cx + r * Math.sin(newest.th), by = cy + r * Math.cos(newest.th);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(bx, by); ctx.strokeStyle = palette.fg; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.beginPath(); ctx.arc(bx, by, 5, 0, Math.PI * 2); ctx.fillStyle = palette.yellow; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fillStyle = palette.fg; ctx.fill();

    if (!trajs.length) {
      ctx.fillStyle = palette.muted; ctx.font = `500 12px ${mono}`; ctx.textAlign = 'center';
      ctx.fillText('click or drag anywhere to release a pendulum from that state', x + w / 2, y + h * 0.5 - 30);
    }
  }

  function frame(now: number) {
    if (!running) return;
    if (!last) last = now;
    const elapsed = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (visible) {
      let acc = elapsed;
      while (acc >= DT) {
        for (const t of trajs) {
          if (!t.alive) continue;
          step(t, DT);
          t.pts.push([t.th, t.om]);
          if (t.pts.length > MAX_PTS) t.pts.shift();
          const settled = Math.abs(t.om) < 0.01 && Math.abs(Math.sin(t.th)) < 0.002 && Math.cos(t.th) > 0;
          if (settled || Math.abs(t.om) > OM_RANGE * 1.5 || Math.abs(t.th) > TH_RANGE * 1.6) t.alive = false;
        }
        acc -= DT;
      }
      draw();
    }
    requestAnimationFrame(frame);
  }

  function add(th: number, om: number) {
    trajs.push({ pts: [[th, om]], th, om, alive: true, born: performance.now() });
    while (trajs.length > MAX_TRAJ) trajs.shift();
  }

  const inPlot = (px: number, py: number) => px >= plot.x && px <= plot.x + plot.w && py >= plot.y && py <= plot.y + plot.h;
  const pos = (e: PointerEvent): [number, number] => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const onDown = (e: PointerEvent) => {
    const [px, py] = pos(e);
    if (!inPlot(px, py)) return;
    painting = true; canvas.setPointerCapture(e.pointerId);
    add(...toState(px, py)); paintTimer = performance.now();
    e.preventDefault();
  };
  const onMove = (e: PointerEvent) => {
    if (!painting) return;
    const now = performance.now();
    if (now - paintTimer < 140) return;
    const [px, py] = pos(e);
    if (!inPlot(px, py)) return;
    add(...toState(px, py)); paintTimer = now;
  };
  const onUp = (e: PointerEvent) => { painting = false; try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ } };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.style.cursor = 'crosshair';

  const ro = new ResizeObserver(() => layout());
  ro.observe(canvas);
  const io = new IntersectionObserver((en) => { visible = en[0]?.isIntersecting ?? true; if (visible) last = 0; }, { threshold: 0.05 });
  io.observe(canvas);
  const mo = new MutationObserver(() => { palette = readPalette(canvas); buildField(); });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  layout();
  // a few trajectories to start with, as in the report's animation
  for (const [th, om] of [[0, 5.5], [1.7, 0], [-0.8, -2.4], [2.9, 0]]) add(th, om);
  requestAnimationFrame(frame);

  return {
    setMu(m) { mu = m; buildField(); },
    setW0sq(w) { w0sq = w; buildField(); },
    addTrajectory: add,
    seedRandom(n) { for (let i = 0; i < n; i++) add((Math.random() * 2 - 1) * TH_RANGE * 0.9, (Math.random() * 2 - 1) * OM_RANGE * 0.9); },
    clear() { trajs.length = 0; },
    destroy() {
      running = false; ro.disconnect(); io.disconnect(); mo.disconnect();
      canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp);
    },
  };
}
