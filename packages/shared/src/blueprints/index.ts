import { Registry } from '../Registry.js';
import { GunType, ProjectileType, TankBlueprint } from '../types.js';

export const STANDARD_PROJECTILE_TYPE: ProjectileType = {
    id: 'standard_bubble',
    name: 'Стандартный мыльный снаряд',
    damage: 16,
    speed: 28,
    lifetime: 2400,
    body: {
        bubbles: [
            { id: 'core', offsetX: 0, offsetY: 0, radius: 9, color: { hue: 28, tint: 0.9 } },
        ],
    },
};

export const STANDARD_GUN_TYPE: GunType = {
    id: 'standard',
    name: 'Стандартный мыломёт',
    body: {
        bubbles: [
            { id: 'turret_base', offsetX: 0, offsetY: 0, radius: 17, color: { hue: 355, tint: 0.85 } },
            { id: 'barrel_mid', offsetX: 16, offsetY: 0, zIndex: 1, radius: 8.5, attachedTo: 'turret_base', color: { hue: 355, tint: 0.85 } },
            { id: 'barrel_tip', offsetX: 26, offsetY: 0, zIndex: 1, radius: 7, attachedTo: 'barrel_mid', color: { hue: 355, tint: 0.85 } },
        ],
    },
    barrels: [
        {
            id: 'barrel_0',
            offsetX: 0,
            offsetY: 0,
            length: 40,
            width: 7.5,
            projectileTypeId: 'standard_bubble',
            cooldownMs: 200,
            recoilRecoverySpeed: 0.22,
        },
    ],
};

export const CLASSIC_TANK_BLUEPRINT: TankBlueprint = {
    id: 'classic',
    name: 'Классический пузырь',
    maxHp: 100,
    thrustForce: 0.015,
    linearDamping: 0.042,
    body: {
        bubbles: [{ id: 'b_0', radius: 32, offsetX: 0, offsetY: 0, color: { hue: 195, tint: 0.5 } }],
    },
    guns: [
        {
            id: 'g_0',
            attachedTo: 'b_0',
            gunTypeId: 'standard',
            offsetAngle: 0,
        },
    ],
};

export const DEFAULT_PROJECTILE_TYPES: ProjectileType[] = [STANDARD_PROJECTILE_TYPE];
export const DEFAULT_GUN_TYPES: GunType[] = [STANDARD_GUN_TYPE];
export const DEFAULT_TANK_BLUEPRINTS: TankBlueprint[] = [CLASSIC_TANK_BLUEPRINT];

export const projectileTypeRegistry = new Registry<ProjectileType>('ProjectileTypeRegistry');
export const gunTypeRegistry = new Registry<GunType>('GunTypeRegistry');
export const tankBlueprintRegistry = new Registry<TankBlueprint>('TankBlueprintRegistry');

/**
 * Register all default projectiles, weapons and tank blueprints into runtime registries
 */
export function initDefaultRegistries(): void {
    projectileTypeRegistry.clear();
    gunTypeRegistry.clear();
    tankBlueprintRegistry.clear();

    DEFAULT_PROJECTILE_TYPES.forEach((p) => projectileTypeRegistry.register(p));
    DEFAULT_GUN_TYPES.forEach((g) => gunTypeRegistry.register(g));
    DEFAULT_TANK_BLUEPRINTS.forEach((t) => tankBlueprintRegistry.register(t));
}

// Auto-initialize default registries
initDefaultRegistries();
