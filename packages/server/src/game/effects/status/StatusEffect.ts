import type { ServerTank } from '../../ServerTank.js';

/**
 * Base abstract class for server-side status effects on tanks
 */
export abstract class StatusEffect {
    public abstract readonly id: string;
    public durationMs: number;
    public appliedAt: number;
    public sourceTankId?: string;

    constructor(durationMs: number, sourceTankId?: string) {
        this.durationMs = durationMs;
        this.appliedAt = Date.now();
        this.sourceTankId = sourceTankId;
    }

    // Lifecycle hooks
    public onApply(tank: ServerTank): void {}
    public onTick(tank: ServerTank, dt: number): void {}
    public onRemove(tank: ServerTank): void {}

    public onRefresh(tank: ServerTank, newEffect: this): void {
        this.durationMs = Math.max(this.durationMs, newEffect.durationMs);
        if (newEffect.sourceTankId) {
            this.sourceTankId = newEffect.sourceTankId;
        }
    }

    // Stat / Physics Modifiers
    public modifyThrust(tank: ServerTank, currentThrust: number): number {
        return currentThrust;
    }

    public modifyDamage(tank: ServerTank, incomingDamage: number): number {
        return incomingDamage;
    }
}
