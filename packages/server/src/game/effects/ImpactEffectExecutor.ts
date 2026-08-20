import Matter from 'matter-js';
import type { GameRoom } from '../GameRoom.js';
import type { ServerTank } from '../ServerTank.js';
import type { ServerProjectile } from '../Projectile.js';
import { BaseImpactEffect, Identifiable, ImpactEffect, Registry } from '@bubble-wars/shared';

/**
 * Дискриминированное объединение целей, в которые может попасть снаряд
 */
export type ImpactTarget =
    | { type: 'tank'; tank: ServerTank }
    | { type: 'obstacle'; body: Matter.Body; obstacleId?: number }
    | { type: 'map_boundary' }
    | { type: 'projectile'; projectile: ServerProjectile };

/**
 * Контекст выполнения эффектов попадания / детонации
 */
export interface ImpactContext {
    game: GameRoom;
    position: { x: number; y: number };
    sourceTank?: ServerTank;
    target?: ImpactTarget;
}

/**
 * Базовый абстрактный обработчик конкретного типа серверного эффекта
 */
export abstract class ImpactHandler<T extends BaseImpactEffect = ImpactEffect> implements Identifiable {
    public abstract readonly id: string;
    public abstract execute(effect: T, ctx: ImpactContext): void;
}

/**
 * Диспетчер исполнения массивов эффектов ImpactEffect с использованием общего Registry
 */
export class ImpactEffectExecutor {
    public readonly registry = new Registry<ImpactHandler<any>>('ImpactHandlerRegistry');

    public register(handler: ImpactHandler<any>): this {
        this.registry.register(handler);
        return this;
    }

    public execute(effects: ImpactEffect[] | null | undefined, ctx: ImpactContext): void {
        if (!effects || effects.length === 0) return;
        for (const effect of effects) {
            const handler = this.registry.tryGet(effect.type);
            if (handler) {
                handler.execute(effect, ctx);
            }
        }
    }
}
