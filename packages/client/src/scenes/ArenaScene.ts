import Phaser from 'phaser';
import {
  BubblePopEvent,
  GAME_CONFIG,
  KillEventMessage,
  LeaderboardEntry,
  ObstacleSnapshot,
  PlayerInput,
  ProjectileSnapshot,
  TankColor,
  TankSnapshot,
  WorldStateMessage,
} from '@bubble-wars/shared';
import { networkManager } from '../net/NetworkManager.js';
import { soundFx } from '../audio/SoundFx.js';
import {
  AmbientBubble,
  createAmbient,
  drawBackdrop,
  drawBubble,
  drawVignette,
  hsla,
} from '../graphics/render.js';

interface ClientTankState {
  id: string;
  name: string;
  color: TankColor;
  hue: number;
  isBot: boolean;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  aimAngle: number;
  hp: number;
  maxHp: number;
  isDead: boolean;
  score: number;
  kills: number;
  deaths: number;
  recoil: number;
  invulnT: number;
  flash: number;
  wobbleS: number;
  wobbleA: number;
  wobbleV: number;
}

interface ClientProjectile {
  id: number;
  ownerId: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  r: number;
  hue: number;
  color: TankColor;
  trail: Array<{ x: number; y: number }>;
}

interface ClientObstacle {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  r: number;
  hue: number;
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

const PI2 = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export class ArenaScene extends Phaser.Scene {
  private tanks: Map<string, ClientTankState> = new Map();
  private projectiles: Map<number, ClientProjectile> = new Map();
  private clientObstacles: Map<number, ClientObstacle> = new Map();
  private particles: Particle[] = [];
  private ambient: AmbientBubble[] = [];

  private keys = new Set<string>();
  private mouse = { x: 400, y: 300, down: false };
  private inputSeq: number = 0;
  private isPlayerAlive: boolean = true;
  private lastShootTime: number = 0;

  private shake: number = 0;
  private playerFlash: number = 0;
  private gameTime: number = 0;

  private customCanvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;

  constructor() {
    super({ key: 'ArenaScene' });
  }

  public create(): void {
    const { width, height } = GAME_CONFIG.ARENA;

    // Create full screen high performance 2D Canvas overlay for pristine iridescent rendering
    this.customCanvas = document.createElement('canvas');
    this.customCanvas.id = 'bubble-canvas';
    this.customCanvas.style.position = 'absolute';
    this.customCanvas.style.top = '0';
    this.customCanvas.style.left = '0';
    this.customCanvas.style.width = '100vw';
    this.customCanvas.style.height = '100vh';
    this.customCanvas.style.zIndex = '5';
    this.customCanvas.style.pointerEvents = 'none';

    document.getElementById('game-container')?.appendChild(this.customCanvas);
    this.ctx = this.customCanvas.getContext('2d')!;

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    this.ambient = createAmbient(width, height);

    // Setup User Inputs
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouse.down = true;
    });
    window.addEventListener('mouseup', () => {
      this.mouse.down = false;
    });

    // Setup Network Listeners
    networkManager.onWelcomeCallback = (data) => {
      if (data.obstacles) {
        for (const o of data.obstacles) {
          this.clientObstacles.set(o.id, {
            id: o.id,
            x: o.x,
            y: o.y,
            targetX: o.x,
            targetY: o.y,
            r: o.r,
            hue: o.hue,
          });
        }
      }
    };
    networkManager.onWorldStateCallback = (data) => this.handleWorldState(data);
    networkManager.onBubblePopCallback = (event) => this.handleBubblePop(event);
    networkManager.onKillCallback = (data) => this.handleKillEvent(data);
  }

  private resizeCanvas(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.customCanvas.width = Math.floor(window.innerWidth * dpr);
    this.customCanvas.height = Math.floor(window.innerHeight * dpr);
  }

  public update(time: number, delta: number): void {
    const dt = Math.min(0.05, delta / 1000);
    this.gameTime += dt;

    const myId = networkManager.playerId;
    const myTank = myId ? this.tanks.get(myId) : null;

    // 1. Gather & Send Player Input
    if (myTank && !myTank.isDead) {
      const up = this.keys.has('KeyW') || this.keys.has('ArrowUp');
      const down = this.keys.has('KeyS') || this.keys.has('ArrowDown');
      const left = this.keys.has('KeyA') || this.keys.has('ArrowLeft');
      const right = this.keys.has('KeyD') || this.keys.has('ArrowRight');

      // Calculate aim angle from player screen position to mouse
      const screenCenterX = window.innerWidth / 2;
      const screenCenterY = window.innerHeight / 2;
      const aimAngle = Math.atan2(this.mouse.y - screenCenterY, this.mouse.x - screenCenterX);

      const shooting = this.mouse.down || this.keys.has('Space');

      if (shooting && Date.now() - this.lastShootTime >= GAME_CONFIG.PROJECTILE.COOLDOWN_MS) {
        soundFx.playShoot();
        this.lastShootTime = Date.now();
      }

      const input: PlayerInput = {
        up: !!up,
        down: !!down,
        left: !!left,
        right: !!right,
        aimAngle,
        shooting: !!shooting,
        seq: ++this.inputSeq,
      };

      networkManager.sendInput(input);
    }

    // 2. Interpolate Tanks
    this.tanks.forEach((tank) => {
      tank.x += (tank.targetX - tank.x) * 0.45;
      tank.y += (tank.targetY - tank.y) * 0.45;

      tank.flash = Math.max(0, tank.flash - dt * 3.2);
      tank.wobbleV += (-tank.wobbleS * 170 - tank.wobbleV * 9) * dt;
      tank.wobbleS = clamp(tank.wobbleS + tank.wobbleV * dt, -0.45, 0.45);
      if (tank.recoil > 0) {
        tank.recoil = Math.max(0, tank.recoil - GAME_CONFIG.TANK.RECOIL_RECOVERY_SPEED);
      }
    });

    // 3. Interpolate Migrating Obstacles
    this.clientObstacles.forEach((o) => {
      o.x += (o.targetX - o.x) * 0.4;
      o.y += (o.targetY - o.y) * 0.4;
    });

    // 4. Interpolate Projectiles & Trail History
    this.projectiles.forEach((proj) => {
      proj.x += (proj.targetX - proj.x) * 0.6;
      proj.y += (proj.targetY - proj.y) * 0.6;

      proj.trail.push({ x: proj.x, y: proj.y });
      if (proj.trail.length > 5) proj.trail.shift();
    });

    // 5. Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.exp(-2.5 * dt);
      p.vy *= Math.exp(-2.5 * dt);
    }

    // 6. Screen shake and flash decay
    this.shake = Math.max(0, this.shake - dt * 28);
    this.playerFlash = Math.max(0, this.playerFlash - dt * 2.0);

    // 7. Execute Pristine Custom Canvas Render
    this.renderCustomCanvas(myTank);
  }

  private renderCustomCanvas(myTank: ClientTankState | null | undefined): void {
    if (!this.ctx) return;
    const { ctx } = this;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 1. Draw dynamic underwater backdrop with floating ambient bubbles
    drawBackdrop(ctx, viewW, viewH, this.gameTime, this.ambient, 0.016);

    // 2. Camera Transform centered on Player Tank
    const camX = myTank ? myTank.x : GAME_CONFIG.ARENA.width / 2;
    const camY = myTank ? myTank.y : GAME_CONFIG.ARENA.height / 2;

    const sx = (Math.random() - 0.5) * 2 * this.shake;
    const sy = (Math.random() - 0.5) * 2 * this.shake;

    ctx.save();
    ctx.translate(viewW / 2 + sx, viewH / 2 + sy);
    ctx.translate(-camX, -camY);

    // 3. Draw Arena Boundary Walls
    const { width: aW, height: aH } = GAME_CONFIG.ARENA;
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
    ctx.lineWidth = 14;
    ctx.strokeRect(0, 0, aW, aH);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.75)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, aW, aH);
    ctx.restore();

    // 4. Draw Obstacles (Giant pulsing iridescent bubbles smoothly migrating)
    for (const o of this.clientObstacles.values()) {
      const idle = Math.sin(this.gameTime * 1.8 + o.id) * 0.02;
      drawBubble(ctx, o.x, o.y, o.r, o.hue, {
        squash: idle,
        rimAlpha: 0.85,
        fillAlpha: 0.8,
        glow: 0.45,
      });
    }

    // 5. Draw Tanks (Body, Turret, Double Barrel with recoil, Health Arc, Invuln Ring, Name)
    for (const t of this.tanks.values()) {
      if (t.isDead) continue;

      const blink = t.invulnT > 0 ? 0.55 + 0.45 * Math.sin(this.gameTime * 18) : 1;
      const idle = Math.sin(this.gameTime * 2.6 + t.x) * 0.02;
      const ca = Math.cos(t.aimAngle);
      const sa = Math.sin(t.aimAngle);

      // Barrel connector bubbles
      for (let i = 1; i >= 0; i--) {
        const d =
          GAME_CONFIG.TANK.TURRET_RADIUS +
          5 +
          GAME_CONFIG.TANK.BARREL_BUBBLE_1_RADIUS +
          i * (GAME_CONFIG.TANK.BARREL_BUBBLE_1_RADIUS * 2 + 1) -
          t.recoil * 8;
        drawBubble(
          ctx,
          t.x + ca * d,
          t.y + sa * d,
          GAME_CONFIG.TANK.BARREL_BUBBLE_1_RADIUS - i * 1.5,
          t.hue + 45,
          {
            alpha: blink,
            glow: 0.6,
          }
        );
      }

      // Main Tank Body
      drawBubble(ctx, t.x, t.y, GAME_CONFIG.TANK.BODY_RADIUS, t.hue, {
        squash: clamp(t.wobbleS + idle, -0.42, 0.42),
        sqAngle: t.wobbleA,
        alpha: blink,
        flash: t.flash * 0.85,
        glow: 0.55,
      });

      // Turret Bubble
      drawBubble(ctx, t.x + ca * 2, t.y + sa * 2, GAME_CONFIG.TANK.TURRET_RADIUS, t.hue + 22, {
        alpha: blink,
        rimAlpha: 0.9,
        glow: 0.35,
      });

      // Turret Center Gloss
      ctx.save();
      ctx.globalAlpha = blink;
      ctx.fillStyle = hsla(t.hue, 70, 22, 0.75);
      ctx.beginPath();
      ctx.arc(t.x + ca * 6, t.y + sa * 6, 5.5, 0, PI2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(t.x + ca * 4.8 - 1.5, t.y + sa * 4.8 - 1.5, 1.6, 0, PI2);
      ctx.fill();
      ctx.restore();

      // Circular Health Arc
      const pct = clamp(t.hp / t.maxHp, 0, 1);
      ctx.save();
      ctx.globalAlpha = blink;
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.arc(t.x, t.y, GAME_CONFIG.TANK.BODY_RADIUS + 10, 0, PI2);
      ctx.stroke();
      ctx.strokeStyle = hsla(8 + pct * 130, 92, 62, 0.95);
      ctx.beginPath();
      ctx.arc(
        t.x,
        t.y,
        GAME_CONFIG.TANK.BODY_RADIUS + 10,
        -Math.PI / 2,
        -Math.PI / 2 + Math.max(0.03, pct) * PI2
      );
      ctx.stroke();
      ctx.restore();

      // Invulnerability Ring
      if (t.invulnT > 0) {
        ctx.save();
        ctx.globalAlpha = 0.4 + 0.3 * Math.sin(this.gameTime * 14);
        ctx.setLineDash([6, 8]);
        ctx.lineDashOffset = -this.gameTime * 40;
        ctx.strokeStyle = hsla(t.hue, 95, 75, 1);
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(t.x, t.y, GAME_CONFIG.TANK.BODY_RADIUS + 18, 0, PI2);
        ctx.stroke();
        ctx.restore();
      }

      // Name Text
      ctx.save();
      ctx.font = '800 13px Outfit, Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(3,10,22,0.9)';
      ctx.shadowBlur = 6;
      ctx.fillStyle = hsla(t.hue, 92, 80, 0.96 * blink);
      ctx.fillText(t.name, t.x, t.y - GAME_CONFIG.TANK.BODY_RADIUS - 22);
      ctx.restore();
    }

    // 6. Draw Projectiles with Trails
    for (const p of this.projectiles.values()) {
      for (let i = 0; i < p.trail.length; i++) {
        const f = (i + 1) / p.trail.length;
        ctx.fillStyle = hsla(p.hue, 90, 72, f * 0.18);
        ctx.beginPath();
        ctx.arc(p.trail[i].x, p.trail[i].y, p.r * f * 0.85, 0, PI2);
        ctx.fill();
      }
      drawBubble(ctx, p.x, p.y, p.r, p.hue, { glow: 1, rimAlpha: 1 });
    }

    // 7. Draw Particles (Rings, Droplets, Sparks)
    for (const pt of this.particles) {
      const f = pt.life / pt.maxLife;
      if (pt.kind === 'drop') {
        ctx.fillStyle = hsla(pt.hue, 92, 72, f * 0.9);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r * (0.35 + f * 0.65), 0, PI2);
        ctx.fill();
      } else if (pt.kind === 'ring') {
        ctx.strokeStyle = hsla(pt.hue, 95, 76, f * 0.85);
        ctx.lineWidth = 1.5 + f * 3.5;
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

    // 8. Draw Vignette & Low HP Red Alert Pulse
    drawVignette(ctx, viewW, viewH);

    const lowHp = myTank && !myTank.isDead && myTank.hp <= 30 ? 0.16 + 0.12 * Math.sin(this.gameTime * 7) : 0;
    const redA = Math.max(this.playerFlash * 0.35, lowHp);
    if (redA > 0.01) {
      const rg = ctx.createRadialGradient(
        viewW / 2,
        viewH / 2,
        Math.min(viewW, viewH) * 0.3,
        viewW / 2,
        viewH / 2,
        Math.max(viewW, viewH) * 0.72
      );
      rg.addColorStop(0, 'rgba(255,64,96,0)');
      rg.addColorStop(1, `rgba(255,64,96,${redA})`);
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, viewW, viewH);
    }
  }

  private handleWorldState(data: WorldStateMessage): void {
    const receivedTankIds = new Set<string>();
    const receivedProjIds = new Set<number>();
    const myId = networkManager.playerId;

    if (data.obstacles && data.obstacles.length > 0) {
      for (const o of data.obstacles) {
        let co = this.clientObstacles.get(o.id);
        if (!co) {
          co = {
            id: o.id,
            x: o.x,
            y: o.y,
            targetX: o.x,
            targetY: o.y,
            r: o.r,
            hue: o.hue,
          };
          this.clientObstacles.set(o.id, co);
        }
        co.targetX = o.x;
        co.targetY = o.y;
        co.r = o.r;
        co.hue = o.hue;
      }
    }

    // Process Tanks
    for (const snap of data.tanks) {
      receivedTankIds.add(snap.id);
      let t = this.tanks.get(snap.id);

      if (!t) {
        t = {
          id: snap.id,
          name: snap.name,
          color: snap.color,
          hue: snap.hue,
          isBot: snap.isBot,
          x: snap.x,
          y: snap.y,
          targetX: snap.x,
          targetY: snap.y,
          vx: snap.vx,
          vy: snap.vy,
          aimAngle: snap.aimAngle,
          hp: snap.hp,
          maxHp: snap.maxHp,
          isDead: snap.isDead,
          score: snap.score,
          kills: snap.kills,
          deaths: snap.deaths,
          recoil: snap.recoil,
          invulnT: snap.invulnT,
          flash: snap.flash,
          wobbleS: snap.wobbleS,
          wobbleA: snap.wobbleA,
          wobbleV: 0,
        };
        this.tanks.set(snap.id, t);
      }

      t.targetX = snap.x;
      t.targetY = snap.y;
      t.vx = snap.vx;
      t.vy = snap.vy;
      t.aimAngle = snap.aimAngle;
      t.hp = snap.hp;
      t.maxHp = snap.maxHp;
      t.score = snap.score;
      t.kills = snap.kills;
      t.deaths = snap.deaths;
      t.recoil = snap.recoil;
      t.invulnT = snap.invulnT;
      t.flash = snap.flash;
      t.wobbleS = snap.wobbleS;
      t.wobbleA = snap.wobbleA;
      t.isDead = snap.isDead;

      // Update Local Player UI
      if (snap.id === myId) {
        this.updatePlayerHUD(snap);

        if (snap.isDead && this.isPlayerAlive) {
          this.isPlayerAlive = false;
          this.playerFlash = 1.0;
          this.shake = Math.min(18, this.shake + 12);
          this.showDeathModal(snap.score);
        } else if (!snap.isDead && !this.isPlayerAlive) {
          this.isPlayerAlive = true;
          this.hideDeathModal();
        }
      }
    }

    // Clean up deleted tanks
    for (const id of this.tanks.keys()) {
      if (!receivedTankIds.has(id)) {
        this.tanks.delete(id);
      }
    }

    // Process Projectiles
    for (const pSnap of data.projectiles) {
      receivedProjIds.add(pSnap.id);
      let p = this.projectiles.get(pSnap.id);

      if (!p) {
        p = {
          id: pSnap.id,
          ownerId: pSnap.ownerId,
          x: pSnap.x,
          y: pSnap.y,
          targetX: pSnap.x,
          targetY: pSnap.y,
          vx: pSnap.vx,
          vy: pSnap.vy,
          r: pSnap.r,
          hue: pSnap.hue,
          color: pSnap.color,
          trail: [],
        };
        this.projectiles.set(pSnap.id, p);
      }

      p.targetX = pSnap.x;
      p.targetY = pSnap.y;
      p.vx = pSnap.vx;
      p.vy = pSnap.vy;
    }

    // Clean up deleted projectiles
    for (const id of this.projectiles.keys()) {
      if (!receivedProjIds.has(id)) {
        this.projectiles.delete(id);
      }
    }

    // Update Leaderboard & Ping in DOM
    this.updateLeaderboardDOM(data.leaderboard);
    const pingEl = document.getElementById('hud-ping');
    if (pingEl) pingEl.textContent = `${networkManager.latency} ms`;
  }

  private handleBubblePop(event: BubblePopEvent): void {
    soundFx.playBubblePop(event.radius, event.isKill);

    if (event.isKill) {
      this.shake = Math.min(18, this.shake + 14);
    }

    // Particle Explosion
    const count = event.isKill ? 28 : 10;
    const r = event.radius;
    const hue = event.hue;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * PI2;
      const sp = 70 + Math.random() * 260;
      this.particles.push({
        x: event.x,
        y: event.y,
        vx: Math.cos(angle) * sp,
        vy: Math.sin(angle) * sp,
        r: 2 + Math.random() * 3.5,
        life: 0.4 + Math.random() * 0.5,
        maxLife: 0.9,
        hue: hue + (Math.random() * 40 - 20),
        kind: 'drop',
      });
    }

    this.particles.push({
      x: event.x,
      y: event.y,
      vx: 0,
      vy: 0,
      r: r * 1.8,
      life: 0.4,
      maxLife: 0.4,
      hue,
      kind: 'ring',
    });

    if (event.isKill) {
      this.particles.push({
        x: event.x,
        y: event.y,
        vx: 0,
        vy: 0,
        r: r * 2.8,
        life: 0.55,
        maxLife: 0.55,
        hue: hue + 40,
        kind: 'ring',
      });

      for (let i = 0; i < 7; i++) {
        const a = Math.random() * PI2;
        this.particles.push({
          x: event.x,
          y: event.y,
          vx: Math.cos(a) * (20 + Math.random() * 70),
          vy: Math.sin(a) * (20 + Math.random() * 70),
          r: 1 + Math.random() * 1.5,
          life: 0.3 + Math.random() * 0.2,
          maxLife: 0.5,
          hue: 0,
          kind: 'spark',
        });
      }
    }
  }

  private handleKillEvent(data: KillEventMessage): void {
    const feed = document.getElementById('kill-feed');
    if (!feed) return;

    const item = document.createElement('div');
    item.className = 'feed-item panel-soft';
    item.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      font-size: 12px;
      font-weight: 700;
    `;
    item.innerHTML = `<span style="color: ${hsla(data.killerHue, 90, 72, 1)}">${data.killerName}</span> <span style="color: rgba(154, 220, 240, 0.6); font-weight: 600;">${data.verb || 'лопает'}</span> <span style="color: ${hsla(data.victimHue, 90, 72, 1)}">${data.victimName}</span> 💥`;

    feed.appendChild(item);
    setTimeout(() => {
      if (item.parentNode) item.parentNode.removeChild(item);
    }, 4000);
  }

  private updatePlayerHUD(snap: TankSnapshot): void {
    const hpFill = document.getElementById('hud-health-fill');
    const hpText = document.getElementById('hud-health-text');
    const scoreText = document.getElementById('hud-score');
    const killsText = document.getElementById('hud-kills');

    const pct = Math.max(0, Math.round((snap.hp / snap.maxHp) * 100));

    if (hpFill) {
      hpFill.style.width = `${pct}%`;
      if (pct <= 30) {
        hpFill.classList.add('low');
      } else {
        hpFill.classList.remove('low');
      }
    }

    if (hpText) hpText.innerHTML = `${Math.round(snap.hp)}<span style="color: rgba(154, 220, 240, 0.5);">/${snap.maxHp}</span>`;
    if (scoreText) scoreText.textContent = `${snap.score}`;
    if (killsText) killsText.textContent = `${snap.kills}`;
  }

  private updateLeaderboardDOM(leaderboard: LeaderboardEntry[]): void {
    const container = document.getElementById('leaderboard-container');
    if (!container) return;

    const myId = networkManager.playerId;
    container.innerHTML = '';

    leaderboard.forEach((entry) => {
      const isPlayer = entry.id === myId;
      const card = document.createElement('div');
      card.className = isPlayer ? 'panel' : 'panel-soft';
      card.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        border-radius: 999px;
        padding: 4px 12px;
        ${isPlayer ? 'border: 1px solid rgba(53, 224, 255, 0.6);' : ''}
      `;

      card.innerHTML = `
        <span style="
          display: inline-block;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: radial-gradient(circle at 32% 30%, rgba(255,255,255,0.9), ${hsla(entry.hue, 90, 62, 1)} 60%);
          box-shadow: 0 0 8px ${hsla(entry.hue, 95, 65, 0.8)};
        "></span>
        <span style="max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 800; color: ${isPlayer ? '#fff' : 'var(--color-foam)'};">
          ${entry.name}
        </span>
        <span style="font-family: var(--font-disp); font-size: 14px; font-weight: 700; color: #fff;">${entry.kills}</span>
        <span style="font-size: 10px; font-weight: 700; color: rgba(154, 220, 240, 0.5);">/${entry.deaths}</span>
      `;
      container.appendChild(card);
    });
  }

  private showDeathModal(score: number): void {
    const modal = document.getElementById('death-modal');
    const scoreEl = document.getElementById('death-final-score');
    if (scoreEl) scoreEl.textContent = `${score}`;
    if (modal) modal.classList.remove('hidden');
  }

  private hideDeathModal(): void {
    const modal = document.getElementById('death-modal');
    if (modal) modal.classList.add('hidden');
  }
}
