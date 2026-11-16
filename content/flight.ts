// Flight numbers shared by the flight loop in App.tsx and the screens that
// show speed (Ship stats, the Navigation and Cargo Trim skill cards). Pure
// functions only.
//
// The flight loop, each frame: speed += thrust·dt, then speed ×= SPACE_DRAG^(dt·60),
// then speed is held under the cap. Holding thrust, speed settles where the two
// balance, v = 0.96·(v + T/60), so v = 0.96·T / (60·0.04) = 0.4·T. That is about
// 88 m/s on a Ferrier, well under its 320 m/s cap, so thrust sets the top speed
// a player reaches and the cap only matters if thrust ever grows past 2.5× the cap.

import {FULL_HOLD_SPEED_CUT} from './skills';

/** Speed kept per 1/60 s of flight (space drag). */
export const SPACE_DRAG = 0.96;
/** Share of thrust a full hold costs, before Cargo Trim. */
export const FULL_HOLD_THRUST_CUT = 0.4;

export interface SpeedInputs {
  /** constants.ts playerThrust. */
  baseThrust: number;
  /** constants.ts playerMaxSpeed. */
  baseMaxSpeed: number;
  /** Navigation level, 0 to 5. */
  navigation: number;
  /** 1.15 with a thruster hardpoint, else 1. */
  hullMult: number;
  /** content/fitting.ts fittedSpeedMult: 0.8 with a Bulk Hold. */
  moduleMult: number;
  /** Hold load after Cargo Trim (content/skills.ts effectiveLoad), 0 to 1. */
  load: number;
}

/** Thrust and speed cap the flight loop uses, before Rift decay. */
export function flightLimits(i: SpeedInputs): {thrust: number; cap: number} {
  const common = (1 + 0.1 * i.navigation) * i.hullMult * i.moduleMult;
  return {
    thrust: i.baseThrust * common * (1 - FULL_HOLD_THRUST_CUT * i.load),
    cap: i.baseMaxSpeed * common * (1 - FULL_HOLD_SPEED_CUT * i.load),
  };
}

/** The speed holding thrust settles at: where thrust and drag balance, or the cap if lower. */
export function topSpeed(i: SpeedInputs): number {
  const {thrust, cap} = flightLimits(i);
  return Math.min(cap, (SPACE_DRAG * thrust) / (60 * (1 - SPACE_DRAG)));
}
