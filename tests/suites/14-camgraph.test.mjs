// OPT-IN: side-view SVG graphs of the camera curve, traced from the REAL Java
// engine (CONTEXT 7g). The design-time reference graphs (the approved "single
// continuous curve" ascent series) were drawn from cam_math.js in plain float;
// this suite re-draws the same ten ascents -- 1, 2, 3, 4, 5, 7, 10, 15, 25 and
// 40 blocks -- from actual in-game data: a synthetic ascent profile in the
// track history, the pace cart teleported along it in 0.25-block steps, the
// integer cam_follow flown each step, and the seat's real Y read back. Each
// graph overlays the in-game path (blue) on the cam_math.js float reference
// (orange dashes), so the two editions' curves are compared point by point ON
// the picture as well as in the asserts.
//
// Run it with:   CAM_GRAPHS=1 node tests/run.mjs
//         or:    node tests/run.mjs --filter graph
// Output:        tests/.work/camgraphs/ascent_XX.svg
//
// It doubles as a real-engine regression net for the construction itself; the
// asserts encode the properties the curve was designed for (and the bugs it
// replaced -- each is a NEGATIVE hypothesis a bad curve fails):
//   * Java integer path == Bedrock float path (parity; truncation noise only)
//   * never below the rail line (the descent-top rail-clip bug)
//   * dead level on the flats at both ends (no residual float)
//   * no vertical overshoot above the summit (CAMLIFT is the whole budget)
//   * monotone up the whole climb (the mid-ramp wobble bug)
//   * floats ~CAMLIFT above the rail mid-slope on tall ascents

import { defineSuite, ok, eq, between } from '../lib/harness.mjs';
import { camHeight } from '../../src/bedrock/bp/scripts/cam_math.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TESTS_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = path.join(TESTS_DIR, '.work', 'camgraphs');

const ASCENTS = [1, 2, 3, 4, 5, 7, 10, 15, 25, 40];
const PAD = 12;          // flat columns before and after each ascent
const STEP = 0.25;       // cart X step per sample (4 samples/block)
const BASE = 4000;       // world X of history index 0
const Z = 4000;
const SEAT_OFF = 0.062;  // cam_move's +62 milli cart-on-rail offset (CAMHEIGHT 0)

const railLineAt = (H, x) => {
  const i = Math.min(Math.floor(x), H.length - 1);
  const f = x - i;
  const a = H[i];
  const b = H[Math.min(i + 1, H.length - 1)];
  return a * (1 - f) + b * f;
};

function renderSvg({ title, H, base, top, lift, samples }) {
  const len = H.length;
  const px = Math.min(24, Math.floor(840 / (len - 1)));
  const yMax = top + lift + 0.5;
  const yMin = base - 1;
  const L = 52, T = 70;
  const W = L + (len - 1) * px + px + 20;
  const HT = Math.ceil(T + (yMax - yMin) * px + 16);
  const xPix = (x) => (L + x * px).toFixed(1);
  const yPix = (v) => (T + (yMax - v) * px).toFixed(1);
  const lines = [];
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${HT}" viewBox="0 0 ${W} ${HT}" font-family="Segoe UI,Helvetica,Arial,sans-serif">`);
  lines.push(`<rect width="${W}" height="${HT}" fill="#ffffff"/>`);
  lines.push(`<text x="52" y="34" font-size="23" font-weight="700" fill="#111">${title}</text>`);
  lines.push('<text x="52" y="58" font-size="13" fill="#777">side view · grey = track blocks · blue = IN-GAME cart path (Java integer camera) · orange dashes = cam_math.js float reference</text>');
  for (let i = 0; i < len; i++) {
    lines.push(`<rect x="${xPix(i)}" y="${yPix(H[i])}" width="${px}" height="${px}" fill="#f2f2f2" stroke="#333" stroke-width="1.1"/>`);
  }
  const railPts = H.map((v, i) => `${xPix(i)},${yPix(v)}`).join(' ');
  lines.push(`<polyline points="${railPts}" fill="none" stroke="#c8c8c8" stroke-width="1.4" stroke-dasharray="4 4"/>`);
  const refPts = samples.map((s) => `${xPix(s.x)},${yPix(s.ref)}`).join(' ');
  lines.push(`<polyline points="${refPts}" fill="none" stroke="#ff9d2e" stroke-width="1.8" stroke-dasharray="6 4"/>`);
  const gamePts = samples.map((s) => `${xPix(s.x)},${yPix(s.game)}`).join(' ');
  lines.push(`<polyline points="${gamePts}" fill="none" stroke="#1f8fff" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round"/>`);
  lines.push('</svg>');
  return lines.join('\n');
}

export default defineSuite('camera curve graphs from in-game data (SVG)', { optIn: 'CAM_GRAPHS' }, ({ test }) => {
  // One synthetic rig for the whole suite, revcam-style: rig lead pinned to 0
  // (cam_follow samples the profile at the pace cart's own column), frozen
  // throughout so nothing drifts between the teleport and the readback.
  const setup = async (ctx) => {
    if (ctx.state.camReady) return ctx.state;
    const { mc } = ctx;
    await mc.setScore('.PACE_CART_BEHIND', 'cfg_ride', 0);
    await mc.setScore('.RIDER_BEHIND', 'cfg_camera', 0);
    await mc.setScore('.CAMHEIGHT', 'cfg_camera', 0);
    await mc.setScore('.trackBase', 'ir', BASE);
    await mc.setScore('.lineZ', 'ir', Z);
    const lift10 = await mc.score('.CAMLIFT', 'cfg_camera');
    const blend = await mc.score('.CAMBLEND', 'cfg_camera');
    const maxLen = PAD + Math.max(...ASCENTS) + PAD;
    await mc.loadRegion(BASE - 4, Z - 4, BASE + maxLen + 4, Z + 4, { settleMs: 1200 });
    await mc.cmd(`summon minecraft:minecart ${BASE}.0 200 ${Z}.0 {Tags:["ir_cart"],Invulnerable:1b,NoGravity:1b,Motion:[0.0,0.0,0.0]}`);
    await mc.cmd(`summon minecraft:item_display ${BASE}.0 200 ${Z}.0 {Tags:["ir_seat"],teleport_duration:1}`);
    // Freshly forceloaded chunks take a moment to reach their entity-ticking
    // state; until then summoned entities read back null. Poll until the rig
    // is genuinely readable -- a silent null here would trace empty graphs.
    for (let tries = 0; ; tries++) {
      if (await mc.entityNum('@e[type=item_display,tag=ir_seat,limit=1]', 'Pos[1]') !== null
        && await mc.entityExists('@e[type=minecart,tag=ir_cart,limit=1]')) break;
      if (tries >= 40) throw new Error('rig entities never became readable (chunks not entity-ticking)');
      await new Promise((r) => setTimeout(r, 500));
    }
    await mc.freeze();
    fs.mkdirSync(OUT_DIR, { recursive: true });
    ctx.state.camReady = { lift10, blend, maxLen };
    return ctx.state;
  };

  for (const A of ASCENTS) {
    test(`ascent ${A}: in-game curve graphed and clean`, { timeout: 180000 }, async (ctx) => {
      const { mc, note } = ctx;
      const { camReady } = await setup(ctx);
      const { lift10, blend } = camReady;
      const lift = lift10 / 10;
      const base = 100, top = base + A;
      const H = [
        ...Array(PAD).fill(base),
        ...Array.from({ length: A }, (_, i) => base + i + 1),
        ...Array(PAD).fill(top),
      ];
      await mc.cmd(`data modify storage infinite_rail:track y set value [${H.join(',')}]`);
      await mc.setScore('.headX', 'ir', BASE + H.length - 1);

      // Trace: teleport the pace cart along the profile in 0.25-block steps,
      // fly the rig, read the seat's actual Y back off the entity.
      const samples = [];
      for (let x = 0; x <= H.length - 1 + 1e-9; x += STEP) {
        const wx = (BASE + x).toFixed(2);
        await mc.cmd(`tp @e[type=minecart,tag=ir_cart,limit=1] ${wx} 200 ${Z}.0 0 0`);
        await mc.fn('cam_follow');
        const seatY = await mc.entityNum('@e[type=item_display,tag=ir_seat,limit=1]', 'Pos[1]');
        eq(seatY !== null, true, `seat Y unreadable at x=${x} -- the trace would be a false green, failing loudly`);
        const idx = Math.min(Math.floor(x), H.length - 1);
        const ref = camHeight({ trackY: H, index: idx, fx: x - idx, lift10, blend }).sy;
        samples.push({ x, game: seatY - SEAT_OFF, ref });
      }

      // Draw FIRST -- a failing curve should still leave its picture behind.
      const file = path.join(OUT_DIR, `ascent_${String(A).padStart(2, '0')}.svg`);
      fs.writeFileSync(file, renderSvg({ title: `Ascent: ${A} block${A === 1 ? '' : 's'} — in-game`, H, base, top, lift, samples }));
      note(`graph: ${path.relative(process.cwd(), file)} (${samples.length} in-game samples)`);

      // Parity: the Java integer curve IS the float curve (truncation only).
      let maxDiff = 0;
      for (const s of samples) maxDiff = Math.max(maxDiff, Math.abs(s.game - s.ref));
      note(`max |Java - cam_math.js| = ${maxDiff.toFixed(4)} blocks`);
      ok(maxDiff < 0.005, `integer camera matches the float reference (got ${maxDiff.toFixed(4)})`);

      // The design properties (each a former bug):
      for (const s of samples) {
        const rail = railLineAt(H, s.x);
        if (s.game < rail - 0.002) return eq(s.game >= rail - 0.002, true, `clipped below the rail line at x=${s.x} (${s.game.toFixed(3)} < ${rail.toFixed(3)})`);
        if (s.game > top + 0.01) return eq(s.game <= top + 0.01, true, `overshot above the summit at x=${s.x} (${s.game.toFixed(3)} > ${top})`);
      }
      between(samples[4].game - base, -0.01, 0.01, 'level on the approach flat');
      between(samples[samples.length - 5].game - top, -0.01, 0.01, 'level on the summit flat');
      for (let i = 1; i < samples.length; i++) {
        const d = samples[i].game - samples[i - 1].game;
        if (d < -0.0025) return eq(d >= -0.0025, true, `curve wobbles (drops ${d.toFixed(4)}) at x=${samples[i].x}`);
      }
      if (A >= 10) {
        const mid = samples.find((s) => s.x === PAD + A / 2) ?? samples[Math.floor(samples.length / 2)];
        between(mid.game - railLineAt(H, mid.x), 0.6 * lift, 1.2 * lift, `floats ~CAMLIFT above the rail mid-slope (got ${(mid.game - railLineAt(H, mid.x)).toFixed(2)})`);
      }
    });
  }

  test('cleanup: rig removed, world unfrozen', { timeout: 60000 }, async ({ mc, state }) => {
    await mc.unfreeze();
    await mc.cmd('kill @e[type=minecart,tag=ir_cart]');
    await mc.cmd('kill @e[type=item_display,tag=ir_seat]');
    const maxLen = state.camReady?.maxLen ?? PAD + Math.max(...ASCENTS) + PAD;
    await mc.unloadRegion(BASE - 4, Z - 4, BASE + maxLen + 4, Z + 4);
    ok(true, 'cleaned up');
  });
});
