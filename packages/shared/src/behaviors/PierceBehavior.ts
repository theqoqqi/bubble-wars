import { BaseProjectileBehavior } from './types.js';

/**
 * Конфигурация пробивания насквозь (Pierce)
 */
export interface PierceBehavior extends BaseProjectileBehavior {
    type: 'pierce';
    maxHits: number; // Сколько целей снаряд может поразить до уничтожения
}
