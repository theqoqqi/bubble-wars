export * from './types.js';
export * from './PierceBehavior.js';
export * from './BounceBehavior.js';

import { PierceBehavior } from './PierceBehavior.js';
import { BounceBehavior } from './BounceBehavior.js';

/**
 * Дискриминированное объединение всех поддерживаемых поведений снарядов
 */
export type ProjectileBehavior =
    | PierceBehavior
    | BounceBehavior;
