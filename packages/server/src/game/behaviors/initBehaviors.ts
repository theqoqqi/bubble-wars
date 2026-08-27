import { ProjectileBehaviorFactory } from './ProjectileBehaviorFactory.js';
import { PierceServerBehavior } from './handlers/PierceServerBehavior.js';
import { BounceServerBehavior } from './handlers/BounceServerBehavior.js';
import { DecelerationServerBehavior } from './handlers/DecelerationServerBehavior.js';

/**
 * Централизованная точка регистрации серверных поведений снарядов
 */
export function initBehaviors(): void {
    ProjectileBehaviorFactory.register('pierce', (cfg) => new PierceServerBehavior(cfg));
    ProjectileBehaviorFactory.register('bounce', (cfg) => new BounceServerBehavior(cfg));
    ProjectileBehaviorFactory.register('deceleration', (cfg) => new DecelerationServerBehavior(cfg));
}
