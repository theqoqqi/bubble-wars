import { BaseImpactEffect } from './types.js';

/**
 * Описание параметров наложения статус-эффекта на танк
 */
export interface StatusImpactEffect extends BaseImpactEffect {
    type: 'status';
    effectId: string;
    durationMs: number;
    intensity?: number;
}
