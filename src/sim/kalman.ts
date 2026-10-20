/**
 * Live Kalman filtering of a pendulum from noisy angle measurements
 * (Pendulum Lab, chapter 5). The truth runs at 100 Hz; a linear Kalman filter or an
 * extended Kalman filter estimates angle and angular velocity from the measured angle,
 * optionally gating outliers by their normalised innovation.
 */
import { readPalette, type Palette } from './pendulum';

export type FilterKind = 'kf' | 'ekf';

export interface KalmanStats { rmsVel: number; nis: number; rejected: number; outliers: number }

export interface KalmanHandle {
  setSigmaDeg(v: number): void;
  setOutlierPct(v: number): void;
  setLogQ(v: number): void;
  setFilter(f: FilterKind): void;
  setGate(on: boolean): void;
  kick(): void;
  destroy(): void;
}

const H = 0.01; // sample period [s]
const W0SQ = 9.81; // ω₀² = g/L with L = 1 m
const MU = 0.25; // damping [1/s]
const WINDOW = 600; // samples shown (6 s)
const GATE = 9; // χ² gate on the normalised innovation
const DEG = Math.PI / 180;

function randn(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function rk4(th: number, om: number, dt: number, accel: (t: number, w: number) => number): [number, number] {
  const k1t = om, k1w = accel(th, om);
  const k2t = om + 0.5 * dt * k1w, k2w = accel(th + 0.5 * dt * k1t, om + 0.5 * dt * k1w);
  const k3t = om + 0.5 * dt * k2w, k3w = accel(th + 0.5 * dt * k2t, om + 0.5 * dt * k2w);
  const k4t = om + dt * k3w, k4w = accel(th + dt * k3t, om + dt * k3w);
  return [th + (dt / 6) * (k1t + 2 * k2t + 2 * k3t + k4t), om + (dt / 6) * (k1w + 2 * k2w + 2 * k3w + k4w)];
}

const accelTrue = (th: number, om: number) => -W0SQ * Math.sin(th) - MU * om;
const accelLin = (th: number, om: number) => -W0SQ * th - MU * om;

interface Sample { t: number; th: number; om: number; y: number; outlier: boolean; rejected: boolean; the: number; ome: number; sig: number; nis: number }

export function mountKalman(canvas: HTMLCanvasElement, onStats?: (s: KalmanStats) => void): KalmanHandle {
  const ctx = canvas.getContext('2d')!;
  let palette: Palette = readPalette(canvas);
  let width = 0, height = 0, dpr = 1;
  let running = true, visible = true, last = 0, acc = 0, lastStats = 0;

  // tunables
  let sigma = 1.0 * DEG, pOut = 0.02, q = 1e-4;
  let kind: FilterKind = 'ekf', gate = true;

  // truth
  let th = 120 * DEG, om = 0, t = 0;
  // filter state and covariance
  let xe = [th + 10 * DEG, 0];
  let P = [[(10 * DEG) ** 2, 0], [0, 4]];

  const buf: Sample[] = [];
  let peakWindow: number[] = [];

  function predict() {
    const accel = kind === 'ekf' ? accelTrue : accelLin;
    const [pth, pom] = rk4(xe[0], xe[1], H, accel);
    const c = kind === 'ekf' ? Math.cos(xe[0]) : 1;
    const F = [[1, H], [-H * W0SQ * c, 1 - H * MU]];
    const Q = [[q * H ** 3 / 3, q * H ** 2 / 2], [q * H ** 2 / 2, q * H]];
    // P = F P Fᵀ + Q
    const FP = [
      [F[0][0] * P[0][0] + F[0][1] * P[1][0], F[0][0] * P[0][1] + F[0][1] * P[1][1]],
      [F[1][0] * P[0][0] + F[1][1] * P[1][0], F[1][0] * P[0][1] + F[1][1] * P[1][1]],
    ];
    P = [
      [FP[0][0] * F[0][0] + FP[0][1] * F[0][1] + Q[0][0], FP[0][0] * F[1][0] + FP[0][1] * F[1][1] + Q[0][1]],
      [FP[1][0] * F[0][0] + FP[1][1] * F[0][1] + Q[1][0], FP[1][0] * F[1][0] + FP[1][1] * F[1][1] + Q[1][1]],
    ];
    xe = [pth, pom];
  }

  let consecutiveRejected = 0;
  const LOCKOUT = 20; // after this many rejections in a row the filter is probably wrong, not the sensor

  function update(y: number): { nis: number; rejected: boolean } {
    const nu = y - xe[0];
    let S = P[0][0] + sigma * sigma;
    let nis = (nu * nu) / S;
    if (gate && nis > GATE) {
      consecutiveRejected++;
      if (consecutiveRejected <= LOCKOUT) return { nis, rejected: true };
      // escape the lockout: admit the filter is lost, inflate P and accept the measurement
      P = [[P[0][0] * 50 + (10 * DEG) ** 2, 0], [0, P[1][1] * 50 + 4]];
      S = P[0][0] + sigma * sigma;
      nis = (nu * nu) / S;
    }
    consecutiveRejected = 0;
    const K = [P[0][0] / S, P[1][0] / S];
    xe = [xe[0] + K[0] * nu, xe[1] + K[1] * nu];
    // P = (I − K H) P with H = [1 0]
    P = [
      [(1 - K[0]) * P[0][0], (1 - K[0]) * P[0][1]],
      [P[1][0] - K[1] * P[0][0], P[1][1] - K[1] * P[0][1]],
    ];
    return { nis, rejected: false };
  }

  function sample() {
    // truth, four substeps
    for (let i = 0; i < 4; i++) [th, om] = rk4(th, om, H / 4, accelTrue);
    t += H;
    const outlier = Math.random() < pOut;
    const y = th + (outlier ? 25 * DEG * randn() : sigma * randn());
    predict();
    const { nis, rejected } = update(y);
    buf.push({ t, th, om, y, outlier, rejected, the: xe[0], ome: xe[1], sig: Math.sqrt(Math.max(P[1][1], 0)), nis });
    if (buf.length > WINDOW) buf.shift();
    // auto re-kick when the swing has died down
    peakWindow.push(Math.abs(th));
    if (peakWindow.length > 300) peakWindow.shift();
    if (peakWindow.length === 300 && Math.max(...peakWindow) < 12 * DEG) { kick(); peakWindow = []; }
  }

  function kick() {
    const s = Math.random() < 0.5 ? -1 : 1;
    om += s * (4.5 + Math.random() * 2.5);
  }

  function stats(): KalmanStats {
    let se = 0, n = 0, nisSum = 0, nisN = 0, rej = 0, out = 0;
    for (const s of buf) {
      se += (s.ome - s.om) ** 2; n++;
      if (!s.rejected) { nisSum += s.nis; nisN++; } else rej++;
      if (s.outlier) out++;
    }
    return { rmsVel: n ? Math.sqrt(se / n) : 0, nis: nisN ? nisSum / nisN : 0, rejected: rej, outliers: out };
  }

  // --- drawing ------------------------------------------------------------
  let pend = { cx: 0, cy: 0, r: 0 };
  let plotA = { x: 0, y: 0, w: 0, h: 0 }; // angle
  let plotV = { x: 0, y: 0, w: 0, h: 0 }; // velocity
  let stacked = false;

  function layout() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, Math.round(rect.width));
    stacked = width < 600;
    height = stacked ? Math.round(width * 1.25) : Math.round(Math.max(300, Math.min(460, width * 0.5)));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pad = 14;
    if (stacked) {
      const ph = Math.round(width * 0.42);
      pend = { cx: width / 2, cy: pad + ph / 2, r: ph * 0.4 };
      const top = pad + ph + 10, hh = (height - top - pad - 30) / 2;
      plotA = { x: 44, y: top, w: width - 44 - pad, h: hh - 10 };
      plotV = { x: 44, y: top + hh + 4, w: width - 44 - pad, h: hh - 10 };
    } else {
      const pw = Math.round(width * 0.27);
      pend = { cx: pad + pw / 2, cy: height / 2 - 10, r: Math.min(pw, height) * 0.38 };
      const left = pad + pw + 44, hh = (height - 2 * pad - 30) / 2;
      plotA = { x: left, y: pad, w: width - left - pad, h: hh - 8 };
      plotV = { x: left, y: pad + hh + 6, w: width - left - pad, h: hh - 8 };
    }
  }

  function drawPendulum(c: CanvasRenderingContext2D, s: Sample | undefined) {
    const { cx, cy, r } = pend;
    const mono = getComputedStyle(canvas).getPropertyValue('--font-mono') || 'monospace';
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.strokeStyle = palette.line; c.setLineDash([3, 6]); c.lineWidth = 1; c.stroke(); c.setLineDash([]);
    if (!s) return;
    // measurement tick
    const my = cx + r * Math.sin(s.y), myy = cy + r * Math.cos(s.y);
    c.beginPath(); c.arc(my, myy, 4, 0, Math.PI * 2); c.fillStyle = s.outlier ? palette.red : palette.yellow; c.globalAlpha = 0.9; c.fill(); c.globalAlpha = 1;
    // estimate
    const ex = cx + r * Math.sin(s.the), ey = cy + r * Math.cos(s.the);
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(ex, ey); c.strokeStyle = palette.accent; c.lineWidth = 6; c.globalAlpha = 0.45; c.lineCap = 'round'; c.stroke(); c.globalAlpha = 1;
    // truth
    const bx = cx + r * Math.sin(s.th), by = cy + r * Math.cos(s.th);
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(bx, by); c.strokeStyle = palette.fg; c.lineWidth = 2; c.stroke();
    c.beginPath(); c.arc(bx, by, 8, 0, Math.PI * 2); c.fillStyle = palette.fg; c.fill();
    c.beginPath(); c.arc(cx, cy, 3, 0, Math.PI * 2); c.fillStyle = palette.fg; c.fill();
    // legend
    c.font = `500 11px ${mono}`; c.textAlign = 'center'; c.fillStyle = palette.muted;
    c.fillText('truth · estimate · measurement', cx, cy + r + 24);
  }

  function drawPlot(c: CanvasRenderingContext2D, p: { x: number; y: number; w: number; h: number }, range: number, label: string, which: 'angle' | 'vel') {
    const mono = getComputedStyle(canvas).getPropertyValue('--font-mono') || 'monospace';
    c.strokeStyle = palette.line; c.lineWidth = 1; c.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);
    const y0 = p.y + p.h / 2;
    c.beginPath(); c.moveTo(p.x, y0); c.lineTo(p.x + p.w, y0); c.stroke();
    c.fillStyle = palette.muted; c.font = `500 11px ${mono}`; c.textAlign = 'right';
    c.fillText(`+${range}`, p.x - 5, p.y + 10); c.fillText('0', p.x - 5, y0 + 4); c.fillText(`−${range}`, p.x - 5, p.y + p.h - 2);
    c.textAlign = 'left'; c.fillStyle = palette.faint; c.fillText(label, p.x + 6, p.y + 13);
    if (buf.length < 2) return;
    const tNow = buf[buf.length - 1].t;
    const tx = (tt: number) => p.x + p.w - ((tNow - tt) / (WINDOW * H)) * p.w;
    const ty = (v: number) => y0 - (v / range) * (p.h / 2);
    const unit = which === 'angle' ? 1 / DEG : 1;
    c.save(); c.beginPath(); c.rect(p.x, p.y, p.w, p.h); c.clip();
    if (which === 'vel') {
      // ±2σ band
      c.beginPath();
      for (let i = 0; i < buf.length; i++) c.lineTo(tx(buf[i].t), ty(buf[i].ome + 2 * buf[i].sig));
      for (let i = buf.length - 1; i >= 0; i--) c.lineTo(tx(buf[i].t), ty(buf[i].ome - 2 * buf[i].sig));
      c.closePath(); c.fillStyle = palette.accent; c.globalAlpha = 0.16; c.fill(); c.globalAlpha = 1;
    } else {
      // measurements
      for (let i = 0; i < buf.length; i += 2) {
        const s = buf[i];
        const px = tx(s.t), py = ty(s.y * unit);
        if (s.outlier) {
          c.strokeStyle = palette.red; c.lineWidth = 1.2;
          c.beginPath(); c.moveTo(px - 3, py - 3); c.lineTo(px + 3, py + 3); c.moveTo(px + 3, py - 3); c.lineTo(px - 3, py + 3); c.stroke();
        } else {
          c.fillStyle = palette.yellow; c.globalAlpha = 0.7;
          c.beginPath(); c.arc(px, py, 1.3, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
        }
        if (s.rejected) { c.strokeStyle = palette.red; c.lineWidth = 1; c.beginPath(); c.arc(px, py, 5, 0, Math.PI * 2); c.stroke(); }
      }
    }
    // truth
    c.beginPath();
    for (let i = 0; i < buf.length; i++) { const s = buf[i]; const v = which === 'angle' ? s.th * unit : s.om; i ? c.lineTo(tx(s.t), ty(v)) : c.moveTo(tx(s.t), ty(v)); }
    c.strokeStyle = palette.fg; c.lineWidth = 1.4; c.globalAlpha = 0.8; c.stroke(); c.globalAlpha = 1;
    // estimate
    c.beginPath();
    for (let i = 0; i < buf.length; i++) { const s = buf[i]; const v = which === 'angle' ? s.the * unit : s.ome; i ? c.lineTo(tx(s.t), ty(v)) : c.moveTo(tx(s.t), ty(v)); }
    c.strokeStyle = palette.accent; c.lineWidth = 1.8; c.stroke();
    c.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    drawPendulum(ctx, buf[buf.length - 1]);
    drawPlot(ctx, plotA, 180, 'angle θ  [deg]   · measurements', 'angle');
    drawPlot(ctx, plotV, 10, 'angular velocity θ̇  [rad/s]   · ±2σ of the filter', 'vel');
    const mono = getComputedStyle(canvas).getPropertyValue('--font-mono') || 'monospace';
    ctx.fillStyle = palette.muted; ctx.font = `500 11px ${mono}`; ctx.textAlign = 'right';
    ctx.fillText('last 6 s →', plotV.x + plotV.w, plotV.y + plotV.h + 14);
  }

  function frame(now: number) {
    if (!running) return;
    if (!last) last = now;
    const elapsed = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (visible) {
      acc += elapsed;
      while (acc >= H) { sample(); acc -= H; }
      draw();
      if (onStats && now - lastStats > 150) { lastStats = now; onStats(stats()); }
    }
    requestAnimationFrame(frame);
  }

  function resetFilter() {
    xe = [th + 10 * DEG, 0];
    P = [[(10 * DEG) ** 2, 0], [0, 4]];
  }

  const ro = new ResizeObserver(() => layout());
  ro.observe(canvas);
  const io = new IntersectionObserver((en) => { visible = en[0]?.isIntersecting ?? true; if (visible) last = 0; }, { threshold: 0.05 });
  io.observe(canvas);
  const mo = new MutationObserver(() => { palette = readPalette(canvas); });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  layout();
  requestAnimationFrame(frame);

  return {
    setSigmaDeg(v) { sigma = v * DEG; },
    setOutlierPct(v) { pOut = v / 100; },
    setLogQ(v) { q = 10 ** v; },
    setFilter(f) { kind = f; resetFilter(); },
    setGate(on) { gate = on; },
    kick,
    destroy() { running = false; ro.disconnect(); io.disconnect(); mo.disconnect(); },
  };
}
