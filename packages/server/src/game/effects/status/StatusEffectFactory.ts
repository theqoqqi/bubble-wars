import type { StatusEffect } from './StatusEffect.js';
import type { ServerTank } from '../../ServerTank.js';

export type StatusEffectCreator = (
    durationMs: number,
    params: any,
    sourceTank: ServerTank | null
) => StatusEffect;

export class StatusEffectFactory {
    private static creators = new Map<string, StatusEffectCreator>();

    public static register(id: string, creator: StatusEffectCreator): void {
        this.creators.set(id, creator);
    }

    public static create(
        id: string,
        durationMs: number,
        params: any,
        sourceTank: ServerTank | null
    ): StatusEffect | null {
        const creator = this.creators.get(id);
        return creator ? creator(durationMs, params, sourceTank) : null;
    }

    public static clear(): void {
        this.creators.clear();
    }
}
