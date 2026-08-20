import type { ServerTank } from '../../ServerTank.js';
import { StatusEffect } from './StatusEffect.js';
import { StatusSnapshot } from '@bubble-wars/shared';

/**
 * Manager handling active status effects on a tank
 */
export class StatusEffectManager {
    private activeEffects = new Map<string, StatusEffect>();

    constructor(private tank: ServerTank) {}

    public add(effect: StatusEffect): void {
        const existing = this.activeEffects.get(effect.id);
        if (existing) {
            existing.onRefresh(this.tank, effect as any);
            return;
        }
        this.activeEffects.set(effect.id, effect);
        effect.onApply(this.tank);
    }

    public remove(effectId: string): void {
        const effect = this.activeEffects.get(effectId);
        if (effect) {
            effect.onRemove(this.tank);
            this.activeEffects.delete(effectId);
        }
    }

    /**
     * Clear all active effects (e.g. on tank death or respawn)
     */
    public clear(): void {
        for (const effect of this.activeEffects.values()) {
            effect.onRemove(this.tank);
        }
        this.activeEffects.clear();
    }

    public update(dt: number): void {
        for (const [id, effect] of this.activeEffects) {
            effect.durationMs -= dt * 1000;
            effect.onTick(this.tank, dt);

            if (effect.durationMs <= 0) {
                effect.onRemove(this.tank);
                this.activeEffects.delete(id);
            }
        }
    }

    public modifyThrust(baseThrust: number): number {
        let thrust = baseThrust;
        for (const effect of this.activeEffects.values()) {
            thrust = effect.modifyThrust(this.tank, thrust);
        }
        return thrust;
    }

    public modifyDamage(incomingDamage: number): number {
        let damage = incomingDamage;
        for (const effect of this.activeEffects.values()) {
            damage = effect.modifyDamage(this.tank, damage);
        }
        return damage;
    }

    /**
     * Network snapshot of active status effects.
     * Returns undefined if no active effects, saving JSON bandwidth.
     */
    public getSnapshots(): StatusSnapshot[] | undefined {
        if (this.activeEffects.size === 0) return undefined;
        return Array.from(this.activeEffects.values()).map((e) => ({
            id: e.id,
            remainingMs: Math.max(0, Math.round(e.durationMs)),
        }));
    }
}
