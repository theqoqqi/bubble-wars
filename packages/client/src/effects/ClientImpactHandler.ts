import { Identifiable, ImpactEvent } from '@bubble-wars/shared';
import type { ParticleSystem } from '../graphics/ParticleSystem.js';
import type { SoundFx } from '../audio/SoundFx.js';

export interface ClientImpactContext {
    particleSystem: ParticleSystem;
    soundFx: SoundFx;
}

/**
 * Базовый абстрактный класс клиентского обработчика события импакта
 */
export abstract class ClientImpactHandler<T extends ImpactEvent = ImpactEvent> implements Identifiable {
    public abstract readonly id: string; // Должен совпадать с event.type (например, 'splash')
    public abstract handle(event: T, ctx: ClientImpactContext): void;
}
