import { StatusEffect } from './StatusEffect.js';
import type { ServerTank } from '../../ServerTank.js';

/**
 * Статус замедления («Липкая пена»)
 * Снижает силу тяги и скорость передвижения танка
 */
export class SlowStatusEffect extends StatusEffect {
    public readonly id = 'slow';
    public slowFactor: number;

    constructor(durationMs: number, slowFactor: number = 0.45, sourceTankId?: string) {
        super(durationMs, sourceTankId);
        this.slowFactor = slowFactor;
    }

    public override modifyThrust(tank: ServerTank, currentThrust: number): number {
        return currentThrust * (1 - this.slowFactor);
    }

    public override onRefresh(tank: ServerTank, newEffect: this): void {
        super.onRefresh(tank, newEffect);
        this.slowFactor = Math.max(this.slowFactor, newEffect.slowFactor);
    }
}
