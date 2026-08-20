import Matter from 'matter-js';
import {
    ColorDef,
    GAME_CONFIG,
    ImpactEffect,
    ProjectileSnapshot,
    ProjectileType,
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
    public onHit?: ImpactEffect[];
    public onExpire?: ImpactEffect[];
    public isDestroyed: boolean = false;
    public hitsLeft: number = 1;
    public hitTankIds: Set<string> = new Set();

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
        this.onHit = projectileType?.onHit;
        this.onExpire = projectileType?.onExpire;
        this.hitsLeft = projectileType?.maxHits ?? 1;
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
