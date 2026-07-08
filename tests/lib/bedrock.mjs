// Bedrock Dedicated Server lifecycle + console driver (zero dependencies).
//
// BDS has no RCON; the console (stdin/stdout) is the control channel.
// Commands are serialized and each response is collected with a short
// quiet-window, which is crude but reliable for the scoreboard/function
// commands the tests use.

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LIB_DIR = path.dirname(url.fileURLToPath(import.meta.url));

/**
 * Containers without IPv6 make BDS abort with a bogus "Port may be in use".
 * Compile the ipv6 shim (once) so LD_PRELOAD can paper over it; returns the
 * .so path, or null when IPv6 exists (no shim needed) / no compiler.
 */
function ipv6ShimPath(workDir) {
  if (fs.existsSync('/proc/net/if_inet6')) return null; // real IPv6 -- no shim
  const so = path.join(workDir, 'ipv6shim.so');
  if (!fs.existsSync(so)) {
    fs.mkdirSync(workDir, { recursive: true });
    const cc = spawnSync('gcc', ['-shared', '-fPIC', '-O2', '-o', so, path.join(LIB_DIR, 'ipv6shim.c')], { encoding: 'utf8' });
    if (cc.status !== 0) {
      console.warn(`[bedrock] no IPv6 and the shim did not compile -- BDS may refuse to bind:\n${cc.stderr}`);
      return null;
    }
  }
  return so;
}

export class BedrockServer {
  constructor({ serverDir, bpDir, rpDir, seed = '12345', levelName = 'Bedrock level' }) {
    this.serverDir = serverDir;
    this.bpDir = bpDir;
    this.rpDir = rpDir;
    this.seed = seed;
    this.levelName = levelName;
    this.proc = null;
    this.logBuf = '';
    this.exited = false;
    this._queue = Promise.resolve();
  }

  get log() { return this.logBuf; }
  mark() { return this.logBuf.length; }

  /** Content-log / scripting errors since mark (console output enabled). */
  scriptErrorsSince(mark = 0) {
    return this.logBuf.slice(mark).split('\n').filter((l) =>
      /\[Scripting\].*error|ERROR\]|\[error\]/i.test(l)
      // Harness artifact: freshWorld() removes allowlist.json (BDS refuses
      // offline mode while it exists), so BDS logs one benign open error.
      && !/allow list file|allowlist\.json/i.test(l));
  }

  freshWorld() {
    if (this.proc) throw new Error('server running');
    fs.rmSync(path.join(this.serverDir, 'worlds'), { recursive: true, force: true });

    // install packs into the development folders
    const devBp = path.join(this.serverDir, 'development_behavior_packs', 'sirm_bp_under_test');
    const devRp = path.join(this.serverDir, 'development_resource_packs', 'sirm_rp_under_test');
    fs.rmSync(devBp, { recursive: true, force: true });
    fs.rmSync(devRp, { recursive: true, force: true });
    fs.cpSync(this.bpDir, devBp, { recursive: true });
    if (this.rpDir) fs.cpSync(this.rpDir, devRp, { recursive: true });

    // activate them in the (about to be created) world
    const worldDir = path.join(this.serverDir, 'worlds', this.levelName);
    fs.mkdirSync(worldDir, { recursive: true });
    const ref = (dir) => {
      const man = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
      return [{ pack_id: man.header.uuid, version: man.header.version }];
    };
    fs.writeFileSync(path.join(worldDir, 'world_behavior_packs.json'), JSON.stringify(ref(this.bpDir), null, 2));
    if (this.rpDir) fs.writeFileSync(path.join(worldDir, 'world_resource_packs.json'), JSON.stringify(ref(this.rpDir), null, 2));

    // server.properties: cheats on (console commands), content log to console
    const propsPath = path.join(this.serverDir, 'server.properties');
    const props = new Map(fs.readFileSync(propsPath, 'utf8').split('\n')
      .filter((l) => l.includes('=') && !l.startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
    props.set('level-name', this.levelName);
    props.set('level-seed', this.seed);
    props.set('allow-cheats', 'true');
    // Offline mode: the sandbox has no route to Minecraft services, and no
    // client ever connects anyway. BDS refuses offline mode while an
    // allowlist file exists, so clear both.
    props.set('online-mode', 'false');
    props.set('allow-list', 'false');
    for (const f of ['allowlist.json', 'whitelist.json']) {
      const p = path.join(this.serverDir, f);
      if (fs.existsSync(p)) fs.rmSync(p);
    }
    props.set('content-log-file-enabled', 'true');
    props.set('content-log-console-output-enabled', 'true');
    props.set('content-log-level', 'info');
    props.set('player-idle-timeout', '0');
    // The LAN-announce thread binds the game port a second time, which reads
    // as "Port may be in use" in sandboxed/containerized environments.
    props.set('enable-lan-visibility', 'false');
    fs.writeFileSync(propsPath, [...props].map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
  }

  async start({ timeoutMs = 180000 } = {}) {
    this.logBuf = '';
    this.exited = false;
    const shim = ipv6ShimPath(path.join(LIB_DIR, '..', '.work'));
    this.proc = spawn('./bedrock_server', [], {
      cwd: this.serverDir,
      env: {
        ...process.env,
        LD_LIBRARY_PATH: this.serverDir,
        ...(shim ? { LD_PRELOAD: shim } : {}),
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.proc.stdout.on('data', (d) => { this.logBuf += d; });
    this.proc.stderr.on('data', (d) => { this.logBuf += d; });
    this.proc.on('exit', () => { this.exited = true; });
    const t0 = Date.now();
    while (!/Server started/.test(this.logBuf)) {
      if (/Port \[\d+\] may be in use/.test(this.logBuf)) {
        throw new Error('BDS port already in use -- is another bedrock_server still running? (pkill bedrock_server)');
      }
      if (this.exited) throw new Error(`BDS exited during boot:\n${this.logBuf.slice(-2000)}`);
      if (Date.now() - t0 > timeoutMs) throw new Error(`BDS boot timeout:\n${this.logBuf.slice(-2000)}`);
      await sleep(300);
    }
    await sleep(1500); // let the script init settle
  }

  /** Send one console command; resolve with output printed until quiet. */
  cmd(command, { quietMs = 350, maxMs = 8000 } = {}) {
    this._queue = this._queue.then(async () => {
      const start = this.logBuf.length;
      this.proc.stdin.write(command + '\n');
      const t0 = Date.now();
      let lastLen = start;
      let lastChange = Date.now();
      while (Date.now() - t0 < maxMs) {
        await sleep(80);
        if (this.logBuf.length !== lastLen) { lastLen = this.logBuf.length; lastChange = Date.now(); }
        else if (this.logBuf.length > start && Date.now() - lastChange >= quietMs) break;
      }
      return this.logBuf.slice(start).trim();
    });
    return this._queue;
  }

  /** Bedrock has no `scoreboard players get`; use `test` and parse. */
  async scoreInRange(holder, objective, min, max = min) {
    const r = await this.cmd(`scoreboard players test ${holder} ${objective} ${min} ${max}`);
    return /is in range/i.test(r);
  }

  async fn(name) {
    return this.cmd(`function infinite_rail/${name}`);
  }

  async setScore(holder, objective, value) {
    await this.cmd(`scoreboard players set ${holder} ${objective} ${value}`);
  }

  async stop({ timeoutMs = 30000 } = {}) {
    if (!this.proc) return;
    const proc = this.proc;
    try { proc.stdin.write('stop\n'); } catch { /* ignore */ }
    await new Promise((resolve) => {
      if (this.exited) return resolve();
      const k1 = setTimeout(() => proc.kill('SIGTERM'), timeoutMs / 2);
      const k2 = setTimeout(() => proc.kill('SIGKILL'), timeoutMs);
      proc.on('exit', () => { clearTimeout(k1); clearTimeout(k2); resolve(); });
    });
    this.proc = null;
  }
}
