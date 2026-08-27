export * from './types.js';
export * from './PierceBehavior.js';

import { PierceBehavior } from './PierceBehavior.js';

/**
 * Дискриминированное объединение всех поддерживаемых поведений снарядов
 */
export type ProjectileBehavior = PierceBehavior;
