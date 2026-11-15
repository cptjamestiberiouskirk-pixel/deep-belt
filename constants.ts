/**
 * Configuration for Deep Belt
 */
export const MINING_RANGE_KM = 8.0;

export interface RiftGuardianEntity {
  id: string;
  name: string;
  kind: 'sentinel' | 'warden';
  stageId: string;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  vx: number;
  vy: number;
  heading: number;
  shield: number;
  maxShield: number;
  armor: number;
  maxArmor: number;
  hull: number;
  maxHull: number;
  isAlive: boolean;
  fireTimer: number;
  // Warden shockwave mechanics:
  shockwaveTimer?: number; // 0..12s
  telegraphTimer?: number; // 1.5s countdown when telegraphed
  isTelegraphing?: boolean;
}

export interface RiftStageDef {
  id: string;
  name: string;
  conduitPos?: { x: number; y: number };
  gatePos?: { x: number; y: number };
  sentinels: { x: number; y: number }[];
  warden?: { x: number; y: number };
  caches: { id: string; x: number; y: number; reward: { credits?: number; item?: string; qty?: number } }[];
  exotics: {
    prismite: { x: number; y: number; qty: number };
    nimbus: { x: number; y: number; qty: number };
    radflux: { x: number; y: number; qty: number };
  };
}

export const RIFT_STAGES: RiftStageDef[] = [
  {
    id: 'stage_1',
    name: 'Fracture Shelf',
    conduitPos: { x: 5000, y: -3000 },
    sentinels: [
      { x: 2500, y: -1500 },
      { x: 4200, y: -2200 },
    ],
    caches: [
      { id: 'c1a', x: 1800, y: 1200, reward: { credits: 1200 } },
      { id: 'c1b', x: 3600, y: -3400, reward: { item: 'latticeAlloy', qty: 2 } },
    ],
    exotics: {
      prismite: { x: 1000, y: -800, qty: 6 },
      nimbus: { x: 2600, y: 400, qty: 6 },
      radflux: { x: 4400, y: -600, qty: 6 },
    },
  },
  {
    id: 'stage_2',
    name: 'Ember Vault',
    conduitPos: { x: -4500, y: -4000 },
    sentinels: [
      { x: -1500, y: -1800 },
      { x: -3000, y: -2600 },
      { x: -4000, y: -3400 },
    ],
    caches: [
      { id: 'c2a', x: -2600, y: -600, reward: { item: 'quantumCore', qty: 1 } },
      { id: 'c2b', x: -1200, y: -3800, reward: { item: 'riftSync', qty: 1 } },
    ],
    exotics: {
      prismite: { x: -800, y: -1200, qty: 8 },
      nimbus: { x: -2200, y: -2000, qty: 8 },
      radflux: { x: -3600, y: -1800, qty: 8 },
    },
  },
  {
    id: 'stage_3',
    name: 'Core Breach',
    gatePos: { x: 0, y: 6000 },
    sentinels: [
      { x: -1200, y: 2400 },
      { x: 1200, y: 2400 },
      { x: 0, y: 4200 },
    ],
    warden: { x: 0, y: 5400 },
    caches: [
      { id: 'c3a', x: -2400, y: 3600, reward: { item: 'thermalGrid', qty: 1 } },
      { id: 'c3b', x: 2400, y: 3600, reward: { credits: 4000 } },
    ],
    exotics: {
      prismite: { x: -1000, y: 1200, qty: 10 },
      nimbus: { x: 1000, y: 1200, qty: 10 },
      radflux: { x: 0, y: 3000, qty: 10 },
    },
  },
];

export function getRiftDecayPhase(left: number | undefined): number {
  if (left === undefined) return 1;
  const elapsed = Math.floor(1200 - left);
  if (elapsed >= 900) return 4;
  if (elapsed >= 600) return 3;
  if (elapsed >= 300) return 2;
  return 1;
}

export function getRiftDecaySpeedMult(system: string, left: number | undefined): number {
  if (system !== 'Rift' || left === undefined) return 1.0;
  const elapsed = Math.floor(1200 - left);
  if (elapsed >= 900) return 0.70;
  if (elapsed >= 600) return 0.85;
  return 1.0;
}

export function getRiftPhaseRoman(phase: number): string {
  if (phase === 4) return 'IV';
  if (phase === 3) return 'III';
  if (phase === 2) return 'II';
  return 'I';
}

export const THEME = {
  ink: '#0A0E1A',
  panel: '#1A2133',
  panel2: '#252F47',
  hover: '#33405F',
  well: '#0F1424',
  text: '#F6EED8',
  dim: '#AEB6CA',
  primary: '#2EC4B6',
  amber: '#FFB547',
  hostile: '#FF5A5F',
  good: '#8BD17C',
  shield: '#4CC9F0',
  armor: '#F4A259',
  hull: '#8BD17C',
  cap: '#FFD166',
  scrim: 'rgba(10, 14, 26, 0.62)',
  fontHeading: "'Fredoka', cursive, sans-serif",
  fontBody: "'Inter', sans-serif",
  fontMono: "'JetBrains Mono', monospace",
};

export const CONFIG = {
  // Game Info
  title: {
    value: 'Deep Belt',
    type: 'string',
    label: 'Game Title',
    group: 'GAME',
  },
  baseCanvasWidth: {
    value: 1280,
    type: 'number',
    label: 'Base Canvas Width',
    group: 'GAME',
  },
  baseCanvasHeight: {
    value: 800,
    type: 'number',
    label: 'Base Canvas Height',
    group: 'GAME',
  },

  // System Constants
  targetFPS: {
    value: 60,
    type: 'number',
    label: 'Target FPS',
    group: 'SYSTEM',
  },
  stepMs: {
    value: 1000 / 60,
    type: 'number',
    label: 'Step MS',
    group: 'SYSTEM',
  },
  maxSubSteps: {
    value: 5,
    type: 'number',
    label: 'Max Sub Steps',
    group: 'SYSTEM',
  },

  // Audio Settings
  defaultMusicVolume: {
    value: 0.6,
    type: 'number',
    label: 'Default Music Volume',
    group: 'AUDIO',
  },
  defaultSfxVolume: {
    value: 0.3,
    type: 'number',
    label: 'Default SFX Volume',
    group: 'AUDIO',
  },

  // Flight & Propulsion Tuning (Physics / Rules)
  playerThrust: {
    value: 220,
    type: 'number',
    label: 'Player Thruster Power',
    group: 'Physics',
  },
  playerMaxSpeed: {
    value: 320,
    type: 'number',
    label: 'Player Max Speed',
    group: 'Physics',
  },
  playerTurnSpeed: {
    value: 3.2,
    type: 'number',
    label: 'Ship Turn Rate (rad/s)',
    group: 'Physics',
  },
  afterburnerSpeedBoost: {
    value: 1.8,
    type: 'number',
    label: 'Afterburner Boost Factor',
    group: 'Physics',
  },

  // Mining & Cargo Rules
  laserMiningRate: {
    value: 50,
    type: 'number',
    label: 'Laser Ore Yield per Cycle',
    group: 'Rules',
  },
  cargoBaseCapacity: {
    value: 500,
    type: 'number',
    label: 'Base Cargo Hold Capacity',
    group: 'Rules',
  },
  shieldRegenRate: {
    value: 8,
    type: 'number',
    label: 'Shield Booster Pulse Regen',
    group: 'Rules',
  },
  maxCapacitor: {
    value: 100,
    type: 'number',
    label: 'Max Ship Capacitor',
    group: 'Rules',
  },
  capacitorRegenRate: {
    value: 2.5,
    type: 'number',
    label: 'Capacitor Regen Rate (Cap/s)',
    group: 'Rules',
  },
  miningLaserCapCost: {
    value: 12,
    type: 'number',
    label: 'Mining Laser Activation Cap Cost',
    group: 'Rules',
  },
  lightCannonCapCost: {
    value: 8,
    type: 'number',
    label: 'Light Cannon Firing Cap Cost',
    group: 'Rules',
  },
  shieldBoosterCapCost: {
    value: 25,
    type: 'number',
    label: 'Shield Booster Cycle Cap Cost',
    group: 'Rules',
  },
  warpCapCost: {
    value: 20,
    type: 'number',
    label: 'Warp Spool Cap Cost',
    group: 'Rules',
  },
  warpTravelSpeed: {
    value: 1800,
    type: 'number',
    label: 'Warp Transit Speed',
    group: 'Physics',
  },

  // Economy & Market Values
  ferriteUnitPrice: {
    value: 12,
    type: 'number',
    label: 'Ferrite Ore Market Price (MARKS)',
    group: 'Economy',
  },
  auriteUnitPrice: {
    value: 30,
    type: 'number',
    label: 'Aurite Ore Market Price (MARKS)',
    group: 'Economy',
  },
  chromiteHarrowUnitPrice: {
    value: 25,
    type: 'number',
    label: 'Chromite Ore Harrow Price (MARKS)',
    group: 'Economy',
  },
  chromiteVaelUnitPrice: {
    value: 20,
    type: 'number',
    label: 'Chromite Ore Vael Price (MARKS)',
    group: 'Economy',
  },
  pyroxUnitPrice: {
    value: 20,
    type: 'number',
    label: 'Pyrox Ore Market Price (MARKS)',
    group: 'Economy',
  },
  tritaniumUnitPrice: {
    value: 20,
    type: 'number',
    label: 'Tritanium Mineral Price (MARKS)',
    group: 'Economy',
  },
  auriteConcentrateUnitPrice: {
    value: 38,
    type: 'number',
    label: 'Aurite Concentrate Price (MARKS)',
    group: 'Economy',
  },
  chromiteBarUnitPrice: {
    value: 30,
    type: 'number',
    label: 'Chromite Bar Price (MARKS)',
    group: 'Economy',
  },
  pyroxiteUnitPrice: {
    value: 28,
    type: 'number',
    label: 'Pyroxite Mineral Price (MARKS)',
    group: 'Economy',
  },
  rawOreUnitPrice: {
    value: 36,
    type: 'number',
    label: 'Rare Ore Canister Market Price (MARKS)',
    group: 'Economy',
  },
  pirateBountyMarks: {
    value: 250,
    type: 'number',
    label: 'Pirate Frigate Bounty (MARKS)',
    group: 'Economy',
  },
  vaelPirateBountyMarks: {
    value: 600,
    type: 'number',
    label: 'Vael Heavy Pirate Frigate Bounty (MARKS)',
    group: 'Economy',
  },
  cannonModulePrice: {
    value: 600,
    type: 'number',
    label: 'Light Cannon Module Price (MARKS)',
    group: 'Economy',
  },
  probeLauncherPrice: {
    value: 450,
    type: 'number',
    label: 'Core Probe Launcher Price (MARKS)',
    group: 'Economy',
  },
  dataCacheRewardMarks: {
    value: 600,
    type: 'number',
    label: 'Data Cache Salvage Reward (MARKS)',
    group: 'Economy',
  },

  // Asset Dimensions and Aspect Ratios (Authoritative from read_assets_metadata)
  assetPirateShipWidth: {
    value: 925,
    type: 'number',
    label: 'Pirate Frigate Width',
    group: 'ASSETS',
  },
  assetPirateShipHeight: {
    value: 435,
    type: 'number',
    label: 'Pirate Frigate Height',
    group: 'ASSETS',
  },
  assetPirateShipAspectRatio: {
    value: 925 / 435, // 2.1264
    type: 'number',
    label: 'Pirate Frigate Aspect Ratio',
    group: 'ASSETS',
  },

  assetPirateShipVaelWidth: {
    value: 896,
    type: 'number',
    label: 'Vael Heavy Pirate Frigate Width',
    group: 'ASSETS',
  },
  assetPirateShipVaelHeight: {
    value: 486,
    type: 'number',
    label: 'Vael Heavy Pirate Frigate Height',
    group: 'ASSETS',
  },
  assetPirateShipVaelAspectRatio: {
    value: 896 / 486, // 1.8436
    type: 'number',
    label: 'Vael Heavy Pirate Frigate Aspect Ratio',
    group: 'ASSETS',
  },

  assetModuleCannonWidth: {
    value: 652,
    type: 'number',
    label: 'Light Cannon Module Icon Width',
    group: 'ASSETS',
  },
  assetModuleCannonHeight: {
    value: 652,
    type: 'number',
    label: 'Light Cannon Module Icon Height',
    group: 'ASSETS',
  },

  assetPlayerShipWidth: {
    value: 801,
    type: 'number',
    label: 'Player Ship Width',
    group: 'ASSETS',
  },
  assetPlayerShipHeight: {
    value: 475,
    type: 'number',
    label: 'Player Ship Height',
    group: 'ASSETS',
  },
  assetPlayerShipAspectRatio: {
    value: 801 / 475, // 1.6863
    type: 'number',
    label: 'Player Ship Aspect Ratio',
    group: 'ASSETS',
  },

  assetPlayerShipTernWidth: {
    value: 874,
    type: 'number',
    label: 'Player Ship Tern Width',
    group: 'ASSETS',
  },
  assetPlayerShipTernHeight: {
    value: 495,
    type: 'number',
    label: 'Player Ship Tern Height',
    group: 'ASSETS',
  },
  assetPlayerShipTernAspectRatio: {
    value: 874 / 495, // 1.76565
    type: 'number',
    label: 'Player Ship Tern Aspect Ratio',
    group: 'ASSETS',
  },

  assetPlayerShipSkirmisherWidth: {
    value: 875,
    type: 'number',
    label: 'Player Ship Skirmisher Width',
    group: 'ASSETS',
  },
  assetPlayerShipSkirmisherHeight: {
    value: 471,
    type: 'number',
    label: 'Player Ship Skirmisher Height',
    group: 'ASSETS',
  },
  assetPlayerShipSkirmisherAspectRatio: {
    value: 875 / 471, // 1.85775
    type: 'number',
    label: 'Player Ship Skirmisher Aspect Ratio',
    group: 'ASSETS',
  },

  assetPlayerShipLatticeWidth: {
    value: 971,
    type: 'number',
    label: 'Player Ship Lattice Width',
    group: 'ASSETS',
  },
  assetPlayerShipLatticeHeight: {
    value: 617,
    type: 'number',
    label: 'Player Ship Lattice Height',
    group: 'ASSETS',
  },
  assetPlayerShipLatticeAspectRatio: {
    value: 971 / 617, // 1.5737
    type: 'number',
    label: 'Player Ship Lattice Aspect Ratio',
    group: 'ASSETS',
  },

  assetSpaceStationWidth: {
    value: 919,
    type: 'number',
    label: 'Space Station Width',
    group: 'ASSETS',
  },
  assetSpaceStationHeight: {
    value: 661,
    type: 'number',
    label: 'Space Station Height',
    group: 'ASSETS',
  },
  assetSpaceStationAspectRatio: {
    value: 919 / 661, // 1.3903
    type: 'number',
    label: 'Space Station Aspect Ratio',
    group: 'ASSETS',
  },

  assetStationInteriorWidth: {
    value: 1376,
    type: 'number',
    label: 'Station Interior Width',
    group: 'ASSETS',
  },
  assetStationInteriorHeight: {
    value: 768,
    type: 'number',
    label: 'Station Interior Height',
    group: 'ASSETS',
  },
  assetStationInteriorAspectRatio: {
    value: 1376 / 768, // 1.7916
    type: 'number',
    label: 'Station Interior Aspect Ratio',
    group: 'ASSETS',
  },

  assetVaelInteriorWidth: {
    value: 1376,
    type: 'number',
    label: 'Vael Station Interior Width',
    group: 'ASSETS',
  },
  assetVaelInteriorHeight: {
    value: 768,
    type: 'number',
    label: 'Vael Station Interior Height',
    group: 'ASSETS',
  },
  assetVaelInteriorAspectRatio: {
    value: 1376 / 768, // 1.7916
    type: 'number',
    label: 'Vael Station Interior Aspect Ratio',
    group: 'ASSETS',
  },

  assetSpaceNebulaBgWidth: {
    value: 1376,
    type: 'number',
    label: 'Space Nebula Background Width',
    group: 'ASSETS',
  },
  assetSpaceNebulaBgHeight: {
    value: 768,
    type: 'number',
    label: 'Space Nebula Background Height',
    group: 'ASSETS',
  },
  assetSpaceNebulaBgAspectRatio: {
    value: 1376 / 768,
    type: 'number',
    label: 'Space Nebula Background Aspect Ratio',
    group: 'ASSETS',
  },

  assetSpaceAshNebulaBgWidth: {
    value: 1376,
    type: 'number',
    label: 'Space Ash Nebula Background Width',
    group: 'ASSETS',
  },
  assetSpaceAshNebulaBgHeight: {
    value: 768,
    type: 'number',
    label: 'Space Ash Nebula Background Height',
    group: 'ASSETS',
  },
  assetSpaceAshNebulaBgAspectRatio: {
    value: 1376 / 768,
    type: 'number',
    label: 'Space Ash Nebula Background Aspect Ratio',
    group: 'ASSETS',
  },

  assetAsteroidFerriteWidth: {
    value: 715,
    type: 'number',
    label: 'Ferrite Asteroid Width',
    group: 'ASSETS',
  },
  assetAsteroidFerriteHeight: {
    value: 652,
    type: 'number',
    label: 'Ferrite Asteroid Height',
    group: 'ASSETS',
  },
  assetAsteroidFerriteAspectRatio: {
    value: 715 / 652, // 1.0966
    type: 'number',
    label: 'Ferrite Asteroid Aspect Ratio',
    group: 'ASSETS',
  },

  assetAsteroidAuriteWidth: {
    value: 722,
    type: 'number',
    label: 'Aurite Asteroid Width',
    group: 'ASSETS',
  },
  assetAsteroidAuriteHeight: {
    value: 586,
    type: 'number',
    label: 'Aurite Asteroid Height',
    group: 'ASSETS',
  },
  assetAsteroidAuriteAspectRatio: {
    value: 722 / 586, // 1.2321
    type: 'number',
    label: 'Aurite Asteroid Aspect Ratio',
    group: 'ASSETS',
  },

  assetAsteroidChromiteWidth: {
    value: 844,
    type: 'number',
    label: 'Chromite Asteroid Width',
    group: 'ASSETS',
  },
  assetAsteroidChromiteHeight: {
    value: 666,
    type: 'number',
    label: 'Chromite Asteroid Height',
    group: 'ASSETS',
  },
  assetAsteroidChromiteAspectRatio: {
    value: 844 / 666, // 1.2673
    type: 'number',
    label: 'Chromite Asteroid Aspect Ratio',
    group: 'ASSETS',
  },

  assetAsteroidPyroxWidth: {
    value: 620,
    type: 'number',
    label: 'Pyrox Asteroid Width',
    group: 'ASSETS',
  },
  assetAsteroidPyroxHeight: {
    value: 534,
    type: 'number',
    label: 'Pyrox Asteroid Height',
    group: 'ASSETS',
  },
  assetAsteroidPyroxAspectRatio: {
    value: 620 / 534, // 1.1610
    type: 'number',
    label: 'Pyrox Asteroid Aspect Ratio',
    group: 'ASSETS',
  },

  assetAsteroidRareWidth: {
    value: 737,
    type: 'number',
    label: 'Rare Ore Crystal Asteroid Width',
    group: 'ASSETS',
  },
  assetAsteroidRareHeight: {
    value: 756,
    type: 'number',
    label: 'Rare Ore Crystal Asteroid Height',
    group: 'ASSETS',
  },
  assetAsteroidRareAspectRatio: {
    value: 737 / 756, // 0.974868
    type: 'number',
    label: 'Rare Ore Crystal Asteroid Aspect Ratio',
    group: 'ASSETS',
  },

  assetAsteroidOreWidth: {
    value: 737,
    type: 'number',
    label: 'Ore Asteroid Width',
    group: 'ASSETS',
  },
  assetAsteroidOreHeight: {
    value: 756,
    type: 'number',
    label: 'Ore Asteroid Height',
    group: 'ASSETS',
  },
  assetAsteroidOreAspectRatio: {
    value: 737 / 756,
    type: 'number',
    label: 'Ore Asteroid Aspect Ratio',
    group: 'ASSETS',
  },

  assetShipWreckDebrisWidth: {
    value: 899,
    type: 'number',
    label: 'Ship Wreck Debris Width',
    group: 'ASSETS',
  },
  assetShipWreckDebrisHeight: {
    value: 623,
    type: 'number',
    label: 'Ship Wreck Debris Height',
    group: 'ASSETS',
  },
  assetShipWreckDebrisAspectRatio: {
    value: 899 / 623, // 1.4430
    type: 'number',
    label: 'Ship Wreck Debris Aspect Ratio',
    group: 'ASSETS',
  },

  assetSystemGateWidth: {
    value: 700,
    type: 'number',
    label: 'System Gate Width',
    group: 'ASSETS',
  },
  assetSystemGateHeight: {
    value: 884,
    type: 'number',
    label: 'System Gate Height',
    group: 'ASSETS',
  },
  assetSystemGateAspectRatio: {
    value: 700 / 884, // 0.79185
    type: 'number',
    label: 'System Gate Aspect Ratio',
    group: 'ASSETS',
  },

  assetBeltNavBeaconWidth: {
    value: 517,
    type: 'number',
    label: 'Belt Nav Beacon Width',
    group: 'ASSETS',
  },
  assetBeltNavBeaconHeight: {
    value: 649,
    type: 'number',
    label: 'Belt Nav Beacon Height',
    group: 'ASSETS',
  },
  assetBeltNavBeaconAspectRatio: {
    value: 517 / 649, // 0.7966
    type: 'number',
    label: 'Belt Nav Beacon Aspect Ratio',
    group: 'ASSETS',
  },

  assetModuleProbeLauncherWidth: {
    value: 619,
    type: 'number',
    label: 'Core Probe Launcher Icon Width',
    group: 'ASSETS',
  },
  assetModuleProbeLauncherHeight: {
    value: 556,
    type: 'number',
    label: 'Core Probe Launcher Icon Height',
    group: 'ASSETS',
  },

  assetDataCacheContainerWidth: {
    value: 413,
    type: 'number',
    label: 'Data Cache Container Width',
    group: 'ASSETS',
  },
  assetDataCacheContainerHeight: {
    value: 826,
    type: 'number',
    label: 'Data Cache Container Height',
    group: 'ASSETS',
  },
  assetDataCacheContainerAspectRatio: {
    value: 413 / 826, // 0.5
    type: 'number',
    label: 'Data Cache Container Aspect Ratio',
    group: 'ASSETS',
  },

  assetMissionAgentOskWidth: {
    value: 512,
    type: 'number',
    label: 'Mission Agent Osk Width',
    group: 'ASSETS',
  },
  assetMissionAgentOskHeight: {
    value: 512,
    type: 'number',
    label: 'Mission Agent Osk Height',
    group: 'ASSETS',
  },
};

// Merge customized config values if present (injected by Playground)
const {playgroundConfig} = globalThis as {
  playgroundConfig?: Record<string, unknown>;
};
if (playgroundConfig) {
  for (const [key, value] of Object.entries(playgroundConfig)) {
    if (key in CONFIG) {
      Object.assign(CONFIG[key as keyof typeof CONFIG], {value});
    }
  }
}

/**
 * Type helper for reading values in game code
 */
export type ConfigKey = keyof typeof CONFIG;

/**
 * Gets a configuration value by key.
 * @param key The configuration key.
 * @return The configuration value.
 */
export function getConfig<K extends ConfigKey>(
  key: K,
): (typeof CONFIG)[K]['value'] {
  return CONFIG[key].value;
}

export interface StationPriceSchedule {
  ferrite: number;
  aurite: number;
  chromite: number;
  pyrox: number;
  rare: number;
  scrap: number;
  tritanium: number;
  auriteConc: number;
  chromiteBar: number;
  pyroxite: number;
  hullPlate: number;
  thrusterCoil: number;
  sensorCore: number;
  latticeAlloy: number;
  conductiveMesh: number;
  thermalAlloy: number;
  quantumCore: number;
  integritySeal: number;
  thermalGrid: number;
  prismite: number;
  nimbus: number;
  radflux: number;
  packedPrismite: number;
  packedNimbus: number;
  packedRadflux: number;
  silicateLens: number;
  metallicLens: number;
  exoticLens: number;
  extractDrone: number;
  defenseDrone: number;
  salvageDrone: number;
  commandHub: number;
  polymer: number;
  chemical: number;
  polymerComposite: number;
  pristinePrismite: number;
  pristineNimbus: number;
  pristineRadflux: number;
  riftSync: number;
}

export const STATION_PRICES: Record<'Harrow' | 'Vael', StationPriceSchedule> = {
  Harrow: {
    ferrite: 12,
    aurite: 40,
    chromite: 25,
    pyrox: 20,
    rare: 36,
    scrap: 150,
    tritanium: 31,
    auriteConc: 104,
    chromiteBar: 65,
    pyroxite: 52,
    hullPlate: 1600,
    thrusterCoil: 1950,
    sensorCore: 1250,
    latticeAlloy: 900,
    conductiveMesh: 1600,
    thermalAlloy: 800,
    quantumCore: 4800,
    integritySeal: 3200,
    thermalGrid: 3800,
    prismite: 90,
    nimbus: 70,
    radflux: 140,
    packedPrismite: 900,
    packedNimbus: 700,
    packedRadflux: 1400,
    silicateLens: 800,
    metallicLens: 1200,
    exoticLens: 2400,
    extractDrone: 1500,
    defenseDrone: 1800,
    salvageDrone: 1200,
    commandHub: 6000,
    polymer: 60,
    chemical: 80,
    polymerComposite: 2400,
    pristinePrismite: 300,
    pristineNimbus: 240,
    pristineRadflux: 420,
    riftSync: 0,
  },
  Vael: {
    ferrite: 16,
    aurite: 30,
    chromite: 20,
    pyrox: 24,
    rare: 36,
    scrap: 150,
    tritanium: 42,
    auriteConc: 78,
    chromiteBar: 52,
    pyroxite: 62,
    hullPlate: 1600,
    thrusterCoil: 1950,
    sensorCore: 1250,
    latticeAlloy: 900,
    conductiveMesh: 1600,
    thermalAlloy: 800,
    quantumCore: 4800,
    integritySeal: 3200,
    thermalGrid: 3800,
    prismite: 90,
    nimbus: 70,
    radflux: 140,
    packedPrismite: 900,
    packedNimbus: 700,
    packedRadflux: 1400,
    silicateLens: 800,
    metallicLens: 1200,
    exoticLens: 2400,
    extractDrone: 1500,
    defenseDrone: 1800,
    salvageDrone: 1200,
    commandHub: 6000,
    polymer: 60,
    chemical: 80,
    polymerComposite: 2400,
    pristinePrismite: 300,
    pristineNimbus: 240,
    pristineRadflux: 420,
    riftSync: 0,
  },
};

export interface FabricatorRecipe {
  id: string;
  name: string;
  category?: string;
  inputs: {
    tritanium?: number;
    chromiteBar?: number;
    auriteConc?: number;
    pyroxite?: number;
    scrap?: number;
    latticeAlloy?: number;
    conductiveMesh?: number;
    thermalAlloy?: number;
    quantumCore?: number;
    integritySeal?: number;
    thermalGrid?: number;
    packedPrismite?: number;
    packedNimbus?: number;
    packedRadflux?: number;
    polymer?: number;
    chemical?: number;
    polymerComposite?: number;
  };
  duration: number;
  volume: number;
  sellPrice: number;
  desc?: string;
}

export function meQty(base: number, me: number): number {
  if (base < 1) return 0;
  const clampedME = Math.max(0, Math.min(5, me));
  return Math.max(1, Math.floor(base * (1 - 0.02 * clampedME)));
}

export function teTime(base: number, te: number): number {
  const clampedTE = Math.max(0, Math.min(5, te));
  return base * (1 - 0.04 * clampedTE);
}

export function getRecipeTierMultiplier(recipeId: string): number {
  if (['hull_plate', 'thruster_coil', 'sensor_core'].includes(recipeId)) {
    return 1.0;
  }
  if (['lattice_alloy', 'conductive_mesh', 'thermal_alloy'].includes(recipeId)) {
    return 1.5;
  }
  if (['quantum_core', 'integrity_seal', 'thermal_grid', 'polymer_composite', 'rift_synchronizer'].includes(recipeId)) {
    return 2.0;
  }
  if (['lattice_tender', 'gantry_command', 'gantry_refit'].includes(recipeId)) {
    return 2.5;
  }
  return 1.0;
}

export const FABRICATOR_RECIPES: Record<string, FabricatorRecipe> = {
  hull_plate: {
    id: 'hull_plate',
    name: 'Hull Plate',
    inputs: { tritanium: 20, chromiteBar: 10 },
    duration: 8.0,
    volume: 5,
    sellPrice: 1600,
  },
  thruster_coil: {
    id: 'thruster_coil',
    name: 'Thruster Coil',
    inputs: { auriteConc: 10, pyroxite: 10 },
    duration: 8.0,
    volume: 5,
    sellPrice: 1950,
  },
  sensor_core: {
    id: 'sensor_core',
    name: 'Sensor Core',
    inputs: { auriteConc: 5, chromiteBar: 5, scrap: 1 },
    duration: 10.0,
    volume: 5,
    sellPrice: 1250,
  },
  lattice_alloy: {
    id: 'lattice_alloy',
    name: 'Lattice Alloy',
    inputs: { tritanium: 12, chromiteBar: 6 },
    duration: 12.0,
    volume: 2,
    sellPrice: 900,
  },
  conductive_mesh: {
    id: 'conductive_mesh',
    name: 'Conductive Mesh',
    inputs: { auriteConc: 10, pyroxite: 6 },
    duration: 12.0,
    volume: 2,
    sellPrice: 1600,
  },
  thermal_alloy: {
    id: 'thermal_alloy',
    name: 'Thermal Alloy',
    inputs: { pyroxite: 8, tritanium: 8 },
    duration: 12.0,
    volume: 2,
    sellPrice: 800,
  },
  quantum_core: {
    id: 'quantum_core',
    name: 'Quantum Core',
    inputs: { conductiveMesh: 2, latticeAlloy: 1 },
    duration: 20.0,
    volume: 5,
    sellPrice: 4800,
  },
  integrity_seal: {
    id: 'integrity_seal',
    name: 'Integrity Seal',
    inputs: { latticeAlloy: 2, thermalAlloy: 1 },
    duration: 20.0,
    volume: 5,
    sellPrice: 3200,
  },
  thermal_grid: {
    id: 'thermal_grid',
    name: 'Thermal Grid',
    inputs: { thermalAlloy: 2, conductiveMesh: 1 },
    duration: 20.0,
    volume: 5,
    sellPrice: 3800,
  },
  polymer_composite: {
    id: 'polymer_composite',
    name: 'Polymer Composite',
    category: 'advanced',
    inputs: {
      polymer: 6,
      chemical: 4,
      latticeAlloy: 1,
    },
    duration: 20.0,
    volume: 2,
    sellPrice: 2400,
    desc: 'High-tensile structural polymer composite synthesized from colony polymers, reactive chemicals, and lattice alloys.',
  },
  rift_synchronizer: {
    id: 'rift_synchronizer',
    name: 'Rift Synchronizer',
    category: 'advanced',
    inputs: {
      packedRadflux: 2,
      packedPrismite: 1,
      quantumCore: 1,
      polymerComposite: 1,
    },
    duration: 45.0,
    volume: 5,
    sellPrice: 0,
    desc: 'Harmonic subspace alignment key engineered to penetrate and stabilize Cinder Rift anomaly horizons.',
  },
  gantry_refit: {
    id: 'gantry_refit',
    name: 'Gantry Hold Refit',
    category: 'hull',
    inputs: {
      polymerComposite: 4,
      integritySeal: 1,
      thermalGrid: 1,
    },
    duration: 40.0,
    volume: 0,
    sellPrice: 0,
    desc: 'Structural cargo hold expansion and reinforced bulkhead refit for the Gantry Command flagship. Increases cargo to 2,500 m³ and hull to 150.',
  },
  lattice_tender: {
    id: 'lattice_tender',
    name: 'Lattice Tender Assembly',
    inputs: { quantumCore: 1, integritySeal: 1, thermalGrid: 1 },
    duration: 30.0,
    volume: 0,
    sellPrice: 0,
  },
  gantry_command: {
    id: 'gantry_command',
    name: 'Gantry Command Assembly',
    category: 'hull',
    inputs: {
      quantumCore: 2,
      integritySeal: 2,
      thermalGrid: 1,
      packedPrismite: 2,
      packedRadflux: 1,
    },
    duration: 45.0,
    volume: 0,
    sellPrice: 0,
    desc: 'Assemble the massive Gantry Command industrial flagship hull. Unlocks ship in Hangar.',
  },
};

export const fabricatorRecipeOrder = [
  'hull_plate',
  'thruster_coil',
  'sensor_core',
  'lattice_alloy',
  'conductive_mesh',
  'thermal_alloy',
  'quantum_core',
  'integrity_seal',
  'thermal_grid',
  'polymer_composite',
  'rift_synchronizer',
  'gantry_refit',
  'lattice_tender',
  'gantry_command',
];

export const FABRICATOR_RECIPE_ORDER = fabricatorRecipeOrder;

export function getRecipeCategory(recipeId: string): { chip: string; color: string; groupTitle: string } {
  if (['hull_plate', 'thruster_coil', 'sensor_core'].includes(recipeId)) {
    return { chip: 'T1 PART', color: '#4CC9F0', groupTitle: 'T1 Parts' };
  }
  if (['lattice_alloy', 'conductive_mesh', 'thermal_alloy'].includes(recipeId)) {
    return { chip: 'ALLOY', color: '#FFB547', groupTitle: 'Intermediate Alloys' };
  }
  if (['quantum_core', 'integrity_seal', 'thermal_grid', 'polymer_composite', 'rift_synchronizer'].includes(recipeId)) {
    return { chip: 'ADVANCED', color: '#2EC4B6', groupTitle: 'Advanced Components' };
  }
  if (recipeId === 'lattice_tender' || recipeId === 'gantry_command' || recipeId === 'gantry_refit') {
    return { chip: 'HULL ASSEMBLY', color: '#FFD166', groupTitle: 'Hull Assembly' };
  }
  return { chip: 'COMPONENT', color: '#AEB6CA', groupTitle: 'Components' };
}

export interface HaulContract {
  id: string;
  title: string;
  destName: string;
  destStationId: string;
  destSystem: 'Harrow' | 'Vael';
  partType: 'hullPlate' | 'sensorCore';
  partName: string;
  count: number;
  reward: number;
}

export const HAUL_CONTRACTS: Record<string, HaulContract> = {
  haul_plates_vael: {
    id: 'haul_plates_vael',
    title: 'Haul: Hull Plates to Vael',
    destName: 'Vael Mining Outpost',
    destStationId: 'vael_station',
    destSystem: 'Vael',
    partType: 'hullPlate',
    partName: 'Hull Plates',
    count: 2,
    reward: 600,
  },
  haul_core_harrow: {
    id: 'haul_core_harrow',
    title: 'Haul: Sensor Core to Harrow',
    destName: 'Harrow Station Alpha',
    destStationId: 'station',
    destSystem: 'Harrow',
    partType: 'sensorCore',
    partName: 'Sensor Core',
    count: 1,
    reward: 450,
  },
};

export const HAUL_CONTRACTS_LIST: HaulContract[] = [
  HAUL_CONTRACTS.haul_plates_vael,
  HAUL_CONTRACTS.haul_core_harrow,
];

export interface HullHardpointDef {
  id: 'armor_plate' | 'cargo_pod' | 'thruster' | 'sensor';
  name: string;
  part: 'hullPlate' | 'thrusterCoil' | 'sensorCore';
  partName: string;
  pos: { x: number; y: number };
  effect: string;
  cost: number;
}

export const HULL_HARDPOINTS: HullHardpointDef[] = [
  {
    id: 'armor_plate',
    name: 'Armor Plate',
    part: 'hullPlate',
    partName: 'Hull Plate',
    pos: { x: 0.05, y: -0.28 },
    effect: '+20 HP',
    cost: 1,
  },
  {
    id: 'cargo_pod',
    name: 'Cargo Pod',
    part: 'hullPlate',
    partName: 'Hull Plate',
    pos: { x: 0.00, y: 0.22 },
    effect: '+200 m³',
    cost: 1,
  },
  {
    id: 'thruster',
    name: 'Thruster',
    part: 'thrusterCoil',
    partName: 'Thruster Coil',
    pos: { x: -0.42, y: 0.0 },
    effect: '+15% Speed/Thrust',
    cost: 1,
  },
  {
    id: 'sensor',
    name: 'Sensor',
    part: 'sensorCore',
    partName: 'Sensor Core',
    pos: { x: 0.42, y: 0.0 },
    effect: '+2.0 km Lock Range',
    cost: 1,
  },
];

export const HULL_MODULES: Record<string, HullHardpointDef> = {
  armor_plate: HULL_HARDPOINTS[0],
  cargo_pod: HULL_HARDPOINTS[1],
  thruster: HULL_HARDPOINTS[2],
  sensor: HULL_HARDPOINTS[3],
};

export const SHIP_MODULE_ASSETS = {
  celInk: {
    armor: 'module_armor_plate',
    cargo: 'module_cargo_pod',
    thruster: 'module_thruster',
    sensor: 'module_sensor',
    armor_plate: 'module_armor_plate',
    cargo_pod: 'module_cargo_pod',
  },
};

export const SHIP_HULL_ASSETS = {
  celInk: {
    ferrier: 'player_ship',
    pelican: 'player_ship',
    mule: 'player_ship',
    lattice: 'player_ship_lattice',
    shade: 'player_ship_shade',
    gantry: 'player_ship_gantry',
  } as Record<string, string>,
};

export const LENS_ASSETS = {
  celInk: {
    silicateLens: 'lens_silicate',
    metallicLens: 'lens_metallic',
    exoticLens: 'lens_exotic',
  } as Record<string, string>,
};

export const DRONE_ASSETS = {
  celInk: {
    extractDrone: 'drone_extract',
    defenseDrone: 'drone_defense',
    salvageDrone: 'drone_salvage',
  } as Record<string, string>,
};

export const PLANET_ASSETS = {
  celInk: {
    barren: 'planet_barren',
    gasGiant: 'planet_gas_giant',
    volcanic: 'planet_volcanic',
    oceanic: 'planet_oceanic',
    orbital_depot: 'orbital_depot',
    cargo_rocket: 'cargo_rocket',
  } as Record<string, string>,
};

export const COLONY_ASSETS = {
  celInk: {
    hub: 'icon_command_hub',
    drill: 'icon_drill',
    processor: 'icon_processor',
    pipe: 'icon_pipe',
    polymer: 'polymer',
    chemical: 'chemical',
    polymerComposite: 'polymer_composite',
  } as Record<string, string>,
};

export const RIFT_ASSETS = {
  celInk: {
    anomaly: 'rift_anomaly',
    conduit: 'rift_conduit',
    collapseGate: 'collapse_gate',
    sentinel: 'rift_sentinel',
    warden: 'rift_warden',
    dataContainer: 'data_container',
    pristineCluster: 'pristine_cluster',
    riftSync: 'rift_sync',
    riftBg: 'rift_bg',
    pristinePrismite: 'pristine_prismite',
    pristineNimbus: 'pristine_nimbus',
    pristineRadflux: 'pristine_radflux',
  },
};

export const ASSETS_MANIFEST: Record<string, string> = {
  polymer: 'assets/images/polymer.png',
  chemical: 'assets/images/chemical.png',
  rift_anomaly: 'assets/images/rift_anomaly.png',
  rift_conduit: 'assets/images/rift_conduit.png',
  collapse_gate: 'assets/images/collapse_gate.png',
  rift_sentinel: 'assets/images/rift_sentinel.png',
  rift_warden: 'assets/images/rift_warden.png',
  data_container: 'assets/images/data_container.png',
  pristine_cluster: 'assets/images/pristine_cluster.png',
  rift_sync: 'assets/images/rift_sync.png',
  rift_bg: 'assets/images/rift_bg.png',
  pristine_prismite: 'assets/images/pristine_prismite.png',
  pristine_nimbus: 'assets/images/pristine_nimbus.png',
  pristine_radflux: 'assets/images/pristine_radflux.png',
  planet_barren: 'assets/images/planet_barren.png',
  planet_gas_giant: 'assets/images/planet_gas_giant.png',
  planet_volcanic: 'assets/images/planet_volcanic.png',
  planet_oceanic: 'assets/images/planet_oceanic.png',
};

export const EXOTIC_ORE_ASSETS = {
  celInk: {
    prismite: 'prismite',
    nimbus: 'nimbus',
    radflux: 'radflux',
    packedPrismite: 'packed_prismite',
    packedNimbus: 'packed_nimbus',
    packedRadflux: 'packed_radflux',
    ast_prismite: 'ast_prismite',
    ast_nimbus: 'ast_nimbus',
    ast_radflux: 'ast_radflux',
  } as Record<string, string>,
};

export const FAB_ITEM_ASSETS = {
  celInk: {
    hull_plate: 'module_armor_plate',
    thruster_coil: 'module_thruster',
    sensor_core: 'module_sensor',
    lattice_alloy: 'lattice_alloy',
    conductive_mesh: 'conductive_mesh',
    thermal_alloy: 'thermal_alloy',
    quantum_core: 'quantum_core',
    integrity_seal: 'integrity_seal',
    thermal_grid: 'thermal_grid',
    lattice_tender: 'player_ship_lattice',
    gantry_command: 'player_ship_gantry',
  } as Record<string, string>,
};

export const STATION_MODULE_ASSETS = {
  celInk: {
    core: 'outpost_core',
    storage_bay: 'outpost_storage_bay',
    refinery_annex: 'outpost_refinery_annex',
    fab_bay: 'outpost_fab_bay',
    docking_ring: 'outpost_docking_ring',
  },
};

export const OUTPOST_ANCHOR = {
  id: 'belt_one_anchor',
  name: 'Belt One Anchor',
  type: 'ANCHOR' as const,
  x: 1820,
  y: -800,
  radius: 40,
};

export const STATION_CORE_PRICE = 5000;
export const STATION_CORE_VOLUME = 10;
export const EXPANDER_BONUS = 500;

export interface StationModuleDef {
  id: 'storage_bay' | 'refinery_annex' | 'fab_bay' | 'docking_ring';
  name: string;
  part: 'hullPlate' | 'sensorCore' | 'thrusterCoil';
  partName: string;
  marksCost: number;
  desc: string;
}

export const STATION_MODULES: Record<string, StationModuleDef> = {
  storage_bay: {
    id: 'storage_bay',
    name: 'Storage Bay',
    part: 'hullPlate',
    partName: 'Hull Plate',
    marksCost: 1000,
    desc: '+2000 m³ Outpost Storage Vault',
  },
  refinery_annex: {
    id: 'refinery_annex',
    name: 'Refinery Annex',
    part: 'sensorCore',
    partName: 'Sensor Core',
    marksCost: 1500,
    desc: 'Outpost Refinery: 2.0s cycle, 0% fee',
  },
  fab_bay: {
    id: 'fab_bay',
    name: 'Fab Bay',
    part: 'thrusterCoil',
    partName: 'Thruster Coil',
    marksCost: 1500,
    desc: 'Enables Outpost Component Fabricator',
  },
  docking_ring: {
    id: 'docking_ring',
    name: 'Docking Ring',
    part: 'hullPlate',
    partName: 'Hull Plate',
    marksCost: 1000,
    desc: 'Integrates Outpost into Warp Menu [M]',
  },
};

export const STATION_MODULES_LIST: StationModuleDef[] = [
  STATION_MODULES.storage_bay,
  STATION_MODULES.refinery_annex,
  STATION_MODULES.fab_bay,
  STATION_MODULES.docking_ring,
];

export function getStationPrices(system?: string): StationPriceSchedule {
  if (system && system.toLowerCase() === 'vael') {
    return STATION_PRICES.Vael;
  }
  return STATION_PRICES.Harrow;
}

export type HullId = 'ferrier' | 'tern' | 'skirmisher' | 'lattice' | 'shade' | 'gantry';

export function getShipSignatureKm(activeHullId: string): number {
  return activeHullId === 'shade' ? 3.0 : 8.0;
}

export function getDroneBandwidth(hullId: string): number {
  if (hullId === 'gantry') return 5;
  if (hullId === 'ferrier' || hullId === 'tern' || hullId === 'lattice') return 2;
  if (hullId === 'shade' || hullId === 'skirmisher') return 1;
  return 2;
}

export interface HullDefinition {
  id: HullId;
  name: string;
  role?: string;
  craftOnly?: boolean;
  cost: number;
  cargo: number;
  baseCargo: number;
  cap: number;
  baseCap: number;
  shield: number;
  baseShield: number;
  armor: number;
  baseArmor: number;
  hull: number;
  baseHull: number;
  slots: number;
  spriteKey: string;
  perkText?: string;
  perk?: string;
  desc?: string;
}

export const HULL_DEFINITIONS: HullDefinition[] = [
  {
    id: 'ferrier',
    name: 'Ferrier',
    role: 'Mining Frigate',
    cost: 0,
    cargo: 600,
    baseCargo: 600,
    cap: 100,
    baseCap: 100,
    shield: 100,
    baseShield: 100,
    armor: 80,
    baseArmor: 80,
    hull: 60,
    baseHull: 60,
    slots: 4,
    spriteKey: 'player_ship',
    perkText: 'Balanced industrial frigate with 4 flexible module slots.',
    desc: 'Balanced industrial frigate with 4 flexible module slots.',
  },
  {
    id: 'tern',
    name: 'Tern',
    role: 'Heavy Hauler',
    cost: 2200,
    cargo: 1200,
    baseCargo: 1200,
    cap: 80,
    baseCap: 80,
    shield: 90,
    baseShield: 90,
    armor: 70,
    baseArmor: 70,
    hull: 50,
    baseHull: 50,
    slots: 3,
    spriteKey: 'player_ship_tern',
    perkText: 'High-capacity cargo hold (1,200 m³). Fitted with 3 module slots.',
    desc: 'High-capacity cargo hold (1,200 m³). Fitted with 3 module slots.',
  },
  {
    id: 'skirmisher',
    name: 'Skirmisher',
    role: 'Combat Frigate',
    cost: 2800,
    cargo: 300,
    baseCargo: 300,
    cap: 120,
    baseCap: 120,
    shield: 140,
    baseShield: 140,
    armor: 90,
    baseArmor: 90,
    hull: 70,
    baseHull: 70,
    slots: 4,
    spriteKey: 'player_ship_skirmisher',
    perkText: '+25% Light Cannon fire damage bonus. Heavy military shielding.',
    desc: '+25% Light Cannon fire damage bonus. Heavy military shielding.',
  },
  {
    id: 'lattice',
    name: 'Lattice Tender',
    role: 'Industrial Tender',
    craftOnly: true,
    cost: 0,
    cargo: 900,
    baseCargo: 900,
    cap: 110,
    baseCap: 110,
    shield: 110,
    baseShield: 110,
    armor: 90,
    baseArmor: 90,
    hull: 80,
    baseHull: 80,
    slots: 4,
    spriteKey: 'player_ship_lattice',
    perkText: 'Advanced industrial tender assembled from quantum lattice components. Features heavy 900 m³ cargo capacity and balanced defensive grid.',
    desc: 'Advanced industrial tender assembled from quantum lattice components. Features heavy 900 m³ cargo capacity and balanced defensive grid.',
  },
  {
    id: 'shade',
    name: 'Shade Skiff',
    role: 'Stealth Extractor',
    cost: 3500,
    cargo: 400,
    baseCargo: 400,
    cap: 90,
    baseCap: 90,
    shield: 80,
    baseShield: 80,
    armor: 55,
    baseArmor: 55,
    hull: 45,
    baseHull: 45,
    slots: 3,
    craftOnly: false,
    spriteKey: 'player_ship_shade',
    desc: 'Lightweight stealth reconnaissance extractor engineered for low sensor profile. Reduces detection signature to 3.0 km.',
    perk: 'Low signature 3.0 km.',
    perkText: 'Low signature 3.0 km.',
  },
  {
    id: 'gantry',
    name: 'Gantry Command',
    role: 'Industrial Command Flagship',
    craftOnly: true,
    cost: 0,
    cargo: 2000,
    baseCargo: 2000,
    cap: 140,
    baseCap: 140,
    shield: 140,
    baseShield: 140,
    armor: 110,
    baseArmor: 110,
    hull: 120,
    baseHull: 120,
    slots: 5,
    spriteKey: 'player_ship_gantry',
    desc: 'Massive heavy industrial command flagship equipped with high-yield drone control relays and immense 2,000 m³ cavernous hold.',
    perk: 'Drone bandwidth 5. 2,000 m³ hold.',
    perkText: 'Drone bandwidth 5. 2,000 m³ hold.',
  },
];

export const ITEM_VOLUMES: Record<string, number> = {
  ferrite: 1,
  aurite: 1,
  chromite: 1,
  pyrox: 1,
  rare: 1,
  tritanium: 1,
  auriteConc: 1,
  chromiteBar: 1,
  pyroxite: 1,
  scrap: 5,
  hullPlate: 5,
  thrusterCoil: 5,
  sensorCore: 5,
  stationCore: 10,
  latticeAlloy: 2,
  conductiveMesh: 2,
  thermalAlloy: 2,
  quantumCore: 5,
  integritySeal: 5,
  thermalGrid: 5,
  prismite: 8,
  nimbus: 6,
  radflux: 10,
  packedPrismite: 1,
  packedNimbus: 1,
  packedRadflux: 1,
  silicateLens: 1,
  metallicLens: 1,
  exoticLens: 1,
  extractDrone: 5,
  defenseDrone: 5,
  salvageDrone: 5,
  commandHub: 20,
  polymer: 2,
  chemical: 2,
  polymerComposite: 2,
  riftSync: 5,
  pristinePrismite: 1,
  pristineNimbus: 1,
  pristineRadflux: 1,
};

export const INGREDIENT_NAMES: Record<string, string> = {
  ferrite: 'Ferrite Ore',
  aurite: 'Aurite Ore',
  chromite: 'Chromite Ore',
  pyrox: 'Pyrox Ore',
  rare: 'Rare Ore Crystal',
  tritanium: 'Tritanium',
  auriteConc: 'Aurite Concentrate',
  chromiteBar: 'Chromite Bar',
  pyroxite: 'Pyroxite',
  scrap: 'Module Scrap',
  hullPlate: 'Hull Plate',
  thrusterCoil: 'Thruster Coil',
  sensorCore: 'Sensor Core',
  latticeAlloy: 'Lattice Alloy',
  conductiveMesh: 'Conductive Mesh',
  thermalAlloy: 'Thermal Alloy',
  quantumCore: 'Quantum Core',
  integritySeal: 'Integrity Seal',
  thermalGrid: 'Thermal Grid',
  stationCore: 'Station Core Deed',
  prismite: 'Prismite Crystal',
  nimbus: 'Nimbus Gas',
  radflux: 'Radflux Isotope',
  packedPrismite: 'Packed Prismite',
  packedNimbus: 'Packed Nimbus',
  packedRadflux: 'Packed Radflux',
  silicateLens: 'Silicate Lens',
  metallicLens: 'Metallic Lens',
  exoticLens: 'Exotic Lens',
  extractDrone: 'Extraction Drone',
  defenseDrone: 'Defense Drone',
  salvageDrone: 'Salvage Drone',
  commandHub: 'Orbital Command Hub',
  polymer: 'Polymer Resin',
  chemical: 'Reactive Chemicals',
  polymerComposite: 'Polymer Composite',
  riftSync: 'Rift Synchronizer',
  pristinePrismite: 'Pristine Prismite',
  pristineNimbus: 'Pristine Nimbus',
  pristineRadflux: 'Pristine Radflux',
};

export const RECIPE_OUTPUT_MAP: Record<string, string> = {
  hull_plate: 'hullPlate',
  thruster_coil: 'thrusterCoil',
  sensor_core: 'sensorCore',
  lattice_alloy: 'latticeAlloy',
  conductive_mesh: 'conductiveMesh',
  thermal_alloy: 'thermalAlloy',
  quantum_core: 'quantumCore',
  integrity_seal: 'integritySeal',
  thermal_grid: 'thermalGrid',
  polymer_composite: 'polymerComposite',
  rift_synchronizer: 'riftSync',
  gantry_refit: 'gantryRefit',
};

export interface PlanetDef {
  id: string;
  name: string;
  type: 'barren' | 'gasGiant' | 'volcanic' | 'oceanic';
  system: string;
  x: number;
  y: number;
  radius: number;
  hot: [number, number][]; // [col, row] coordinates on an 8x6 grid
  desc?: string;
}

export const PLANET_DEFS: PlanetDef[] = [
  {
    id: 'harrow_ii',
    name: 'Harrow II',
    type: 'barren',
    system: 'Harrow',
    x: 4600,
    y: 400,
    radius: 900,
    hot: [[1, 1], [6, 4]],
    desc: 'Barren terrestrial world with high surface titanium deposits and subsurface volcanic fissures.',
  },
  {
    id: 'harrow_v',
    name: 'Harrow V',
    type: 'gasGiant',
    system: 'Harrow',
    x: -600,
    y: -4200,
    radius: 1300,
    hot: [[5, 1]],
    desc: 'Massive turbulent gas giant churning with volatile nimbus and isotopic storms.',
  },
  {
    id: 'ember_iv',
    name: 'Ember IV',
    type: 'volcanic',
    system: 'Harrow',
    x: -5200,
    y: 3600,
    radius: 1000,
    hot: [[2, 4], [6, 1]],
    desc: 'Irradiated super-heated volcanic planet bordering the Cinder Rift fissure.',
  },
  {
    id: 'vael_ii',
    name: 'Vael II',
    type: 'oceanic',
    system: 'Vael',
    x: 3600,
    y: 2400,
    radius: 1100,
    hot: [[4, 2]],
    desc: 'Deep oceanic planet shrouded in dense atmosphere, rich in hydrocarbon polymers.',
  },
];

export function getPlanetHeat(id: string, c: number, r: number): number {
  const planet = PLANET_DEFS.find((p) => p.id === id);
  const hotspots = planet ? planet.hot : [[0, 0]];
  let minD = Infinity;
  for (const [hCol, hRow] of hotspots) {
    const dist = Math.hypot(c - hCol, r - hRow);
    if (dist < minD) minD = dist;
  }
  const charSum = (str: string) => str.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const raw = Math.round(100 - 22 * minD) + (charSum(id + c + r) % 9) - 4;
  return Math.max(5, Math.min(100, raw));
}

export function getColonyRawName(planetId: string): string {
  if (planetId === 'harrow_ii') return 'Mineral Salts';
  if (planetId === 'ember_iv') return 'Sulfur Ash';
  if (planetId === 'harrow_v') return 'Hydrocarbon Gas';
  if (planetId === 'vael_ii') return 'Brine Organics';
  return 'Mineral Salts';
}

export function getColonyProductInfo(planetType: string): { type: 'chemical' | 'polymer'; name: string } {
  if (planetType === 'gasGiant' || planetType === 'oceanic') {
    return { type: 'polymer', name: 'Polymer Resin' };
  }
  return { type: 'chemical', name: 'Reactive Chemicals' };
}

export function getPlanetHeatColor(heat: number): string {
  const h = Math.max(5, Math.min(100, heat));
  const t = (h - 5) / 95;
  let r: number, g: number, b: number;
  if (t < 0.33) {
    const f = t / 0.33;
    r = Math.round(43 + (46 - 43) * f);
    g = Math.round(108 + (196 - 108) * f);
    b = Math.round(176 + (182 - 176) * f);
  } else if (t < 0.66) {
    const f = (t - 0.33) / 0.33;
    r = Math.round(46 + (255 - 46) * f);
    g = Math.round(196 + (181 - 196) * f);
    b = Math.round(182 + (71 - 182) * f);
  } else {
    const f = (t - 0.66) / 0.34;
    r = Math.round(255 + (229 - 255) * f);
    g = Math.round(181 + (62 - 181) * f);
    b = Math.round(71 + (62 - 71) * f);
  }
  return `rgb(${r}, ${g}, ${b})`;
}

export interface ColonyCell {
  col: number; // 0..7
  row: number; // 0..5
  type: 'drill' | 'processor' | 'pipe';
}

export interface ColonyData {
  cells: ColonyCell[];
  raw?: number;
  product?: number;
  acc?: number;
  secAcc?: number;
  launchIn?: number;
  interval?: number;
  rocket?: any;
  depot?: number;
  depotBuilt?: boolean;
  structures?: { type: string; [key: string]: any }[];
}

export interface ColonyNetworkStatus {
  reachablePipes: Set<string>;
  onlineMap: Map<string, boolean>;
  drillCount: number;
  processorCount: number;
  pipeCount: number;
  onlineDrills: number;
  offlineDrills: number;
  onlineProcessors: number;
  offlineProcessors: number;
  onlinePipes: number;
  offlinePipes: number;
}

export function getColonyNetwork(colony?: ColonyData | null): ColonyNetworkStatus {
  const cells = colony?.cells || [];
  const cellMap = new Map<string, ColonyCell>();
  for (const c of cells) {
    cellMap.set(`${c.col},${c.row}`, c);
  }

  // BFS from Hub [3, 2]
  const reachablePipes = new Set<string>();
  const queue: [number, number][] = [[3, 2]];
  const visitedPipes = new Set<string>();

  const DIRS = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];

  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx >= 0 && nx < 8 && ny >= 0 && ny < 6) {
        const key = `${nx},${ny}`;
        const neighbor = cellMap.get(key);
        if (neighbor && neighbor.type === 'pipe') {
          if (!visitedPipes.has(key)) {
            visitedPipes.add(key);
            reachablePipes.add(key);
            queue.push([nx, ny]);
          }
        }
      }
    }
  }

  const onlineMap = new Map<string, boolean>();
  let drillCount = 0;
  let processorCount = 0;
  let pipeCount = 0;
  let onlineDrills = 0;
  let onlineProcessors = 0;

  for (const c of cells) {
    const key = `${c.col},${c.row}`;
    if (c.type === 'pipe') {
      pipeCount++;
      const isOnline = reachablePipes.has(key);
      onlineMap.set(key, isOnline);
    } else if (c.type === 'drill' || c.type === 'processor') {
      if (c.type === 'drill') drillCount++;
      if (c.type === 'processor') processorCount++;

      let isConnected = false;
      for (const [dx, dy] of DIRS) {
        const nx = c.col + dx;
        const ny = c.row + dy;
        if (nx === 3 && ny === 2) {
          isConnected = true;
          break;
        }
        if (reachablePipes.has(`${nx},${ny}`)) {
          isConnected = true;
          break;
        }
      }
      onlineMap.set(key, isConnected);
      if (isConnected) {
        if (c.type === 'drill') onlineDrills++;
        if (c.type === 'processor') onlineProcessors++;
      }
    }
  }

  return {
    reachablePipes,
    onlineMap,
    drillCount,
    processorCount,
    pipeCount,
    onlineDrills,
    offlineDrills: drillCount - onlineDrills,
    onlineProcessors,
    offlineProcessors: processorCount - onlineProcessors,
    onlinePipes: reachablePipes.size,
    offlinePipes: pipeCount - reachablePipes.size,
  };
}

export type PoiZone = 'core' | 'fringe' | 'rift';
export function getPoiZone(poi: { id?: string; type?: string }): PoiZone {
  const id = (poi.id || '').replace('depot_', '');
  if (
    id === 'cinder_rift' ||
    id === 'ember_iv' ||
    id === 'rift_anomaly' ||
    poi.type === 'RIFT' ||
    poi.type === 'CACHE' ||
    id.startsWith('rift_') ||
    id.startsWith('c1') ||
    id.startsWith('c2') ||
    id.startsWith('c3') ||
    id.includes('container') ||
    id.includes('pristine') ||
    id.includes('conduit') ||
    id.includes('gate') && id.includes('rift')
  ) return 'rift';
  if (id === 'belt_two' || id === 'belt_beta' || id === 'ash_drift' || id === 'vael_belt' || id === 'harrow_v') return 'fringe';
  // Core: harrow, vael, belt_one, deep_harrow, belt_one_anchor, outpost, stargates, other planets
  return 'core';
}
export const ZONE_COLORS: Record<PoiZone, string> = {
  core: '#8BD17C',
  fringe: '#FFB547',
  rift: '#B48CFF',
};

export interface PointOfInterestDef {
  id: string;
  name: string;
  type: 'STATION' | 'BELT' | 'GATE' | 'CACHE' | 'ANCHOR' | 'WRECK' | 'OUTPOST' | 'PLANET' | 'DEPOT' | 'RIFT';
  x: number;
  y: number;
  radius: number;
  planetType?: 'barren' | 'gasGiant' | 'volcanic' | 'oceanic';
  desc?: string;
  description?: string;
  zone?: string;
}

export const HARROW_POIS: PointOfInterestDef[] = [
  {
    id: 'station',
    name: 'Harrow Station Alpha',
    type: 'STATION',
    x: 0,
    y: 0,
    radius: 220,
    desc: 'Central orbital industrial station and trade port.',
    description: 'Central orbital industrial station and trade port.',
  },
  {
    id: 'belt_alpha',
    name: 'Belt One',
    type: 'BELT',
    x: 1300,
    y: -800,
    radius: 420,
    desc: 'Dense cluster of high-grade Ferrite asteroids.',
    description: 'Dense cluster of high-grade Ferrite asteroids.',
  },
  {
    id: 'belt_beta',
    name: 'Belt Two',
    type: 'BELT',
    x: -1500,
    y: 1100,
    radius: 440,
    desc: 'Mixed belt of raw ore crystals and rich Ferrite veins.',
    description: 'Mixed belt of raw ore crystals and rich Ferrite veins.',
  },
  {
    id: 'deep_harrow',
    name: 'Deep Harrow Belt',
    type: 'BELT',
    x: 2300,
    y: 1900,
    radius: 460,
    desc: 'Rich outer field with dense mineral clusters.',
    description: 'Rich outer field with dense mineral clusters.',
  },
  {
    id: 'cinder_rift',
    name: 'Cinder Rift',
    type: 'BELT',
    x: -3400,
    y: 2200,
    radius: 440,
    desc: 'Deep geological fissure rich in exotic Prismite, Nimbus gas, and Radflux isotopes.',
    description: 'Deep geological fissure rich in exotic Prismite, Nimbus gas, and Radflux isotopes.',
  },
  {
    id: 'system_gate',
    name: 'Harrow Outer Jump Gate',
    type: 'GATE',
    x: -2500,
    y: -1700,
    radius: 140,
    desc: 'Interstellar gate linked to the Vael system.',
    description: 'Interstellar gate linked to the Vael system.',
  },
];


