import Matter from 'matter-js';
import { WebSocket } from 'ws';
import {
  BubblePopEvent,
  COLOR_TO_HUE,
  GAME_CONFIG,
  KILL_VERBS,
  LeaderboardEntry,
  PlayerInput,
  ServerMessage,
  TankColor,
} from '@bubble-wars/shared';
import { PhysicsWorld } from './PhysicsWorld.js';
import { ServerTank } from './ServerTank.js';
import { ServerProjectile } from './Projectile.js';
import { BotPlayer } from './BotPlayer.js';

interface ConnectedPlayer {
  id: string;
  ws: WebSocket;
  tank: ServerTank;
  input: PlayerInput;
}

export class GameRoom {
  public physics: PhysicsWorld;
  public botCount: number = GAME_CONFIG.BOT.SPAWN_COUNT;
  public fragLimit: number = 10;
  public isMatchOver: boolean = false;
  public matchOverTime: number = 0;
  private players: Map<string, ConnectedPlayer> = new Map();
  private bots: BotPlayer[] = [];
  private projectiles: ServerProjectile[] = [];
  private tickCount: number = 0;
  private intervalId: NodeJS.Timeout | null = null;
  private pendingPopEvents: BubblePopEvent[] = [];
  private colorIndex: number = 0;
  private availableColors: TankColor[] = ['cyan', 'coral', 'lime', 'violet', 'amber'];

  constructor() {
    this.physics = new PhysicsWorld();
    this.setupCollisionHandlers();
    this.spawnInitialBots();
    this.startLoop();
  }

  private setupCollisionHandlers(): void {
    Matter.Events.on(this.physics.engine, 'collisionStart', (event) => {
      for (const pair of event.pairs) {
        const { bodyA, bodyB } = pair;

        let projectileBody: Matter.Body | null = null;
        let otherBody: Matter.Body | null = null;

        if (bodyA.label === 'projectile') {
          projectileBody = bodyA;
          otherBody = bodyB;
        } else if (bodyB.label === 'projectile') {
          projectileBody = bodyB;
          otherBody = bodyA;
        }

        // Projectile vs Projectile collision (destroy each other on impact!)
        if (bodyA.label === 'projectile' && bodyB.label === 'projectile') {
          const projA: ServerProjectile = (bodyA as any).projectileInstance;
          const projB: ServerProjectile = (bodyB as any).projectileInstance;
          if (projA && projB && !projA.isDestroyed && !projB.isDestroyed) {
            projA.isDestroyed = true;
            projB.isDestroyed = true;

            const midX = (bodyA.position.x + bodyB.position.x) / 2;
            const midY = (bodyA.position.y + bodyB.position.y) / 2;

            this.pendingPopEvents.push({
              id: `${Date.now()}_clash_${projA.id}`,
              x: midX,
              y: midY,
              radius: projA.radius * 1.8,
              hue: projA.hue,
              color: projA.color,
              isKill: false,
            });
            this.pendingPopEvents.push({
              id: `${Date.now()}_clash_${projB.id}`,
              x: midX,
              y: midY,
              radius: projB.radius * 1.8,
              hue: projB.hue,
              color: projB.color,
              isKill: false,
            });
          }
          continue;
        }

        // Projectile collisions with Tank / Obstacle / Wall
        if (projectileBody && otherBody) {
          const projectile: ServerProjectile = (projectileBody as any).projectileInstance;
          if (!projectile || projectile.isDestroyed) continue;

          if (otherBody.label === 'tank') {
            const tank: ServerTank = (otherBody as any).tankInstance;
            if (tank && tank.id !== projectile.ownerId && !tank.isDead) {
              projectile.isDestroyed = true;
              const killed = tank.takeDamage(GAME_CONFIG.PROJECTILE.DAMAGE);

              // Small pop effect for hit
              this.pendingPopEvents.push({
                id: `${Date.now()}_${Math.random()}`,
                x: projectileBody.position.x,
                y: projectileBody.position.y,
                radius: projectile.radius * 1.6,
                hue: projectile.hue,
                color: projectile.color,
                isKill: false,
              });

              if (killed) {
                const killer = this.findTankById(projectile.ownerId);
                if (killer) {
                  killer.score += 100;
                  killer.kills += 1;

                  const verb = KILL_VERBS[Math.floor(Math.random() * KILL_VERBS.length)];
                  this.broadcast({
                    type: 'kill',
                    killerName: killer.name,
                    victimName: tank.name,
                    killerColor: killer.color,
                    victimColor: tank.color,
                    killerHue: killer.hue,
                    victimHue: tank.hue,
                    verb,
                  });

                  if (!this.isMatchOver && killer.kills >= this.fragLimit) {
                    this.triggerGameOver(killer);
                  }
                }

                // Big pop explosion on tank death
                this.pendingPopEvents.push({
                  id: `${Date.now()}_kill_${tank.id}`,
                  x: tank.body.position.x,
                  y: tank.body.position.y,
                  radius: GAME_CONFIG.TANK.BODY_RADIUS * 2.4,
                  hue: tank.hue,
                  color: tank.color,
                  isKill: true,
                });
              }
            }
          } else if (otherBody.label === 'obstacle') {
            // Push obstacle on bullet impact and pop bullet
            projectile.isDestroyed = true;
            Matter.Body.applyForce(otherBody, projectileBody.position, {
              x: projectileBody.velocity.x * 0.0006,
              y: projectileBody.velocity.y * 0.0006,
            });
            this.pendingPopEvents.push({
              id: `${Date.now()}_${Math.random()}`,
              x: projectileBody.position.x,
              y: projectileBody.position.y,
              radius: projectile.radius * 1.5,
              hue: projectile.hue,
              color: projectile.color,
              isKill: false,
            });
          } else if (otherBody.label === 'wall') {
            // Pop on wall impact
            projectile.isDestroyed = true;
            this.pendingPopEvents.push({
              id: `${Date.now()}_${Math.random()}`,
              x: projectileBody.position.x,
              y: projectileBody.position.y,
              radius: projectile.radius * 1.4,
              hue: projectile.hue,
              color: projectile.color,
              isKill: false,
            });
          }
        }

        // Tank vs Obstacle or Tank vs Tank collisions (trigger wobbles)
        if (bodyA.label === 'tank' && bodyB.label === 'obstacle') {
          const tank: ServerTank = (bodyA as any).tankInstance;
          if (tank) tank.addWobble(Math.random() * Math.PI * 2, 0.18);
        } else if (bodyB.label === 'tank' && bodyA.label === 'obstacle') {
          const tank: ServerTank = (bodyB as any).tankInstance;
          if (tank) tank.addWobble(Math.random() * Math.PI * 2, 0.18);
        } else if (bodyA.label === 'tank' && bodyB.label === 'tank') {
          const tankA: ServerTank = (bodyA as any).tankInstance;
          const tankB: ServerTank = (bodyB as any).tankInstance;
          if (tankA) tankA.addWobble(Math.random() * Math.PI * 2, 0.22);
          if (tankB) tankB.addWobble(Math.random() * Math.PI * 2, 0.22);
        }
      }
    });
  }

  private spawnInitialBots(): void {
    const count = GAME_CONFIG.BOT.SPAWN_COUNT;
    for (let i = 0; i < count; i++) {
      const pos = this.physics.getRandomSpawnPosition(300);
      const bot = new BotPlayer(`bot_${i + 1}`, pos.x, pos.y, i);
      this.bots.push(bot);
      this.physics.addBody(bot.tank.body);
    }
  }

  public triggerGameOver(winner: ServerTank): void {
    if (this.isMatchOver) return;
    this.isMatchOver = true;
    this.matchOverTime = Date.now();

    const allTanks = this.getAllTanks();
    const leaderboard: LeaderboardEntry[] = allTanks
      .map((t) => ({
        id: t.id,
        name: t.name,
        score: t.score,
        kills: t.kills,
        deaths: t.deaths,
        isBot: t.isBot,
        color: t.color,
        hue: t.hue,
      }))
      .sort((a, b) => b.kills - a.kills || b.score - a.score);

    console.log(`🏆 [Game Over] Winner: "${winner.name}" with ${winner.kills} kills!`);

    this.broadcast({
      type: 'game_over',
      winnerId: winner.id,
      winnerName: winner.name,
      winnerColor: winner.color,
      winnerHue: winner.hue,
      winnerIsBot: winner.isBot,
      winnerKills: winner.kills,
      fragLimit: this.fragLimit,
      leaderboard,
    });
  }

  public handlePlayerJoin(ws: WebSocket, name: string, preferredColor?: TankColor): ConnectedPlayer {
    const id = `player_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const cleanName = (name || 'Bubble Warrior').trim().slice(0, 16);
    const color = preferredColor || this.availableColors[this.colorIndex++ % this.availableColors.length];
    const hue = COLOR_TO_HUE[color] ?? 192;

    const pos = this.physics.getRandomSpawnPosition(300);
    const tank = new ServerTank(id, cleanName, color, pos.x, pos.y, false, hue);

    this.physics.addBody(tank.body);

    const player: ConnectedPlayer = {
      id,
      ws,
      tank,
      input: {
        up: false,
        down: false,
        left: false,
        right: false,
        aimAngle: 0,
        shooting: false,
        seq: 0,
      },
    };

    this.players.set(id, player);

    // Send welcome with obstacles and fragLimit
    this.sendTo(ws, {
      type: 'welcome',
      playerId: id,
      arena: GAME_CONFIG.ARENA,
      obstacles: this.physics.getObstacleSnapshots(),
      fragLimit: this.fragLimit,
    });

    return player;
  }

  public handlePlayerRematch(playerId: string): void {
    if (this.isMatchOver) {
      console.log(`🔄 [Rematch] Player ${playerId} requested rematch. Resetting arena!`);
      this.resetArena();
    }
  }

  public handlePlayerInput(playerId: string, input: PlayerInput): void {
    const player = this.players.get(playerId);
    if (player) {
      player.input = input;
    }
  }

  public handlePlayerRespawn(playerId: string): void {
    const player = this.players.get(playerId);
    if (player && player.tank.isDead) {
      const pos = this.physics.getRandomSpawnPosition(300);
      player.tank.respawn(pos.x, pos.y);
    }
  }

  public handlePlayerDisconnect(playerId: string): void {
    const player = this.players.get(playerId);
    if (player) {
      this.physics.removeBody(player.tank.body);
      this.players.delete(playerId);
    }
  }

  private findTankById(id: string): ServerTank | null {
    const player = this.players.get(id);
    if (player) return player.tank;
    const bot = this.bots.find((b) => b.tank.id === id);
    return bot ? bot.tank : null;
  }

  private getAllTanks(): ServerTank[] {
    const tanks: ServerTank[] = [];
    for (const player of this.players.values()) {
      tanks.push(player.tank);
    }
    for (const bot of this.bots) {
      tanks.push(bot.tank);
    }
    return tanks;
  }

  private startLoop(): void {
    const deltaMs = GAME_CONFIG.TICK_INTERVAL_MS;

    this.intervalId = setInterval(() => {
      this.tick(deltaMs);
    }, deltaMs);
  }

  private tick(deltaMs: number): void {
    this.tickCount++;
    const now = Date.now();
    const dt = deltaMs / 1000;
    const allTanks = this.getAllTanks();

    // 1. Process human player inputs
    for (const player of this.players.values()) {
      const projectile = player.tank.applyInput(player.input, now);
      if (projectile) {
        this.projectiles.push(projectile);
        this.physics.addBody(projectile.body);
      }
      player.tank.update(deltaMs);
    }

    // 2. Process bot AI & inputs
    for (const bot of this.bots) {
      if (bot.tank.isDead) {
        if (now - bot.tank.deathTime >= GAME_CONFIG.TANK.RESPAWN_DELAY_MS) {
          const pos = this.physics.getRandomSpawnPosition(300);
          bot.tank.respawn(pos.x, pos.y);
        }
      } else {
        const botInput = bot.updateAI(allTanks, this.physics, dt);
        const projectile = bot.tank.applyInput(botInput, now);
        if (projectile) {
          this.projectiles.push(projectile);
          this.physics.addBody(projectile.body);
        }
      }
      bot.tank.update(deltaMs);
    }

    // 3. Step physics simulation
    this.physics.step(deltaMs);

    // 4. Projectiles lifetime & cleanup
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      if (proj.isDestroyed || proj.isExpired(now)) {
        this.physics.removeBody(proj.body);
        this.projectiles.splice(i, 1);
      }
    }

    // 5. Send pending pop events
    if (this.pendingPopEvents.length > 0) {
      for (const event of this.pendingPopEvents) {
        this.broadcast({
          type: 'bubble_pop',
          event,
        });
      }
      this.pendingPopEvents = [];
    }

    // 6. Construct leaderboard
    const leaderboard: LeaderboardEntry[] = allTanks
      .map((t) => ({
        id: t.id,
        name: t.name,
        score: t.score,
        kills: t.kills,
        deaths: t.deaths,
        isBot: t.isBot,
        color: t.color,
        hue: t.hue,
      }))
      .sort((a, b) => b.score - a.score || b.kills - a.kills)
      .slice(0, 10);

    // 7. Broadcast world snapshot
    const worldStateMsg: ServerMessage = {
      type: 'world_state',
      tick: this.tickCount,
      fragLimit: this.fragLimit,
      tanks: allTanks.map((t) => t.toSnapshot()),
      projectiles: this.projectiles.map((p) => p.toSnapshot()),
      obstacles: this.physics.getObstacleSnapshots(),
      leaderboard,
    };

    this.broadcast(worldStateMsg);

    // Auto-restart next match after 12s if game over
    if (this.isMatchOver && now - this.matchOverTime > 12000) {
      this.resetArena();
    }
  }

  private sendTo(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  private broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg);
    for (const player of this.players.values()) {
      if (player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(data);
      }
    }
  }

  public setBotCount(targetCount: number): number {
    const count = Math.max(0, Math.min(15, Math.floor(targetCount)));

    while (this.bots.length < count) {
      const idx = this.bots.length;
      const pos = this.physics.getRandomSpawnPosition(300);
      const bot = new BotPlayer(`bot_${Date.now()}_${idx + 1}`, pos.x, pos.y, idx);
      this.bots.push(bot);
      this.physics.addBody(bot.tank.body);
    }

    while (this.bots.length > count) {
      const removed = this.bots.pop();
      if (removed) {
        this.physics.removeBody(removed.tank.body);
        this.pendingPopEvents.push({
          id: `bot_remove_${removed.tank.id}_${Date.now()}`,
          x: removed.tank.body.position.x,
          y: removed.tank.body.position.y,
          radius: GAME_CONFIG.TANK.BODY_RADIUS * 2,
          hue: removed.tank.hue,
          color: removed.tank.color,
          isKill: false,
        });
      }
    }

    return this.bots.length;
  }

  public setFragLimit(limit: number): number {
    this.fragLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    return this.fragLimit;
  }

  public resetArena(): void {
    this.isMatchOver = false;
    this.matchOverTime = 0;

    // Reset all tank scores and respawn
    for (const player of this.players.values()) {
      player.tank.score = 0;
      player.tank.kills = 0;
      player.tank.deaths = 0;
      const pos = this.physics.getRandomSpawnPosition(300);
      player.tank.respawn(pos.x, pos.y);
    }

    for (const bot of this.bots) {
      bot.tank.score = 0;
      bot.tank.kills = 0;
      bot.tank.deaths = 0;
      const pos = this.physics.getRandomSpawnPosition(300);
      bot.tank.respawn(pos.x, pos.y);
    }

    // Clear projectiles
    for (const proj of this.projectiles) {
      this.physics.removeBody(proj.body);
    }
    this.projectiles = [];
  }

  public kickPlayer(id: string): boolean {
    const player = this.players.get(id);
    if (player) {
      try {
        player.ws.close(4001, 'Kicked by administrator');
      } catch {
        /* ignore */
      }
      this.handlePlayerDisconnect(id);
      return true;
    }
    return false;
  }

  public getAdminState() {
    const allTanks = this.getAllTanks();
    return {
      botCount: this.bots.length,
      fragLimit: this.fragLimit || 10,
      playersCount: this.players.size,
      botsCount: this.bots.length,
      projectilesCount: this.projectiles.length,
      uptimeSeconds: Math.floor(process.uptime()),
      tanks: allTanks.map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        hue: t.hue,
        score: t.score,
        kills: t.kills,
        deaths: t.deaths,
        isBot: t.isBot,
        isDead: t.isDead,
        hp: t.hp,
        maxHp: t.maxHp,
      })),
    };
  }

  public cleanup(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}
