import Phaser from 'phaser';
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

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export class ArenaScene extends Phaser.Scene {
  private tanks: Map<string, ClientTankState> = new Map();
  private projectiles: Map<number, ClientProjectile> = new Map();
  private clientObstacles: Map<number, ClientObstacle> = new Map();

  private inputManager!: InputManager;
  private particleSystem!: ParticleSystem;
  private hudManager!: HudManager;
  private gameRenderer!: GameRenderer;

  private isPlayerAlive: boolean = true;
  private shake: number = 0;
  private playerFlash: number = 0;
  private gameTime: number = 0;

  constructor() {
    super({ key: 'ArenaScene' });
  }

  public create(): void {
    this.inputManager = new InputManager();
    this.particleSystem = new ParticleSystem();
    this.hudManager = new HudManager();
    this.gameRenderer = new GameRenderer('game-container');

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
    networkManager.onGameOverCallback = (data: GameOverMessage) => this.handleGameOver(data);
  }

  public update(time: number, delta: number): void {
    const dt = Math.min(0.05, delta / 1000);
    this.gameTime += dt;

    const myId = networkManager.playerId;
    const myTank = myId ? this.tanks.get(myId) : null;

    // 1. Gather & Send Player Input
    if (myTank && !myTank.isDead) {
      const input = this.inputManager.getInput();
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

    // 5. Update Particle Simulation
    this.particleSystem.update(dt);

    // 6. Screen shake and flash decay
    this.shake = Math.max(0, this.shake - dt * 28);
    this.playerFlash = Math.max(0, this.playerFlash - dt * 2.0);

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
          this.shake = Math.min(18, this.shake + 12);
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
  }

  private handleBubblePop(event: BubblePopEvent): void {
    soundFx.playBubblePop(event.radius, event.isKill);

    if (event.isKill) {
      this.shake = Math.min(18, this.shake + 14);
    }

    this.particleSystem.emitPop(event.x, event.y, event.radius, event.hue, event.isKill);
  }

  private handleKillEvent(data: KillEventMessage): void {
    this.hudManager.addKillFeedItem(data);
  }

  private handleGameOver(data: GameOverMessage): void {
    const myId = networkManager.playerId;
    this.hudManager.showGameOverModal(data, myId);
  }

  public leaveGame(): void {
    if (this.inputManager) this.inputManager.reset();
    if (this.hudManager) this.hudManager.reset();
    if (this.particleSystem) this.particleSystem.clear();

    this.tanks.clear();
    this.projectiles.clear();
  }
}
