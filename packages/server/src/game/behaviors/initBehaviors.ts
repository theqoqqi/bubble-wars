import { ProjectileBehaviorFactory } from './ProjectileBehaviorFactory.js';
import { PierceServerBehavior } from './handlers/PierceServerBehavior.js';

/**
 * Централизованная точка регистрации серверных поведений снарядов
 */
export function initBehaviors(): void {
    ProjectileBehaviorFactory.register('pierce', (cfg) => new PierceServerBehavior(cfg));
}
