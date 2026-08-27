import type { BounceBehavior, TargetType } from '@bubble-wars/shared';
import { ServerProjectileBehavior } from '../ServerProjectileBehavior.js';
import type { ServerProjectile } from '../../Projectile.js';
import type { BehaviorCollisionContext, CollisionResult } from '../types.js';

/**
 * Серверная реализация отскоков снаряда (Bounce)
 */
export class BounceServerBehavior extends ServerProjectileBehavior<BounceBehavior> {
    public readonly type = 'bounce';
    private bouncesLeft: number;
    private bounceFrom: Set<TargetType>;

    constructor(config: BounceBehavior) {
        super(config);
        this.bouncesLeft = config.bounces;
        this.bounceFrom = new Set(config.bounceFrom ?? ['map_boundary', 'obstacle']);
    }

    public onCollision(
        proj: ServerProjectile,
        ctx: BehaviorCollisionContext
    ): CollisionResult | null {
        if (this.bouncesLeft <= 0 || !this.bounceFrom.has(ctx.targetType)) {
            return null;
        }

        this.bouncesLeft--;
        return { preventDestroy: true, reflect: true };
    }
}
