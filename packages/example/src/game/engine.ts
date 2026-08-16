/*
 * Локальная авторитетная симуляция (аналог GameRoom + PhysicsWorld + BotPlayer).
 * Клиент и «сервер» живут в одном окне: снапшоты WORLD_STATE уходят в HUD,
 * события BUBBLE_POP_EVENT — в частицы и звук.
 */
import { BAL, BOT_DEFS, PLAYER_HUE, KILL_VERBS, OBSTACLE_SPOTS } from './constants';
import type { EngineCallbacks, HudPlayer, HudSnapshot, MatchResult } from './types';
import {
  drawBubble,
  drawBackdrop,
  drawVignette,
  createAmbient,
  hsla,
  type AmbientBubble,
} from './render';
import { AudioSynth } from './audio';

const PI2 = Math.PI * 2;
const STEP = 1 / 60;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const angDiff = (from: number, to: number) => {
  let d = (to - from) % PI2;
  if (d > Math.PI) d -= PI2;
  if (d < -Math.PI) d += PI2;
  return d;
};
const rand = (a: number, b: number) => a + Math.random() * (b - a);

interface Wobble {
  s: number;
  v: number;
  a: number;
}
interface Tank {
  id: string;
  name: string;
  isBot: boolean;
  hue: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  aim: number;
  aimTarget: number;
  recoil: number;
  recoilV: number;
  fireCd: number;
  hp: number;
  kills: number;
  deaths: number;
  shotsFired: number;
  shotsHit: number;
  damageDealt: number;
  alive: boolean;
  respawnT: number;
  invulnT: number;
  flash: number;
  wob: Wobble;
  phase: number;
  skill: number;
  strafeDir: number;
  strafeT: number;
  burstLeft: number;
  restT: number;
  moveX: number;
  moveY: number;
  shooting: boolean;
}
interface Obstacle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: number;
  wob: Wobble;
  phase: number;
}
interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: number;
  owner: string;
  life: number;
  age: number;
  trail: Array<{ x: number; y: number }>;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  maxLife: number;
  hue: number;
  kind: 'drop' | 'ring' | 'spark';
}

export class BubbleWarsEngine {
  readonly audio = new AudioSynth();
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cb: EngineCallbacks;
  private w = 800;
  private h = 600;
  private dpr = 1;

  private tanks: Tank[] = [];
  private obstacles: Obstacle[] = [];
  private projectiles: Projectile[] = [];
  private particles: Particle[] = [];
  private ambient: AmbientBubble[] = [];

  private keys = new Set<string>();
  private mouse = { x: 400, y: 200, down: false };

  private raf = 0;
  private lastTs = 0;
  private acc = 0;
  private t = 0;
  private destroyed = false;
  paused = false;

  private phase: 'match' | 'over' = 'match';
  private matchT = 0;
  private suddenDeath = false;
  private pendingEnd: { t: number; winner: Tank; reason: 'frags' | 'time' } | null = null;

  private shake = 0;
  private hitStop = 0;
  private timeScale = 1;
  private playerFlash = 0;
  private hudAcc = 0;
  private nextProjId = 1;
  private playerName = 'Игрок';

  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private onMouseMove: (e: MouseEvent) => void;
  private onMouseDown: (e: MouseEvent) => void;
  private onMouseUp: () => void;
  private onResize: () => void;
  private onBlur: () => void;
  private onCtx: (e: Event) => void;

  constructor(canvas: HTMLCanvasElement, cb: EngineCallbacks) {
    this.canvas = canvas;
    this.cb = cb;
    this.ctx = canvas.getContext('2d')!;
    try {
      document.fonts.load('800 13px Nunito').catch(() => undefined);
      document.fonts.load('700 13px Comfortaa').catch(() => undefined);
    } catch {
      /* ignore */
    }

    this.onResize = () => this.resize();
    this.onKeyDown = (e) => {
      this.audio.init();
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      this.keys.add(e.code);
      if ((e.code === 'Escape' || e.code === 'KeyP') && this.phase === 'match') {
        this.cb.onPauseRequest();
      }
      if (e.code === 'KeyM') this.toggleMute();
    };
    this.onKeyUp = (e) => this.keys.delete(e.code);
    this.onMouseMove = (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    };
    this.onMouseDown = (e) => {
      this.audio.init();
      if (e.button === 0) this.mouse.down = true;
    };
    this.onMouseUp = () => {
      this.mouse.down = false;
    };
    this.onBlur = () => {
      this.keys.clear();
      this.mouse.down = false;
    };
    this.onCtx = (e) => e.preventDefault();

    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('blur', this.onBlur);
    canvas.addEventListener('contextmenu', this.onCtx);

    this.resize();
    this.ambient = createAmbient(this.w, this.h);
    this.lastTs = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('blur', this.onBlur);
    this.canvas.removeEventListener('contextmenu', this.onCtx);
  }

  private resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = Math.max(480, window.innerWidth);
    this.h = Math.max(360, window.innerHeight);
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
    const m = BAL.TANK_R + 16;
    for (const t of this.tanks) {
      t.x = clamp(t.x, m, this.w - m);
      t.y = clamp(t.y, m, this.h - m);
    }
    for (const o of this.obstacles) {
      o.x = clamp(o.x, o.r + 14, this.w - o.r - 14);
      o.y = clamp(o.y, o.r + 14, this.h - o.r - 14);
    }
  }

  /* ------------------------------------------------- матч */

  startMatch(name: string) {
    this.playerName = name.trim() || 'Игрок';
    this.tanks = [];
    this.projectiles = [];
    this.particles = [];
    this.matchT = 0;
    this.suddenDeath = false;
    this.pendingEnd = null;
    this.phase = 'match';
    this.timeScale = 1;
    this.shake = 0;
    this.playerFlash = 0;

    const m = 96;
    const corners = [
      { x: m, y: m },
      { x: this.w - m, y: m },
      { x: m, y: this.h - m },
      { x: this.w - m, y: this.h - m },
    ];
    const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
    this.tanks.push(this.makeTank('p1', this.playerName, false, PLAYER_HUE, corners[order[0]], 1));
    BOT_DEFS.forEach((b, i) => {
      this.tanks.push(
        this.makeTank(`bot${i}`, b.name, true, b.hue, corners[order[i + 1]], b.skill),
      );
    });

    this.obstacles = OBSTACLE_SPOTS.map((s) => ({
      x: clamp(s.fx * this.w, s.fr * Math.min(this.w, this.h) + 20, this.w - s.fr * Math.min(this.w, this.h) - 20),
      y: clamp(s.fy * this.h, s.fr * Math.min(this.w, this.h) + 20, this.h - s.fr * Math.min(this.w, this.h) - 20),
      vx: 0,
      vy: 0,
      r: clamp(s.fr * Math.min(this.w, this.h), 34, 92),
      hue: s.hue,
      wob: { s: 0, v: 0, a: 0 },
      phase: Math.random() * PI2,
    }));

    this.emitHud();
  }

  private makeTank(
    id: string,
    name: string,
    isBot: boolean,
    hue: number,
    at: { x: number; y: number },
    skill: number,
  ): Tank {
    return {
      id,
      name,
      isBot,
      hue,
      x: at.x,
      y: at.y,
      vx: 0,
      vy: 0,
      aim: Math.random() * PI2,
      aimTarget: 0,
      recoil: 0,
      recoilV: 0,
      fireCd: 0.4,
      hp: BAL.HP,
      kills: 0,
      deaths: 0,
      shotsFired: 0,
      shotsHit: 0,
      damageDealt: 0,
      alive: true,
      respawnT: 0,
      invulnT: 1.4,
      flash: 0,
      wob: { s: 0, v: 0, a: 0 },
      phase: Math.random() * PI2,
      skill,
      strafeDir: Math.random() < 0.5 ? 1 : -1,
      strafeT: rand(0.8, 2),
      burstLeft: 3,
      restT: 0,
      moveX: 0,
      moveY: 0,
      shooting: false,
    };
  }

  setPaused(p: boolean) {
    this.paused = p;
    if (p) {
      this.keys.clear();
      this.mouse.down = false;
    }
  }

  toggleMute(): boolean {
    const m = this.audio.toggleMute();
    this.emitHud();
    return m;
  }

  /* ------------------------------------------------- цикл */

  private loop = (ts: number) => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.loop);
    const realDt = clamp((ts - this.lastTs) / 1000, 0.001, 0.05);
    this.lastTs = ts;
    this.t += realDt;

    if (!this.paused) {
      if (this.hitStop > 0) {
        this.hitStop -= realDt;
      } else {
        this.acc += realDt * this.timeScale;
        let n = 0;
        while (this.acc >= STEP && n < 5) {
          this.update(STEP);
          this.acc -= STEP;
          n++;
        }
      }
      this.shake = Math.max(0, this.shake - realDt * 34);
      this.playerFlash = Math.max(0, this.playerFlash - realDt * 1.7);
      if (this.timeScale < 1) this.timeScale = Math.min(1, this.timeScale + realDt * 1.3);
    }
    this.render();
  };

  private update(dt: number) {
    if (this.phase === 'match') {
      this.matchT += dt;
      const left = BAL.MATCH_TIME - this.matchT;
      if (left <= 0 && !this.suddenDeath) {
        const leader = this.getLeader();
        if (leader) this.scheduleEnd(leader, 'time', 0.4);
        else {
          this.suddenDeath = true;
          this.audio.count();
        }
      }
      if (this.pendingEnd) {
        this.pendingEnd.t -= dt;
        if (this.pendingEnd.t <= 0) {
          const { winner, reason } = this.pendingEnd;
          this.pendingEnd = null;
          this.endMatch(winner, reason);
        }
      }
    }

    const player = this.tanks[0];

    for (const t of this.tanks) {
      t.flash = Math.max(0, t.flash - dt * 3.2);
      const w = t.wob;
      w.v += (-w.s * 170 - w.v * 9) * dt;
      w.s = clamp(w.s + w.v * dt, -0.45, 0.45);
      t.recoilV += (-t.recoil * 240 - t.recoilV * 13) * dt;
      t.recoil = Math.max(0, t.recoil + t.recoilV * dt);

      if (!t.alive) {
        t.respawnT -= dt;
        if (t.respawnT <= 0) this.respawn(t);
        continue;
      }
      t.invulnT = Math.max(0, t.invulnT - dt);

      if (t.isBot) this.updateBot(t, dt);
      else this.readPlayerInput(t);

      if (t.moveX !== 0 || t.moveY !== 0) {
        const len = Math.hypot(t.moveX, t.moveY) || 1;
        t.vx += (t.moveX / len) * BAL.ACCEL * dt;
        t.vy += (t.moveY / len) * BAL.ACCEL * dt;
      }
      const damp = Math.exp(-3.1 * dt);
      t.vx *= damp;
      t.vy *= damp;
      const sp = Math.hypot(t.vx, t.vy);
      if (sp > BAL.MAX_SPEED) {
        t.vx = (t.vx / sp) * BAL.MAX_SPEED;
        t.vy = (t.vy / sp) * BAL.MAX_SPEED;
      }
      t.aim += angDiff(t.aim, t.aimTarget) * Math.min(1, 14 * dt);
      t.x += t.vx * dt;
      t.y += t.vy * dt;

      this.collideWalls(t);

      t.fireCd -= dt;
      if (t.shooting && t.fireCd <= 0) this.fire(t);
    }

    for (let i = 0; i < this.tanks.length; i++) {
      for (let j = i + 1; j < this.tanks.length; j++) {
        const a = this.tanks[i];
        const b = this.tanks[j];
        if (a.alive && b.alive) this.collideCircles(a, BAL.TANK_R, b, BAL.TANK_R, 1, 1);
      }
    }
    for (const t of this.tanks) {
      if (!t.alive) continue;
      for (const o of this.obstacles) this.collideCircles(t, BAL.TANK_R, o, o.r, 1, (o.r * o.r) / (BAL.TANK_R * BAL.TANK_R) * 0.35);
    }
    for (let i = 0; i < this.obstacles.length; i++) {
      for (let j = i + 1; j < this.obstacles.length; j++) {
        const a = this.obstacles[i];
        const b = this.obstacles[j];
        this.collideCircles(a, a.r, b, b.r, 0.6, 0.6);
      }
    }
    for (const o of this.obstacles) {
      o.vx *= Math.exp(-1.6 * dt);
      o.vy *= Math.exp(-1.6 * dt);
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      const wm = o.r + 14;
      if (o.x < wm) { o.x = wm; o.vx = Math.abs(o.vx) * 0.6; }
      if (o.x > this.w - wm) { o.x = this.w - wm; o.vx = -Math.abs(o.vx) * 0.6; }
      if (o.y < wm) { o.y = wm; o.vy = Math.abs(o.vy) * 0.6; }
      if (o.y > this.h - wm) { o.y = this.h - wm; o.vy = -Math.abs(o.vy) * 0.6; }
      const w = o.wob;
      w.v += (-w.s * 150 - w.v * 8) * dt;
      w.s = clamp(w.s + w.v * dt, -0.4, 0.4);
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.age += dt;
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 7) p.trail.shift();

      let dead = false;
      if (p.x < 14 + p.r || p.x > this.w - 14 - p.r || p.y < 14 + p.r || p.y > this.h - 14 - p.r) {
        this.popProjectile(p, 0.4);
        dead = true;
      }
      if (!dead) {
        for (const o of this.obstacles) {
          if (Math.hypot(p.x - o.x, p.y - o.y) < p.r + o.r * 0.92) {
            this.addWobble(o, Math.atan2(p.vy, p.vx), 0.18);
            o.vx += (p.vx / BAL.PROJ_SPEED) * 60;
            o.vy += (p.vy / BAL.PROJ_SPEED) * 60;
            this.popProjectile(p, 0.55);
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const t of this.tanks) {
          if (!t.alive || t.invulnT > 0) continue;
          if (t.id === p.owner && p.age < 0.15) continue;
          if (Math.hypot(p.x - t.x, p.y - t.y) < p.r + BAL.TANK_R * 0.92) {
            const owner = this.tanks.find((k) => k.id === p.owner);
            this.popProjectile(p, 0.8);
            if (owner) this.damage(t, BAL.PROJ_DMG, owner, p);
            dead = true;
            break;
          }
        }
      }
      if (!dead && p.life <= 0) {
        this.popProjectile(p, 0.15);
        dead = true;
      }
      if (dead) this.projectiles.splice(i, 1);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      if (pt.kind === 'drop') {
        pt.vx *= Math.exp(-2.1 * dt);
        pt.vy *= Math.exp(-2.1 * dt);
        pt.vy += 46 * dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
      }
    }

    if (player && player.alive && player.hp <= 30 && Math.random() < dt * 2) {
      this.audio.hit();
    }
    this.hudAcc += dt;
    if (this.hudAcc >= 0.1) {
      this.hudAcc = 0;
      this.emitHud();
    }
  }

  /* ------------------------------------------------- ввод и боты */

  private readPlayerInput(t: Tank) {
    const k = this.keys;
    t.moveX =
      (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    t.moveY =
      (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    t.aimTarget = Math.atan2(this.mouse.y - t.y, this.mouse.x - t.x);
    t.shooting = this.mouse.down || k.has('Space');
  }

  private updateBot(t: Tank, dt: number) {
    t.strafeT -= dt;
    if (t.strafeT <= 0) {
      t.strafeDir *= -1;
      t.strafeT = rand(1.1, 2.6);
    }
    t.restT = Math.max(0, t.restT - dt);

    let target: Tank | null = null;
    let best = Infinity;
    for (const o of this.tanks) {
      if (o === t || !o.alive) continue;
      const d = Math.hypot(o.x - t.x, o.y - t.y);
      if (d < best) {
        best = d;
        target = o;
      }
    }

    let mx = 0;
    let my = 0;
    if (target) {
      const dx = target.x - t.x;
      const dy = target.y - t.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const desired = 235 + t.skill * 70;
      const radial = dist - desired;
      const nx = dx / dist;
      const ny = dy / dist;
      mx = nx * clamp(radial / 90, -1, 1) + -ny * t.strafeDir * 0.8;
      my = ny * clamp(radial / 90, -1, 1) + nx * t.strafeDir * 0.8;

      const lead = (dist / BAL.PROJ_SPEED) * (0.5 + t.skill * 0.42);
      const ax = target.x + target.vx * lead - t.x;
      const ay = target.y + target.vy * lead - t.y;
      const err =
        Math.sin(this.t * 2.6 + t.phase) * (0.24 - t.skill * 0.18) + rand(-0.03, 0.03);
      t.aimTarget = Math.atan2(ay, ax) + err;

      const aimOk = Math.abs(angDiff(t.aim, t.aimTarget)) < 0.3;
      t.shooting = dist < 620 && aimOk && t.restT <= 0;
    } else {
      t.aimTarget = Math.atan2(this.h / 2 - t.y, this.w / 2 - t.x);
      t.shooting = false;
    }

    const margin = 120;
    if (t.x < margin) mx += (margin - t.x) / margin;
    if (t.x > this.w - margin) mx -= (t.x - (this.w - margin)) / margin;
    if (t.y < margin) my += (margin - t.y) / margin;
    if (t.y > this.h - margin) my -= (t.y - (this.h - margin)) / margin;
    for (const o of this.obstacles) {
      const dx = t.x - o.x;
      const dy = t.y - o.y;
      const d = Math.hypot(dx, dy);
      const safe = o.r + BAL.TANK_R + 42;
      if (d < safe && d > 0.01) {
        mx += (dx / d) * ((safe - d) / safe) * 1.4;
        my += (dy / d) * ((safe - d) / safe) * 1.4;
      }
    }
    t.moveX = mx;
    t.moveY = my;
  }

  /* ------------------------------------------------- физика */

  private addWobble(body: { wob: Wobble }, angle: number, strength: number) {
    body.wob.s = clamp(body.wob.s + strength, -0.45, 0.45);
    body.wob.a = angle;
    body.wob.v += strength * 7;
  }

  private collideWalls(t: Tank) {
    const m = BAL.TANK_R + 14;
    const rest = BAL.RESTITUTION;
    if (t.x < m) {
      t.x = m;
      if (t.vx < -40) this.addWobble(t, 0, clamp(-t.vx / 800, 0.05, 0.3));
      t.vx = Math.abs(t.vx) * rest;
    }
    if (t.x > this.w - m) {
      t.x = this.w - m;
      if (t.vx > 40) this.addWobble(t, 0, clamp(t.vx / 800, 0.05, 0.3));
      t.vx = -Math.abs(t.vx) * rest;
    }
    if (t.y < m) {
      t.y = m;
      if (t.vy < -40) this.addWobble(t, Math.PI / 2, clamp(-t.vy / 800, 0.05, 0.3));
      t.vy = Math.abs(t.vy) * rest;
    }
    if (t.y > this.h - m) {
      t.y = this.h - m;
      if (t.vy > 40) this.addWobble(t, Math.PI / 2, clamp(t.vy / 800, 0.05, 0.3));
      t.vy = -Math.abs(t.vy) * rest;
    }
  }

  private collideCircles(
    a: { x: number; y: number; vx: number; vy: number; wob: Wobble },
    ra: number,
    b: { x: number; y: number; vx: number; vy: number; wob: Wobble },
    rb: number,
    massA: number,
    massB: number,
  ) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    const min = ra + rb;
    if (dist >= min || dist < 0.001) return;
    const nx = dx / dist;
    const ny = dy / dist;
    const total = massA + massB;
    const push = min - dist;
    a.x -= nx * push * (massA / total);
    a.y -= ny * push * (massA / total);
    b.x += nx * push * (massB / total);
    b.y += ny * push * (massB / total);

    const rvx = b.vx - a.vx;
    const rvy = b.vy - a.vy;
    const vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      const e = BAL.RESTITUTION;
      const j = (-(1 + e) * vn) / (1 / massA + 1 / massB);
      a.vx -= (j * nx) / massA;
      a.vy -= (j * ny) / massA;
      b.vx += (j * nx) / massB;
      b.vy += (j * ny) / massB;
      const str = clamp(-vn / 700, 0.03, 0.28);
      const ang = Math.atan2(ny, nx);
      this.addWobble(a, ang, str);
      this.addWobble(b, ang, str);
    }
  }

  /* ------------------------------------------------- бой */

  private fire(t: Tank) {
    t.fireCd = t.isBot
      ? BAL.BOT_FIRE_CD * (1.3 - t.skill * 0.55) * rand(0.85, 1.25)
      : BAL.FIRE_CD;
    const spread = t.isBot ? rand(-0.06, 0.06) : rand(-0.035, 0.035);
    const a = t.aim + spread;
    const muzzleD = BAL.TURRET_R + BAL.BARREL_R * 2 + 12;
    const mx = t.x + Math.cos(t.aim) * muzzleD;
    const my = t.y + Math.sin(t.aim) * muzzleD;
    this.projectiles.push({
      id: this.nextProjId++,
      x: mx,
      y: my,
      vx: Math.cos(a) * BAL.PROJ_SPEED + t.vx * 0.35,
      vy: Math.sin(a) * BAL.PROJ_SPEED + t.vy * 0.35,
      r: BAL.PROJ_R,
      hue: t.hue,
      owner: t.id,
      life: BAL.PROJ_LIFE,
      age: 0,
      trail: [],
    });
    t.recoilV += 190;
    t.vx -= Math.cos(a) * 26;
    t.vy -= Math.sin(a) * 26;
    t.shotsFired++;
    this.particles.push({
      x: mx, y: my, vx: 0, vy: 0, r: 16, life: 0.22, maxLife: 0.22, hue: t.hue, kind: 'ring',
    });
    for (let i = 0; i < 3; i++) {
      const sa = a + rand(-0.6, 0.6);
      this.particles.push({
        x: mx, y: my,
        vx: Math.cos(sa) * rand(40, 130),
        vy: Math.sin(sa) * rand(40, 130),
        r: rand(1.5, 3.5), life: rand(0.25, 0.45), maxLife: 0.45, hue: t.hue, kind: 'drop',
      });
    }
    if (t.isBot) {
      t.burstLeft--;
      if (t.burstLeft <= 0) {
        t.burstLeft = 2 + Math.floor(t.skill * 3);
        t.restT = rand(0.45, 1.1);
      }
      const dToPlayer = Math.hypot(t.x - this.tanks[0].x, t.y - this.tanks[0].y);
      if (dToPlayer < 760) this.audio.shot();
    } else {
      this.audio.shot();
    }
  }

  private damage(victim: Tank, dmg: number, killer: Tank, p: Projectile) {
    victim.hp -= dmg;
    victim.flash = 1;
    const ang = Math.atan2(p.vy, p.vx);
    this.addWobble(victim, ang, 0.26);
    const sp = Math.hypot(p.vx, p.vy) || 1;
    victim.vx += (p.vx / sp) * BAL.KNOCKBACK;
    victim.vy += (p.vy / sp) * BAL.KNOCKBACK;
    killer.shotsHit++;
    killer.damageDealt += dmg;
    for (let i = 0; i < 6; i++) {
      const a = rand(0, PI2);
      this.particles.push({
        x: p.x, y: p.y,
        vx: Math.cos(a) * rand(60, 240),
        vy: Math.sin(a) * rand(60, 240),
        r: rand(2, 4.5), life: rand(0.3, 0.6), maxLife: 0.6, hue: victim.hue, kind: 'drop',
      });
    }
    const isPlayer = !victim.isBot || !killer.isBot;
    if (isPlayer) this.audio.hit();
    if (!victim.isBot) {
      this.playerFlash = 1;
      this.shake = Math.min(14, this.shake + 5);
    }
    if (victim.hp <= 0) this.killTank(victim, killer);
  }

  private killTank(victim: Tank, killer: Tank) {
    victim.hp = 0;
    victim.alive = false;
    victim.deaths++;
    victim.respawnT = BAL.RESPAWN;
    killer.kills++;

    this.spawnPop(victim.x, victim.y, BAL.TANK_R, victim.hue, 26);
    this.audio.kill();
    this.shake = Math.min(18, this.shake + (victim.isBot ? 8 : 15));
    this.hitStop = 0.055;
    if (!victim.isBot) this.timeScale = 0.3;

    const verb = KILL_VERBS[Math.floor(Math.random() * KILL_VERBS.length)];
    this.cb.onKill({
      id: Date.now() + Math.random(),
      killer: killer.name,
      victim: victim.name,
      killerHue: killer.hue,
      victimHue: victim.hue,
      verb,
      you: !killer.isBot || !victim.isBot,
    });

    if (this.phase !== 'match' || this.pendingEnd) return;
    if (this.suddenDeath || killer.kills >= BAL.FRAG_LIMIT) {
      this.scheduleEnd(killer, 'frags', 1.1);
    }
  }

  private spawnPop(x: number, y: number, r: number, hue: number, count: number) {
    this.audio.pop(clamp(r / 60, 0.2, 1));
    for (let i = 0; i < count; i++) {
      const a = rand(0, PI2);
      const sp = rand(70, 340);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        r: rand(2, 5.5), life: rand(0.4, 0.9), maxLife: 0.9, hue: hue + rand(-25, 25), kind: 'drop',
      });
    }
    this.particles.push({ x, y, vx: 0, vy: 0, r: r * 1.7, life: 0.4, maxLife: 0.4, hue, kind: 'ring' });
    this.particles.push({ x, y, vx: 0, vy: 0, r: r * 2.6, life: 0.55, maxLife: 0.55, hue: hue + 40, kind: 'ring' });
    for (let i = 0; i < 7; i++) {
      const a = rand(0, PI2);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * rand(20, 90),
        vy: Math.sin(a) * rand(20, 90),
        r: rand(1, 2.4), life: rand(0.3, 0.5), maxLife: 0.5, hue: 0, kind: 'spark',
      });
    }
  }

  private popProjectile(p: Projectile, size: number) {
    this.spawnPop(p.x, p.y, p.r + 4, p.hue, Math.round(6 + size * 8));
  }

  private respawn(t: Tank) {
    const m = 100;
    const spots = [
      { x: m, y: m },
      { x: this.w - m, y: m },
      { x: m, y: this.h - m },
      { x: this.w - m, y: this.h - m },
      { x: this.w / 2, y: m },
      { x: this.w / 2, y: this.h - m },
      { x: m, y: this.h / 2 },
      { x: this.w - m, y: this.h / 2 },
    ];
    let best = spots[0];
    let bestScore = -1;
    for (const s of spots) {
      let minD = Infinity;
      for (const o of this.tanks) {
        if (o === t || !o.alive) continue;
        minD = Math.min(minD, Math.hypot(o.x - s.x, o.y - s.y));
      }
      const score = minD + rand(0, 60);
      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    }
    t.x = clamp(best.x + rand(-30, 30), BAL.TANK_R + 16, this.w - BAL.TANK_R - 16);
    t.y = clamp(best.y + rand(-30, 30), BAL.TANK_R + 16, this.h - BAL.TANK_R - 16);
    for (const o of this.obstacles) {
      const d = Math.hypot(t.x - o.x, t.y - o.y);
      const min = o.r + BAL.TANK_R + 8;
      if (d < min && d > 0.01) {
        t.x = o.x + ((t.x - o.x) / d) * min;
        t.y = o.y + ((t.y - o.y) / d) * min;
      }
    }
    t.vx = 0;
    t.vy = 0;
    t.hp = BAL.HP;
    t.alive = true;
    t.invulnT = BAL.INVULN;
    t.flash = 0;
    this.particles.push({
      x: t.x, y: t.y, vx: 0, vy: 0, r: BAL.TANK_R * 2.4, life: 0.5, maxLife: 0.5, hue: t.hue, kind: 'ring',
    });
    if (!t.isBot) this.audio.respawn();
  }

  /* ------------------------------------------------- конец матча */

  private getLeader(): Tank | null {
    const sorted = [...this.tanks].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    if (sorted[0].kills > sorted[1].kills) return sorted[0];
    return null;
  }

  private scheduleEnd(winner: Tank, reason: 'frags' | 'time', delay: number) {
    if (this.pendingEnd) return;
    this.pendingEnd = { t: delay, winner, reason };
  }

  private endMatch(winner: Tank, reason: 'frags' | 'time') {
    if (this.phase === 'over') return;
    this.phase = 'over';
    const player = this.tanks[0];
    if (winner === player) this.audio.win();
    else this.audio.lose();
    const toHud = (t: Tank): HudPlayer => ({
      id: t.id,
      name: t.name,
      hue: t.hue,
      kills: t.kills,
      deaths: t.deaths,
      isPlayer: !t.isBot,
      alive: t.alive,
      hp: Math.max(0, t.hp),
    });
    const result: MatchResult = {
      winnerName: winner.name,
      winnerIsPlayer: !winner.isBot,
      winnerHue: winner.hue,
      reason,
      players: [...this.tanks].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths).map(toHud),
      stats: {
        kills: player.kills,
        deaths: player.deaths,
        accuracy: player.shotsFired > 0 ? player.shotsHit / player.shotsFired : 0,
        damage: Math.round(player.damageDealt),
      },
    };
    this.cb.onOver(result);
  }

  private emitHud() {
    const toHud = (t: Tank): HudPlayer => ({
      id: t.id,
      name: t.name,
      hue: t.hue,
      kills: t.kills,
      deaths: t.deaths,
      isPlayer: !t.isBot,
      alive: t.alive,
      hp: Math.max(0, t.hp),
    });
    const player = this.tanks[0];
    const snap: HudSnapshot = {
      timeLeft: Math.max(0, BAL.MATCH_TIME - this.matchT),
      suddenDeath: this.suddenDeath,
      players: [...this.tanks].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths).map(toHud),
      player: player ? toHud(player) : toHud(this.makeTank('x', '', false, 0, { x: 0, y: 0 }, 0)),
      fragLimit: BAL.FRAG_LIMIT,
      respawnT: player && !player.alive ? player.respawnT : 0,
      muted: this.audio.muted,
      running: this.phase === 'match',
    };
    this.cb.onHud(snap);
  }

  /* ------------------------------------------------- рендер */

  private render() {
    const { ctx, w, h } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    drawBackdrop(ctx, w, h, this.t, this.ambient, this.paused ? 0 : 0.016);

    const sx = (Math.random() - 0.5) * 2 * this.shake;
    const sy = (Math.random() - 0.5) * 2 * this.shake;
    ctx.save();
    ctx.translate(sx, sy);

    for (const o of this.obstacles) {
      const idle = Math.sin(this.t * 1.8 + o.phase) * 0.014;
      drawBubble(ctx, o.x, o.y, o.r, o.hue, {
        squash: clamp(o.wob.s + idle, -0.4, 0.4),
        sqAngle: o.wob.a,
        rimAlpha: 0.75,
        fillAlpha: 0.8,
        glow: 0.3,
      });
    }

    for (const t of this.tanks) {
      if (!t.alive) continue;
      const blink = t.invulnT > 0 ? 0.6 + 0.35 * Math.sin(this.t * 18) : 1;
      const idle = Math.sin(this.t * 2.6 + t.phase) * 0.02;
      const ca = Math.cos(t.aim);
      const sa = Math.sin(t.aim);

      for (let i = 1; i >= 0; i--) {
        const d = BAL.TURRET_R + 5 + BAL.BARREL_R + i * (BAL.BARREL_R * 2 + 1.5) + t.recoil * 0.9;
        drawBubble(ctx, t.x + ca * d, t.y + sa * d, BAL.BARREL_R - i * 1.3, t.hue + 45, {
          alpha: blink,
          glow: 0.7,
        });
      }

      drawBubble(ctx, t.x, t.y, BAL.TANK_R, t.hue, {
        squash: clamp(t.wob.s + idle, -0.42, 0.42),
        sqAngle: t.wob.a,
        alpha: blink,
        flash: t.flash * 0.8,
        glow: 0.55,
      });

      drawBubble(ctx, t.x + ca * 2, t.y + sa * 2, BAL.TURRET_R, t.hue + 22, {
        alpha: blink,
        rimAlpha: 0.9,
        glow: 0.35,
      });
      ctx.save();
      ctx.globalAlpha = blink;
      ctx.fillStyle = hsla(t.hue, 70, 22, 0.75);
      ctx.beginPath();
      ctx.arc(t.x + ca * 7, t.y + sa * 7, 6.4, 0, PI2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(t.x + ca * 5.4 - 1.6, t.y + sa * 5.4 - 1.8, 1.8, 0, PI2);
      ctx.fill();
      ctx.restore();

      const pct = clamp(t.hp / BAL.HP, 0, 1);
      ctx.save();
      ctx.globalAlpha = blink;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.arc(t.x, t.y, BAL.TANK_R + 10, 0, PI2);
      ctx.stroke();
      ctx.strokeStyle = hsla(8 + pct * 130, 92, 62, 0.95);
      ctx.beginPath();
      ctx.arc(t.x, t.y, BAL.TANK_R + 10, -Math.PI / 2, -Math.PI / 2 + Math.max(0.03, pct) * PI2);
      ctx.stroke();
      ctx.restore();

      if (t.invulnT > 0) {
        ctx.save();
        ctx.globalAlpha = 0.35 + 0.25 * Math.sin(this.t * 12);
        ctx.setLineDash([6, 9]);
        ctx.lineDashOffset = -this.t * 40;
        ctx.strokeStyle = hsla(t.hue, 95, 75, 1);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(t.x, t.y, BAL.TANK_R + 19, 0, PI2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.font = '800 13px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(3,10,22,0.9)';
      ctx.shadowBlur = 6;
      ctx.fillStyle = hsla(t.hue, 92, 80, 0.96 * blink);
      ctx.fillText(t.name, t.x, t.y - BAL.TANK_R - 24);
      ctx.restore();
    }

    for (const p of this.projectiles) {
      for (let i = 0; i < p.trail.length; i++) {
        const f = (i + 1) / p.trail.length;
        ctx.fillStyle = hsla(p.hue, 90, 72, f * 0.16);
        ctx.beginPath();
        ctx.arc(p.trail[i].x, p.trail[i].y, p.r * f * 0.85, 0, PI2);
        ctx.fill();
      }
      drawBubble(ctx, p.x, p.y, p.r, p.hue, { glow: 1, rimAlpha: 1 });
    }

    for (const pt of this.particles) {
      const f = pt.life / pt.maxLife;
      if (pt.kind === 'drop') {
        ctx.fillStyle = hsla(pt.hue, 92, 72, f * 0.9);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r * (0.35 + f * 0.65), 0, PI2);
        ctx.fill();
      } else if (pt.kind === 'ring') {
        ctx.strokeStyle = hsla(pt.hue, 95, 76, f * 0.8);
        ctx.lineWidth = 1.5 + f * 3;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, (1 - f) * pt.r + 4, 0, PI2);
        ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(255,255,255,${f})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r, 0, PI2);
        ctx.fill();
      }
    }

    ctx.restore();
    drawVignette(ctx, w, h);

    const player = this.tanks[0];
    const lowHp =
      this.phase === 'match' && player && player.alive && player.hp <= 30
        ? 0.14 + 0.1 * Math.sin(this.t * 7)
        : 0;
    const redA = Math.max(this.playerFlash * 0.32, lowHp);
    if (redA > 0.01) {
      const rg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.72);
      rg.addColorStop(0, 'rgba(255,64,96,0)');
      rg.addColorStop(1, `rgba(255,64,96,${redA})`);
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);
    }
  }
}
