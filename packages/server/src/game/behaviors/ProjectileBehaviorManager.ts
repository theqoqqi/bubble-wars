import type { ProjectileBehavior } from '@bubble-wars/shared';
import type { ServerProjectile } from '../Projectile.js';
import type { ServerProjectileBehavior } from './ServerProjectileBehavior.js';
import { ProjectileBehaviorFactory } from './ProjectileBehaviorFactory.js';
import type { BehaviorCollisionContext, BehaviorUpdateContext, CollisionResult } from './types.js';

export class ProjectileBehaviorManager {
    private behaviors: ServerProjectileBehavior[] = [];

    constructor(proj: ServerProjectile, configs?: ProjectileBehavior[]) {
        if (!configs || configs.length === 0) return;
        for (const cfg of configs) {
            const behavior = ProjectileBehaviorFactory.create(cfg);
            if (behavior) {
                this.behaviors.push(behavior);
            }
        }
    }

    public get hasBehaviors(): boolean {
        return this.behaviors.length > 0;
    }

    public onSpawn(proj: ServerProjectile): void {
        for (const b of this.behaviors) {
            b.onSpawn(proj);
        }
    }

    public onUpdate(proj: ServerProjectile, ctx: BehaviorUpdateContext): void {
        for (const b of this.behaviors) {
            b.onUpdate(proj, ctx);
        }
    }

    /**
     * Агрегирует результаты коллизий от всех поведений.
     * Логика: если ХОТЯ БЫ ОДНО поведение сказало preventDestroy — снаряд выживает.
     * Если хотя бы одно сказало skip — коллизия пропускается целиком.
     * Если ни одно поведение не ответило — возвращает пустой результат.
     */
    public handleCollision(
        proj: ServerProjectile,
        ctx: BehaviorCollisionContext
    ): CollisionResult {
        let skip = false;
        let preventDestroy = false;
        let reflect = false;

        for (const b of this.behaviors) {
            const result = b.onCollision(proj, ctx);
            if (!result) continue;
            if (result.skip) skip = true;
            if (result.preventDestroy) preventDestroy = true;
            if (result.reflect) reflect = true;
        }

        return { skip, preventDestroy, reflect };
    }

    public onDestroy(proj: ServerProjectile): void {
        for (const b of this.behaviors) {
            b.onDestroy(proj);
        }
    }
}
