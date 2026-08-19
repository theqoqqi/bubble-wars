import Matter from 'matter-js';
import { GAME_CONFIG, ObstacleSnapshot, round1 } from '@bubble-wars/shared';
import './matterTypes.js';

export const COLLISION_CATEGORIES = {
    WALL: 0x0001,
    TANK: 0x0002,
    PROJECTILE: 0x0004,
    OBSTACLE: 0x0008,
};

export interface DynamicObstacle {
    body: Matter.Body;
    id: number;
    r: number;
    hue: number;
    homeX: number;
    homeY: number;
    driftAngle: number;
    driftSpeed: number;
    phase: number;
    time: number;
}

export class PhysicsWorld {
    public engine: Matter.Engine;
    public world: Matter.World;
    private walls: Matter.Body[] = [];
    public obstacles: DynamicObstacle[] = [];

    constructor() {
        this.engine = Matter.Engine.create({
            gravity: { x: 0, y: 0, scale: 0 },
            positionIterations: 8,
            velocityIterations: 8,
        });
        this.world = this.engine.world;
        this.createWalls();
        this.createObstacles();
    }

    private createWalls(): void {
        const { radius } = GAME_CONFIG.ARENA;
        const segmentsCount = 64;
        const angleStep = (Math.PI * 2) / segmentsCount;
        const chordLen = 2 * radius * Math.sin(angleStep / 2) * 1.08;
        const thickness = 160;

        const wallOpts: Matter.IBodyDefinition = {
            isStatic: true,
            restitution: 0.9,
            friction: 0.05,
            collisionFilter: {
                category: COLLISION_CATEGORIES.WALL,
                mask:
                    COLLISION_CATEGORIES.TANK |
                    COLLISION_CATEGORIES.PROJECTILE |
                    COLLISION_CATEGORIES.OBSTACLE,
            },
            label: 'wall',
        };

        this.walls = [];
        for (let i = 0; i < segmentsCount; i++) {
            const angle = i * angleStep;
            const distFromCenter = radius + thickness / 2;
            const x = Math.cos(angle) * distFromCenter;
            const y = Math.sin(angle) * distFromCenter;

            const segment = Matter.Bodies.rectangle(x, y, thickness, chordLen, {
                ...wallOpts,
                angle: angle,
            });
            this.walls.push(segment);
        }

        Matter.Composite.add(this.world, this.walls);
    }

    private createObstacles(): void {
        this.obstacles = GAME_CONFIG.OBSTACLES.map((spot, idx) => {
            const x = spot.x;
            const y = spot.y;
            const r = spot.r;

            const body = Matter.Bodies.circle(x, y, r, {
                isStatic: false, // Pushable dynamic obstacles!
                restitution: 0.85,
                friction: 0.02,
                frictionAir: 0.035, // Low water drag
                density: 0.007,
                collisionFilter: {
                    category: COLLISION_CATEGORIES.OBSTACLE,
                    mask:
                        COLLISION_CATEGORIES.TANK |
                        COLLISION_CATEGORIES.PROJECTILE |
                        COLLISION_CATEGORIES.OBSTACLE |
                        COLLISION_CATEGORIES.WALL,
                },
                label: 'obstacle',
            });

            body.obstacleData = { id: idx + 1, r, hue: spot.hue };
            Matter.Composite.add(this.world, body);

            return {
                body,
                id: idx + 1,
                r,
                hue: spot.hue,
                homeX: x,
                homeY: y,
                driftAngle: Math.random() * Math.PI * 2,
                driftSpeed: 1.2 + Math.random() * 1.6,
                phase: Math.random() * Math.PI * 2,
                time: Math.random() * 100,
            };
        });
    }

    public step(deltaMs: number): void {
        const dt = deltaMs / 1000;
        const { radius } = GAME_CONFIG.ARENA;
        const margin = 280;

        // Apply gentle wandering drift & arena repelling forces to migrating obstacles
        for (const o of this.obstacles) {
            o.time += dt;

            // 1. Sinusoidal current drift
            const wanderAngle = o.driftAngle + Math.sin(o.time * 0.35 + o.phase) * 1.2;
            let fx = Math.cos(wanderAngle) * o.driftSpeed * 0.00035 * o.body.mass;
            let fy = Math.sin(wanderAngle) * o.driftSpeed * 0.00035 * o.body.mass;

            // 2. Soft attraction to patrol sector (prevents all obstacles from clumping together)
            const dx = o.homeX - o.body.position.x;
            const dy = o.homeY - o.body.position.y;
            const distToHome = Math.hypot(dx, dy);
            if (distToHome > 220) {
                const pull = Math.min(0.0008, (distToHome - 220) * 0.000003) * o.body.mass;
                fx += (dx / distToHome) * pull;
                fy += (dy / distToHome) * pull;
            }

            // 3. Circular Wall avoidance (pushes bubbles back towards center (0,0))
            const px = o.body.position.x;
            const py = o.body.position.y;
            const distFromCenter = Math.hypot(px, py);
            const maxDist = radius - margin;

            if (distFromCenter > maxDist && distFromCenter > 0) {
                const push = ((distFromCenter - maxDist) / margin) * 0.0025 * o.body.mass;
                fx -= (px / distFromCenter) * push;
                fy -= (py / distFromCenter) * push;
            }

            Matter.Body.applyForce(o.body, o.body.position, { x: fx, y: fy });

            // 4. Softly dampen passive floating speed to keep motion graceful and fluid
            const speed = Math.hypot(o.body.velocity.x, o.body.velocity.y);
            const maxNormalSpeed = 4.0;
            if (speed > maxNormalSpeed) {
                const scale = (maxNormalSpeed + (speed - maxNormalSpeed) * 0.94) / speed;
                Matter.Body.setVelocity(o.body, {
                    x: o.body.velocity.x * scale,
                    y: o.body.velocity.y * scale,
                });
            }
        }

        Matter.Engine.update(this.engine, deltaMs);
    }

    public addBody(body: Matter.Body): void {
        Matter.Composite.add(this.world, body);
    }

    public removeBody(body: Matter.Body): void {
        Matter.Composite.remove(this.world, body);
    }

    public getObstacleSnapshots(): ObstacleSnapshot[] {
        return this.obstacles.map((o) => ({
            id: o.id,
            x: round1(o.body.position.x),
            y: round1(o.body.position.y),
            r: round1(o.r),
            hue: o.hue,
        }));
    }

    public getRandomSpawnPosition(margin: number = 240): { x: number; y: number } {
        const { radius } = GAME_CONFIG.ARENA;
        const maxSpawnRadius = Math.max(100, radius - margin);
        let attempts = 0;

        while (attempts < 30) {
            attempts++;
            const angle = Math.random() * Math.PI * 2;
            const r = Math.sqrt(Math.random()) * maxSpawnRadius;
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;

            let safe = true;
            for (const o of this.obstacles) {
                const dist = Math.hypot(x - o.body.position.x, y - o.body.position.y);
                if (dist < o.r + GAME_CONFIG.TANK.BODY_RADIUS + 80) {
                    safe = false;
                    break;
                }
            }

            if (safe) return { x, y };
        }

        return { x: 0, y: 0 };
    }
}
