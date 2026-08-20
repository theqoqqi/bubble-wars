import { ImpactEffectExecutor } from './ImpactEffectExecutor.js';
import { SplashImpactHandler } from './handlers/index.js';

/**
 * Central bootstrap function for registering server-side impact handlers
 */
export function initEffects(executor: ImpactEffectExecutor): void {
    executor.register(new SplashImpactHandler());
}
