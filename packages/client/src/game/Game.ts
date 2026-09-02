import {
    BubblePopEvent,
    GAME_CONFIG,
    GameOverMessage,
    GunBarrelDef,
    HostChangedMessage,
    ImpactEvent,
    KillEventMessage,
    PlayerInfo,
    PlayerJoinedMessage,
    PlayerLeftMessage,
    ProjectilesSpawnMessage,
    ReadyStateMessage,
    RoomConfigUpdatedMessage,
    TankDespawnMessage,
    TankSpawnMessage,
    WorldStateMessage,
    gunTypeRegistry,
    projectileTypeRegistry,
    tankBlueprintRegistry,
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
    private playersInfo: Map<string, PlayerInfo> = new Map();
    private impactExecutor = new ClientImpactExecutor();
    private statusManager = new ClientStatusManager();

    private inputManager: InputManager;
    private particleSystem: ParticleSystem;
    private hudManager: HudManager;
    private gameRenderer: GameRenderer;

    private unsubscribers: Array<() => void> = [];

    private isPlayerAlive: boolean = false;
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
            networkManager.on('room_joined', (data) => {
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

                this.playersInfo.clear();

                for (const p of data.players ?? []) {
                    this.playersInfo.set(p.id, p);
                }

                this.tanks.clear();

                for (const s of data.tanks ?? []) {
                    this.handleTankSpawn({ type: 'tank_spawn', tank: s });
                }

                const myId = data.playerId;
                this.hudManager.setHostId(data.hostId ?? null);
                this.hudManager.setReadyCheck(data.breakReadyCheck ?? false);
                const isMyTankAlive = (data.tanks ?? []).some(
                    (s) => s.id === myId || s.playerId === myId
                );

                if (data.isDead || !isMyTankAlive) {
                    this.isPlayerAlive = false;
                    const myInfo = this.playersInfo.get(myId);
                    const bp = myInfo ? tankBlueprintRegistry.get(myInfo.blueprintId) : null;
                    const maxHp = bp ? bp.maxHp : GAME_CONFIG.TANK.MAX_HP;
                    this.lastKiller = data.killer ?? null;
                    this.hudManager.updatePlayerHUD(0, maxHp);
                    this.hudManager.showDeathModal(data.score ?? 0, this.lastKiller);
                }
            }),
            networkManager.on('host_changed', (data) => this.handleHostChanged(data)),
            networkManager.on('room_config_updated', (data) => this.handleRoomConfigUpdated(data)),
            networkManager.on('ready_state', (data) => this.handleReadyState(data)),
            networkManager.on('world_state', (data) => this.handleWorldState(data)),
            networkManager.on('projectiles_spawn', (data) => this.handleProjectilesSpawn(data)),
            networkManager.on('player_joined', (data) => this.handlePlayerJoined(data)),
            networkManager.on('player_left', (data) => this.handlePlayerLeft(data)),
            networkManager.on('tank_spawn', (data) => this.handleTankSpawn(data)),
            networkManager.on('tank_despawn', (data) => this.handleTankDespawn(data)),
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
        const myTank = myId ? this.tanks.get(myId) ?? null : null;

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

            let diff = (tank.targetBodyAngle - tank.bodyAngle) % (Math.PI * 2);
            if (diff > Math.PI) diff -= Math.PI * 2;
            if (diff < -Math.PI) diff += Math.PI * 2;
            tank.bodyAngle += diff * Math.min(1, dt * 14);

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
            const bp = tankBlueprintRegistry.get(tank.blueprintId);
            if (tank.recoil > 0) {
                tank.recoil = Math.max(
                    0,
                    tank.recoil - dt * (GAME_CONFIG.TANK.RECOIL_RECOVERY_SPEED * 40)
                );
            }
            if (tank.barrelRecoils && tank.barrelRecoils.size > 0 && bp) {
                for (const [key, val] of tank.barrelRecoils) {
                    const [gunId, barrelId] = key.split(':');
                    const gunDef = bp.guns.find((g) => g.id === gunId);
                    const gunSpec = gunDef ? gunTypeRegistry.get(gunDef.gunTypeId) : null;
                    const barrelDef = gunSpec?.barrels.find(
                        (b: GunBarrelDef) => b.id === (barrelId ?? gunSpec.barrels[0]?.id)
                    );
                    const speed =
                        barrelDef?.recoilRecoverySpeed ??
                        GAME_CONFIG.TANK.RECOIL_RECOVERY_SPEED;
                    const recoveryRate = speed * 40;

                    const nextVal = Math.max(0, val - dt * recoveryRate);
                    if (nextVal <= 0) {
                        tank.barrelRecoils.delete(key);
                    } else {
                        tank.barrelRecoils.set(key, nextVal);
                    }
                }
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

        const isControlAllowed = !!myTank && !myTank.isDead && !this.isMatchOver && !isAnyModalOpen;
        this.inputManager.setTouchEnabled(isControlAllowed);

        const isTouch = this.inputManager.isTouchDevice();
        const showCrosshair = !isTouch && isControlAllowed;

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
            const t = this.tanks.get(snap.id);
            if (!t) continue;

            t.targetBodyAngle = snap.bodyAngle;
            t.targetX = snap.x;
            t.targetY = snap.y;
            t.vx = snap.vx;
            t.vy = snap.vy;
            t.aimAngle = snap.aimAngle;
            t.hp = snap.hp;
            t.invulnT = snap.invulnT;
            t.flash = snap.flash;
            t.wobbleS = snap.wobbleS;
            t.wobbleA = snap.wobbleA;
            t.effects = snap.effects;

            // Synchronize status effects lifecycle
            this.statusManager.syncTankStatuses(t, snap.effects, statusCtx);

            // Update Local Player UI
            if (snap.id === myId) {
                this.hudManager.updatePlayerHUD(snap.hp, t.maxHp);
                const factor = CLIENT_CONFIG.HUD.VELOCITY_TO_BLUEPRINT_SPEED;
                const currentSpeed = Math.round(Math.hypot(snap.vx, snap.vy) * factor);
                this.hudManager.updateTankSpeed(currentSpeed);
            }
        }

        // Clean up deleted tanks
        for (const id of this.tanks.keys()) {
            if (!receivedTankIds.has(id)) {
                this.statusManager.clearTank(id, statusCtx);
                this.tanks.delete(id);
            }
        }

        // Process Projectiles (tuples: [id, x, y])
        for (const [id, x, y] of data.projectiles) {
            receivedProjIds.add(id);
            const p = this.projectiles.get(id);

            if (p) {
                const dx = x - p.targetX;
                const dy = y - p.targetY;
                if (dx !== 0 || dy !== 0) {
                    p.angle = Math.atan2(dy, dx);
                }
                p.targetX = x;
                p.targetY = y;
            } else {
                // Fallback for late join / missing spawn event
                const typeId = 'standard_bubble';
                const projType = projectileTypeRegistry.get(typeId);
                const r = projType?.body?.bubbles?.[0]?.radius ?? GAME_CONFIG.PROJECTILE.RADIUS;
                this.projectiles.set(id, {
                    id,
                    projectileTypeId: typeId,
                    x,
                    y,
                    targetX: x,
                    targetY: y,
                    angle: 0,
                    r,
                    hue: 200,
                    trail: [],
                });
            }
        }

        // Clean up deleted projectiles
        for (const id of this.projectiles.keys()) {
            if (!receivedProjIds.has(id)) {
                this.projectiles.delete(id);
            }
        }

        // Update stats on ClientTankState from leaderboard
        if (data.leaderboard) {
            for (const entry of data.leaderboard) {
                const tank = this.tanks.get(entry.id);
                if (tank) {
                    tank.name = entry.name;
                    tank.isBot = entry.isBot;
                    tank.color = entry.color;
                    tank.hue = entry.hue;
                    tank.score = entry.score;
                    tank.kills = entry.kills;
                    tank.deaths = entry.deaths;
                }
            }

            if (!this.isPlayerAlive && myId) {
                const myEntry = data.leaderboard.find((e) => e.id === myId);
                if (myEntry) {
                    this.hudManager.updateDeathModalScore(myEntry.score);
                }
            }
        }

        // Update HUD frag limit, leaderboard and ping
        if (data.fragLimit) {
            this.hudManager.updateFragLimit(data.fragLimit);
        }
        this.hudManager.updateLeaderboard(data.leaderboard, myId, this.playersInfo);
        this.hudManager.updateNetworkStats(
            networkManager.latency,
            networkManager.inboundKbps,
            networkManager.avgPacketBytes
        );

        // If new match has begun, automatically dismiss game over modal
        if (this.isMatchOver && data.isMatchOver === false) {
            this.isMatchOver = false;
            this.hudManager.hideGameOverModal();
        }
    }

    private handleProjectilesSpawn(data: ProjectilesSpawnMessage): void {
        const myId = networkManager.playerId;
        for (const s of data.projectiles) {
            const typeId = s.projectileTypeId ?? 'standard_bubble';
            const projType = projectileTypeRegistry.get(typeId);
            const r = projType?.body?.bubbles?.[0]?.radius ?? GAME_CONFIG.PROJECTILE.RADIUS;
            const angle = Math.atan2(s.vy, s.vx);

            const p: ClientProjectile = {
                id: s.id,
                ownerId: s.ownerId,
                projectileTypeId: typeId,
                x: s.x,
                y: s.y,
                targetX: s.x,
                targetY: s.y,
                angle,
                r,
                hue: s.hue,
                trail: [],
            };
            this.projectiles.set(s.id, p);

            if (s.ownerId) {
                const shooter = this.tanks.get(s.ownerId);
                if (shooter) {
                    shooter.recoil = 1.0;
                    shooter.wobbleV += 0.12;
                    if (s.gunId) {
                        if (!shooter.barrelRecoils) shooter.barrelRecoils = new Map();
                        const barrelKey = s.barrelId ? `${s.gunId}:${s.barrelId}` : s.gunId;
                        shooter.barrelRecoils.set(barrelKey, 1.0);
                        shooter.barrelRecoils.set(s.gunId, 1.0);
                    }
                }
            }

            if (s.ownerId === myId) {
                soundFx.playShoot(typeId);
            }
        }
    }

    private handleHostChanged(data: HostChangedMessage): void {
        this.hudManager.setHostId(data.hostId ?? null);
    }

    private handleRoomConfigUpdated(data: RoomConfigUpdatedMessage): void {
        if (data.fragLimit) {
            this.hudManager.updateFragLimit(data.fragLimit);
        }
        if (data.breakReadyCheck !== undefined) {
            this.hudManager.setReadyCheck(data.breakReadyCheck);
        }
    }

    private handleReadyState(data: ReadyStateMessage): void {
        const myId = networkManager.playerId;
        this.hudManager.updateReadyState(data, myId);
    }

    private handlePlayerJoined(data: PlayerJoinedMessage): void {
        this.playersInfo.set(data.player.id, data.player);
        const tank = this.tanks.get(data.player.id);
        if (tank) {
            tank.name = data.player.name;
            tank.color = data.player.color;
            tank.hue = data.player.hue;
            tank.isBot = data.player.isBot;
        }
    }

    private handlePlayerLeft(data: PlayerLeftMessage): void {
        this.playersInfo.delete(data.playerId);
        this.tanks.delete(data.playerId);
    }

    private handleTankSpawn(data: TankSpawnMessage): void {
        const s = data.tank;
        const info = this.playersInfo.get(s.playerId);
        const bp = tankBlueprintRegistry.get(s.blueprintId);
        const maxHp = bp ? bp.maxHp : 100;
        const myId = networkManager.playerId;

        let t = this.tanks.get(s.id);
        if (!t) {
            t = {
                id: s.id,
                name: info?.name ?? 'Player',
                blueprintId: s.blueprintId,
                bodyAngle: s.bodyAngle,
                targetBodyAngle: s.bodyAngle,
                color: info?.color ?? { hue: 192 },
                hue: info?.hue ?? 192,
                isBot: info?.isBot ?? false,
                x: s.x,
                y: s.y,
                targetX: s.x,
                targetY: s.y,
                vx: 0,
                vy: 0,
                aimAngle: s.bodyAngle,
                hp: s.hp,
                maxHp: maxHp,
                isDead: false,
                score: 0,
                kills: 0,
                deaths: 0,
                recoil: 0,
                barrelRecoils: new Map(),
                invulnT: s.invulnT ?? 0,
                flash: 0,
                wobbleS: 1.0,
                wobbleA: 0,
                wobbleV: 0,
                effects: [],
            };
            this.tanks.set(s.id, t);
        } else {
            t.blueprintId = s.blueprintId;
            t.barrelRecoils?.clear();
            t.x = s.x;
            t.y = s.y;
            t.targetX = s.x;
            t.targetY = s.y;
            t.bodyAngle = s.bodyAngle;
            t.targetBodyAngle = s.bodyAngle;
            t.hp = s.hp;
            t.maxHp = maxHp;
            t.isDead = false;
            t.invulnT = s.invulnT ?? 0;
            if (info) {
                t.name = info.name;
                t.color = info.color;
                t.hue = info.hue;
                t.isBot = info.isBot;
            }
        }

        if ((s.id === myId || s.playerId === myId) && !this.isPlayerAlive) {
            this.isPlayerAlive = true;
            this.lastKiller = null;
            this.hudManager.hideDeathModal();
            this.hudManager.updatePlayerHUD(s.hp, maxHp);
        }
    }

    private handleTankDespawn(data: TankDespawnMessage): void {
        const myId = networkManager.playerId;
        if (data.tankId === myId && this.isPlayerAlive) {
            this.isPlayerAlive = false;
            this.hudManager.updateTankSpeed(0);
            this.playerFlash = 1.0;
            this.shake = Math.min(
                CLIENT_CONFIG.SHAKE.MAX,
                this.shake + CLIENT_CONFIG.SHAKE.HIT
            );
            const myScore = this.tanks.get(myId)?.score ?? 0;
            this.hudManager.showDeathModal(myScore, this.lastKiller);
        }
        this.tanks.delete(data.tankId);
    }

    private handleBubblePop(event: BubblePopEvent): void {
        if (event.isKill) {
            soundFx.playKill();
        } else if (event.projectileTypeId) {
            soundFx.playHit(event.projectileTypeId);
        } else {
            soundFx.playBubblePop(event.radius);
        }

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
        this.hudManager.showGameOverModal(data, myId, this.playersInfo);
    }

    public showTabStats(): void {
        if (!this.isMatchOver && this.isRunning) {
            this.hudManager.showTabStats();
        }
    }

    public hideTabStats(): void {
        this.hudManager.hideTabStats();
    }

    public toggleTabStats(): void {
        if (!this.isMatchOver && this.isRunning) {
            this.hudManager.toggleTabStats();
        }
    }

    public leaveGame(): void {
        this.isPlayerAlive = false;
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
