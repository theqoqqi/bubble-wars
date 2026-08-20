export * from './types.js';
export * from './SplashEffect.js';

import { SplashImpactEffect } from './SplashEffect.js';

/**
 * Дискриминированное объединение всех поддерживаемых серверных эффектов воздействия
 */
export type ImpactEffect = SplashImpactEffect;
