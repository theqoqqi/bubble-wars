import Matter from 'matter-js';
import { WebSocket } from 'ws';
import {
    BOT_NAMES,
    BubblePopEvent,
    ColorDef,
    GAME_CONFIG,
    ImpactEvent,
    KILL_VERBS,
    LeaderboardEntry,
    PlayerInput,
    ServerMessage,
} from '@bubble-wars/shared';
import { PhysicsWorld } from './PhysicsWorld.js';
import { ServerTank } from './ServerTank.js';
import { ServerProjectile } from './Projectile.js';
import { BotPlayer } from './BotPlayer.js';
import { CollisionHandler } from './CollisionHandler.js';
import { ImpactContext, ImpactEffectExecutor, initEffects } from './effects/index.js';

interface ConnectedPlayer {
    id: string;
    sessionToken: string;
    ws: WebSocket | null;
    tank: ServerTank;
    input: PlayerInput;
    disconnectedAt: number | null;
    disconnectTimeout: NodeJS.Timeout | null;
}

export class GameRoom {
    public physics: PhysicsWorld;
    public botCount: number = GAME_CONFIG.BOT.SPAWN_COUNT;
    public fragLimit: number = GAME_CONFIG.MATCH.DEFAULT_FRAG_LIMIT;
    public isMatchOver: boolean = false;
    public matchOverTime: number = 0;
    public impactExecutor: ImpactEffectExecutor = new ImpactEffectExecutor();
    private collisionHandler: CollisionHandler;
    private players: Map<string, ConnectedPlayer> = new Map();
    private playersByToken: Map<string, ConnectedPlayer> = new Map();
    private bots: BotPlayer[] = [];
    private freeNames: string[] = [];
    private projectiles: ServerProjectile[] = [];
    private tickCount: number = 0;
    private intervalId: NodeJS.Timeout | null = null;
    private pendingPopEvents: BubblePopEvent[] = [];
    private pendingImpactEvents: ImpactEvent[] = [];
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
        initEffects(this.impactExecutor);
        this.collisionHandler = new CollisionHandler({
            game: this,
            impactExecutor: this.impactExecutor,
            findTankById: (id) => this.findTankById(id),
            addPopEvent: (event) => this.pendingPopEvents.push(event),
            isMatchOver: () => this.isMatchOver,
        });
        this.collisionHandler.setup(this.physics.engine);
        this.respawnAllBots();
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

    public handleTankDeath(victim: ServerTank, killer: ServerTank | null): void {
        if (killer) {
            killer.score += 100;
            killer.kills += 1;

            const verb = KILL_VERBS[Math.floor(Math.random() * KILL_VERBS.length)];
            this.broadcast({
                type: 'kill',
                killerId: killer.id,
                victimId: victim.id,
                killerName: killer.name,
                victimName: victim.name,
                killerColor: killer.color,
                victimColor: victim.color,
                killerHue: killer.hue,
                victimHue: victim.hue,
                verb,
            });

            if (!this.isMatchOver && killer.kills >= this.fragLimit) {
                this.triggerGameOver(killer);
            }
        }

        // Pop explosion on tank death
        this.pendingPopEvents.push({
            id: `${Date.now()}_kill_${victim.id}`,
            x: victim.body.position.x,
            y: victim.body.position.y,
            radius: GAME_CONFIG.TANK.BODY_RADIUS * 2.4,
            hue: victim.hue,
            color: victim.color,
            isKill: true,
        });
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
        blueprintId: string = 'heavy',
        sessionToken?: string
    ): ConnectedPlayer {
        // 1. Check if reconnecting with an existing valid sessionToken
        if (sessionToken && this.playersByToken.has(sessionToken)) {
            const player = this.playersByToken.get(sessionToken)!;

            // Cancel any pending disconnect cleanup timeout
            if (player.disconnectTimeout) {
                clearTimeout(player.disconnectTimeout);
                player.disconnectTimeout = null;
            }

            // Close previous socket if still open (e.g. duplicate tab or rapid refresh)
            if (player.ws && player.ws !== ws && player.ws.readyState === WebSocket.OPEN) {
                try {
                    player.ws.close(4000, 'Reconnected from another session');
                } catch {
                    /* ignore */
                }
            }

            player.ws = ws;
            player.disconnectedAt = null;
            player.input = {
                up: false,
                down: false,
                left: false,
                right: false,
                aimAngle: player.tank.aimAngle,
                shooting: false,
                seq: 0,
            };

            // Send welcome confirmation with existing playerId, sessionToken and reconnected flag
            this.sendTo(ws, {
                type: 'welcome',
                playerId: player.id,
                sessionToken: player.sessionToken,
                reconnected: true,
                arena: GAME_CONFIG.ARENA,
                obstacles: this.physics.getObstacleSnapshots(),
                fragLimit: this.fragLimit,
            });

            console.log(
                `[Server] Player reconnected: "${player.tank.name}" (${player.id}) [Score: ${player.tank.score}, Kills: ${player.tank.kills}]`
            );

            return player;
        }

        // 2. New player join
        const id = `player_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const newSessionToken = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        const cleanName = (name || 'Bubble Warrior').trim().slice(0, 16);
        const color =
            preferredColor || this.availableColors[this.colorIndex++ % this.availableColors.length];
        const hue = color.hue;

        const pos = this.physics.getRandomSpawnPosition(GAME_CONFIG.ARENA.SPAWN_MARGIN);
        const tank = new ServerTank(id, cleanName, color, pos.x, pos.y, false, hue, blueprintId);
        tank.onDeath = (victim, killer) => this.handleTankDeath(victim, killer);

        this.physics.addBody(tank.body);

        const player: ConnectedPlayer = {
            id,
            sessionToken: newSessionToken,
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
            disconnectedAt: null,
            disconnectTimeout: null,
        };

        this.players.set(id, player);
        this.playersByToken.set(newSessionToken, player);

        // Send welcome with session token
        this.sendTo(ws, {
            type: 'welcome',
            playerId: id,
            sessionToken: newSessionToken,
            reconnected: false,
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
        if (!player) return;

        player.ws = null;
        player.disconnectedAt = Date.now();
        player.input = {
            up: false,
            down: false,
            left: false,
            right: false,
            aimAngle: player.tank.aimAngle,
            shooting: false,
            seq: 0,
        };

        if (player.disconnectTimeout) {
            clearTimeout(player.disconnectTimeout);
            player.disconnectTimeout = null;
        }

        player.disconnectTimeout = setTimeout(() => {
            if (player.ws === null) {
                console.log(
                    `[Server] Reconnect timeout expired for "${player.tank.name}" (${player.id}). Removing from room.`
                );
                this.removePlayerCompletely(player.id);
            }
        }, GAME_CONFIG.PLAYER.RECONNECT_TIMEOUT_MS);
    }

    public removePlayerCompletely(playerId: string): void {
        const player = this.players.get(playerId);
        if (player) {
            if (player.disconnectTimeout) {
                clearTimeout(player.disconnectTimeout);
                player.disconnectTimeout = null;
            }
            this.physics.removeBody(player.tank.body);
            this.players.delete(playerId);
            this.playersByToken.delete(player.sessionToken);
        }
    }

    public addImpactEvent(event: ImpactEvent): void {
        this.pendingImpactEvents.push(event);
    }

    private findTankById(id: string): ServerTank | null {
        const player = this.players.get(id);
        if (player) return player.tank;
        const bot = this.bots.find((b) => b.tank.id === id);
        return bot ? bot.tank : null;
    }

    public getAllTanks(): ServerTank[] {
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
                    if (!proj.isDestroyed && proj.isExpired(now)) {
                        const ctx: ImpactContext = {
                            game: this,
                            position: { x: proj.body.position.x, y: proj.body.position.y },
                            sourceTank: this.findTankById(proj.ownerId),
                        };
                        this.impactExecutor.execute(proj.onExpire, ctx);
                    }
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

        // 6. Send pending impact events
        if (this.pendingImpactEvents.length > 0) {
            for (const event of this.pendingImpactEvents) {
                this.broadcast({
                    type: 'impact',
                    event,
                });
            }
            this.pendingImpactEvents = [];
        }

        // 7. Construct leaderboard
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

    private sendTo(ws: WebSocket | null, msg: ServerMessage): void {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(msg));
        }
    }

    private broadcast(msg: ServerMessage): void {
        const data = JSON.stringify(msg);
        for (const player of this.players.values()) {
            if (player.ws && player.ws.readyState === WebSocket.OPEN) {
                player.ws.send(data);
            }
        }
    }

    private respawnAllBots(): void {
        this.removeBots(this.bots.length, false);
        this.addBots(this.botCount);
    }

    public setBotCount(targetCount: number): number {
        const count = Math.max(0, Math.min(15, Math.floor(targetCount)));
        this.botCount = count;

        if (this.bots.length < count) {
            this.addBots(count - this.bots.length);
        } else if (this.bots.length > count) {
            this.removeBots(this.bots.length - count, true);
        }

        return this.bots.length;
    }

    private getRandomBotName(): string {
        if (this.freeNames.length === 0) {
            this.freeNames = [...BOT_NAMES];
        }

        const idx = Math.floor(Math.random() * this.freeNames.length);
        const [picked] = this.freeNames.splice(idx, 1);

        return picked;
    }

    private addBots(count: number): void {
        for (let i = 0; i < count; i++) {
            this.addBot();
        }
    }

    private addBot(): BotPlayer {
        const name = this.getRandomBotName();
        const bot = this.createBot(`bot_${Date.now()}_${this.bots.length + 1}`, name);

        this.bots.push(bot);
        this.physics.addBody(bot.tank.body);

        return bot;
    }

    private createBot(id: string, name: string): BotPlayer {
        const pos = this.physics.getRandomSpawnPosition(GAME_CONFIG.ARENA.SPAWN_MARGIN);
        const bot = new BotPlayer(id, name, pos.x, pos.y);

        bot.tank.onDeath = (victim, killer) => this.handleTankDeath(victim, killer);

        return bot;
    }

    private removeBots(count: number, emitPop: boolean = true): void {
        const toRemove = Math.min(count, this.bots.length);

        for (let i = 0; i < toRemove; i++) {
            const removed = this.bots.pop();

            if (removed) {
                this.removeBot(removed, emitPop);
            }
        }
    }

    private removeBot(bot: BotPlayer, emitPop: boolean = true): void {
        this.physics.removeBody(bot.tank.body);

        if (!emitPop) {
            return;
        }

        this.pendingPopEvents.push({
            id: `bot_remove_${bot.tank.id}_${Date.now()}`,
            x: bot.tank.body.position.x,
            y: bot.tank.body.position.y,
            radius: GAME_CONFIG.TANK.BODY_RADIUS * 2,
            hue: bot.tank.hue,
            color: bot.tank.color,
            isKill: false,
        });
    }

    public setFragLimit(limit: number): number {
        this.fragLimit = Math.max(1, Math.min(100, Math.floor(limit)));
        return this.fragLimit;
    }

    public resetArena(): void {
        this.isMatchOver = false;
        this.matchOverTime = 0;

        // Generate fresh random obstacles for the new match
        this.physics.generateRandomObstacles();

        // Reset all player tank scores and respawn
        for (const player of this.players.values()) {
            player.tank.score = 0;
            player.tank.kills = 0;
            player.tank.deaths = 0;
            const pos = this.physics.getRandomSpawnPosition(GAME_CONFIG.ARENA.SPAWN_MARGIN);
            player.tank.respawn(pos.x, pos.y);
        }

        // Spawn a brand new random set of bots for the new match
        this.respawnAllBots();

        // Clear projectiles
        for (const proj of this.projectiles) {
            this.physics.removeBody(proj.body);
        }
        this.projectiles = [];
    }

    public kickPlayer(id: string): boolean {
        const player = this.players.get(id);
        if (player) {
            if (player.ws && player.ws.readyState === WebSocket.OPEN) {
                try {
                    player.ws.close(4001, 'Kicked by administrator');
                } catch {
                    /* ignore */
                }
            }
            this.removePlayerCompletely(id);
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
            activePlayersCount: Array.from(this.players.values()).filter((p) => p.ws !== null)
                .length,
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
            this.intervalId = null;
        }
        for (const player of this.players.values()) {
            if (player.disconnectTimeout) {
                clearTimeout(player.disconnectTimeout);
                player.disconnectTimeout = null;
            }
        }
    }
}
