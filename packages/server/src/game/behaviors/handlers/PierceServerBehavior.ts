import type { PierceBehavior } from '@bubble-wars/shared';
import { ServerProjectileBehavior } from '../ServerProjectileBehavior.js';
import type { ServerProjectile } from '../../Projectile.js';
import type { BehaviorCollisionContext, CollisionResult } from '../types.js';

/**
 * Серверная реализация пробивания снарядом танков насквозь (Pierce)
 */
export class PierceServerBehavior extends ServerProjectileBehavior<PierceBehavior> {
    public readonly type = 'pierce';
    private hitsLeft: number;
    private hitTankIds = new Set<string>();

    constructor(config: PierceBehavior) {
        super(config);
        this.hitsLeft = config.maxHits;
    }

    public onCollision(
        proj: ServerProjectile,
        ctx: BehaviorCollisionContext
    ): CollisionResult | null {
        if (ctx.targetType !== 'tank' || ctx.target.type !== 'tank') {
            return null;
        }

        const tankId = ctx.target.tank.id;

        // Если в этот танк уже попадали — пропускаем коллизию полностью
        if (this.hitTankIds.has(tankId)) {
            return { skip: true };
        }

        this.hitTankIds.add(tankId);
        this.hitsLeft--;

        // Пока остались доступные попадания — снаряд выживает
        return { preventDestroy: this.hitsLeft > 0 };
    }
}
