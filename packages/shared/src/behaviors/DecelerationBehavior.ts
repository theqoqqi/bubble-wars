import { BaseProjectileBehavior } from './types.js';

/**
 * Конфигурация замедления снаряда в полёте (Deceleration)
 */
export interface DecelerationBehavior extends BaseProjectileBehavior {
    type: 'deceleration';
    rate?: number;           // Коэффициент замедления за физический тик (по умолчанию: 0.90)
    stopThreshold?: number;  // Порог скорости, ниже которого снаряд полностью останавливается (по умолчанию: 0.05)
}
