// Boot & initialization: the pack loads, every function compiles, load ->
// config -> consts -> modes_init all ran and left the scoreboard exactly as
// the pack's own source files say they should.

import { defineSuite, eq, ok, includes } from '../lib/harness.mjs';

export default defineSuite('boot & initialization', ({ test }) => {
  test('data pack is enabled in the world', async ({ mc }) => {
    const r = await mc.cmd('datapack list enabled');
    includes(r, 'Scenic_Infinite_Rail_Mode', 'enabled datapack list');
  });

  test('every pack function compiles on this server version', async ({ server }) => {
    const bad = server.functionLoadErrors(0);
    eq(bad.length, 0, `functions failed to load (likely a command/gamerule rename on this Minecraft version): ${bad.join(', ')}`);
  });

  test('all scoreboard objectives are created', async ({ mc }) => {
    // The list command shows display names, so probe each objective by id.
    const missing = [];
    for (const obj of ['ir', 'cfg_terrain', 'cfg_camera', 'cfg_ride', 'dbg', 'ir_menu', 'ir_click']) {
      const r = await mc.cmd(`scoreboard players get .__probe ${obj}`);
      if (/Unknown scoreboard objective/i.test(r)) missing.push(obj);
    }
    eq(missing.length, 0, `objectives not created by load: ${missing.join(', ')}`);
  });

  test('config.mcfunction values all applied to the scoreboard', async ({ mc, expected }) => {
    ok(expected.entries.length >= 25, `parsed too few config entries from the pack (${expected.entries.length}) -- config.mcfunction format changed?`);
    const wrong = [];
    for (const { holder, objective, value } of expected.entries) {
      const actual = await mc.score(holder, objective);
      if (actual !== value) wrong.push(`${holder} ${objective}: expected ${value}, got ${actual}`);
    }
    eq(wrong.length, 0, `config knobs not applied -> ${wrong.join('; ')}`);
  });

  test('fixed-point constants seeded by load', async ({ mc }) => {
    eq(await mc.score('.C16', 'ir'), 16, '.C16');
    eq(await mc.score('.C100', 'ir'), 100, '.C100');
    eq(await mc.score('.C1000', 'ir'), 1000, '.C1000');
  });

  test('.TUNNELUP derived as .TUNNELCLEAR + 1', async ({ mc }) => {
    const tunnel = await mc.score('.TUNNELCLEAR', 'cfg_terrain');
    eq(await mc.score('.TUNNELUP', 'ir'), tunnel + 1, '.TUNNELUP');
  });

  test('modes_init seeds mode defaults (fresh world)', async ({ mc }) => {
    eq(await mc.score('.TORCHMODE', 'ir'), 2, 'torch mode defaults to auto (2)');
    eq(await mc.score('.AGGROMODE', 'ir'), await mc.score('.MOBAGGRO', 'cfg_ride'), '.AGGROMODE seeded from .MOBAGGRO');
    eq(await mc.score('.RAINMODE', 'ir'), 0, 'rain mode off');
    eq(await mc.score('.NIGHTMODE', 'ir'), 0, 'time mode default');
    eq(await mc.score('.SKYMODE', 'ir'), 0, 'sky mode off');
    eq(await mc.score('.HIDECART', 'ir'), 0, 'hide-cart off');
    eq(await mc.score('.SOUNDMODE', 'ir'), await mc.score('.CARTSOUND', 'cfg_ride'), '.SOUNDMODE seeded from .CARTSOUND');
    eq(await mc.score('.LIGHTMODE', 'ir'), 11, 'track light defaults to bright (11)');
    eq(await mc.score('.STORMMODE', 'ir'), await mc.score('.NOSTORMS', 'ir'), '.STORMMODE seeded from .NOSTORMS');
    eq(await mc.score('.trchinit', 'ir'), 1, 'torch one-shot seed flag consumed');
    eq(await mc.score('.agginit', 'ir'), 1, 'aggro one-shot seed flag consumed');
    eq(await mc.score('.sndinit', 'ir'), 1, 'sound one-shot seed flag consumed');
    eq(await mc.score('.lgtinit', 'ir'), 1, 'track-light one-shot seed flag consumed');
    eq(await mc.score('.stminit', 'ir'), 1, 'storms one-shot seed flag consumed');
  });

  test('adjustable state seeded from config defaults', async ({ mc }) => {
    eq(await mc.score('.speed', 'ir'), await mc.score('.DEFAULTSPEED', 'cfg_ride'), '.speed seeded from .DEFAULTSPEED');
    eq(await mc.score('.skyspd', 'ir'), await mc.score('.SKYSPEED', 'cfg_ride'), '.skyspd seeded from .SKYSPEED');
    eq(await mc.score('.ocnspd', 'ir'), await mc.score('.OCEANSPEED', 'cfg_ride'), '.ocnspd seeded from .OCEANSPEED');
    eq(await mc.score('.torchdens', 'ir'), await mc.score('.TORCHODDS', 'cfg_ride'), '.torchdens seeded from .TORCHODDS');
  });

  test('day/night clock self-test passed (.todok)', async ({ mc }) => {
    eq(await mc.score('.todok', 'ir'), 1, 'the pack\'s own predicate clock check -- 0 means torch auto cannot tell day from night on this version');
  });

  test('thunderstorm self-test passed (.stormok)', async ({ mc }) => {
    eq(await mc.score('.stormok', 'ir'), 1, 'the thundering/not_thundering predicate pair -- 0 means the No-Thunderstorms mode cannot see storms on this version');
  });

  test('version-name storage populated by names.mcfunction', async ({ mc }) => {
    ok(await mc.storageString('infinite_rail:speed', 'rule'), 'minecart max-speed gamerule name');
    ok(await mc.storageString('infinite_rail:names', 'weather_cycle'), 'weather-cycle gamerule name');
    ok(await mc.storageString('infinite_rail:names', 'daylight_cycle'), 'daylight-cycle gamerule name');
    ok(await mc.storageString('infinite_rail:names', 'chain_length'), 'chain-budget gamerule name');
  });

  test('no unexpected server errors during boot', async ({ server }) => {
    // Function-compile failures are asserted (with better detail) above;
    // don't double-report them here.
    const errs = server.errorsSince(0, { alsoIgnore: [/Failed to load function/] });
    eq(errs.length, 0, `unexpected ERROR lines: ${errs.slice(0, 5).join(' | ')}`);
  });
});
