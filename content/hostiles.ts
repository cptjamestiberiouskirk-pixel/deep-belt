// Hostile catalog (design/content-tree.md, section 5, "A hostile that stands off past
// 8 km", step 49; built in step 50). The Skiff is its first entry. Today's other
// hostiles still keep their numbers in App.tsx; they move here in later steps, so until
// then two places hold hostile numbers. Every hostile turns through steerHeading here, and
// every engaged hostile but the Rift Warden steers to the turn standoffTurn gives (step 52).

export interface HostileDef {
  /** Starts with `raider_`, so App.tsx isHostileTarget treats it as hostile. */
  id: string;
  name: string;
  shield: number;
  armor: number;
  hull: number;
  /** Share of a plain Ferrier's top speed at Navigation 0 (App.tsx hostileBaseSpeed, 88 px/s). */
  speedShare: number;
  /** The fastest it turns, in rad/s: steerHeading's cap for all its steering (step 52). */
  turnRadS: number;
  /** The distance it holds from the player, in km. */
  standoffKm: number;
  /** It closes or backs off when farther or nearer than the standoff by more than this; inside it, it orbits and steers back toward the standoff. */
  standoffBandKm: number;
  /** It fires only within this distance, in km, and only while the player is not warping. */
  fireRangeKm: number;
  /** Damage per bolt. */
  boltDamage: number;
  /** Seconds between bolts. */
  fireCycleSec: number;
  /** Seconds before it comes back after a kill. The wait counts down in any system while the ship is undocked, as the pirates' waits do. */
  respawnSec: number;
  /** MARKS for a kill. */
  bounty: number;
  /** Its post in its system, in world px: it patrols here and returns here when not fighting. */
  postX: number;
  postY: number;
  /** The radius of the circle it patrols around its post when not fighting, in km. */
  patrolRadiusKm: number;
  /** It stops fighting and goes back to its post once the player is farther than this from the post, in km. */
  leashKm: number;
  /** It (re)appears only while the player is farther than this from its post, in km, so it never pops into view, or as the player arrives in its system. */
  spawnClearKm: number;
}

/**
 * The Skiff (step 50): a light kiting hostile in Vael that holds 9.5 km and fires from
 * up to 12 km at the player's own top speed, so a Light Cannon (8 km) cannot reach it
 * without Navigation. A Lance Driver (12 km) can, and a warp ends its fire at once.
 * Raider-light: a raider's 60 shield, 40 armor and 30 hull, and a raider's 8-damage bolt
 * every 3 s. Its post is 10.5 km from both places a ship comes out by the Vael gate: a jump
 * from Harrow (App.tsx puts the ship at -2200, 1580) and a warp to the gate (the ship comes to
 * rest near -2311, 1696, measured). It patrols only 1.2 km around the post, so either arrival
 * is 9.3 to 11.7 km from it: inside its 12 km sight, outside a Light Cannon's 8 km. It meets
 * every ship that comes into Vael, and it does not join the Vael pirate's fight at the Vael
 * Belt (the probe lost a Gunnery III ship parked there in about 30 s, most of it to that
 * pirate, so a Skiff there could not be measured).
 * Shown as "Raider Skiff": the hangar already has a player hull called the Shade Skiff.
 * It turns at 3.5 rad/s, not the 1.5 of the other hostiles: a kiter must turn about faster
 * than a charging ship closes its 1.5 km margin over a Light Cannon (at 1.5 rad/s a ship
 * charging it got to 6.2 km, step 52's probe).
 */
export const SKIFF: HostileDef = {
  id: 'raider_skiff',
  name: 'Raider Skiff',
  shield: 60,
  armor: 40,
  hull: 30,
  speedShare: 1.0,
  turnRadS: 3.5,
  standoffKm: 9.5,
  standoffBandKm: 0.6,
  fireRangeKm: 12,
  boltDamage: 8,
  fireCycleSec: 3,
  respawnSec: 180,
  bounty: 300,
  postX: -2629,
  postY: 1281,
  patrolRadiusKm: 1.2,
  leashKm: 25,
  spawnClearKm: 20,
};

/**
 * How near the player must be before the Skiff starts a fight unprovoked, in km: its
 * fire range for a ship with the usual 8 km signature, and less for a quieter one in
 * the same proportion (the Shade's 3 km signature gives 4.5 km). The Vael pirate's
 * trigger is the signature itself; the Skiff sees farther because it fights farther.
 */
export function skiffAggroKm(signatureKm: number): number {
  return SKIFF.fireRangeKm * (signatureKm / 8);
}

/**
 * The turn, in radians, that a hostile inside its standoff band adds to the tangent of its
 * orbit around the ship: it steers to angleFromPlayer + pi/2 + this, where angleFromPlayer
 * points from the ship to the hostile. A positive turn bends the orbit inward and a negative
 * one outward, so a hostile past its standoff turns in, one short of it turns out, and one at
 * it flies the tangent: it holds its standoff. At most 0.4 rad (about 23 degrees). Since step
 * 52 App.tsx reaches it through standoffTurn, which is this inside the band: the Belt Two and
 * Vael pirate, the raider loop (wave raiders and the Skiff), the Ash Drift heavy pirate, the
 * Rift Corsair and the Rift Sentinel. The Rift Warden flies the plain tangent, with no turn.
 * Before step 51, App.tsx had five copies with the opposite sign, so a hostile rode a band
 * edge; step 50 had turned around only the Skiff's branch of the raider copy.
 */
export function inBandTurn(distanceKm: number, standoffKm: number): number {
  return Math.max(-0.4, Math.min(0.4, (distanceKm - standoffKm) * 0.4));
}

/** The width, in km, of the outer part of each side of a band, over which the turn off the tangent grows to a quarter turn (standoffTurn). */
export const STANDOFF_RAMP_KM = 0.3;

/**
 * The turn off the tangent of a hostile's orbit around the ship, for every distance (step 52):
 * App.tsx steers an engaged hostile to angleFromPlayer + pi/2 + this. In the middle of the band
 * it is inBandTurn; over the band's last STANDOFF_RAMP_KM on each side it grows to a quarter
 * turn, pi/2, reached at the edge and held past it: straight at the ship past the outer edge and
 * straight away from it inside the inner edge, from the same edges as the old approach and
 * back-off cases. It never jumps: before, the target heading jumped about 76 degrees at each band
 * edge, and a hostile flying at an edge flipped between two headings. A ramp past the edges
 * instead let a ship that charged the Skiff at its own speed settle at 8.6 km, not 8.9.
 */
export function standoffTurn(distanceKm: number, standoffKm: number, bandKm: number): number {
  const off = distanceKm - standoffKm;
  const ramp = Math.min(STANDOFF_RAMP_KM, bandKm);
  const inner = bandKm - ramp;
  if (Math.abs(off) <= inner) return inBandTurn(distanceKm, standoffKm);
  const side = Math.sign(off);
  const start = Math.abs(inBandTurn(standoffKm + side * inner, standoffKm));
  return side * (start + (Math.PI / 2 - start) * Math.min(1, (Math.abs(off) - inner) / ramp));
}

/** The fastest a hostile turns, in radians a second (86 degrees a second), unless steerHeading is given another cap (the Skiff's turnRadS). */
export const HOSTILE_MAX_TURN_RAD_S = 1.5;
/** The most a hostile's turn rate changes in a second at that cap: a turn starts and ends over a third of a second. A cap given to steerHeading gets the same third of a second. */
export const HOSTILE_TURN_ACCEL_RAD_S2 = 4.5;
/** Per second, the share of the gap between heading and target that a hostile turns to close, on top of the target's own rotation. */
const TURN_GAIN_PER_S = 3;

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clampAbs = (x: number, most: number) => Math.max(-most, Math.min(most, x));

type TurnState = {heading: number; rate: number; target: number | null};
// Beside each hostile, not on it, so nothing is saved. Hostile objects live across frames.
const turnStates = new WeakMap<object, TurnState>();

/**
 * Turns `ship` toward `target` for a step of `dt` seconds, as a ship turns (step 52): at most
 * `maxRate` rad/s, its turn rate changing by at most three times `maxRate` a second, so it flies
 * straight or in a steady arc and never flips from frame to frame. It adds the target's own
 * rotation, so it holds a steady orbit without lagging outward. It starts from no turn whenever
 * the heading was set outside it (a spawn, a respawn), and a step of 0 s or less changes nothing.
 * Every hostile turn in App.tsx goes through it; only a spawn or respawn sets a heading outright.
 */
export function steerHeading(ship: {heading: number}, target: number, dt: number, maxRate = HOSTILE_MAX_TURN_RAD_S): void {
  if (!(dt > 0)) return;
  let st = turnStates.get(ship);
  if (!st || st.heading !== ship.heading) {
    st = {heading: ship.heading, rate: 0, target: null};
    turnStates.set(ship, st);
  }
  const targetRate = st.target === null ? 0 : clampAbs(wrapAngle(target - st.target) / dt, maxRate);
  const want = clampAbs(targetRate + TURN_GAIN_PER_S * wrapAngle(target - ship.heading), maxRate);
  const accel = maxRate * (HOSTILE_TURN_ACCEL_RAD_S2 / HOSTILE_MAX_TURN_RAD_S);
  st.rate += clampAbs(want - st.rate, accel * dt);
  ship.heading += st.rate * dt;
  st.heading = ship.heading;
  st.target = target;
}
