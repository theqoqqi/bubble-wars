import type { ProjectileBehavior } from '@bubble-wars/shared';
import type { ServerProjectileBehavior } from './ServerProjectileBehavior.js';

export type BehaviorCreator = (config: any) => ServerProjectileBehavior;

export class ProjectileBehaviorFactory {
    private static creators = new Map<string, BehaviorCreator>();

    public static register(type: string, creator: BehaviorCreator): void {
        this.creators.set(type, creator);
    }

    public static create(config: ProjectileBehavior): ServerProjectileBehavior | null {
        const creator = this.creators.get(config.type);
        if (!creator) {
            console.warn(`[ProjectileBehaviorFactory] Не найден создатель для поведения типа: ${config.type}`);
            return null;
        }
        return creator(config);
    }
}
