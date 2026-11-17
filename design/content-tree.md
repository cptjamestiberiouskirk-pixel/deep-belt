# Content tree: design

Status: approved by the user, 2026-11-15, with the recommended answer to each question in section 7. Built so far: step 1 (0604bef) and step 2, in three commits: 2a fitting model and save v5 (a764605), 2b catalog stats in combat and hold (1e71334), 2c Fitting screen by slot type with a hangar list (ccf3773). Step 3: the Gantry has a third utility slot, and Expanded Holds and Shield Boosters can be owned up to 3 each and add up (Gantry hold 2,000 + 500 per hold, so 3,500 m³ with three; two boosters give 16 HP/s for 50 Cap per 3 s cycle). Step 4, first group: the three lenses are saved in `inventory` (content/inventory.ts); their cargoXxxLens keys are no longer written. Step 5: content/skills.ts holds each skill's category, rank and prerequisites; the Skills screen has a header per category, and a skill with an unmet prerequisite can't be queued. Each skill's bonus still lives in App.tsx's SKILL_DEFINITIONS, not as a `bonus` field. Step 6: the Lance Driver, a weapon for 1,500 MARKS behind Gunnery II (45 damage per 4 s, 12 km, 14 Cap; one hit takes 54 at Gunnery II). A module's `requires` gates buying it. The market lists every catalog module with a price, and the weapon controls read whichever weapon is fitted, so the next module is a catalog entry plus its tests. Step 7: Charge Control, the first new skill and the first with a prerequisite: Gunnery, rank 2, after Gunnery III. Each level cuts a weapon shot's Cap by 8%, in whole Cap (the Lance Driver's 14 is 8 at level V). Saved skills now hold every catalog skill, and a save from before a skill loads it at 0, so the next skill is a catalog entry, its card in SKILL_DEFINITIONS and its effect. Step 8: the Bulk Hold, a side-grade to the Expanded Hold for 1,600 MARKS: +900 hold in one utility slot, for 20% less top speed and thrust (a new `speedPct` stat, read in flight through fittedSpeedMult). One only, with no skill needed. The Fitting screen's Ship stats gained a Max speed row. Step 9: Cargo Trim, a Navigation skill, rank 2, after Navigation II. A loaded hold slows the ship (top speed up to 30%, thrust, turning, braking, warp spool); each level cuts that effect by 15%, so at level V a full hold handles like a quarter-full one. Ship stats gained a "Speed, full hold" row. A balance probe (tests/balance-probe.spec.ts, bd7ede9) then found that thrust, not the 320 m/s cap, sets top speed: holding thrust, a ship settles at 0.4 × thrust, 88 m/s on a Ferrier. A full hold costs 40% of that through thrust; content/flight.ts now gives every speed display the reachable figure. Step 10: Laser Tuning, an Extraction skill, rank 2, after Mining III. Each level cuts the mining cycle by 4% (content/skills.ts minerCycleAt), so at level V the MK1 cycles in 8.0 s, not 10, measured in flight by the probe: 25% more ore per minute. Charge Control reworked (2026-11-16): the probe found that cutting Cap per shot changed no fight, since none ran short of Cap, so each level now cuts the weapon cycle by 4% (content/skills.ts weaponCycleAt). At level V the Belt Two pirate dies about 20% sooner (Light Cannon 15.1 s to 12.3 s, Lance Driver 16.4 s to 13.2 s), and a Lance Driver with a shield booster now runs its Cap to 0. Hostile speeds fixed (2026-11-16): pirates, raiders and Rift guardians fly at their stated share of a plain Ferrier's top speed (88 m/s), not of the unreachable 320 m/s cap, so the Belt Two pirate flies 70 m/s, not 256. Probe: the Belt Two fights are unchanged (15.2 s cannon, 16.3 s Lance); fleeing Belt Two costs the same HP (32 empty, 48 full), because the pirate gives up at 20 km, before the gap opens; a raider wave, which never gives up, is now outrun with an empty hold (out of range in 2.5 s, 0 HP lost, against 224 HP lost before) but still not with a full one (53 m/s). Lance Driver retuned (2026-11-16): at 45 damage it lost to the free Light Cannon at Gunnery III (16.3 s to 15.2 s), because 59 a hit fell one short of a 3-shot kill on the Belt Two pirate's 182 HP. At 47 (61 a hit at Gunnery III) the probe measured it ahead at every Gunnery level: II 16.2 s to 18.1 s, III to V about 12.2 s to 15.2 s, and 9.8 s to 12.3 s at Charge Control V. A Lance with a shield booster and Charge Control V still runs its Cap down to 6. Mining pace, probed over 80 s at Belt One with rocks running dry included: MK1 300 ore per minute, MK2 about 510 to 540, MK2 with Mining V and Laser Tuning V about 860 to 890 (about 2.9x a bare MK1; the cycle alone, 113 ore per 6.4 s, would be 3.5x). Step 11: Low Profile, an Extraction skill, rank 2, after Mining II. Raider waves come when Notice reaches 100: each Ferrite sold at once beyond 200 adds 3, and the mining laser adds 0.8 a second. Each level of Low Profile lets 80 more Ferrite sell unnoticed (600 at level V, a full Ferrier hold) and cuts the laser's Notice by 10% (0.4 a second at V). Probe: a 600 Ferrite sale gives Notice 100 and a raid on undock untrained, Notice 0 and no raid at V. A warp spool skill was considered first and dropped: the probe found no HP lost during a spool of 4.7 s or 2.1 s, and raiders, which engage within 170 km, catch up after an in-system warp (both 5.5 km away 20 s after reaching Belt One). Step 12: Composite Armor, a utility module for 900 MARKS and a side-grade to the Shield Booster: +100 armor (a Ferrier's 80 becomes 180), using no Cap, but armor never regenerates and the station charges to repair it. One only; a new `armorHp` stat, read in applyHullLayout, and kept through a tow. Probe: the Belt Two fight never gets past the shield, so armor changes nothing there (40 HP lost with the cannon either way, 16 with a booster); parked at Belt Two without firing back, a Ferrier lasts 88.5 s with nothing fitted, 100.6 s with an active booster (its Cap runs down to 14), and 127.8 s with Composite Armor.

Decision behind it (user, 2026-11-15): grow ships, weapons, modules, components, blueprints, hull classes and skill categories into a tiered tree, very gradually. Each increment is small, balanced and checked for clarity before the next.

This doc covers what exists today, what stops it from growing, the data model to grow into, and the order of small steps to get there. Section 7 lists the questions that were put to the user, with the answers chosen.

## 1. Rules for every increment

1. **One small thing at a time.** One mechanic, or one to three items. Each increment is one commit with its own tests and goes to main through the usual loop (`npm test`, type-check, CI green).
2. **The first 30 minutes stay as they are.** Training, contracts 1 to 3 and the Belt Two fight just had two polish rounds. New content unlocks after them, and their tests stay unchanged.
3. **Every new item has a reason to pick it.** A side-grade has a trade-off (more damage, less range). Only a tier step (Tier 1 to Tier 2 of the same item) is a straight upgrade, and it costs a skill level.
4. **Numbers live in one table.** Stats sit in the catalog file, not in formulas spread through `App.tsx`. A test pins the numbers a player relies on, as the Belt Two pirate test does.
5. **Tuning is measured.** Combat and mining changes are timed with a probe script (as the first-fight tuning was: 15.2 s before, 21.2 s after) before and after.
6. **Saved state follows PLAYBOOK "Changing saved state".** Each step names what it changes in the save, edits every reader and writer, and adds a reload test.
7. **Original content only.** Names, factions, item lines and art are Deep Belt's own. The tree's shape is a common mechanic for this kind of game; EVE's names, races and items are not used.

## 2. What exists today

All CONFIRMED by reading the code on 2026-11-15.

**Hulls** (`HULL_DEFINITIONS`, `constants.ts`):

| Id | Name | Role | Cargo m³ | Shield / hull | Slots | How you get it |
|---|---|---|---|---|---|---|
| ferrier | Ferrier | Mining Frigate | 600 | 100 / 60 | 4 | start |
| tern | Tern | Heavy Hauler | 1,200 | 90 / 50 | 3 | Hangar |
| skirmisher | Skirmisher | Combat Frigate | 300 | 140 / 70 | 4 | Hangar |
| shade | Shade Skiff | Stealth Extractor | 400 | 80 / 45 | 3 | Hangar |
| lattice | Lattice Tender | Industrial Tender | 900 | 110 / 80 | 4 | Fabricator only |
| gantry | Gantry Command | Industrial Command Flagship | 2,000 | 140 / 120 | 5 | Fabricator only |

**Modules.** The fitting screen has four fixed slots, each for one kind of module:
- **Slot 1, mining:** Miner MK1, or MK2 for 1,200 MARKS (+50% yield).
- **Slot 2, cargo:** Expanded Hold, 850 MARKS (+500 m³).
- **Slot 3, shield:** Shield Booster, 950 MARKS (+8 HP/s pulse).
- **Slot 4, weapon:** Light Cannon, 600 MARKS (30 damage every 3 s). Only on hulls with 4 or more slots.

Owning a module is a flag in `upgrades` (`laserMk2`, `cargoExpanded`, `shieldBoosterHeavy`, `cannon`). Being fitted is a flag in `fittedSlots` (`slot1MiningLaser`, `slot2CargoExpander`, `slot3ShieldBooster`, `slot4Cannon`).

**Other ship systems,** each with its own state:
- **Lens socket:** one of three lenses (Silicate, Metallic, Exotic), each with 25 charges.
- **Hull hardpoints:** four, built from fabricated parts and kept per hull in `hullLayouts`:
  - Armor Plate: +20 HP
  - Cargo Pod: +200 m³
  - Thruster: +15% speed
  - Sensor: +2 km lock range
- **Installed flags:** the Core Probe Launcher and the Cap Battery.
- **Drones:** three kinds, carried as cargo.

**Skills** (`SKILL_DEFINITIONS`):
- Four skills, each with its own category label: Mining, Gunnery, Shield Operation, Navigation.
- Levels 1 to 5, with no prerequisites. Training takes 1, 2, 4, 8 and 16 minutes of real time and costs 100 MARKS × level.
- Each bonus is +10% per level, written as a formula where the stat is used.

**Fabricator** (`FABRICATOR_RECIPES`, `constants.ts`):
- 14 recipes in four tiers (×1, ×1.5, ×2, ×2.5): components such as Hull Plate, Thruster Coil and Sensor Core, then alloys, cores and seals, then hulls and refits.
- Schematics research gives each recipe material efficiency and time efficiency up to level 5 (`meQty`, `teTime`): 2% fewer materials and 4% less time per level.

**Cargo:**
- About 40 kinds of ore, refined material, part, lens and drone. Each has its own React state, its own ref and its own save key: `cargoFerrite`, `cargoHullPlate`, `cargoSilicateLens` and so on.

**The save:**
- One key, `deep_belt_session_v4`.
- It's written in 9 places: the main writer, plus 8 smaller read-change-write updates for the tutorial bonus and the outpost. It's read by the loader effect and by startup initializers that read the save.

## 3. What stops it from growing

| # | Problem | Effect on adding content |
|---|---|---|
| P1 | Each slot accepts exactly one module, and owning one is a yes/no flag. | A second weapon or a Tier 2 hold has nowhere to go and no way to be owned twice. |
| P2 | Each cargo item is its own state, ref, save key and loader line. | A new item touches about six places in `App.tsx`. |
| P3 | Content data is split between `constants.ts` and inline code in `App.tsx` (43,000 lines). | Prices, stats and names for one item live in different files. |
| P4 | Skills are flat, and each bonus is a formula at the point of use. | A skill tree needs prerequisites and data-driven bonuses. |
| P5 | Hull slot counts above 4 do nothing: Gantry's fifth slot has no code. | A bigger hull class gives no extra fitting room. |
| P6 | Found while reading: each hull's fitting is remembered in `hullFittingsRef`, which is not saved. | After a reload, switching hulls forgets each hull's fitting. The code is CONFIRMED; the player-visible effect is INFERRED, not yet reproduced. Step 2 fixes it. |
| P7 | Found in step 1: the Miner MK2 (1,200 MARKS) changes nothing in play. Mining always yields 50 ore per 10.0 s cycle; only the market card and Fitting's Ship stats show 75 ore per 8.0 s. | A bought upgrade that does nothing. CONFIRMED by reading the code: `upgrades.laserMk2` was read only by display code. Fixed 2026-11-15 at the user's call ("make it work as sold"): mining reads the fitted miner's catalog yield and cycle, so the MK2 mines 75 ore per 8 s (+50% on every ore), about 9.4 ore/s against the MK1's 5. |

## 4. The model to grow into

### 4.1 One catalog, in its own files

A `content/` folder of typed TypeScript data with no React. TypeScript rather than JSON, so the type-check catches a misspelled stat or slot type.

```ts
type Category = 'ore' | 'material' | 'component' | 'module' | 'lens' | 'drone' | 'hull' | 'blueprint';

interface ItemDef {
  id: string;            // 'light_cannon', 'expanded_hold'
  name: string;
  category: Category;
  group: string;         // 'Projectile weapons', 'Cargo expanders'
  tier: 1 | 2 | 3;
  volume: number;        // m³ in the hold
  basePrice: number;     // station prices scale from this
  requires?: Array<{skill: SkillId; level: number}>;
  desc: string;
}

interface ModuleDef extends ItemDef {
  category: 'module';
  slot: 'extraction' | 'weapon' | 'utility';
  stats: Partial<Record<StatId, number>>;   // e.g. {damage: 30, cycle: 3} or {cargo: 500}
}
```

The tree is category, then group, then item, then tier. The market, fitting screen and fabricator read names, prices and stats from here instead of hard-coding them.

### 4.2 Typed slots per hull

Each hull gets a slot layout instead of a slot count. Today's four slots map onto it exactly, so nothing a player has fitted changes:

| Hull | Extraction | Utility | Weapon |
|---|---|---|---|
| Ferrier, Skirmisher, Lattice | 1 | 2 | 1 |
| Tern, Shade | 1 | 2 | 0 |
| Gantry | 1 | 3 | 1 |

That puts Gantry's unused fifth slot to work as a third utility slot (P5). It's a balance change, so it gets its own step (step 3); until then the slot stays shut.

**Owning and fitting modules:**
- **The hangar holds owned modules.** `hangar: Record<ItemId, number>` is saved and counts the modules you own that aren't fitted. They take no hold space; today's "Light Cannon moved to hangar" toast already says so.
- **Fitting moves a real module.** Fitting takes one from the hangar into a slot; unfitting puts it back. Owning two of a module means owning two, which today's yes/no `upgrades` flags can't express.
- **Each hull remembers a loadout, apart from what's fitted.** Two saved records:
  - `loadouts: Record<HullId, Array<ItemId | null>>` is what you want on each hull. It fixes P6.
  - `fitted: Array<ItemId | null>` is what's actually in the active hull's slots.
- **Switching hulls** returns the old hull's fitted modules to the hangar and fills the new hull's slots from its loadout as far as the hangar allows. A slot the hangar can't fill stays empty, but the loadout keeps it, so it fills once you own another. That matches today: one Light Cannon follows you from hull to hull.
- **No module is lost or duplicated.** Hangar plus fitted always equals what you own, across switches and reloads.
- **Buying fits at once** when a matching slot is free; otherwise the module goes to the hangar with a toast that says so. The dock officer's line promises the first case for the Expanded Hold.
- **Doubles come later.** Until step 3, the market sells one of each module, as today's flags allow, so step 2 changes no balance. From step 3, doubles are allowed and add up: two Expanded Holds give +1,000 m³. An item whose doubles would break balance gets a `maxPerShip` in the catalog, decided in the step that adds it.

**On the Fitting screen** (from the UI review, section 8):
- **Slots sit under a header per type** (Extraction, Utility, Weapon), taken from the hull's layout. The card names the module and its state; today's "SLOT 3 · IN HANGAR" puts a state where the type should be.
- **Columns per type replace the four fixed corners,** so a hull with 1/3/1 or 1/2/0 slots lays out without a new design. A type the hull has none of keeps its header, with "None on this hull".
- **The hangar is a list on the Fitting screen,** grouped by slot type, with the count you own and a Fit button. Fit is disabled with a reason ("No free utility slot") when no slot of that type is free.
- **Lenses keep their own panel.** They're cargo (4.3), not modules, so they never appear in the hangar list.

**Game logic reads the catalog too.** Mining yield, cannon damage, hold size, shield boost and lens bonus are worked out from the fitted items' catalog stats, not from the four flags. This moves in step 2, with the fitting. Without it, a new item would show in the market and change nothing in play.

### 4.3 One inventory map

`inventory: Record<ItemId, number>` for the ship's hold. Hold use is the sum of quantity × volume. It replaces the roughly 40 `cargoXxx` keys group by group (P2), not all at once.

### 4.4 Save migration rules

- **The key changes once,** to `deep_belt_session_v5`, in step 2. On load, a v5 save is used when there is one; a v4 save is read only when there's no v5. It's converted, written as v5, and the v4 key is then removed, so it can't come back.
- **A new game removes both keys,** so starting over can't bring back an old v4 save.
- **Old cargo keys move one group per step.** Once a group is in `inventory`, the writer stops writing its old keys. On load, an item present in `inventory` wins, even at 0, over its old key; the old key is read only for items `inventory` doesn't have yet.
- **Every writer and reader changes together,** per PLAYBOOK "Changing saved state": the main writer, the 8 smaller read-change-write updates, the loader, and the startup initializers that read the save.

### 4.5 Skills with categories and prerequisites

```ts
interface SkillDef {
  id: SkillId;
  name: string;
  category: 'Extraction' | 'Gunnery' | 'Defense' | 'Navigation' | 'Industry' | 'Science';
  rank: 1 | 2 | 3;       // training time multiplier
  prerequisites: Array<{skill: SkillId; level: number}>;
  bonus: {stat: StatId; perLevel: number};
}
```

Training time is today's table × rank, so the four existing skills stay rank 1 and keep their 1-to-16-minute times. A skill unlocks items through their `requires`.

**On the Skills screen** (from the UI review, section 8): a header per category, shown only once the category has a skill, so step 5 shows four headers over today's four cards. Each card gets a "Needs: Mining II" line when it has prerequisites. While one is unmet, the Train button is disabled and says what's needed. Prerequisites are text, not arrows between cards. The Train button already shows the time, which is where a rank shows.

### 4.6 Hull classes

Hulls gain a `class` (Frigate, Hauler, Industrial, Command to start) and a skill to fly them. The six hulls fill the first classes. A larger class comes only after several modules exist to fill its slots. A pilot who already owns a hull when its skill arrives keeps flying it; the skill applies only to buying or building one.

### 4.7 Blueprints, later

Schematics research already gives recipes efficiency levels. Blueprints as items, with originals and limited-run copies, come after the steps below are settled. They aren't designed in detail here.

## 5. Increments, in order

Each step is one commit and ends with the full suite green, CI green, and a short play check of the first 30 minutes.

| Step | What | Player-visible change | Saved state | Tests |
|---|---|---|---|---|
| 1 | Catalog files for today's modules, lenses and hulls; the market and fitting screens read names, prices and stats from them | None | None | The suite passes unchanged; a test pins the four module names, prices and stats |
| 2 | Typed slot layouts (Gantry's third utility slot still shut); `hangar`, `fitted` and per-hull `loadouts`; game logic reads fitted items' catalog stats; one of each module, as today; save v5 | Each hull's fitting survives a reload | Flags become `hangar`, `fitted` and `loadouts`; the key becomes v5, migrated from v4 by the rules in 4.4 | Seeded v4 saves with each fitting load the same; buying with no free slot, unfitting, switching hulls and reloading; a loadout the hangar can't fill keeps its wish and conserves module counts across a reload; a new game leaves no v4 key; mining, damage, hold and shield numbers unchanged; at 800×600 the hangar list and Ship stats can be reached |
| 3 | Open Gantry's third utility slot; allow doubles of a module | Gantry fits 5 modules; a second Expanded Hold or Shield Booster can be bought | None | Gantry fits a third utility module; two of a module add up; numbers recorded with a probe |
| 4 | `inventory` for the 3 lenses, then one cargo group per later step | None | Each group's `cargoXxx` keys move into `inventory` by the rules in 4.4 | Each group: seeded old keys load into inventory; an item at 0 in `inventory` stays 0; a reload keeps the quantities |
| 5 | Skill categories and prerequisites, with the 4 existing skills only | The Skills screen shows categories | None (levels already saved) | Training times and costs unchanged; the Skills screen shows each category |
| 6 | First new module: one item in an existing slot type, with a skill requirement | One new market item | Hangar and loadouts already hold it | Buy, fit and use it; a reload keeps it; probe numbers recorded |
| 7+ | One new item or skill per step; a new hull class only after several modules exist | Small | Usually none | Per item |

Steps 1, 2, 4 and 5 add no content and change no balance. They make step 6 and later a data change plus a test, instead of edits in six places.

## 6. Risks

- **Save migration (steps 2 and 4).** A bad migration loses a player's fitting or cargo. Each step migrates one thing by the rules in 4.4 and is tested with seeded old saves.
- **CI time.** The play-test now takes 12.3 of its 30 minutes. Each step adds a few tests; past about 20 minutes, the suite gets split across two CI jobs.
- **Art.** Every new item needs an icon, and a new hull needs a sprite. The asset list is `ASSETS_MANIFEST` in `constants.ts`, and big images slow the title screen: two 3.7 MB portraits were dropped from it on 2026-11-15.
- **Clarity.** More choice makes the market and fitting screens harder to read. Step 5's categories and the catalog's groups exist partly to keep those screens sorted.
- **Small screens.** At 1280×800 today's Ship stats panel already runs past the bottom of the Fitting screen, and step 2 adds a hangar list there. Step 2's tests include an 800×600 check that the stats and the hangar list can still be reached, like the lens-row test added on 2026-11-15.

## 7. Questions for you

Answered 2026-11-15: the user approved the doc with the recommended answer to all five.

1. **Unfitted modules in the station hangar,** taking no hold space, as today's toast says? Recommended: yes.
2. **Modules follow you between hulls:** switching hulls returns the old hull's modules to the hangar and refits the new hull's loadout from it, as one Light Cannon follows you today. Recommended: yes. The alternative is that modules stay on the hull they're fitted to, so each hull needs its own.
3. **Three slot types to start** (extraction, utility, weapon)? Splitting utility into shield and engineering could come later. Recommended: three.
4. **Training time for new skills:** rank 1 to 3, so a rank 3 skill takes up to 48 minutes at level 5? Recommended: yes, so the tree has depth without changing the four existing skills.
5. **Step 3 opens Gantry's unused fifth slot** as a third utility slot. Recommended: yes, or Gantry stays at 4 working slots.

## 8. Reviews

- **Adversarial review (Codex), 2026-11-15:** approved on the first pass with no blocking issues. Its four suggestions are folded in: the hangar and loadouts ownership model (4.2), game logic reading the catalog (4.2, step 2), the migration rules (4.4), and Gantry's slot and hull access kept apart from the groundwork (step 3, 4.6). The second pass also approved, with two suggestions, both folded in: doubles wait for step 3 so step 2 changes no balance, and a hull's wanted loadout is kept apart from what's actually fitted, with a test that module counts are conserved (4.2, steps 2 and 3). Review files: `.adversarial-review/mnrw-ggvp-puez/` (not committed).
- **UI design review (12ui), 2026-11-15:** `12ui improve --to draft` made two candidates each from screenshots of today's Fitting and Skills screens at 1280×800 ($0.12 in all). The candidates are layout studies. Their text is garbled ("Deep Bett", "$00,000 MARKS"), and they invent skills and modules the doc doesn't propose. What they show, most important first:
  1. **Fitting: a hangar list by slot type** (candidate B) is the clearest way to show 4.2's hangar: owned count plus Fit, grouped Extraction, Utility, Weapon. Added to 4.2, with Fit disabled with a reason when no slot is free, which neither candidate showed.
  2. **Fitting: headers per slot type.** Both candidates group the slots, and both put a slot under the wrong type (A files the Shield Booster under Weapon; B files the Expanded Hold under Extraction). That's what happens when the type is inferred from screen position. In 4.2 the header now comes from the hull's layout, in columns that also fit Gantry's 1/3/1 and Tern's 1/2/0.
  3. **Fitting: lenses aren't modules.** Candidate A lists lenses in the hangar. 4.2 now keeps them in their own panel, since they're cargo (4.3).
  4. **Skills: prerequisites as a text line** (candidate B's "Prereq: Mining LVL 1") read better than arrows (candidate A), which drew chains like Mining → Shield Operation that nobody designed. Added to 4.5, with a disabled Train button for an unmet prerequisite, which neither candidate showed.
  5. **Skills: six categories at once don't fit.** Candidate B shrinks the cards until the text overlaps. 4.5 now shows a category only once it has a skill: four headers in step 5, more as skills arrive.
  6. **Fitting at small sizes:** both candidates drop the officer's dialogue to make room. Today's Ship stats already run past the screen's bottom edge at 1280×800. Added under Risks as an 800×600 test in step 2.

  Not reviewed: the Market screen (it changes only in step 6, which gets its own review) and the Hangar [6] tab (hulls, not changed here). Kits, not committed: `12ui-fitting/` and `12ui-skills/` in this session's scratchpad. `12ui review` opens them for notes and picks.
