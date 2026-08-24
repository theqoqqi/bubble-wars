import { ImpactEffectExecutor } from './ImpactEffectExecutor.js';
import { StatusEffectImpactHandler } from './handlers/StatusEffectImpactHandler.js';
import { SplashImpactHandler } from './handlers/index.js';
import { StatusEffectFactory } from './status/StatusEffectFactory.js';
import { SlowStatusEffect } from './status/SlowStatusEffect.js';

/**
 * Central bootstrap function for registering server-side impact handlers
 */
export function initEffects(executor: ImpactEffectExecutor): void {
    executor.register(new StatusEffectImpactHandler());
    executor.register(new SplashImpactHandler());

    StatusEffectFactory.register('slow', (durationMs, params, sourceTank) => {
        const intensity = typeof params?.intensity === 'number' ? params.intensity : 0.45;
        return new SlowStatusEffect(durationMs, intensity, sourceTank?.id);
    });
}
