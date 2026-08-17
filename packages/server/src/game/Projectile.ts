import Matter from 'matter-js';
import {
    COLOR_TO_HUE,
    GAME_CONFIG,
    ProjectileSnapshot,
    TankColor,
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
    public color: TankColor;
    public hue: number;
    public radius: number;
    public isDestroyed: boolean = false;

    constructor(
        ownerId: string,
        startX: number,
        startY: number,
        angle: number,
        color: TankColor,
        hue?: number
    ) {
        this.id = projectileIdCounter++;
        this.ownerId = ownerId;
        this.color = color;
        this.hue = hue ?? COLOR_TO_HUE[color] ?? 192;
        this.radius = GAME_CONFIG.PROJECTILE.RADIUS;
        this.spawnTime = Date.now();

        const speed = GAME_CONFIG.PROJECTILE.SPEED;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        this.body = Matter.Bodies.circle(startX, startY, this.radius, {
            restitution: 0.95,
            friction: 0.01,
            frictionAir: 0.003,
            density: 0.002,
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
        return now - this.spawnTime >= GAME_CONFIG.PROJECTILE.MAX_LIFETIME_MS;
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
        };
    }
}
