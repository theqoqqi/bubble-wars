import { ImpactContext, ImpactHandler } from '../ImpactEffectExecutor.js';
import {StatusImpactEffect} from '@bubble-wars/shared';
import { StatusEffectFactory } from '../status/StatusEffectFactory.js';

/**
 * Generic core handler for impact effects of type 'status'.
 * Bridges ImpactEffectExecutor with StatusEffectFactory and StatusEffectManager.
 */
export class StatusEffectImpactHandler extends ImpactHandler<StatusImpactEffect> {
    public readonly id = 'status';

    public execute(effect: StatusImpactEffect, ctx: ImpactContext): void {
        if (ctx.target?.type !== 'tank') return;
        const instance = StatusEffectFactory.create(
            effect.effectId,
            effect.durationMs,
            effect,
            ctx.sourceTank
        );
        if (instance) {
            ctx.target.tank.statusEffects.add(instance);
        }
    }
}
