import {expect, test} from '@playwright/test';
import {expectClean, launch} from './helpers';
import {MODULES} from '../content/modules';

// The ship panel's line under the capacitor gives the Cap regen and what a mining
// cycle and a shot cost. It said "Fire 8", the Light Cannon's cost, whatever was
// fitted: a Lance Driver takes 14 a shot.

const fitting = (fitted: Array<string | null>) => ({fitting: {hangar: {}, fitted, loadouts: {}}});

for (const c of [
  {name: 'a Light Cannon', fitted: ['miner_mk1', null, null, 'light_cannon'], text: `+2.5/s · Mine 12 · Fire ${MODULES.light_cannon.stats.capPerCycle}`},
  {name: 'a Lance Driver', fitted: ['miner_mk1', null, null, 'lance_driver'], text: `+2.5/s · Mine 12 · Fire ${MODULES.lance_driver.stats.capPerCycle}`},
  {name: 'no weapon', fitted: ['miner_mk1', null, null, null], text: '+2.5/s · Mine 12'},
]) {
  test(`ship panel: with ${c.name} fitted, the Cap line reads "${c.text}"`, async ({page}) => {
    const problems = await launch(page, fitting(c.fitted));
    await expect(page.getByTestId('cap-costs')).toHaveText(c.text);
    expectClean(problems);
  });
}

test('catalog: both miners take the 12 Cap a cycle the mining code spends', () => {
  expect([MODULES.miner_mk1.stats.capPerCycle, MODULES.miner_mk2.stats.capPerCycle]).toEqual([12, 12]);
  expect([MODULES.light_cannon.stats.capPerCycle, MODULES.lance_driver.stats.capPerCycle]).toEqual([8, 14]);
});
