export * from './types.js';
export * from './StatusEffect.js';
export * from './SplashEffect.js';

import { StatusImpactEffect } from './StatusEffect.js';
import { SplashImpactEffect } from './SplashEffect.js';

/**
 * Дискриминированное объединение всех поддерживаемых серверных эффектов воздействия
 */
export type ImpactEffect = StatusImpactEffect | SplashImpactEffect;
