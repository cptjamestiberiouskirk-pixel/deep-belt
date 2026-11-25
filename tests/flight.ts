import type {Page} from '@playwright/test';

// How a hostile flies (step 52): its heading read every animation frame, in the page, from
// the probe hook (App.tsx __DEEP_BELT_PROBE__), and the turn rates and reversals worked out
// from it here. Every hostile's velocity is its heading times its speed, so its heading is
// the way it is moving. A frame's turn rate assumes one game step a frame: the game steps at a
// fixed 1/60 s (utils/helper.tsx createFixedStepper) and headless Chromium draws at 60 frames a
// second. On a faster display (a --headed run on a 120 Hz screen) frames alternate between no
// step and one, and a frame's rate reads 0 or double.

export type Frame = {t: number; ships: {id: string; x: number; y: number; heading: number}[]; px: number; py: number};

/** Records `sec` seconds of frames of the hostiles that `getter` returns (one or a list), keeping only `name` if given. */
export async function recordFlight(page: Page, getter: string, sec: number, name?: string): Promise<Frame[]> {
  return page.evaluate(async ({g, ms, only}) => {
    const probe = (window as any).__DEEP_BELT_PROBE__;
    if (!probe || typeof probe[g] !== 'function') throw new Error(`no probe getter ${g}`);
    const out: any[] = [];
    let t0 = -1;
    await new Promise<void>((resolve) => {
      const step = (now: number) => {
        if (t0 < 0) t0 = now;
        const v = probe[g]();
        const list = (Array.isArray(v) ? v : [v]).filter((s: any) => s.isAlive !== false && (!only || s.name === only));
        const p = probe.player();
        out.push({t: now - t0, ships: list.map((s: any, i: number) => ({id: String(s.id ?? s.name ?? i), x: s.x, y: s.y, heading: s.heading})), px: p.x, py: p.y});
        if (now - t0 < ms) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
    return out;
  }, {g: getter, ms: sec * 1000, only: name ?? ''}) as Promise<Frame[]>;
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const pct = (sorted: number[], q: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : NaN);

/** A window's turn counts as left or right past this rate (rad/s); below it the hostile is flying straight. */
export const STRAIGHT_RAD_S = 0.1;
/** Reversals are counted over windows this long (s), so a single frame's wobble is not one. */
export const WINDOW_S = 0.25;

export type FlightStats = {seconds: number; frames: number; medianDegS: number; p95DegS: number; maxDegS: number; reversalsPerMin: number; medianKm: number};

/** Turn rate per frame (deg/s: median, 95th percentile, most) and turn-direction reversals per minute for one hostile. */
export function flightStats(frames: Frame[], id: string, pxPerKm: number): FlightStats {
  const s = frames.map((f) => ({t: f.t / 1000, ship: f.ships.find((x) => x.id === id), px: f.px, py: f.py})).filter((f) => f.ship) as {t: number; ship: Frame['ships'][number]; px: number; py: number}[];
  const rates: number[] = [];
  const turns: {t: number; d: number}[] = [];
  for (let i = 1; i < s.length; i++) {
    const dt = s[i].t - s[i - 1].t;
    if (dt <= 0) continue;
    const d = wrap(s[i].ship.heading - s[i - 1].ship.heading);
    rates.push(Math.abs(d / dt) * 180 / Math.PI);
    turns.push({t: s[i].t, d});
  }
  // Windows of WINDOW_S: left, right or straight; a reversal is a left after a right or the reverse, with any straight ones between.
  let reversals = 0;
  let last = 0;
  for (let w0 = s.length ? s[0].t : 0, end = s.length ? s[s.length - 1].t : 0; w0 + WINDOW_S <= end; w0 += WINDOW_S) {
    const sum = turns.filter((x) => x.t > w0 && x.t <= w0 + WINDOW_S).reduce((a, x) => a + x.d, 0);
    const rate = sum / WINDOW_S;
    const dir = rate > STRAIGHT_RAD_S ? 1 : rate < -STRAIGHT_RAD_S ? -1 : 0;
    if (dir !== 0) {
      if (last !== 0 && dir !== last) reversals++;
      last = dir;
    }
  }
  const seconds = s.length > 1 ? s[s.length - 1].t - s[0].t : 0;
  const sorted = [...rates].sort((a, b) => a - b);
  const km = s.map((f) => Math.hypot(f.ship.x - f.px, f.ship.y - f.py) / pxPerKm).sort((a, b) => a - b);
  const r1 = (x: number) => Math.round(x * 10) / 10;
  return {seconds: r1(seconds), frames: s.length, medianDegS: r1(pct(sorted, 0.5)), p95DegS: r1(pct(sorted, 0.95)), maxDegS: r1(sorted[sorted.length - 1] ?? NaN), reversalsPerMin: r1(seconds > 0 ? reversals / seconds * 60 : NaN), medianKm: Math.round(pct(km, 0.5) * 100) / 100};
}

/** The ids of the hostiles in a recording. */
export const flightIds = (frames: Frame[]) => [...new Set(frames.flatMap((f) => f.ships.map((s) => s.id)))];
