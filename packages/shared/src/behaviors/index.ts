export * from './types.js';
export * from './PierceBehavior.js';
export * from './BounceBehavior.js';
export * from './DecelerationBehavior.js';

import { PierceBehavior } from './PierceBehavior.js';
import { BounceBehavior } from './BounceBehavior.js';
import { DecelerationBehavior } from './DecelerationBehavior.js';

/**
 * Дискриминированное объединение всех поддерживаемых поведений снарядов
 */
export type ProjectileBehavior =
    | PierceBehavior
    | BounceBehavior
    | DecelerationBehavior;
