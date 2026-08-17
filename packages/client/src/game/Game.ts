import {
  BubblePopEvent,
  GAME_CONFIG,
  GameOverMessage,
  KillEventMessage,
  WorldStateMessage,
} from '@bubble-wars/shared';
import { networkManager } from '../net/NetworkManager.js';
import { soundFx } from '../audio/SoundFx.js';
import { ClientObstacle, ClientProjectile, ClientTankState } from '../types.js';
import { InputManager } from '../input/InputManager.js';
import { ParticleSystem } from '../graphics/ParticleSystem.js';
import { HudManager } from '../ui/HudManager.js';
import { GameRenderer } from '../graphics/GameRenderer.js';
import { CLIENT_CONFIG } from '../config.js';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export class Game {
  private tanks: Map<string, ClientTankState> = new Map();
  private projectiles: Map<number, ClientProjectile> = new Map();
  private clientObstacles: Map<number, ClientObstacle> = new Map();

  private inputManager: InputManager;
  private particleSystem: ParticleSystem;
  private hudManager: HudManager;
  private gameRenderer: GameRenderer;

  private unsubscribers: Array<() => void> = [];

  private isPlayerAlive: boolean = true;
  private isMatchOver: boolean = false;
  private shake: number = 0;
  private playerFlash: number = 0;
  private gameTime: number = 0;

  private animFrameId: number | null = null;
  private lastTime: number = 0;
  private isRunning: boolean = false;

  constructor(containerId: string = 'game-container') {
    this.inputManager = new InputManager();
    this.particleSystem = new ParticleSystem();
    this.hudManager = new HudManager();
    this.gameRenderer = new GameRenderer(containerId);

    this.setupNetwork();
  }

  private setupNetwork(): void {
    this.unsubscribers.push(
      networkManager.on('welcome', (data) => {
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
      }),
      networkManager.on('world_state', (data) => this.handleWorldState(data)),
      networkManager.on('bubble_pop', (event) => this.handleBubblePop(event)),
      networkManager.on('kill', (data) => this.handleKillEvent(data)),
      networkManager.on('game_over', (data) => this.handleGameOver(data))
    );
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();

    const loop = (currentTime: number) => {
      if (!this.isRunning) return;
      const delta = currentTime - this.lastTime;
      this.lastTime = currentTime;

      this.update(delta);
      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  public update(delta: number): void {
    const dt = Math.min(0.05, delta / 1000);
    this.gameTime += dt;

    const myId = networkManager.playerId;
    const myTank = myId ? this.tanks.get(myId) : null;

    // 1. Gather & Send Player Input (only when alive and match is active)
    if (myTank && !myTank.isDead && !this.isMatchOver) {
      const input = this.inputManager.getInput();
      networkManager.sendInput(input);
    }

    // 2. Interpolate Tanks
    this.tanks.forEach((tank) => {
      tank.x += (tank.targetX - tank.x) * CLIENT_CONFIG.INTERPOLATION.TANK;
      tank.y += (tank.targetY - tank.y) * CLIENT_CONFIG.INTERPOLATION.TANK;

      tank.flash = Math.max(0, tank.flash - dt * CLIENT_CONFIG.ANIMATION.FLASH_DECAY_TANK);
      tank.wobbleV +=
        (-tank.wobbleS * CLIENT_CONFIG.ANIMATION.WOBBLE_SPRING -
          tank.wobbleV * CLIENT_CONFIG.ANIMATION.WOBBLE_DAMPING) *
        dt;
      tank.wobbleS = clamp(
        tank.wobbleS + tank.wobbleV * dt,
        -CLIENT_CONFIG.ANIMATION.WOBBLE_MAX,
        CLIENT_CONFIG.ANIMATION.WOBBLE_MAX
      );
      if (tank.recoil > 0) {
        tank.recoil = Math.max(0, tank.recoil - GAME_CONFIG.TANK.RECOIL_RECOVERY_SPEED);
      }
    });

    // 3. Interpolate Migrating Obstacles
    this.clientObstacles.forEach((o) => {
      o.x += (o.targetX - o.x) * CLIENT_CONFIG.INTERPOLATION.OBSTACLE;
      o.y += (o.targetY - o.y) * CLIENT_CONFIG.INTERPOLATION.OBSTACLE;
    });

    // 4. Interpolate Projectiles & Trail History
    this.projectiles.forEach((proj) => {
      proj.x += (proj.targetX - proj.x) * CLIENT_CONFIG.INTERPOLATION.PROJECTILE;
      proj.y += (proj.targetY - proj.y) * CLIENT_CONFIG.INTERPOLATION.PROJECTILE;

      proj.trail.push({ x: proj.x, y: proj.y });
      if (proj.trail.length > CLIENT_CONFIG.ANIMATION.TRAIL_MAX_LENGTH) proj.trail.shift();
    });

    // 5. Update Particle Simulation
    this.particleSystem.update(dt);

    // 6. Screen shake and flash decay
    this.shake = Math.max(0, this.shake - dt * CLIENT_CONFIG.ANIMATION.SHAKE_DECAY);
    this.playerFlash = Math.max(0, this.playerFlash - dt * CLIENT_CONFIG.ANIMATION.FLASH_DECAY_PLAYER);

    // 7. Render Everything on Custom Canvas
    this.gameRenderer.render(
      this.gameTime,
      this.shake,
      this.playerFlash,
      myTank,
      this.tanks.values(),
      this.projectiles.values(),
      this.clientObstacles.values(),
      this.particleSystem
    );
  }

  private handleWorldState(data: WorldStateMessage): void {
    const receivedTankIds = new Set<string>();
    const receivedProjIds = new Set<number>();
    const myId = networkManager.playerId;

    // Process Obstacles
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
        this.hudManager.updatePlayerHUD(snap);

        if (snap.isDead && this.isPlayerAlive) {
          this.isPlayerAlive = false;
          this.playerFlash = 1.0;
          this.shake = Math.min(CLIENT_CONFIG.SHAKE.MAX, this.shake + CLIENT_CONFIG.SHAKE.HIT);
          this.hudManager.showDeathModal(snap.score);
        } else if (!snap.isDead && !this.isPlayerAlive) {
          this.isPlayerAlive = true;
          this.hudManager.hideDeathModal();
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

    // Update HUD frag limit, leaderboard and ping
    if (data.fragLimit) {
      this.hudManager.updateFragLimit(data.fragLimit);
    }
    this.hudManager.updateLeaderboard(data.leaderboard, myId);
    this.hudManager.updatePing(networkManager.latency);

    // If new match has begun, automatically dismiss game over modal
    if (this.isMatchOver && data.isMatchOver === false) {
      this.isMatchOver = false;
      this.hudManager.hideGameOverModal();
    }
  }

  private handleBubblePop(event: BubblePopEvent): void {
    soundFx.playBubblePop(event.radius, event.isKill);

    if (event.isKill) {
      this.shake = Math.min(CLIENT_CONFIG.SHAKE.MAX, this.shake + CLIENT_CONFIG.SHAKE.KILL_POP);
    }

    this.particleSystem.emitPop(event.x, event.y, event.radius, event.hue, event.isKill);
  }

  private handleKillEvent(data: KillEventMessage): void {
    this.hudManager.addKillFeedItem(data);
  }

  private handleGameOver(data: GameOverMessage): void {
    const myId = networkManager.playerId;
    this.isMatchOver = true;
    this.hudManager.hideDeathModal();
    this.hudManager.showGameOverModal(data, myId);
  }

  public leaveGame(): void {
    this.isMatchOver = false;
    if (this.inputManager) this.inputManager.reset();
    if (this.hudManager) this.hudManager.reset();
    if (this.particleSystem) this.particleSystem.clear();

    this.tanks.clear();
    this.projectiles.clear();
  }

  public destroy(): void {
    this.stop();
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];
  }
}
