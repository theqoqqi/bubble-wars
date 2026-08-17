import Matter from 'matter-js';
import { WebSocket } from 'ws';
import {
    BubblePopEvent,
    ColorDef,
    GAME_CONFIG,
    LeaderboardEntry,
    PlayerInput,
    ServerMessage,
} from '@bubble-wars/shared';
import { PhysicsWorld } from './PhysicsWorld.js';
import { ServerTank } from './ServerTank.js';
import { ServerProjectile } from './Projectile.js';
import { BotPlayer } from './BotPlayer.js';
import { CollisionHandler } from './CollisionHandler.js';

interface ConnectedPlayer {
    id: string;
    ws: WebSocket;
    tank: ServerTank;
    input: PlayerInput;
}

export class GameRoom {
    public physics: PhysicsWorld;
    public botCount: number = GAME_CONFIG.BOT.SPAWN_COUNT;
    public fragLimit: number = GAME_CONFIG.MATCH.DEFAULT_FRAG_LIMIT;
    public isMatchOver: boolean = false;
    public matchOverTime: number = 0;
    private collisionHandler: CollisionHandler;
    private players: Map<string, ConnectedPlayer> = new Map();
    private bots: BotPlayer[] = [];
    private projectiles: ServerProjectile[] = [];
    private tickCount: number = 0;
    private intervalId: NodeJS.Timeout | null = null;
    private pendingPopEvents: BubblePopEvent[] = [];
    private colorIndex: number = 0;
    private availableColors: ColorDef[] = [
        { hue: 192 },
        { hue: 326 },
        { hue: 130 },
        { hue: 280 },
        { hue: 42 },
    ];

    constructor() {
        this.physics = new PhysicsWorld();
        this.collisionHandler = new CollisionHandler({
            findTankById: (id) => this.findTankById(id),
            addPopEvent: (event) => this.pendingPopEvents.push(event),
            broadcast: (msg) => this.broadcast(msg),
            isMatchOver: () => this.isMatchOver,
            getFragLimit: () => this.fragLimit,
            triggerGameOver: (killer) => this.triggerGameOver(killer),
        });
        this.collisionHandler.setup(this.physics.engine);
        this.spawnInitialBots();
        this.startLoop();
    }

    public buildLeaderboard(tanks?: ServerTank[]): LeaderboardEntry[] {
        const list = tanks || this.getAllTanks();
        return list
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
            .sort((a, b) => b.kills - a.kills || b.score - a.score)
            .slice(0, 10);
    }

    private spawnInitialBots(): void {
        const count = GAME_CONFIG.BOT.SPAWN_COUNT;
        for (let i = 0; i < count; i++) {
            const pos = this.physics.getRandomSpawnPosition(GAME_CONFIG.ARENA.SPAWN_MARGIN);
            const bot = new BotPlayer(`bot_${i + 1}`, pos.x, pos.y, i);
            this.bots.push(bot);
            this.physics.addBody(bot.tank.body);
        }
    }

    public triggerGameOver(winner: ServerTank): void {
        if (this.isMatchOver) return;
        this.isMatchOver = true;
        this.matchOverTime = Date.now();

        // Clear all existing projectiles so no damage/clashes occur after match ends
        for (const proj of this.projectiles) {
            this.physics.removeBody(proj.body);
        }
        this.projectiles = [];

        const allTanks = this.getAllTanks();
        for (const tank of allTanks) {
            Matter.Body.setVelocity(tank.body, { x: 0, y: 0 });
        }

        const leaderboard = this.buildLeaderboard(allTanks);

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

    public handlePlayerJoin(
        ws: WebSocket,
        name: string,
        preferredColor?: ColorDef,
        blueprintId: string = 'heavy'
    ): ConnectedPlayer {
        const id = `player_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const cleanName = (name || 'Bubble Warrior').trim().slice(0, 16);
        const color =
            preferredColor || this.availableColors[this.colorIndex++ % this.availableColors.length];
        const hue = color.hue;

        const pos = this.physics.getRandomSpawnPosition(GAME_CONFIG.ARENA.SPAWN_MARGIN);
        const tank = new ServerTank(id, cleanName, color, pos.x, pos.y, false, hue, blueprintId);

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
        if (this.isMatchOver) return;
        const player = this.players.get(playerId);
        if (player) {
            player.input = input;
        }
    }

    public handlePlayerRespawn(playerId: string): void {
        if (this.isMatchOver) return;
        const player = this.players.get(playerId);
        if (player && player.tank.isDead) {
            const pos = this.physics.getRandomSpawnPosition(GAME_CONFIG.ARENA.SPAWN_MARGIN);
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

        if (!this.isMatchOver) {
            // 1. Process human player inputs
            for (const player of this.players.values()) {
                const spawned = player.tank.applyInput(player.input, now);
                for (const proj of spawned) {
                    this.projectiles.push(proj);
                    this.physics.addBody(proj.body);
                }
                player.tank.update(deltaMs);
            }

            // 2. Process bot AI & inputs
            for (const bot of this.bots) {
                if (bot.tank.isDead) {
                    if (now - bot.tank.deathTime >= GAME_CONFIG.TANK.RESPAWN_DELAY_MS) {
                        const pos = this.physics.getRandomSpawnPosition(
                            GAME_CONFIG.ARENA.SPAWN_MARGIN
                        );
                        bot.tank.respawn(pos.x, pos.y);
                    }
                } else {
                    const botInput = bot.updateAI(allTanks, this.physics, dt);
                    const spawned = bot.tank.applyInput(botInput, now);
                    for (const proj of spawned) {
                        this.projectiles.push(proj);
                        this.physics.addBody(proj.body);
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
        } else {
            // Game over state: stop tanks, update visual decay, gentle obstacle step
            for (const tank of allTanks) {
                Matter.Body.setVelocity(tank.body, { x: 0, y: 0 });
                tank.update(deltaMs);
            }
            this.physics.step(deltaMs);
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
        const leaderboard = this.buildLeaderboard(allTanks);

        // 7. Broadcast world snapshot
        const worldStateMsg: ServerMessage = {
            type: 'world_state',
            tick: this.tickCount,
            fragLimit: this.fragLimit,
            isMatchOver: this.isMatchOver,
            tanks: allTanks.map((t) => t.toSnapshot()),
            projectiles: this.projectiles.map((p) => p.toSnapshot()),
            obstacles: this.physics.getObstacleSnapshots(),
            leaderboard,
        };

        this.broadcast(worldStateMsg);

        // Auto-restart next match after delay if game over
        if (this.isMatchOver && now - this.matchOverTime > GAME_CONFIG.MATCH.AUTO_RESET_DELAY_MS) {
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
            const pos = this.physics.getRandomSpawnPosition(GAME_CONFIG.ARENA.SPAWN_MARGIN);
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
            const pos = this.physics.getRandomSpawnPosition(GAME_CONFIG.ARENA.SPAWN_MARGIN);
            player.tank.respawn(pos.x, pos.y);
        }

        for (const bot of this.bots) {
            bot.tank.score = 0;
            bot.tank.kills = 0;
            bot.tank.deaths = 0;
            const pos = this.physics.getRandomSpawnPosition(GAME_CONFIG.ARENA.SPAWN_MARGIN);
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
