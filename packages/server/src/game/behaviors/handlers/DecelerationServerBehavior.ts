import Matter from 'matter-js';
import type { DecelerationBehavior } from '@bubble-wars/shared';
import { ServerProjectileBehavior } from '../ServerProjectileBehavior.js';
import type { ServerProjectile } from '../../Projectile.js';
import type { BehaviorUpdateContext } from '../types.js';

/**
 * Серверная реализация физического замедления снаряда в полёте (Deceleration)
 */
export class DecelerationServerBehavior extends ServerProjectileBehavior<DecelerationBehavior> {
    public readonly type = 'deceleration';
    private rate: number;
    private stopThreshold: number;

    constructor(config: DecelerationBehavior) {
        super(config);
        this.rate = config.rate ?? 0.90;
        this.stopThreshold = config.stopThreshold ?? 0.05;
    }

    public onUpdate(proj: ServerProjectile, ctx: BehaviorUpdateContext): void {
        const vx = proj.body.velocity.x;
        const vy = proj.body.velocity.y;
        const speed = Math.hypot(vx, vy);

        if (speed > this.stopThreshold) {
            const factor = Math.pow(this.rate, ctx.dt * 40);
            Matter.Body.setVelocity(proj.body, {
                x: vx * factor,
                y: vy * factor,
            });
        } else if (speed > 0) {
            Matter.Body.setVelocity(proj.body, { x: 0, y: 0 });
        }
    }
}
