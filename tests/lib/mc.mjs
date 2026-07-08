// High-level game helpers over RCON: scoreboard/NBT readback, tick control,
// chunk loading, block checks and block counting.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class MC {
  constructor(rcon) {
    this.rcon = rcon;
    this._scratchReady = false;
  }

  cmd(c) { return this.rcon.cmd(c); }

  /** `function infinite_rail:<name>` */
  fn(name) { return this.cmd(`function infinite_rail:${name}`); }

  // ---------- scoreboard ----------

  /** Integer score or null when unset. Throws on unknown objective. */
  async score(holder, objective) {
    const r = await this.cmd(`scoreboard players get ${holder} ${objective}`);
    const m = r.match(/ has (-?\d+) \[/);
    if (m) return parseInt(m[1], 10);
    if (/none is set/.test(r)) return null;
    throw new Error(`score ${holder} ${objective}: unexpected response ${JSON.stringify(r)}`);
  }

  async setScore(holder, objective, value) {
    await this.cmd(`scoreboard players set ${holder} ${objective} ${value}`);
  }

  async #scratch() {
    if (!this._scratchReady) {
      await this.cmd('scoreboard objectives add irtest dummy'); // idempotent enough: errors are ignored
      this._scratchReady = true;
    }
  }

  /** `execute store result` of an arbitrary command into a scratch score. */
  async storeResult(command) {
    await this.#scratch();
    await this.cmd(`execute store result score .r irtest run ${command}`);
    return this.score('.r', 'irtest');
  }

  // ---------- NBT / storage ----------

  async storageInt(storage, nbtPath) {
    const r = await this.cmd(`data get storage ${storage} ${nbtPath}`);
    const m = r.match(/contents: (-?\d+)\b/);
    return m ? parseInt(m[1], 10) : null;
  }

  async storageString(storage, nbtPath) {
    const r = await this.cmd(`data get storage ${storage} ${nbtPath}`);
    const m = r.match(/contents: "(.*)"/);
    return m ? m[1] : null;
  }

  /** First float/double/int in a `data get entity ...` response, or null. */
  async entityNum(selector, nbtPath) {
    const r = await this.cmd(`data get entity ${selector} ${nbtPath}`);
    const m = r.match(/data: \[?(-?\d+(?:\.\d+)?)[dfbsL]?[,\]]?/);
    return m ? parseFloat(m[1]) : null;
  }

  async entityExists(selector) {
    const r = await this.cmd(`execute if entity ${selector}`);
    return /Test passed/.test(r);
  }

  // ---------- track history ----------

  async trackLen() {
    return this.storeResult('data get storage infinite_rail:track y');
  }

  async trackY(index) {
    return this.storageInt('infinite_rail:track', `y[${index}]`);
  }

  // ---------- tick control ----------

  async gametime() {
    const r = await this.cmd('time query gametime');
    const m = r.match(/(-?\d+) tick/);
    if (!m) throw new Error(`time query: ${JSON.stringify(r)}`);
    return parseInt(m[1], 10);
  }

  async freeze() { await this.cmd('tick freeze'); }
  async unfreeze() { await this.cmd('tick unfreeze'); }

  /** Step exactly n ticks (game must be frozen) and wait for completion. */
  async step(n, { timeoutMs } = {}) {
    const t0 = await this.gametime();
    await this.cmd(`tick step ${n}`);
    const limit = timeoutMs ?? Math.max(5000, n * 500);
    const start = Date.now();
    while (Date.now() - start < limit) {
      if (await this.gametime() >= t0 + n) return;
      await sleep(100);
    }
    throw new Error(`tick step ${n} did not complete within ${limit}ms`);
  }

  /** Sprint n ticks as fast as the server can, waiting for completion. */
  async sprint(n, { timeoutMs } = {}) {
    const t0 = await this.gametime();
    await this.cmd(`tick sprint ${n}`);
    const limit = timeoutMs ?? Math.max(30000, n * 100);
    const start = Date.now();
    while (Date.now() - start < limit) {
      const q = await this.cmd('tick query');
      if (!/sprinting/i.test(q) && (await this.gametime()) >= t0 + n) return;
      await sleep(300);
    }
    throw new Error(`tick sprint ${n} did not complete within ${limit}ms`);
  }

  // ---------- chunks & blocks ----------

  /** Force-load the chunks covering a block-coordinate rectangle. */
  async loadRegion(x1, z1, x2, z2, { settleMs = 800 } = {}) {
    await this.cmd(`forceload add ${Math.min(x1, x2)} ${Math.min(z1, z2)} ${Math.max(x1, x2)} ${Math.max(z1, z2)}`);
    await sleep(settleMs);
  }

  async unloadRegion(x1, z1, x2, z2) {
    await this.cmd(`forceload remove ${Math.min(x1, x2)} ${Math.min(z1, z2)} ${Math.max(x1, x2)} ${Math.max(z1, z2)}`);
  }

  /** 'match' | 'nomatch' | 'unloaded' */
  async blockIs(x, y, z, block) {
    const r = await this.cmd(`execute if block ${x} ${y} ${z} ${block}`);
    if (/Test passed/.test(r)) return 'match';
    if (/not loaded/i.test(r)) return 'unloaded';
    return 'nomatch';
  }

  /**
   * Count blocks of a type in a cuboid by fill-replacing them with air
   * (destructive -- use on regions whose contents are done being asserted).
   * Splits the volume into y-slabs to stay under the fill command limit.
   */
  async countAndClearBlocks(x1, y1, z1, x2, y2, z2, block) {
    const [xa, xb] = [Math.min(x1, x2), Math.max(x1, x2)];
    const [ya, yb] = [Math.min(y1, y2), Math.max(y1, y2)];
    const [za, zb] = [Math.min(z1, z2), Math.max(z1, z2)];
    const footprint = (xb - xa + 1) * (zb - za + 1);
    const maxSlabH = Math.max(1, Math.floor(30000 / footprint));
    let total = 0;
    for (let y = ya; y <= yb; y += maxSlabH) {
      const yTop = Math.min(yb, y + maxSlabH - 1);
      const r = await this.cmd(`fill ${xa} ${y} ${za} ${xb} ${yTop} ${zb} minecraft:air replace ${block}`);
      const m = r.match(/filled (\d+) block/i);
      if (m) total += parseInt(m[1], 10);
      else if (/not loaded/i.test(r)) throw new Error(`countAndClearBlocks: region not loaded at y=${y}: ${r}`);
      // "no blocks were filled" style responses mean 0 -- fine.
    }
    return total;
  }
}
