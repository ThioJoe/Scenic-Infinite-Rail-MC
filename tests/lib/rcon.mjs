// Minimal zero-dependency RCON client for the vanilla Java server.
//
// Vanilla RCON sends exactly one response packet per request (bodies are
// truncated around 4 KiB -- keep individual command outputs small; read big
// NBT lists element-by-element instead of all at once). Commands are
// serialized: each waits for the response whose id matches its request.

import net from 'node:net';

export class Rcon {
  constructor(host, port, password) {
    this.host = host;
    this.port = port;
    this.password = password;
    this.socket = null;
    this.nextId = 1;
    this.buffer = Buffer.alloc(0);
    this.pending = new Map(); // id -> {resolve, reject}
  }

  connect(timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: this.host, port: this.port });
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error(`RCON connect timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      socket.on('connect', async () => {
        clearTimeout(timer);
        this.socket = socket;
        socket.on('data', (chunk) => this.#onData(chunk));
        socket.on('error', (err) => this.#failAll(err));
        socket.on('close', () => this.#failAll(new Error('RCON connection closed')));
        try {
          await this.#send(3, this.password); // SERVERDATA_AUTH
          resolve();
        } catch (err) {
          reject(err);
        }
      });
      socket.once('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  /** Run one command; resolves with the server's textual response. */
  async cmd(command) {
    if (!this.socket) throw new Error('RCON not connected');
    return this.#send(2, command); // SERVERDATA_EXECCOMMAND
  }

  close() {
    if (this.socket) {
      this.socket.removeAllListeners('close');
      this.socket.destroy();
      this.socket = null;
    }
    this.#failAll(new Error('RCON closed'));
  }

  #send(type, body) {
    const id = this.nextId++;
    const payload = Buffer.from(body, 'utf8');
    const packet = Buffer.alloc(14 + payload.length);
    packet.writeInt32LE(10 + payload.length, 0);
    packet.writeInt32LE(id, 4);
    packet.writeInt32LE(type, 8);
    payload.copy(packet, 12);
    // trailing two zero bytes already present from alloc
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.write(packet);
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`RCON timeout waiting for response to: ${body.slice(0, 120)}`));
        }
      }, 30000);
    });
  }

  #onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 4) {
      const len = this.buffer.readInt32LE(0);
      if (this.buffer.length < 4 + len) return; // wait for more
      const id = this.buffer.readInt32LE(4);
      const body = this.buffer.subarray(12, 4 + len - 2).toString('utf8');
      this.buffer = this.buffer.subarray(4 + len);
      if (id === -1) {
        // auth failure is reported with id -1
        const first = this.pending.values().next().value;
        this.pending.clear();
        if (first) first.reject(new Error('RCON authentication failed'));
        continue;
      }
      const waiter = this.pending.get(id);
      if (waiter) {
        this.pending.delete(id);
        waiter.resolve(body);
      }
    }
  }

  #failAll(err) {
    for (const { reject } of this.pending.values()) reject(err);
    this.pending.clear();
  }
}
