import { ImpactEffectExecutor } from './ImpactEffectExecutor.js';
import { StatusEffectImpactHandler } from './handlers/StatusEffectImpactHandler.js';
import { SplashImpactHandler } from './handlers/index.js';
import { StatusEffectFactory } from './status/StatusEffectFactory.js';

/**
 * Central bootstrap function for registering server-side impact handlers
 */
export function initEffects(executor: ImpactEffectExecutor): void {
    executor.register(new StatusEffectImpactHandler());
    executor.register(new SplashImpactHandler());
}
