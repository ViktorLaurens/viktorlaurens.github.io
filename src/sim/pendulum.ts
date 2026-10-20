/**
 * Live damped pendulum with swing-up and balance control, plus its phase portrait.
 *
 * Model (same as Pendulum Lab, chapter 1), angle θ measured from the hanging position:
 *   θ̈ = −ω₀² sin θ − μ θ̇ + u
 * Integrated with fixed-step RK4. The controller pumps energy until it has enough to
 * reach the top, then hands over to a linear state feedback that holds it upright.
 */

export interface PendulumState {
  theta: number;
  omega: number;
  u: number;
  energy: number;
  control: boolean;
  /** Easter egg: double pendulum. theta2/omega2 are the second link. */
  chaos: boolean;
  theta2: number;
  omega2: number;
}

export interface MountOptions {
  canvas: HTMLCanvasElement;
  onState?: (s: PendulumState) => void;
}

export interface PendulumHandle {
  setControl(on: boolean): void;
  getControl(): boolean;
  setChaos(on: boolean): void;
  getChaos(): boolean;
  reset(): void;
  destroy(): void;
}

// --- physics ---------------------------------------------------------------

const G = 9.81;
const L = 1.0;
const MU = 0.12; // viscous damping [1/s]
const W0 = Math.sqrt(G / L); // natural frequency [rad/s]
const W0SQ = W0 * W0;
const U_MAX = 0.6 * W0SQ; // torque limit: too weak to lift the bob directly
const E_TOP = 2 * W0SQ; // energy of the upright equilibrium
const DT = 1 / 240;

export const PARAMS = { G, L, MU, W0, U_MAX, E_TOP };

export function energy(theta: number, omega: number): number {
  return 0.5 * omega * omega + W0SQ * (1 - Math.cos(theta));
}

export function wrap(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Swing-up by energy shaping, balance by linear state feedback near the top. */
export function controller(theta: number, omega: number): number {
  const phi = wrap(theta - Math.PI); // angle from upright
  const nearTop = Math.abs(phi) < 0.4 && Math.abs(omega) < 2.2;
  if (nearTop) {
    // Linearised about the top: φ̈ = ω₀² φ − μ φ̇ + u. Place closed-loop poles at ω_c, ζ.
    const wc = 2.2 * W0;
    const zeta = 0.85;
    const k1 = W0SQ + wc * wc;
    const k2 = 2 * zeta * wc - MU;
    return clamp(-k1 * phi - k2 * omega, -U_MAX, U_MAX);
  }
  const dE = E_TOP - energy(theta, omega);
  if (Math.abs(omega) < 0.05 && Math.abs(wrap(theta)) < 0.05) return U_MAX; // kick off from rest
  return clamp(2.5 * dE * omega, -U_MAX, U_MAX);
}

function accel(theta: number, omega: number, u: number): number {
  return -W0SQ * Math.sin(theta) - MU * omega + u;
}

// --- double pendulum (easter egg) -------------------------------------------
// Two equal point masses on massless rods of length L/2 each, light damping.
const L2 = L / 2;
const MU2 = 0.02;

function doubleAccel(t1: number, t2: number, w1: number, w2: number): [number, number] {
  const d = t1 - t2;
  const den = 3 - Math.cos(2 * d); // 2m1 + m2 − m2 cos 2Δ with m1 = m2 = 1
  const a1 = (-3 * G * Math.sin(t1) - G * Math.sin(t1 - 2 * t2) - 2 * Math.sin(d) * (w2 * w2 * L2 + w1 * w1 * L2 * Math.cos(d))) / (L2 * den) - MU2 * w1;
  const a2 = (2 * Math.sin(d) * (2 * w1 * w1 * L2 + 2 * G * Math.cos(t1) + w2 * w2 * L2 * Math.cos(d))) / (L2 * den) - MU2 * w2;
  return [a1, a2];
}

export function rk4Double(s: [number, number, number, number], dt: number): [number, number, number, number] {
  const f = (x: [number, number, number, number]): [number, number, number, number] => {
    const [a1, a2] = doubleAccel(x[0], x[1], x[2], x[3]);
    return [x[2], x[3], a1, a2];
  };
  const add = (x: [number, number, number, number], k: [number, number, number, number], h: number): [number, number, number, number] =>
    [x[0] + h * k[0], x[1] + h * k[1], x[2] + h * k[2], x[3] + h * k[3]];
  const k1 = f(s), k2 = f(add(s, k1, dt / 2)), k3 = f(add(s, k2, dt / 2)), k4 = f(add(s, k3, dt));
  return [
    s[0] + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
    s[1] + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
    s[2] + (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]),
    s[3] + (dt / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]),
  ];
}

export function rk4(theta: number, omega: number, u: number, dt: number): [number, number] {
  const k1t = omega, k1w = accel(theta, omega, u);
  const k2t = omega + 0.5 * dt * k1w, k2w = accel(theta + 0.5 * dt * k1t, omega + 0.5 * dt * k1w, u);
  const k3t = omega + 0.5 * dt * k2w, k3w = accel(theta + 0.5 * dt * k2t, omega + 0.5 * dt * k2w, u);
  const k4t = omega + dt * k3w, k4w = accel(theta + dt * k3t, omega + dt * k3w, u);
  return [
    theta + (dt / 6) * (k1t + 2 * k2t + 2 * k3t + k4t),
    omega + (dt / 6) * (k1w + 2 * k2w + 2 * k3w + k4w),
  ];
}

// --- rendering ---------------------------------------------------------------

export interface Palette {
  fg: string; muted: string; faint: string; line: string; accent: string; yellow: string; red: string; field: string; bg: string;
}

export function readPalette(el: HTMLElement): Palette {
  const cs = getComputedStyle(el);
  const v = (n: string, fb: string) => cs.getPropertyValue(n).trim() || fb;
  return {
    fg: v('--fg', '#ececec'),
    muted: v('--fg-muted', '#9a9a9a'),
    faint: v('--fg-faint', '#5a5f68'),
    line: v('--line', '#22262e'),
    accent: v('--accent', '#58c4dd'),
    yellow: v('--yellow', '#f7d96f'),
    red: v('--red', '#fc6255'),
    field: v('--field', 'rgba(88,196,221,.22)'),
    bg: v('--bg', '#0a0b0e'),
  };
}

const OMEGA_RANGE = 2.6 * W0; // phase portrait vertical half-range

export function mountPendulum({ canvas, onState }: MountOptions): PendulumHandle {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas not supported');

  let theta = 2.35, omega = 0, u = 0;
  let control = false;
  let chaos = false;
  let theta2 = 0, omega2 = 0; // second link, chaos mode
  const trail2: Array<[number, number]> = []; // (θ1, θ2) history of the second bob
  const TRAIL2_MAX = 700;
  let running = true, visible = true;
  let last = 0, acc = 0, lastReport = 0;
  let width = 0, height = 0, dpr = 1;
  let palette = readPalette(canvas);
  let field: HTMLCanvasElement | null = null;

  const trail: Array<[number, number]> = []; // phase-space history
  const TRAIL_MAX = 900;
  const ghost: Array<[number, number]> = []; // recent bob positions (angles)
  const GHOST_MAX = 28;

  // layout, recomputed on resize
  let stacked = false;
  let pend = { x: 0, y: 0, w: 0, h: 0, px: 0, py: 0, r: 0 };
  let phase = { x: 0, y: 0, w: 0, h: 0 };

  // dragging
  let dragging = false;
  let dragPrev = { theta: 0, t: 0 };
  let dragOmega = 0;

  function layout() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, Math.round(rect.width));
    stacked = width < 560;
    height = stacked ? Math.round(width * 1.55) : Math.round(width * 0.56);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.height = `${height}px`;
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

    const pad = 16;
    if (stacked) {
      const ph = Math.round(height * 0.48);
      pend = { x: pad, y: pad, w: width - 2 * pad, h: ph - pad, px: 0, py: 0, r: 0 };
      phase = { x: pad + 28, y: ph + pad + 8, w: width - 2 * pad - 36, h: height - ph - 2 * pad - 24 };
    } else {
      const pw = Math.round(width * 0.42);
      pend = { x: pad, y: pad, w: pw - pad, h: height - 2 * pad, px: 0, py: 0, r: 0 };
      phase = { x: pw + pad + 34, y: pad + 10, w: width - pw - 2 * pad - 44, h: height - 2 * pad - 32 };
    }
    pend.px = pend.x + pend.w / 2;
    pend.py = pend.y + pend.h * 0.5;
    pend.r = Math.min(pend.w, pend.h) * 0.42;
    buildField();
  }

  /** Pre-render the vector field of the uncontrolled pendulum. */
  function buildField() {
    field = document.createElement('canvas');
    field.width = Math.round(phase.w * dpr);
    field.height = Math.round(phase.h * dpr);
    const f = field.getContext('2d')!;
    f.setTransform(dpr, 0, 0, dpr, 0, 0);
    const nx = Math.max(12, Math.round(phase.w / 26));
    const ny = Math.max(9, Math.round(phase.h / 26));
    f.strokeStyle = palette.field;
    f.fillStyle = palette.field;
    f.lineWidth = 1;
    for (let i = 0; i <= nx; i++) {
      for (let j = 0; j <= ny; j++) {
        const th = -Math.PI + (2 * Math.PI * i) / nx;
        const om = OMEGA_RANGE - (2 * OMEGA_RANGE * j) / ny;
        const dth = om, dom = accel(th, om, 0);
        // map derivative to pixel direction
        const vx = (dth / (2 * Math.PI)) * phase.w;
        const vy = (-dom / (2 * OMEGA_RANGE)) * phase.h;
        const n = Math.hypot(vx, vy) || 1;
        const len = 9;
        const x = (i / nx) * phase.w, y = (j / ny) * phase.h;
        const ex = x + (vx / n) * len, ey = y + (vy / n) * len;
        f.beginPath(); f.moveTo(x, y); f.lineTo(ex, ey); f.stroke();
        f.beginPath(); f.arc(ex, ey, 1.3, 0, Math.PI * 2); f.fill();
      }
    }
  }

  function toPhase(th: number, om: number): [number, number] {
    const x = phase.x + ((wrap(th) + Math.PI) / (2 * Math.PI)) * phase.w;
    const y = phase.y + ((OMEGA_RANGE - om) / (2 * OMEGA_RANGE)) * phase.h;
    return [x, y];
  }

  function draw() {
    const c = ctx!;
    c.clearRect(0, 0, width, height);
    drawPendulum(c);
    drawPhase(c);
  }

  function bob2(t1: number, t2: number): [number, number] {
    const { px, py, r } = pend;
    const h = r / 2;
    return [px + h * Math.sin(t1) + h * Math.sin(t2), py + h * Math.cos(t1) + h * Math.cos(t2)];
  }

  function drawDouble(c: CanvasRenderingContext2D) {
    const { px, py, r } = pend;
    const h = r / 2;
    const mono = getComputedStyle(canvas).getPropertyValue('--font-mono') || 'monospace';
    c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2);
    c.strokeStyle = palette.line; c.lineWidth = 1; c.setLineDash([3, 6]); c.stroke(); c.setLineDash([]);
    // trail of the second bob
    if (trail2.length > 1) {
      c.lineWidth = 1.5; c.lineJoin = 'round';
      const n = trail2.length;
      for (let i = 1; i < n; i++) {
        const [ax, ay] = bob2(trail2[i - 1][0], trail2[i - 1][1]);
        const [bx, by] = bob2(trail2[i][0], trail2[i][1]);
        c.globalAlpha = 0.05 + 0.75 * (i / n) ** 2;
        c.strokeStyle = palette.yellow;
        c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
      }
      c.globalAlpha = 1;
    }
    const x1 = px + h * Math.sin(theta), y1 = py + h * Math.cos(theta);
    const [x2, y2] = bob2(theta, theta2);
    c.beginPath(); c.moveTo(px, py); c.lineTo(x1, y1); c.lineTo(x2, y2);
    c.strokeStyle = palette.fg; c.lineWidth = 2; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
    c.beginPath(); c.arc(px, py, 4, 0, Math.PI * 2); c.fillStyle = palette.fg; c.fill();
    c.beginPath(); c.arc(x1, y1, 9, 0, Math.PI * 2); c.fillStyle = palette.accent; c.fill();
    c.beginPath(); c.arc(x2, y2, 9, 0, Math.PI * 2); c.fillStyle = palette.yellow; c.fill();
    if (dragging) { c.lineWidth = 2; c.strokeStyle = palette.fg; c.beginPath(); c.arc(x1, y1, 9, 0, Math.PI * 2); c.stroke(); }
    c.font = `500 11px ${mono}`; c.fillStyle = palette.red; c.textAlign = 'left';
    c.fillText('chaos mode · double pendulum · esc to leave', pend.x + 2, pend.y + pend.h - 4);
  }

  function drawPendulum(c: CanvasRenderingContext2D) {
    if (chaos) return drawDouble(c);
    const { px, py, r } = pend;
    const bx = px + r * Math.sin(theta), by = py + r * Math.cos(theta);

    // reach circle
    c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2);
    c.strokeStyle = palette.line; c.lineWidth = 1; c.setLineDash([3, 6]); c.stroke(); c.setLineDash([]);

    // upright marker
    c.beginPath(); c.moveTo(px, py - r - 6); c.lineTo(px, py - r + 6);
    c.strokeStyle = palette.faint; c.lineWidth = 1; c.stroke();

    // torque indicator (arc around pivot)
    if (control && Math.abs(u) > 1e-3) {
      const frac = clamp(u / U_MAX, -1, 1);
      c.beginPath();
      c.arc(px, py, 16, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 0.9, frac < 0);
      c.strokeStyle = palette.yellow; c.lineWidth = 3; c.lineCap = 'round'; c.stroke();
    }

    // ghost trail of the bob
    for (let i = 0; i < ghost.length; i++) {
      const [gth] = ghost[i];
      const a = (i + 1) / ghost.length;
      c.beginPath();
      c.arc(px + r * Math.sin(gth), py + r * Math.cos(gth), 3 + 6 * a, 0, Math.PI * 2);
      c.fillStyle = palette.accent; c.globalAlpha = 0.08 * a; c.fill();
    }
    c.globalAlpha = 1;

    // rod
    c.beginPath(); c.moveTo(px, py); c.lineTo(bx, by);
    c.strokeStyle = palette.fg; c.lineWidth = 2; c.lineCap = 'round'; c.stroke();

    // pivot
    c.beginPath(); c.arc(px, py, 4, 0, Math.PI * 2); c.fillStyle = palette.fg; c.fill();

    // bob
    c.beginPath(); c.arc(bx, by, 11, 0, Math.PI * 2);
    c.fillStyle = control ? palette.yellow : palette.accent; c.fill();
    if (dragging) { c.lineWidth = 2; c.strokeStyle = palette.fg; c.stroke(); }

    // label
    c.font = `500 11px ${getComputedStyle(canvas).getPropertyValue('--font-mono') || 'monospace'}`;
    c.fillStyle = palette.faint; c.textAlign = 'left';
    c.fillText(dragging ? 'release to let go' : 'drag the bob', pend.x + 2, pend.y + pend.h - 4);
  }

  function drawPhase(c: CanvasRenderingContext2D) {
    const { x, y, w, h } = phase;
    const mono = getComputedStyle(canvas).getPropertyValue('--font-mono') || 'monospace';

    if (chaos) {
      // (θ₁, θ₂) on the torus, unwrapped into a square
      c.strokeStyle = palette.line; c.lineWidth = 1;
      c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      const to = (t1: number, t2: number): [number, number] => [x + ((wrap(t1) + Math.PI) / (2 * Math.PI)) * w, y + ((Math.PI - wrap(t2)) / (2 * Math.PI)) * h];
      const [mx, my] = to(0, 0);
      c.beginPath(); c.moveTo(x, my); c.lineTo(x + w, my); c.moveTo(mx, y); c.lineTo(mx, y + h); c.stroke();
      if (trail2.length > 1) {
        c.lineWidth = 1.4;
        const n = trail2.length;
        for (let i = 1; i < n; i++) {
          const [a1, a2] = trail2[i - 1], [b1, b2] = trail2[i];
          if (Math.abs(wrap(b1) - wrap(a1)) > Math.PI || Math.abs(wrap(b2) - wrap(a2)) > Math.PI) continue;
          const [ax, ay] = to(a1, a2), [bx, by] = to(b1, b2);
          c.globalAlpha = 0.08 + 0.92 * (i / n) ** 2; c.strokeStyle = palette.yellow;
          c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
        }
        c.globalAlpha = 1;
      }
      const [cx, cy] = to(theta, theta2);
      c.beginPath(); c.arc(cx, cy, 5, 0, Math.PI * 2); c.fillStyle = palette.yellow; c.fill();
      c.fillStyle = palette.muted; c.font = `500 11px ${mono}`; c.textAlign = 'center';
      c.fillText('−π', x, y + h + 14); c.fillText('0', mx, y + h + 14); c.fillText('π', x + w, y + h + 14);
      c.fillText('θ₁', x + w / 2, y + h + 26);
      c.textAlign = 'right'; c.fillText('θ₂', x - 8, my + 4);
      c.textAlign = 'left'; c.fillStyle = palette.faint; c.fillText('configuration space (θ₁, θ₂)', x + 6, y + 14);
      return;
    }

    // frame and field
    if (field) c.drawImage(field, x, y, w, h);
    c.strokeStyle = palette.line; c.lineWidth = 1;
    c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    // axes through origin
    const [ox, oy] = toPhase(0, 0);
    c.beginPath(); c.moveTo(x, oy); c.lineTo(x + w, oy); c.moveTo(ox, y); c.lineTo(ox, y + h);
    c.strokeStyle = palette.line; c.stroke();

    // fixed points
    c.beginPath(); c.arc(ox, oy, 4, 0, Math.PI * 2); c.fillStyle = palette.fg; c.fill();
    for (const th of [-Math.PI, Math.PI]) {
      const [fx, fy] = toPhase(th, 0);
      c.beginPath(); c.arc(fx, fy, 4, 0, Math.PI * 2);
      c.strokeStyle = palette.red; c.lineWidth = 1.5; c.stroke();
    }

    // trajectory, broken at wrap-around
    if (trail.length > 1) {
      c.lineWidth = 1.6; c.lineJoin = 'round';
      const n = trail.length;
      for (let i = 1; i < n; i++) {
        const [t0, w0] = trail[i - 1], [t1, w1] = trail[i];
        if (Math.abs(wrap(t1) - wrap(t0)) > Math.PI) continue;
        const [ax, ay] = toPhase(t0, w0), [bx, by] = toPhase(t1, w1);
        c.globalAlpha = 0.08 + 0.92 * (i / n) ** 2;
        c.strokeStyle = control ? palette.yellow : palette.accent;
        c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
      }
      c.globalAlpha = 1;
    }

    // current state
    const [cx, cy] = toPhase(theta, omega);
    c.beginPath(); c.arc(cx, cy, 5, 0, Math.PI * 2);
    c.fillStyle = control ? palette.yellow : palette.accent; c.fill();
    c.lineWidth = 1.5; c.strokeStyle = palette.bg; c.stroke();

    // labels
    c.fillStyle = palette.muted; c.font = `500 11px ${mono}`;
    c.textAlign = 'center';
    c.fillText('−π', x, y + h + 14); c.fillText('0', ox, y + h + 14); c.fillText('π', x + w, y + h + 14);
    c.fillText('θ', x + w / 2, y + h + 26);
    c.textAlign = 'right';
    c.fillText('θ̇', x - 8, oy + 4);
    c.fillText(`+${OMEGA_RANGE.toFixed(0)}`, x - 6, y + 10);
    c.fillText(`−${OMEGA_RANGE.toFixed(0)}`, x - 6, y + h - 2);
    c.textAlign = 'left';
    c.fillStyle = palette.faint;
    c.fillText('phase portrait', x + 6, y + 14);
  }

  // --- loop -----------------------------------------------------------------

  function step(dt: number) {
    if (chaos) {
      u = 0;
      [theta, theta2, omega, omega2] = rk4Double([theta, theta2, omega, omega2], dt);
      if (Math.abs(theta) > 50) theta = wrap(theta);
      if (Math.abs(theta2) > 50) theta2 = wrap(theta2);
      return;
    }
    u = control ? controller(theta, omega) : 0;
    [theta, omega] = rk4(theta, omega, u, dt);
    if (Math.abs(theta) > 50) theta = wrap(theta);
  }

  function frame(now: number) {
    if (!running) return;
    if (!last) last = now;
    const elapsed = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (visible) {
      if (!dragging) {
        acc += elapsed;
        while (acc >= DT) { step(DT); acc -= DT; }
        if (chaos) {
          trail2.push([theta, theta2]);
          if (trail2.length > TRAIL2_MAX) trail2.shift();
        } else {
          trail.push([theta, omega]);
          if (trail.length > TRAIL_MAX) trail.shift();
        }
      }
      ghost.push([theta, omega]);
      if (ghost.length > GHOST_MAX) ghost.shift();
      draw();
      if (onState && now - lastReport > 80) {
        lastReport = now;
        onState({ theta: wrap(theta), omega, u, energy: energy(theta, omega), control, chaos, theta2: wrap(theta2), omega2 });
      }
    }
    requestAnimationFrame(frame);
  }

  // --- interaction ---------------------------------------------------------

  function pointerAngle(e: PointerEvent): number {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    return Math.atan2(x - pend.px, y - pend.py);
  }

  function inPendulumPanel(e: PointerEvent): boolean {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    return x >= pend.x && x <= pend.x + pend.w && y >= pend.y && y <= pend.y + pend.h;
  }

  const onDown = (e: PointerEvent) => {
    if (!inPendulumPanel(e)) return;
    dragging = true;
    canvas.setPointerCapture(e.pointerId);
    theta = pointerAngle(e);
    omega = 0; dragOmega = 0;
    if (chaos) { theta2 = theta; omega2 = 0; trail2.length = 0; }
    dragPrev = { theta, t: performance.now() };
    trail.length = 0;
    e.preventDefault();
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const now = performance.now();
    const th = pointerAngle(e);
    const dt = Math.max((now - dragPrev.t) / 1000, 1e-3);
    const dth = wrap(th - dragPrev.theta);
    dragOmega = 0.6 * dragOmega + 0.4 * (dth / dt);
    theta = dragPrev.theta + dth;
    if (chaos) theta2 = theta;
    dragPrev = { theta, t: now };
  };
  const onUp = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    const stale = performance.now() - dragPrev.t > 80;
    omega = stale ? 0 : clamp(dragOmega, -OMEGA_RANGE, OMEGA_RANGE);
    acc = 0;
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.style.touchAction = 'none';
  canvas.style.cursor = 'grab';

  const ro = new ResizeObserver(() => layout());
  ro.observe(canvas);
  const io = new IntersectionObserver((entries) => { visible = entries[0]?.isIntersecting ?? true; }, { threshold: 0.05 });
  io.observe(canvas);
  const onVis = () => { last = 0; };
  document.addEventListener('visibilitychange', onVis);
  const mo = new MutationObserver(() => { palette = readPalette(canvas); buildField(); });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  layout();
  requestAnimationFrame(frame);

  return {
    setControl(on) { if (chaos) return; control = on; trail.length = 0; },
    getControl() { return control; },
    setChaos(on) {
      chaos = on; control = false; trail.length = 0; trail2.length = 0; ghost.length = 0;
      if (on) { theta = Math.PI * 0.75; theta2 = Math.PI * 0.9; omega = 0; omega2 = 0; }
      else { theta = wrap(theta); omega = Math.max(-6, Math.min(6, omega)); }
    },
    getChaos() { return chaos; },
    reset() { theta = 2.35; omega = 0; u = 0; control = false; chaos = false; trail.length = 0; trail2.length = 0; ghost.length = 0; acc = 0; },
    destroy() {
      running = false;
      ro.disconnect(); io.disconnect(); mo.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
    },
  };
}
