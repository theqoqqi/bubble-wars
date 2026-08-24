import {
    BubblePopEvent,
    GAME_CONFIG,
    GameOverMessage,
    ImpactEvent,
    KillEventMessage,
    WorldStateMessage,
} from '@bubble-wars/shared';
import {networkManager} from '../net/NetworkManager.js';
import {soundFx} from '../audio/SoundFx.js';
import {ClientObstacle, ClientProjectile, ClientTankState, KillNotification} from '../types.js';
import {InputManager} from '../input/InputManager.js';
import {ParticleSystem} from '../graphics/ParticleSystem.js';
import {HudManager} from '../ui/HudManager.js';
import {GameRenderer} from '../graphics/GameRenderer.js';
import {CLIENT_CONFIG} from '../config.js';
import {ClientImpactContext, ClientImpactExecutor, initClientEffects} from '../effects/index.js';
import {ClientStatusContext, ClientStatusManager, initClientStatuses} from '../status/index.js';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export class Game {
    private tanks: Map<string, ClientTankState> = new Map();
    private projectiles: Map<number, ClientProjectile> = new Map();
    private clientObstacles: Map<number, ClientObstacle> = new Map();
    private impactExecutor = new ClientImpactExecutor();
    private statusManager = new ClientStatusManager();

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
    private lastKiller: { name: string; hue: number; verb?: string } | null = null;
    private killAlerts: KillNotification[] = [];

    private animFrameId: number | null = null;
    private lastTime: number = 0;
    private isRunning: boolean = false;

    constructor(containerId: string = 'game-container') {
        this.inputManager = new InputManager();
        this.particleSystem = new ParticleSystem();
        this.hudManager = new HudManager();
        this.gameRenderer = new GameRenderer(containerId);

        initClientEffects(this.impactExecutor);
        initClientStatuses(this.statusManager);
        this.setupNetwork();
    }

    private setupNetwork(): void {
        this.unsubscribers.push(
            networkManager.on('welcome', (data) => {
                this.clientObstacles.clear();
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
            networkManager.on('game_over', (data) => this.handleGameOver(data)),
            networkManager.on('impact', (event) => this.handleImpact(event))
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

        // 1. Gather & Send Player Input (only when alive, match is active and leave modal is closed)
        const isLeaveModalOpen = !document
            .getElementById('leave-modal')
            ?.classList.contains('hidden');
        if (myTank && !myTank.isDead && !this.isMatchOver && !isLeaveModalOpen) {
            const input = this.inputManager.getInput();
            networkManager.sendInput(input);
        }

        // 2. Interpolate Tanks
        this.tanks.forEach((tank) => {
            tank.x += (tank.targetX - tank.x) * CLIENT_CONFIG.INTERPOLATION.TANK;
            tank.y += (tank.targetY - tank.y) * CLIENT_CONFIG.INTERPOLATION.TANK;

            if (tank.bodyAngle !== undefined && tank.targetBodyAngle !== undefined) {
                let diff = (tank.targetBodyAngle - tank.bodyAngle) % (Math.PI * 2);
                if (diff > Math.PI) diff -= Math.PI * 2;
                if (diff < -Math.PI) diff += Math.PI * 2;
                tank.bodyAngle += diff * Math.min(1, dt * 14);
            }

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

        // Update Status Effects Simulation
        this.statusManager.update(dt, this.tanks.values(), {
            soundFx,
            particleSystem: this.particleSystem,
            gameTime: this.gameTime,
        });

        // 6. Update Kill Alerts
        for (let i = this.killAlerts.length - 1; i >= 0; i--) {
            this.killAlerts[i].timeRemaining -= dt;
            if (this.killAlerts[i].timeRemaining <= 0) {
                this.killAlerts.splice(i, 1);
            }
        }

        // 7. Screen shake and flash decay
        this.shake = Math.max(0, this.shake - dt * CLIENT_CONFIG.ANIMATION.SHAKE_DECAY);
        this.playerFlash = Math.max(
            0,
            this.playerFlash - dt * CLIENT_CONFIG.ANIMATION.FLASH_DECAY_PLAYER
        );

        // Check active modal states for cursor and input
        const isJoinModalOpen = !document
            .getElementById('join-modal')
            ?.classList.contains('hidden');
        const isTankModalOpen = !document
            .getElementById('tank-modal')
            ?.classList.contains('hidden');
        const isDeathModalOpen = !document
            .getElementById('death-modal')
            ?.classList.contains('hidden');
        const isGameOverModalOpen = !document
            .getElementById('gameover-modal')
            ?.classList.contains('hidden');
        const isAnyModalOpen =
            isLeaveModalOpen ||
            isJoinModalOpen ||
            isTankModalOpen ||
            isDeathModalOpen ||
            isGameOverModalOpen;

        const showCrosshair = !!myTank && !myTank.isDead && !this.isMatchOver && !isAnyModalOpen;

        if (showCrosshair) {
            document.body.classList.add('crosshair-active');
        } else {
            document.body.classList.remove('crosshair-active');
        }

        const mouse = this.inputManager.getMouse();

        // 8. Render Everything on Custom Canvas
        this.gameRenderer.render(
            this.gameTime,
            this.shake,
            this.playerFlash,
            myTank,
            this.tanks.values(),
            this.projectiles.values(),
            this.clientObstacles.values(),
            this.particleSystem,
            this.statusManager,
            this.killAlerts,
            {
                x: mouse.x,
                y: mouse.y,
                down: mouse.down,
                visible: showCrosshair,
                hue: myTank?.hue,
            }
        );
    }

    private handleWorldState(data: WorldStateMessage): void {
        const receivedTankIds = new Set<string>();
        const receivedProjIds = new Set<number>();
        const myId = networkManager.playerId;

        const statusCtx: ClientStatusContext = {
            soundFx,
            particleSystem: this.particleSystem,
            gameTime: this.gameTime,
        };

        // Process Obstacles
        const receivedObstacleIds = new Set<number>();
        if (data.obstacles && data.obstacles.length > 0) {
            for (const o of data.obstacles) {
                receivedObstacleIds.add(o.id);
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
        for (const id of this.clientObstacles.keys()) {
            if (!receivedObstacleIds.has(id)) {
                this.clientObstacles.delete(id);
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
                    blueprintId: snap.blueprintId,
                    bodyAngle: snap.bodyAngle,
                    targetBodyAngle: snap.bodyAngle,
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
                    guns: snap.guns,
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
                    effects: snap.effects,
                };
                this.tanks.set(snap.id, t);
            }

            t.blueprintId = snap.blueprintId;
            t.targetBodyAngle = snap.bodyAngle;
            t.guns = snap.guns;
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
            t.effects = snap.effects;
            t.isDead = snap.isDead;

            // Synchronize status effects lifecycle
            this.statusManager.syncTankStatuses(t, snap.effects, statusCtx);

            // Update Local Player UI
            if (snap.id === myId) {
                this.hudManager.updatePlayerHUD(snap);

                if (snap.isDead && this.isPlayerAlive) {
                    this.isPlayerAlive = false;
                    this.playerFlash = 1.0;
                    this.shake = Math.min(
                        CLIENT_CONFIG.SHAKE.MAX,
                        this.shake + CLIENT_CONFIG.SHAKE.HIT
                    );
                    this.hudManager.showDeathModal(snap.score, this.lastKiller);
                } else if (!snap.isDead && !this.isPlayerAlive) {
                    this.isPlayerAlive = true;
                    this.lastKiller = null;
                    this.hudManager.hideDeathModal();
                }
            }
        }

        // Clean up deleted tanks
        for (const id of this.tanks.keys()) {
            if (!receivedTankIds.has(id)) {
                this.statusManager.clearTank(id, statusCtx);
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
                    projectileTypeId: pSnap.projectileTypeId,
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

                if (pSnap.ownerId === myId) {
                    soundFx.playShoot();
                }
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
            this.shake = Math.min(
                CLIENT_CONFIG.SHAKE.MAX,
                this.shake + CLIENT_CONFIG.SHAKE.KILL_POP
            );
        }

        this.particleSystem.emitPop(event.x, event.y, event.radius, event.hue, event.isKill);
    }

    private handleImpact(event: ImpactEvent): void {
        const ctx: ClientImpactContext = {
            particleSystem: this.particleSystem,
            soundFx: soundFx,
        };

        this.impactExecutor.execute(event, ctx);
    }

    private handleKillEvent(data: KillEventMessage): void {
        this.hudManager.addKillFeedItem(data);

        const myId = networkManager.playerId;
        const myTank = myId ? this.tanks.get(myId) : null;

        // 1. If local player was the victim:
        if (
            (data.victimId && data.victimId === myId) ||
            (myTank && myTank.name === data.victimName)
        ) {
            this.lastKiller = {
                name: data.killerName,
                hue: data.killerHue,
                verb: data.verb,
            };
        }

        // 2. If local player scored the kill:
        if (
            (data.killerId && data.killerId === myId) ||
            (myTank && myTank.name === data.killerName)
        ) {
            this.killAlerts.push({
                id: Date.now() + Math.random(),
                victimName: data.victimName,
                victimHue: data.victimHue,
                timeRemaining: CLIENT_CONFIG.HUD.KILL_ALERT_DURATION_SEC,
                totalTime: CLIENT_CONFIG.HUD.KILL_ALERT_DURATION_SEC,
            });

            if (this.killAlerts.length > 3) {
                this.killAlerts.shift();
            }
        }
    }

    private handleGameOver(data: GameOverMessage): void {
        const myId = networkManager.playerId;
        this.isMatchOver = true;
        this.hudManager.hideDeathModal();
        this.hudManager.showGameOverModal(data, myId);
    }

    public leaveGame(): void {
        this.isMatchOver = false;
        this.lastKiller = null;
        this.killAlerts = [];
        document.body.classList.remove('crosshair-active');
        if (this.inputManager) this.inputManager.reset();
        if (this.hudManager) this.hudManager.reset();
        if (this.particleSystem) this.particleSystem.clear();

        const leaveModal = document.getElementById('leave-modal');
        if (leaveModal) leaveModal.classList.add('hidden');

        this.tanks.clear();
        this.projectiles.clear();
    }

    public destroy(): void {
        this.stop();
        document.body.classList.remove('crosshair-active');
        this.unsubscribers.forEach((unsub) => unsub());
        this.unsubscribers = [];
    }
}
