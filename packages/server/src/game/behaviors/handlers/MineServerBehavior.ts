import Matter from 'matter-js';
import type { MineBehavior } from '@bubble-wars/shared';
import { ServerProjectileBehavior } from '../ServerProjectileBehavior.js';
import type { ServerProjectile } from '../../Projectile.js';
import type { BehaviorCollisionContext, BehaviorUpdateContext, CollisionResult } from '../types.js';

/**
 * Серверная реализация мыльной мины (Mine)
 */
export class MineServerBehavior extends ServerProjectileBehavior<MineBehavior> {
    public readonly type = 'mine';
    private isArmed: boolean = false;
    private spawnTime: number = 0;
    private armDelayMs: number;
    private triggerRadius?: number;

    constructor(config: MineBehavior) {
        super(config);
        this.armDelayMs = config.armDelayMs ?? 600;
        this.triggerRadius = config.triggerRadius;
    }

    public onSpawn(proj: ServerProjectile): void {
        this.spawnTime = Date.now();
        this.isArmed = false;
    }

    public onUpdate(proj: ServerProjectile, ctx: BehaviorUpdateContext): void {
        // 1. Взведение мины в боевой режим по таймеру
        if (!this.isArmed && ctx.now - this.spawnTime >= this.armDelayMs) {
            this.isArmed = true;
        }

        // 2. Бесконтактный триггер по радиусу (если задан triggerRadius)
        if (this.isArmed && this.triggerRadius && this.triggerRadius > proj.radius) {
            const px = proj.body.position.x;
            const py = proj.body.position.y;

            for (const tank of ctx.allTanks) {
                if (tank.id === proj.ownerId || tank.isDead) continue;
                const dist = Math.hypot(tank.body.position.x - px, tank.body.position.y - py);
                if (dist <= this.triggerRadius) {
                    proj.isDestroyed = true;
                    break;
                }
            }
        }
    }

    public onCollision(
        proj: ServerProjectile,
        ctx: BehaviorCollisionContext
    ): CollisionResult | null {
        // Столкновение с танком
        if (ctx.targetType === 'tank' && ctx.target.type === 'tank') {
            const tankId = ctx.target.tank.id;

            // Владелец свободно проезжает сквозь свои мины
            if (tankId === proj.ownerId) {
                return { skip: true };
            }

            // Вражеский танк: взрывается только при боевом взведении
            if (this.isArmed) {
                return { preventDestroy: false };
            }

            // До взведения мина не детонирует при касании
            return { skip: true };
        }

        // Препятствия и стены арены: мина не лопается, а замирает рядом
        if (ctx.targetType === 'obstacle' || ctx.targetType === 'map_boundary') {
            Matter.Body.setVelocity(proj.body, { x: 0, y: 0 });
            return { preventDestroy: true };
        }

        return null;
    }
}
