/**
 * 推幣機 — coin-pusher physics (circles + AABB plate). Not a full engine, but
 * strictly no free energy: a coin moves only when the plate or another coin
 * pushes it, contacts are symmetric, and the house edge comes from the ledge
 * geometry (center payout chute vs side returns) rather than from fudge forces.
 * Top-ish view: back = plate, front = ledge.
 */

export const W = 420;
export const H = 640;
export const COIN_R = 18;
export const FIELD_LEFT = 28;
export const FIELD_RIGHT = W - 28;
export const SHELF_TOP = 118;
export const FRONT_EDGE = 470;
export const DROP_Y = 52;
export const PUSHER_H = 36;
export const PUSHER_AMP = 42;
export const PUSHER_PERIOD = 3.2;
export const GRAVITY = 980;
/** Coulomb friction of coin on shelf: coins only slide while something pushes. */
export const FRICTION_MU = 0.34;
export const WALL_REST = 0.35;
export const COIN_REST = 0.18;
export const FIXED_DT = 1 / 120;
export const START_CREDITS = 20;
export const CREDIT_TOP_UP = 20;
export const POINTS_PER_COIN = 10;
/** Hard cap — the shelf physically holds no more. */
export const MAX_COINS = 84;
/** Contact solver iterations per physics step (chain stiffness). */
export const SOLVER_PASSES = 6;
/**
 * Pre-loaded bed. A real cabinet is filled across the full width: the plate
 * shoves a whole row at once, so every column has its own force chain. A
 * narrow pile just wedges sideways and never moves the bed.
 */
export const SEED_FRONT_GAP = 0;
export const SEED_BACK_Y = 250;
/**
 * Front ledge is split like a real cabinet: a center payout chute that scores,
 * flanked by side returns that swallow coins. This is the whole house edge —
 * nothing else stops a coin from reaching the ledge.
 */
export const PAYOUT_HALF_W = 92;
export const PAYOUT_LEFT = (FIELD_LEFT + FIELD_RIGHT) / 2 - PAYOUT_HALF_W;
export const PAYOUT_RIGHT = (FIELD_LEFT + FIELD_RIGHT) / 2 + PAYOUT_HALF_W;

/**
 * @typedef {object} Coin
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 * @property {number} r
 * @property {boolean} falling still dropping onto shelf
 * @property {boolean} alive
 * @property {number} hue gold variation
 * @property {number} flash
 */

export class CoinpushGame {
  constructor() {
    this.reset();
  }

  reset() {
    this.score = 0;
    this.credits = START_CREDITS;
    this.pushed = 0;
    this.lost = 0;
    this.t = 0;
    this.shake = 0;
    this.lastGain = 0;
    this.aimX = (FIELD_LEFT + FIELD_RIGHT) / 2;
    /** @type {'ready' | 'playing' | 'empty'} */
    this.status = "ready";
    this.message = "點「開台」開始；點機台選位置投幣";
    /** @type {Coin[]} */
    this.coins = [];
    this.physAcc = 0;
    this.pusherY = SHELF_TOP;
    this.seedShelf();
  }

  aliveCount() {
    let n = 0;
    for (const c of this.coins) if (c.alive) n += 1;
    return n;
  }

  pruneDead() {
    if (this.coins.some((c) => !c.alive)) {
      this.coins = this.coins.filter((c) => c.alive);
    }
  }

  start() {
    if (this.status === "playing" && this.credits > 0) return false;
    this.score = 0;
    this.pushed = 0;
    this.lost = 0;
    this.credits = START_CREDITS;
    this.coins = [];
    this.seedShelf();
    this.t = 0;
    this.shake = 0;
    this.physAcc = 0;
    this.status = "playing";
    this.message = "點機台上方投下代幣 · 純娛樂計分";
    this.lastGain = 0;
    return true;
  }

  /**
   * Pre-loaded bed, like a freshly filled machine: rows from the plate's reach
   * out to the ledge, so an inserted coin has to displace what is already there.
   */
  seedShelf() {
    // Hex close packing: neighbours actually touch, so a shove travels instead
    // of being swallowed by slack.
    const d = COIN_R * 2;
    const pitch = d * Math.sin(Math.PI / 3);
    const usable = FIELD_RIGHT - FIELD_LEFT - d;
    const cols = Math.floor(usable / d) + 1;
    const yFront = FRONT_EDGE - COIN_R - SEED_FRONT_GAP;
    const rows = Math.floor((yFront - SEED_BACK_Y) / pitch) + 1;
    for (let row = 0; row < rows; row++) {
      const y = yFront - row * pitch;
      const odd = row % 2 === 1;
      const n = odd ? cols - 1 : cols;
      for (let c = 0; c < n; c++) {
        const x = FIELD_LEFT + COIN_R + (odd ? COIN_R : 0) + c * d;
        this.coins.push(
          this.makeCoin(x + (Math.random() - 0.5) * 0.8, y, false),
        );
      }
    }
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {boolean} falling
   */
  makeCoin(x, y, falling) {
    return {
      x,
      y,
      vx: 0,
      vy: falling ? 40 : 0,
      r: COIN_R,
      falling,
      alive: true,
      hue: 38 + Math.random() * 18,
      flash: 0,
    };
  }

  /**
   * Aim drop X from canvas coords.
   * @param {number} x
   */
  setAim(x) {
    const pad = COIN_R + 2;
    this.aimX = Math.max(FIELD_LEFT + pad, Math.min(FIELD_RIGHT - pad, x));
  }

  /**
   * Unlimited entertainment top-up (pure fun credits).
   * @param {number} [n]
   */
  addCredits(n = CREDIT_TOP_UP) {
    if (n <= 0) return false;
    this.credits += n;
    if (this.status === "empty") this.status = "playing";
    this.message =
      this.status === "ready"
        ? `已加 ${n} 枚 · 開台後可投`
        : `續幣 +${n} · 現有 ${this.credits} 枚`;
    return true;
  }

  /**
   * Spend one credit and drop a coin at aimX.
   */
  drop() {
    /** @type {string[]} */
    const events = [];
    if (this.status !== "playing") {
      this.message = "請先開台";
      events.push("deny");
      return { ok: false, events };
    }
    if (this.credits <= 0) {
      this.status = "empty";
      this.message = `代幣用盡 · 總分 ${this.score} · 可續幣`;
      events.push("deny");
      events.push("empty");
      return { ok: false, events };
    }
    this.pruneDead();
    if (this.aliveCount() >= MAX_COINS) {
      this.message = "盤面滿了 · 等推板推出幾枚再投";
      events.push("deny");
      return { ok: false, events };
    }
    this.credits -= 1;
    this.coins.push(this.makeCoin(this.aimX, DROP_Y, true));
    events.push("drop");
    this.message =
      this.credits > 0
        ? `投下代幣 · 剩 ${this.credits} 枚`
        : "最後一枚投下 · 看推板吧";
    return { ok: true, events };
  }

  pusherRect() {
    const mid = SHELF_TOP + PUSHER_H * 0.35 + PUSHER_AMP * 0.5;
    const y = mid + Math.sin((this.t / PUSHER_PERIOD) * Math.PI * 2) * PUSHER_AMP;
    return {
      x: FIELD_LEFT + 6,
      y,
      w: FIELD_RIGHT - FIELD_LEFT - 12,
      h: PUSHER_H,
    };
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    /** @type {string[]} */
    const events = [];
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 7);

    for (const c of this.coins) {
      if (c.flash > 0) c.flash = Math.max(0, c.flash - dt * 3);
    }

    this.physAcc += Math.min(dt, 0.05);
    let guard = 0;
    while (this.physAcc >= FIXED_DT && guard++ < 24) {
      this.physAcc -= FIXED_DT;
      this.t += FIXED_DT;
      this.stepPhysics(FIXED_DT, events);
    }

    const rect = this.pusherRect();
    this.pusherY = rect.y;

    if (this.status === "playing" && this.credits <= 0) {
      const anyFalling = this.coins.some((c) => c.alive && c.falling);
      const moving = this.coins.some(
        (c) => c.alive && !c.falling && Math.hypot(c.vx, c.vy) > 8,
      );
      if (
        !anyFalling &&
        !moving &&
        this.message.indexOf("代幣用盡") < 0 &&
        this.message.indexOf("續幣") < 0
      ) {
        this.status = "empty";
        this.message = `代幣用盡 · 總分 ${this.score} · 點「+20 幣」續投`;
      }
    }

    return { events: uniqueTail(events, 10) };
  }

  /**
   * @param {number} h
   * @param {string[]} events
   */
  stepPhysics(h, events) {
    const pusher = this.pusherRect();
    const omega = (Math.PI * 2) / PUSHER_PERIOD;
    const pusherVy = Math.cos(this.t * omega) * PUSHER_AMP * omega;

    for (const c of this.coins) {
      if (!c.alive) continue;

      if (c.falling) {
        c.vy += GRAVITY * h;
        c.x += c.vx * h;
        c.y += c.vy * h;
        const landY = Math.max(
          pusher.y + pusher.h + c.r + 2,
          SHELF_TOP + PUSHER_H + c.r,
        );
        if (c.y >= landY) {
          c.y = landY;
          c.vy = 0;
          c.vx *= 0.4;
          c.falling = false;
          events.push("land");
        }
        this.clampX(c);
        continue;
      }

      // Flat shelf: no forward pull. Only contacts move a coin, and Coulomb
      // friction brings it back to rest shortly after the push ends.
      const sp = Math.hypot(c.vx, c.vy);
      if (sp > 0.5) {
        const dec = Math.min(sp, FRICTION_MU * GRAVITY * h);
        c.vx -= (c.vx / sp) * dec;
        c.vy -= (c.vy / sp) * dec;
      } else {
        c.vx = 0;
        c.vy = 0;
      }

      c.x += c.vx * h;
      c.y += c.vy * h;

      this.resolvePusher(c, pusher, pusherVy, events);
      this.clampX(c);

      const back = SHELF_TOP + c.r;
      if (c.y < back) {
        c.y = back;
        if (c.vy < 0) c.vy = -c.vy * WALL_REST;
      }

      // Tips over once its center of mass clears the ledge; only the center
      // chute pays, the flanks are side returns.
      if (c.y > FRONT_EDGE) {
        if (c.x > PAYOUT_LEFT && c.x < PAYOUT_RIGHT) {
          this.scoreCoin(c, events);
        } else {
          this.loseCoin(c, events);
        }
      }
    }

    // Rigid-ish contact chain: iterate plate + coin contacts together, so a
    // packed shelf transmits the plate's shove all the way to the ledge
    // instead of losing half of it at every contact.
    for (let pass = 0; pass < SOLVER_PASSES; pass++) {
      this.resolveCoins(events);
      for (const c of this.coins) {
        if (!c.alive || c.falling) continue;
        this.resolvePusher(c, pusher, pusherVy, events);
        this.clampX(c);
        const back = SHELF_TOP + c.r;
        if (c.y < back) c.y = back;
      }
    }

    // Sweep scored coins so aliveCount stays honest
    if (this.coins.length > this.aliveCount() + 8) this.pruneDead();
  }

  /**
   * @param {Coin} c
   */
  clampX(c) {
    const left = FIELD_LEFT + c.r;
    const right = FIELD_RIGHT - c.r;
    if (c.x < left) {
      c.x = left;
      if (c.vx < 0) c.vx = -c.vx * WALL_REST;
    } else if (c.x > right) {
      c.x = right;
      if (c.vx > 0) c.vx = -c.vx * WALL_REST;
    }
  }

  /**
   * @param {Coin} c
   * @param {{ x: number, y: number, w: number, h: number }} p
   * @param {number} pusherVy
   * @param {string[]} events
   */
  resolvePusher(c, p, pusherVy, events) {
    const nearestX = Math.max(p.x, Math.min(p.x + p.w, c.x));
    const nearestY = Math.max(p.y, Math.min(p.y + p.h, c.y));
    const dx = c.x - nearestX;
    const dy = c.y - nearestY;
    const dist = Math.hypot(dx, dy);

    // Swept over by the plate: eject to the front face, at plate speed.
    if (dist < 1e-6) {
      c.y = p.y + p.h + c.r;
      if (pusherVy > 0) c.vy = Math.max(c.vy, pusherVy);
      events.push("push");
      return;
    }
    if (dist >= c.r) return;

    const nx = dx / dist;
    const ny = dy / dist;
    c.x += nx * (c.r - dist);
    c.y += ny * (c.r - dist);

    // A rigid plate can impart its own surface speed and no more; when it
    // retracts it lets go instead of dragging coins back.
    const vn = c.vx * nx + c.vy * ny;
    const plateVn = pusherVy * ny;
    if (vn < plateVn) {
      const dv = plateVn - vn;
      c.vx += dv * nx;
      c.vy += dv * ny;
      if (dv > 12) events.push("push");
    }
  }

  /**
   * One Gauss-Seidel sweep over coin contacts, ordered back to front so a push
   * propagates along the chain in the direction it travels.
   * @param {string[]} events
   */
  resolveCoins(events) {
    const list = [];
    for (const c of this.coins) {
      if (c.alive && !c.falling) list.push(c);
    }
    list.sort((a, b) => a.y - b.y);
    const n = list.length;
    for (let i = 0; i < n; i++) {
      const a = list[i];
      for (let j = i + 1; j < n; j++) {
        const b = list[j];
        // Sorted by y: once the gap exceeds a diameter, nothing further touches.
        if (b.y - a.y >= a.r + b.r) break;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const min = a.r + b.r;
        if (dist >= min) continue;
        if (dist < 1e-8) {
          a.y -= min * 0.5;
          b.y += min * 0.5;
          continue;
        }

        // Equal masses: split the penetration and the impulse evenly, so a
        // pack only advances as far as something actually pushes it.
        const nx = dx / dist;
        const ny = dy / dist;
        const corr = (min - dist) * 0.5;
        a.x -= nx * corr;
        a.y -= ny * corr;
        b.x += nx * corr;
        b.y += ny * corr;

        const rvn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rvn >= 0) continue;
        const impulse = (-(1 + COIN_REST) * rvn) / 2;
        a.vx -= impulse * nx;
        a.vy -= impulse * ny;
        b.vx += impulse * nx;
        b.vy += impulse * ny;
        if (impulse > 25) events.push("clink");
      }
    }
  }

  /**
   * @param {Coin} c
   * @param {string[]} events
   */
  scoreCoin(c, events) {
    if (!c.alive) return;
    c.alive = false;
    this.score += POINTS_PER_COIN;
    this.pushed += 1;
    this.lastGain = POINTS_PER_COIN;
    this.shake = 0.4;
    events.push("score");
    this.message = `推出！＋${POINTS_PER_COIN} · 總分 ${this.score}`;
  }

  /**
   * Fell into a side return: gone, no points.
   * @param {Coin} c
   * @param {string[]} events
   */
  loseCoin(c, events) {
    if (!c.alive) return;
    c.alive = false;
    this.lost += 1;
    events.push("lost");
    this.message = `滑進邊溝 · 不計分 · 已漏 ${this.lost} 枚`;
  }
}

/**
 * @param {string[]} arr
 * @param {number} n
 */
function uniqueTail(arr, n) {
  const out = [];
  for (let i = arr.length - 1; i >= 0 && out.length < n; i--) {
    if (!out.includes(arr[i])) out.push(arr[i]);
  }
  return out.reverse();
}
