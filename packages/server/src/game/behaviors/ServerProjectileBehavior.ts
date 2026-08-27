import type { BaseProjectileBehavior, ProjectileBehavior } from '@bubble-wars/shared';
import type { ServerProjectile } from '../Projectile.js';
import type { BehaviorCollisionContext, BehaviorUpdateContext, CollisionResult } from './types.js';

export abstract class ServerProjectileBehavior<
    T extends BaseProjectileBehavior = ProjectileBehavior,
> {
    public abstract readonly type: string;

    constructor(public readonly config: T) {}

    /** Вызывается при создании снаряда */
    public onSpawn(proj: ServerProjectile): void {}

    /** Вызывается каждый физический тик (40 FPS) */
    public onUpdate(proj: ServerProjectile, ctx: BehaviorUpdateContext): void {}

    /** Вызывается при коллизии — возвращает решение о судьбе снаряда */
    public onCollision(
        proj: ServerProjectile,
        ctx: BehaviorCollisionContext
    ): CollisionResult | null {
        return null;
    }

    /** Вызывается при уничтожении снаряда */
    public onDestroy(proj: ServerProjectile): void {}
}
