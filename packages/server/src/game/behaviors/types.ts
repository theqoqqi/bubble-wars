import type { TargetType } from '@bubble-wars/shared';
import type { ImpactTarget } from '../effects/ImpactEffectExecutor.js';
import type { GameRoom } from '../GameRoom.js';
import type { ServerTank } from '../ServerTank.js';

export interface BehaviorCollisionContext {
    targetType: TargetType;
    target: ImpactTarget;
    normal: { x: number; y: number };
}

export interface BehaviorUpdateContext {
    game: GameRoom;
    dt: number;              // Дельта времени в секундах
    now: number;             // Date.now()
    allTanks: ServerTank[];
}

export interface CollisionResult {
    skip?: boolean;          // Пропустить коллизию целиком (без урона и эффектов)
    preventDestroy?: boolean; // Снаряд выживает
    reflect?: boolean;        // Отразить вектор скорости
}
