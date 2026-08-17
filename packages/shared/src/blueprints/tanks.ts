import { Registry } from '../Registry.js';
import { TankBlueprint } from '../types.js';

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

export const TWIN_TANK_BLUEPRINT: TankBlueprint = {
    id: 'twin',
    name: 'Сдвоенный пузырь',
    maxHp: 105,
    thrustForce: 0.014,
    linearDamping: 0.042,
    body: {
        bubbles: [
            { id: 'b_main', radius: 28, offsetX: 0, offsetY: -20, color: { hue: 195, tint: 0.5 } },
            { id: 'b_sub', radius: 28, offsetX: 0, offsetY: 20, attachedTo: 'b_main', color: { hue: 195, tint: 0.5 } },
        ],
    },
    guns: [
        {
            id: 'g_left',
            attachedTo: 'b_main',
            gunTypeId: 'twin_cannon',
            offsetAngle: 0,
        },
        {
            id: 'g_right',
            attachedTo: 'b_sub',
            gunTypeId: 'twin_cannon',
            offsetAngle: 0,
        },
    ],
};

export const SNIPER_TANK_BLUEPRINT: TankBlueprint = {
    id: 'sniper',
    name: 'Мыльный снайпер',
    maxHp: 75,
    thrustForce: 0.018,
    linearDamping: 0.046,
    body: {
        bubbles: [{ id: 'b_0', radius: 28, offsetX: 0, offsetY: 0, color: { hue: 195, tint: 0.5 } }],
    },
    guns: [
        {
            id: 'g_0',
            attachedTo: 'b_0',
            gunTypeId: 'sniper',
            offsetAngle: 0,
        },
    ],
};

export const SHOTGUN_TANK_BLUEPRINT: TankBlueprint = {
    id: 'shotgun',
    name: 'Мыльный дробовик',
    maxHp: 125,
    thrustForce: 0.016,
    linearDamping: 0.042,
    body: {
        bubbles: [{ id: 'b_0', radius: 34, offsetX: 0, offsetY: 0, color: { hue: 195, tint: 0.5 } }],
    },
    guns: [
        {
            id: 'g_0',
            attachedTo: 'b_0',
            gunTypeId: 'shotgun',
            offsetAngle: 0,
        },
    ],
};

export const MACHINEGUN_TANK_BLUEPRINT: TankBlueprint = {
    id: 'machinegun',
    name: 'Пеномётчик',
    maxHp: 90,
    thrustForce: 0.015,
    linearDamping: 0.044,
    body: {
        bubbles: [{ id: 'b_0', radius: 30, offsetX: 0, offsetY: 0, color: { hue: 195, tint: 0.5 } }],
    },
    guns: [
        {
            id: 'g_0',
            attachedTo: 'b_0',
            gunTypeId: 'machinegun',
            offsetAngle: 0,
        },
    ],
};

export const HEAVY_TANK_BLUEPRINT: TankBlueprint = {
    id: 'heavy',
    name: 'Мыльный джаггернаут',
    maxHp: 160,
    thrustForce: 0.011,
    linearDamping: 0.048,
    body: {
        bubbles: [
            { id: 'b_center', radius: 34, offsetX: 0, offsetY: 0, color: { hue: 195, tint: 0.5 } },
            { id: 'b_left', radius: 22, offsetX: -12, offsetY: -26, attachedTo: 'b_center', color: { hue: 195, tint: 0.5 } },
            { id: 'b_right', radius: 22, offsetX: -12, offsetY: 26, attachedTo: 'b_center', color: { hue: 195, tint: 0.5 } },
        ],
    },
    guns: [
        {
            id: 'g_main',
            attachedTo: 'b_center',
            gunTypeId: 'heavy_mortar',
            offsetAngle: 0,
        },
    ],
};

export const DEFAULT_TANK_BLUEPRINTS: TankBlueprint[] = [
    CLASSIC_TANK_BLUEPRINT,
    TWIN_TANK_BLUEPRINT,
    SNIPER_TANK_BLUEPRINT,
    SHOTGUN_TANK_BLUEPRINT,
    MACHINEGUN_TANK_BLUEPRINT,
    HEAVY_TANK_BLUEPRINT,
];

export const tankBlueprintRegistry = new Registry<TankBlueprint>('TankBlueprintRegistry');
