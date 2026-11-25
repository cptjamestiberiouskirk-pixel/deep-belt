// Hostile catalog (design/content-tree.md, section 5, "A hostile that stands off past
// 8 km", step 49; built in step 50). The Skiff is its first entry. Today's other
// hostiles still keep their numbers in App.tsx; they move here in later steps, so until
// then two places hold hostile numbers.

export interface HostileDef {
  /** Starts with `raider_`, so App.tsx isHostileTarget treats it as hostile. */
  id: string;
  name: string;
  shield: number;
  armor: number;
  hull: number;
  /** Share of a plain Ferrier's top speed at Navigation 0 (App.tsx hostileBaseSpeed, 88 px/s). */
  speedShare: number;
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
 */
export const SKIFF: HostileDef = {
  id: 'raider_skiff',
  name: 'Raider Skiff',
  shield: 60,
  armor: 40,
  hull: 30,
  speedShare: 1.0,
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
