import { DEFAULT_PROJECTILE_TYPES, projectileTypeRegistry } from './projectiles.js';
import { DEFAULT_GUN_TYPES, gunTypeRegistry } from './guns.js';
import { DEFAULT_TANK_BLUEPRINTS, tankBlueprintRegistry } from './tanks.js';

export * from './projectiles.js';
export * from './guns.js';
export * from './tanks.js';

/**
 * Register all default projectiles, weapons and tank blueprints into runtime registries
 */
export function initDefaultRegistries(): void {
    DEFAULT_PROJECTILE_TYPES.forEach((p) => projectileTypeRegistry.register(p));
    DEFAULT_GUN_TYPES.forEach((g) => gunTypeRegistry.register(g));
    DEFAULT_TANK_BLUEPRINTS.forEach((t) => tankBlueprintRegistry.register(t));
}

// Auto-initialize default registries
initDefaultRegistries();
