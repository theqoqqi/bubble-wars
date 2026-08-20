import { ColorDef } from '../types.js';
import { BaseImpactEffect, ImpactEvent } from './types.js';

/**
 * Описание параметров взрыва по области (сплэш) на сервере
 */
export interface SplashImpactEffect extends BaseImpactEffect {
    type: 'splash';
    radius: number;
    damage: number;
    pushForce?: number;
    hue?: number;
}

/**
 * Сетевое событие взрыва по области для клиентской анимации и звука
 */
export interface SplashImpactEvent extends ImpactEvent {
    type: 'splash';
    radius: number;
    hue?: number;
    color?: ColorDef;
}
