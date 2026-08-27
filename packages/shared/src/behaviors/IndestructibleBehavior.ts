import { BaseProjectileBehavior } from './types.js';
import { TargetType } from '../types.js';

/**
 * Конфигурация неуничтожимости снаряда (Indestructible)
 */
export interface IndestructibleBehavior extends BaseProjectileBehavior {
    type: 'indestructible';
    from?: TargetType[]; // Типы целей, при столкновении с которыми снаряд сохраняет жизнь (по умолчанию: ['projectile'])
}
