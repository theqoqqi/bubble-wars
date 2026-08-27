import type { IndestructibleBehavior, TargetType } from '@bubble-wars/shared';
import { ServerProjectileBehavior } from '../ServerProjectileBehavior.js';
import type { ServerProjectile } from '../../Projectile.js';
import type { BehaviorCollisionContext, CollisionResult } from '../types.js';

/**
 * Серверная реализация неуничтожимости снаряда (Indestructible)
 */
export class IndestructibleServerBehavior extends ServerProjectileBehavior<IndestructibleBehavior> {
    public readonly type = 'indestructible';
    private from: TargetType[];

    constructor(config: IndestructibleBehavior) {
        super(config);
        this.from = config.from ?? ['projectile'];
    }

    public onCollision(
        _proj: ServerProjectile,
        ctx: BehaviorCollisionContext
    ): CollisionResult | null {
        if (this.from.includes(ctx.targetType)) {
            return { preventDestroy: true };
        }
        return null;
    }
}
