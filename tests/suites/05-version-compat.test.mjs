// Version compatibility: does the running server still speak the command
// dialect the pack targets? The pack supports data-pack formats 82-107 with
// version-picked gamerule names; when Mojang renames or removes a rule these
// tests pinpoint exactly which pack plumbing went stale -- the kind of
// breakage that is otherwise silent (macros abort, setup functions vanish).

import { defineSuite, eq, ok, fail } from '../lib/harness.mjs';

async function gameruleQuery(mc, rule) {
  const r = await mc.cmd(`gamerule ${rule}`);
  if (/Incorrect argument|Unknown/i.test(r)) return null; // rule doesn't exist here
  const m = r.match(/currently set to: (\S+)/);
  return m ? m[1] : r;
}

export default defineSuite('server version compatibility', ({ test }) => {
  test('setup_world exists at runtime (world-tuning gamerules)', async ({ mc }) => {
    const r = await mc.fn('setup_world');
    if (/Unknown function/.test(r)) {
      fail('infinite_rail:setup_world is missing at runtime -- its copy for this version failed to compile (see boot suite), so ride gamerules (mob_griefing, tile drops, phantoms, damage) are never applied');
    }
  });

  test('setup_world actually applied its gamerules', async ({ mc, note }) => {
    // setup_world was invoked by the previous test (and by any ride start);
    // mob_griefing is the sentinel -- it exists under this name in both eras.
    const v = await gameruleQuery(mc, 'mob_griefing') ?? await gameruleQuery(mc, 'mobGriefing');
    note(`mob_griefing = ${v}`);
    eq(v, 'false', 'mob_griefing should be false after setup_world (creepers/endermen must not wreck the track)');
  });

  test('command-chain budget gamerule exists and was raised by load', async ({ mc }) => {
    const rule = await mc.storageString('infinite_rail:names', 'chain_length');
    ok(rule, 'chain-budget rule name in storage');
    const v = await gameruleQuery(mc, rule);
    if (v === null) fail(`gamerule '${rule}' does not exist on this server version -- load cannot raise the per-chain command budget (set_rule macro aborts silently)`);
    eq(v, '1000000', `${rule} raised by load`);
  });

  test('minecart max-speed gamerule exists (speed system)', async ({ mc, note }) => {
    const rule = await mc.storageString('infinite_rail:speed', 'rule');
    ok(rule, 'max-speed rule name in storage');
    const v = await gameruleQuery(mc, rule);
    note(`${rule} = ${v}`);
    if (v === null) fail(`gamerule '${rule}' does not exist on this server version -- every speed control (.MAXSPEED, Speed +/- items, ocean sprint, sky cruise) is inert`);
  });

  test('weather/daylight-cycle gamerules exist (rain & time modes)', async ({ mc }) => {
    const missing = [];
    for (const key of ['weather_cycle', 'daylight_cycle']) {
      const rule = await mc.storageString('infinite_rail:names', key);
      if (!rule || (await gameruleQuery(mc, rule)) === null) missing.push(`${key} -> '${rule}'`);
    }
    eq(missing.length, 0, `version-picked gamerule names not accepted by this server: ${missing.join(', ')} (rain/time modes cannot freeze the cycles)`);
  });
});
