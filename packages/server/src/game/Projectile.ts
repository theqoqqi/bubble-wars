import Matter from 'matter-js';
import {
    ColorDef,
    GAME_CONFIG,
    ImpactEffect,
    ProjectileSnapshot,
    ProjectileType,
    TargetType,
    round1,
} from '@bubble-wars/shared';
import { COLLISION_CATEGORIES } from './PhysicsWorld.js';
import './matterTypes.js';

let projectileIdCounter = 1;

export class ServerProjectile {
    public id: number;
    public ownerId: string;
    public body: Matter.Body;
    public spawnTime: number;
    public color: ColorDef;
    public hue: number;
    public radius: number;
    public damage: number;
    public lifetimeMs: number;
    public projectileTypeId: string;
    public onHit: ImpactEffect[];
    public onExpire: ImpactEffect[];
    public isDestroyed: boolean = false;
    public hitsLeft: number = 1;
    public hitTankIds: Set<string> = new Set();
    public bouncesLeft: number = 0;
    public bounceFrom: Set<TargetType> = new Set();

    constructor(
        ownerId: string,
        startX: number,
        startY: number,
        angle: number,
        color: ColorDef,
        hue?: number,
        projectileType?: ProjectileType
    ) {
        this.id = projectileIdCounter++;
        this.ownerId = ownerId;
        this.projectileTypeId = projectileType?.id ?? 'standard_bubble';
        this.onHit = projectileType?.onHit ?? [];
        this.onExpire = projectileType?.onExpire ?? [];
        this.hitsLeft = projectileType?.maxHits ?? 1;
        this.bouncesLeft = projectileType?.bounces ?? 0;

        if (projectileType?.bounceFrom) {
            this.bounceFrom = new Set(projectileType.bounceFrom);
        } else if (this.bouncesLeft > 0) {
            this.bounceFrom = new Set(['map_boundary', 'obstacle']);
        }

        const primaryBubble = projectileType?.body?.bubbles?.[0];
        this.color = primaryBubble?.color ?? color;
        this.hue = hue ?? this.color.hue;
        this.radius = primaryBubble?.radius ?? GAME_CONFIG.PROJECTILE.RADIUS;
        this.damage = projectileType?.damage ?? GAME_CONFIG.PROJECTILE.DAMAGE;
        this.lifetimeMs = projectileType?.lifetime ?? GAME_CONFIG.PROJECTILE.MAX_LIFETIME_MS;
        this.spawnTime = Date.now();

        const speed = projectileType?.speed ?? GAME_CONFIG.PROJECTILE.SPEED;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        this.body = Matter.Bodies.circle(startX, startY, this.radius, {
            isSensor: true,
            frictionAir: 0,
            collisionFilter: {
                category: COLLISION_CATEGORIES.PROJECTILE,
                mask:
                    COLLISION_CATEGORIES.TANK |
                    COLLISION_CATEGORIES.WALL |
                    COLLISION_CATEGORIES.OBSTACLE |
                    COLLISION_CATEGORIES.PROJECTILE,
            },
            label: 'projectile',
        });

        this.body.projectileInstance = this;

        Matter.Body.setVelocity(this.body, { x: vx, y: vy });
    }

    public canBounceFrom(target: TargetType): boolean {
        return this.bouncesLeft > 0 && this.bounceFrom.has(target);
    }

    public reflectVelocity(normal: { x: number; y: number }): void {
        const len = Math.hypot(normal.x, normal.y);
        if (len < 0.0001) return;
        const nx = normal.x / len;
        const ny = normal.y / len;
        const vx = this.body.velocity.x;
        const vy = this.body.velocity.y;
        const dot = vx * nx + vy * ny;

        // Отражаем только если снаряд летит в сторону нормали (dot < 0)
        if (dot < 0) {
            const newVx = vx - 2 * dot * nx;
            const newVy = vy - 2 * dot * ny;
            Matter.Body.setVelocity(this.body, { x: newVx, y: newVy });
        }
    }

    public isExpired(now: number): boolean {
        return now - this.spawnTime >= this.lifetimeMs;
    }

    public toSnapshot(): ProjectileSnapshot {
        return {
            id: this.id,
            ownerId: this.ownerId,
            x: round1(this.body.position.x),
            y: round1(this.body.position.y),
            vx: round1(this.body.velocity.x),
            vy: round1(this.body.velocity.y),
            r: this.radius,
            hue: this.hue,
            color: this.color,
            projectileTypeId: this.projectileTypeId,
        };
    }
}
