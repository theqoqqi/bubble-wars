import { BaseProjectileBehavior } from './types.js';

/**
 * Конфигурация мыльной мины (Mine)
 */
export interface MineBehavior extends BaseProjectileBehavior {
    type: 'mine';
    armDelayMs?: number;    // Время до боевого взведения (по умолчанию: 600 мс)
    triggerRadius?: number; // Радиус срабатывания (по умолчанию: радиус самого пузыря)
}
