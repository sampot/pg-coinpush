/**
 * Original arcade-ish SFX via Web Audio — no commercial samples.
 */

export class CoinpushAudio {
  constructor() {
    /** @type {AudioContext | null} */
    this.ctx = null;
    this.enabled = true;
    this.master = 0.2;
    this._clinkGate = 0;
    this._pushGate = 0;
  }

  async unlock() {
    this.ensure();
    if (this.ctx?.state === "suspended") await this.ctx.resume();
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
  }

  setEnabled(on) {
    this.enabled = on;
  }

  /**
   * @param {number} freq
   * @param {number} dur
   * @param {OscillatorType} [type]
   * @param {number} [gain]
   * @param {number} [when]
   */
  tone(freq, dur, type = "square", gain = 0.12, when = 0) {
    if (!this.enabled) return;
    this.ensure();
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain * this.master, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.03, dur));
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  start() {
    this.tone(392, 0.07, "triangle", 0.09);
    this.tone(523, 0.1, "triangle", 0.08, 0.06);
  }

  drop() {
    this.tone(280, 0.05, "sine", 0.07);
    this.tone(180, 0.08, "triangle", 0.05, 0.04);
  }

  land() {
    this.tone(220 + Math.random() * 40, 0.04, "triangle", 0.05);
  }

  clink() {
    this.ensure();
    const now = this.ctx?.currentTime ?? 0;
    if (now < this._clinkGate) return;
    this._clinkGate = now + 0.04;
    this.tone(640 + Math.random() * 220, 0.03, "square", 0.035);
  }

  push() {
    this.ensure();
    const now = this.ctx?.currentTime ?? 0;
    if (now < this._pushGate) return;
    this._pushGate = now + 0.08;
    this.tone(140, 0.05, "sawtooth", 0.035);
  }

  score() {
    this.tone(440, 0.07, "triangle", 0.09);
    this.tone(660, 0.1, "triangle", 0.08, 0.06);
    this.tone(880, 0.08, "sine", 0.06, 0.12);
  }

  deny() {
    this.tone(160, 0.08, "square", 0.05);
    this.tone(110, 0.1, "triangle", 0.04, 0.05);
  }

  empty() {
    this.tone(300, 0.1, "triangle", 0.07);
    this.tone(220, 0.14, "sine", 0.06, 0.1);
  }
}
