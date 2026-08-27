import { TargetType } from '../types.js';
import { BaseProjectileBehavior } from './types.js';

/**
 * Конфигурация отскока (Bounce)
 */
export interface BounceBehavior extends BaseProjectileBehavior {
    type: 'bounce';
    bounces: number;           // Допустимое количество отскоков
    bounceFrom?: TargetType[]; // От каких объектов отскакивать (по умолчанию: ['map_boundary', 'obstacle'])
}
