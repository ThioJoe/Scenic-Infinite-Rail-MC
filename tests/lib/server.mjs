// Headless Java-server lifecycle: fresh world per suite, pack deployment,
// log capture, RCON hookup, clean shutdown.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { Rcon } from './rcon.mjs';

const DEFAULT_IGNORED_ERRORS = [
  /Yggdrasil/i,
  /authlib/i,
  /minecraftservices/i,
  /Failed to request yggdrasil/i,
  /Expected BEGIN_OBJECT/,          // gson noise from the blocked auth lookup
  /gson\/blob\/main\/Troubleshooting/,
];

// The datapack's folder name is cosmetic -- its real identity is the
// `infinite_rail` namespace inside data/ -- but `datapack list` reports it as
// `file/<foldername>` and the boot suite asserts the shipped name. Deploy under
// this canonical name no matter where the pack under test came from (a src
// build, a `dist/java/Scenic_Infinite_Rail_Mode` folder, a CI-artifact dir that
// download-artifact named `java`, or a zip extracted to a temp dir), so that
// assertion holds for every --pack source and not just a from-src build.
const DATAPACK_FOLDER = 'Scenic_Infinite_Rail_Mode';

export class JavaServer {
  constructor({
    serverDir,
    packDir,
    seed = 'scenic-rail-tests',
    rconPort = 25575,
    rconPassword = 'scenic-rail-tests',
    javaArgs = ['-Xmx2G'],
    props = {},
  }) {
    this.serverDir = serverDir;
    this.packDir = packDir;
    this.seed = seed;
    this.rconPort = rconPort;
    this.rconPassword = rconPassword;
    this.javaArgs = javaArgs;
    this.extraProps = props;
    this.proc = null;
    this.rcon = null;
    this.logBuf = '';
    this.exited = false;
  }

  get log() { return this.logBuf; }
  mark() { return this.logBuf.length; }

  /** ERROR-level log lines since `mark`, minus known-benign noise. */
  errorsSince(mark = 0, { alsoIgnore = [] } = {}) {
    const ignore = [...DEFAULT_IGNORED_ERRORS, ...alsoIgnore];
    return this.logBuf.slice(mark).split('\n')
      .filter((l) => /\/(ERROR|FATAL)\]/.test(l))
      .filter((l) => !ignore.some((re) => re.test(l)));
  }

  functionLoadErrors(mark = 0) {
    return [...this.logBuf.slice(mark).matchAll(/Failed to load function (\S+)/g)].map((m) => m[1]);
  }

  /** Wipe world + logs, write server.properties, deploy the pack under test. */
  freshWorld() {
    if (this.proc) throw new Error('server is running; stop it before freshWorld()');
    fs.rmSync(path.join(this.serverDir, 'world'), { recursive: true, force: true });
    fs.rmSync(path.join(this.serverDir, 'logs'), { recursive: true, force: true });
    const props = {
      'online-mode': 'false',
      'level-name': 'world',
      'level-seed': this.seed,
      'spawn-protection': '0',
      'difficulty': 'peaceful',
      'view-distance': '6',
      'simulation-distance': '6',
      'max-players': '3',
      'enable-rcon': 'true',
      'rcon.port': String(this.rconPort),
      'rcon.password': this.rconPassword,
      'broadcast-rcon-to-ops': 'false',
      // Never pause the tick loop just because no player is online -- the
      // whole harness drives an empty server.
      'pause-when-empty-seconds': '-1',
      'server-port': '25565',
      'sync-chunk-writes': 'false',
      ...this.extraProps,
    };
    fs.writeFileSync(
      path.join(this.serverDir, 'server.properties'),
      Object.entries(props).map(([k, v]) => `${k}=${v}`).join('\n') + '\n',
    );
    fs.writeFileSync(path.join(this.serverDir, 'eula.txt'), 'eula=true\n');
    const dest = path.join(this.serverDir, 'world', 'datapacks', DATAPACK_FOLDER);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.cpSync(this.packDir, dest, { recursive: true });
  }

  async start({ timeoutMs = 240000 } = {}) {
    this.logBuf = '';
    this.exited = false;
    this.proc = spawn('java', [...this.javaArgs, '-jar', 'server.jar', 'nogui'], {
      cwd: this.serverDir,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.proc.stdout.on('data', (d) => { this.logBuf += d; });
    this.proc.stderr.on('data', (d) => { this.logBuf += d; });
    this.proc.on('exit', () => { this.exited = true; });

    const t0 = Date.now();
    await new Promise((resolve, reject) => {
      const iv = setInterval(() => {
        if (/\]: Done \(/.test(this.logBuf)) { clearInterval(iv); resolve(); }
        else if (this.exited) { clearInterval(iv); reject(new Error(`server exited during boot:\n${this.logBuf.slice(-3000)}`)); }
        else if (Date.now() - t0 > timeoutMs) { clearInterval(iv); reject(new Error(`server boot timed out after ${timeoutMs / 1000}s`)); }
      }, 250);
    });

    // The RCON listener can come up a moment after the "Done" log line.
    let lastErr;
    for (let attempt = 0; attempt < 20; attempt++) {
      this.rcon = new Rcon('127.0.0.1', this.rconPort, this.rconPassword);
      try {
        await this.rcon.connect();
        return;
      } catch (err) {
        lastErr = err;
        this.rcon.close();
        this.rcon = null;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    throw new Error(`could not connect RCON after server boot: ${lastErr?.message}`);
  }

  async stop({ timeoutMs = 60000 } = {}) {
    if (!this.proc) return;
    const proc = this.proc;
    try {
      if (this.rcon) await this.rcon.cmd('stop');
    } catch { /* rcon may already be gone */ }
    try { this.rcon?.close(); } catch { /* ignore */ }
    this.rcon = null;
    await new Promise((resolve) => {
      if (this.exited) return resolve();
      const kill1 = setTimeout(() => proc.kill('SIGTERM'), timeoutMs / 2);
      const kill2 = setTimeout(() => proc.kill('SIGKILL'), timeoutMs);
      proc.on('exit', () => { clearTimeout(kill1); clearTimeout(kill2); resolve(); });
    });
    this.proc = null;
  }
}
