import { ClientImpactExecutor } from './ClientImpactExecutor.js';
import { SplashClientImpactHandler } from './handlers/index.js';

/**
 * Централизованная точка регистрации всех клиентских обработчиков импактов
 */
export function initClientEffects(executor: ClientImpactExecutor): void {
    executor.register(new SplashClientImpactHandler());
}
