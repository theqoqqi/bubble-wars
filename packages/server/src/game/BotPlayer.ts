import { BOT_DEFS, getRandomBotDef, GAME_CONFIG, PlayerInput } from '@bubble-wars/shared';
import { ServerTank } from './ServerTank.js';
import { PhysicsWorld } from './PhysicsWorld.js';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const angDiff = (from: number, to: number) => {
    let d = (to - from) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
};

export class BotPlayer {
    public tank: ServerTank;
    public skill: number;
    private strafeDir: number;
    private strafeT: number;
    private burstLeft: number = 3;
    private restT: number = 0;
    private phase: number;
    private aimTarget: number = 0;

    constructor(id: string, x: number, y: number, defIndex?: number, usedNames?: Set<string>) {
        const def = typeof defIndex === 'number'
            ? BOT_DEFS[defIndex % BOT_DEFS.length]
            : getRandomBotDef(usedNames);

        this.skill = def.skill;
        this.tank = new ServerTank(id, def.name, def.color, x, y, true, def.hue, def.blueprintId);
        this.strafeDir = Math.random() < 0.5 ? 1 : -1;
        this.strafeT = rand(1.1, 2.6);
        this.phase = Math.random() * Math.PI * 2;
    }

    public updateAI(allTanks: ServerTank[], physics: PhysicsWorld, dt: number): PlayerInput {
        if (this.tank.isDead) {
            return {
                up: false,
                down: false,
                left: false,
                right: false,
                aimAngle: 0,
                shooting: false,
                seq: 0,
            };
        }

        this.strafeT -= dt;
        if (this.strafeT <= 0) {
            this.strafeDir *= -1;
            this.strafeT = rand(1.1, 2.6);
        }
        this.restT = Math.max(0, this.restT - dt);

        // 1. Find best target (prefer human players, then closest bot)
        let target: ServerTank | null = null;
        let bestDist = Infinity;

        for (const other of allTanks) {
            if (other.id === this.tank.id || other.isDead) continue;
            const d = Math.hypot(
                other.body.position.x - this.tank.body.position.x,
                other.body.position.y - this.tank.body.position.y
            );

            const weightedDist = other.isBot ? d * 1.3 : d;
            if (weightedDist < bestDist) {
                bestDist = weightedDist;
                target = other;
            }
        }

        let mx = 0;
        let my = 0;
        let shooting = false;

        if (target) {
            const tx = this.tank.body.position.x;
            const ty = this.tank.body.position.y;
            const ox = target.body.position.x;
            const oy = target.body.position.y;

            const dx = ox - tx;
            const dy = oy - ty;
            const dist = Math.max(1, Math.hypot(dx, dy));

            // Distance management: desired combat circle
            const desired = 280 + this.skill * 80;
            const radial = dist - desired;
            const nx = dx / dist;
            const ny = dy / dist;

            // Radial force + tangential strafe force
            mx = nx * clamp(radial / 100, -1, 1) + -ny * this.strafeDir * 0.85;
            my = ny * clamp(radial / 100, -1, 1) + nx * this.strafeDir * 0.85;

            // Predictive aim leading based on target velocity
            const projSpeed =
                GAME_CONFIG.PROJECTILE.SPEED * (1000 / GAME_CONFIG.TICK_INTERVAL_MS) * 0.035;
            const lead = (dist / Math.max(100, projSpeed * 25)) * (0.5 + this.skill * 0.45);
            const ax = ox + target.body.velocity.x * lead * 15 - tx;
            const ay = oy + target.body.velocity.y * lead * 15 - ty;

            const now = Date.now() / 1000;
            const err =
                Math.sin(now * 2.6 + this.phase) * (0.22 - this.skill * 0.16) + rand(-0.025, 0.025);
            this.aimTarget = Math.atan2(ay, ax) + err;

            // Smooth turret rotation
            const diff = angDiff(this.tank.aimAngle, this.aimTarget);
            this.tank.aimAngle += diff * Math.min(1, 14 * dt);

            // Check if aim is on target for shooting
            const aimOk = Math.abs(diff) < 0.28;
            if (dist < GAME_CONFIG.BOT.VIEW_DISTANCE && aimOk && this.restT <= 0) {
                shooting = true;
                this.burstLeft--;
                if (this.burstLeft <= 0) {
                    this.burstLeft = 2 + Math.floor(this.skill * 3);
                    this.restT = rand(0.45, 1.1);
                }
            }
        } else {
            const arenaW = GAME_CONFIG.ARENA.width;
            const arenaH = GAME_CONFIG.ARENA.height;
            this.aimTarget = Math.atan2(
                arenaH / 2 - this.tank.body.position.y,
                arenaW / 2 - this.tank.body.position.x
            );
            this.tank.aimAngle += angDiff(this.tank.aimAngle, this.aimTarget) * Math.min(1, 8 * dt);
            shooting = false;
        }

        // 2. Arena Boundary Avoidance
        const margin = 180;
        const { width, height } = GAME_CONFIG.ARENA;
        const tx = this.tank.body.position.x;
        const ty = this.tank.body.position.y;

        if (tx < margin) mx += (margin - tx) / margin;
        if (tx > width - margin) mx -= (tx - (width - margin)) / margin;
        if (ty < margin) my += (margin - ty) / margin;
        if (ty > height - margin) my -= (ty - (height - margin)) / margin;

        // 3. Obstacle Avoidance (Repelling forces from all obstacles)
        for (const o of physics?.obstacles || []) {
            const ox = o.body.position.x;
            const oy = o.body.position.y;
            const odx = tx - ox;
            const ody = ty - oy;
            const od = Math.hypot(odx, ody);
            const safe = o.r + GAME_CONFIG.TANK.BODY_RADIUS + 60;

            if (od < safe && od > 0.01) {
                const push = (safe - od) / safe;
                mx += (odx / od) * push * 1.6;
                my += (ody / od) * push * 1.6;
            }
        }

        // Normalize movement intent
        let up = false;
        let down = false;
        let left = false;
        let right = false;

        if (mx > 0.25) right = true;
        if (mx < -0.25) left = true;
        if (my > 0.25) down = true;
        if (my < -0.25) up = true;

        return {
            up,
            down,
            left,
            right,
            aimAngle: this.tank.aimAngle,
            shooting,
            seq: 0,
        };
    }
}
