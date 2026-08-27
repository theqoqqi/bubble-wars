import { Registry } from '../Registry.js';
import { GunType } from '../types.js';

export const DEFAULT_GUN_TYPES: GunType[] = [
    {
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
    },
    {
        id: 'heavy_mortar',
        name: 'Тяжёлая мыльная мортира',
        body: {
            bubbles: [
                { id: 'turret_base', offsetX: 0, offsetY: 0, radius: 22, color: { hue: 355, tint: 0.85 } },
                { id: 'barrel_left_1', offsetX: 18, offsetY: -15, zIndex: 1, radius: 7, attachedTo: 'turret_base', color: { hue: 355, tint: 0.85 } },
                { id: 'barrel_left_2', offsetX: 27, offsetY: -14, zIndex: 1, radius: 6, attachedTo: 'barrel_left_1', color: { hue: 355, tint: 0.85 } },
                { id: 'barrel_left_3', offsetX: 36, offsetY: -13, zIndex: 1, radius: 5, attachedTo: 'barrel_left_2', color: { hue: 355, tint: 0.85 } },
                { id: 'barrel_right_1', offsetX: 18, offsetY: 15, zIndex: 1, radius: 7, attachedTo: 'turret_base', color: { hue: 355, tint: 0.85 } },
                { id: 'barrel_right_2', offsetX: 27, offsetY: 14, zIndex: 1, radius: 6, attachedTo: 'barrel_right_1', color: { hue: 355, tint: 0.85 } },
                { id: 'barrel_right_3', offsetX: 36, offsetY: 13, zIndex: 1, radius: 5, attachedTo: 'barrel_right_2', color: { hue: 355, tint: 0.85 } },
            ],
        },
        barrels: [
            {
                id: 'barrel_0',
                offsetX: 0,
                offsetY: 0,
                length: 44,
                width: 14,
                projectileTypeId: 'heavy_bubble',
                cooldownMs: 720,
                recoilRecoverySpeed: 0.08,
            },
        ],
    },
    {
        id: 'sniper',
        name: 'Трубка дальнего выдувания',
        body: {
            bubbles: [
                { id: 'turret_base', offsetX: 0, offsetY: 0, radius: 15, color: { hue: 355, tint: 0.85 } },
                { id: 'barrel_1', offsetX: 16, offsetY: 0, zIndex: 1, radius: 8, attachedTo: 'turret_base', color: { hue: 355, tint: 0.85 } },
                { id: 'barrel_2', offsetX: 27, offsetY: 0, zIndex: 1, radius: 5.5, attachedTo: 'barrel_1', color: { hue: 355, tint: 0.85 } },
                { id: 'barrel_3', offsetX: 36, offsetY: 0, zIndex: 1, radius: 4, attachedTo: 'barrel_2', color: { hue: 355, tint: 0.85 } },
            ],
        },
        barrels: [
            {
                id: 'barrel_0',
                offsetX: 0,
                offsetY: 0,
                length: 50,
                width: 6,
                projectileTypeId: 'piercing_bubble',
                cooldownMs: 900,
                recoilRecoverySpeed: 0.05,
            },
        ],
    },
    {
        id: 'shotgun',
        name: 'Мыльная картечь',
        body: {
            bubbles: [
                { id: 'turret_base', offsetX: 0, offsetY: 0, radius: 18, color: { hue: 355, tint: 0.85 } },
                { id: 'bell_1', offsetX: 13, offsetY: -12, zIndex: 1, radius: 4, attachedTo: 'turret_base', color: { hue: 355, tint: 0.85 } },
                { id: 'bell_2', offsetX: 16, offsetY: -6, zIndex: 2, radius: 4, attachedTo: 'turret_base', color: { hue: 355, tint: 0.85 } },
                { id: 'bell_3', offsetX: 17, offsetY: 0, zIndex: 3, radius: 4, attachedTo: 'turret_base', color: { hue: 355, tint: 0.85 } },
                { id: 'bell_4', offsetX: 16, offsetY: 6, zIndex: 2, radius: 4, attachedTo: 'turret_base', color: { hue: 355, tint: 0.85 } },
                { id: 'bell_5', offsetX: 13, offsetY: 12, zIndex: 1, radius: 4, attachedTo: 'turret_base', color: { hue: 355, tint: 0.85 } },
            ],
        },
        barrels: [
            {
                id: 'barrel_0',
                offsetX: 0,
                offsetY: 0,
                length: 28,
                width: 10,
                projectileTypeId: 'pellet',
                cooldownMs: 480,
                recoilRecoverySpeed: 0.12,
                spreadAngle: 0.52,
                bulletsPerShot: 7,
            },
        ],
    },
    {
        id: 'machinegun',
        name: 'Пеногенератор',
        body: {
            bubbles: [
                { id: 'turret_base', offsetX: 0, offsetY: 0, radius: 16, color: { hue: 355, tint: 0.85 } },
                { id: 'barrel_mid', offsetX: 16, offsetY: 0, zIndex: 1, radius: 8.5, attachedTo: 'turret_base', color: { hue: 355, tint: 0.85 } },
                { id: 'barrel_tip', offsetX: 26, offsetY: 0, zIndex: 1, radius: 5, attachedTo: 'barrel_mid', color: { hue: 355, tint: 0.85 } },
                { id: 'ammo_1', offsetX: 13, offsetY: 8, zIndex: 3, radius: 3, attachedTo: 'turret_base', color: { hue: 15, tint: 1 } },
                { id: 'ammo_2', offsetX: 10, offsetY: 12, zIndex: 2, radius: 3, attachedTo: 'turret_base', color: { hue: 15, tint: 1 } },
                { id: 'ammo_3', offsetX: 5, offsetY: 14, zIndex: 1, radius: 3, attachedTo: 'turret_base', color: { hue: 15, tint: 1 } },
            ],
        },
        barrels: [
            {
                id: 'barrel_0',
                offsetX: 0,
                offsetY: 0,
                length: 30,
                width: 7,
                projectileTypeId: 'foam_round',
                cooldownMs: 95,
                recoilRecoverySpeed: 0.18,
                spreadAngle: 0.12,
            },
        ],
    },
    {
        id: 'twin_cannon',
        name: 'Орудие спарки',
        body: {
            bubbles: [
                { id: 'turret_base', offsetX: 0, offsetY: 0, radius: 15, color: { hue: 355, tint: 0.85 } },
                { id: 'barrel_mid', offsetX: 14, offsetY: 0, zIndex: 1, radius: 7.5, attachedTo: 'turret_base', color: { hue: 355, tint: 0.85 } },
                { id: 'barrel_tip', offsetX: 23, offsetY: 0, zIndex: 1, radius: 6, attachedTo: 'barrel_mid', color: { hue: 355, tint: 0.85 } },
            ],
        },
        barrels: [
            {
                id: 'barrel_0',
                offsetX: 0,
                offsetY: 0,
                length: 36,
                width: 6.5,
                projectileTypeId: 'twin_bubble',
                cooldownMs: 250,
                recoilRecoverySpeed: 0.18,
            },
        ],
    },
    {
        id: 'dual_cannon',
        name: 'Сдвоенный мыломёт',
        body: {
            bubbles: [
                { id: 'turret_base', offsetX: 0, offsetY: 0, radius: 17, color: { hue: 355, tint: 0.85 } },
                { id: 'barrel_l1', offsetX: 10, offsetY: -6, radius: 7, attachedTo: 'turret_base', color: { hue: 355, tint: 0.85 } },
                { id: 'barrel_l2', offsetX: 20, offsetY: -6, radius: 6, attachedTo: 'barrel_l1', color: { hue: 355, tint: 0.85 } },
                { id: 'barrel_r1', offsetX: 10, offsetY: 6, radius: 7, attachedTo: 'turret_base', color: { hue: 355, tint: 0.85 } },
                { id: 'barrel_r2', offsetX: 20, offsetY: 6, radius: 6, attachedTo: 'barrel_r1', color: { hue: 355, tint: 0.85 } },
            ],
        },
        barrels: [
            {
                id: 'barrel_left',
                offsetX: 0,
                offsetY: -6,
                length: 36,
                width: 6.5,
                projectileTypeId: 'twin_bubble',
                cooldownMs: 250,
                recoilRecoverySpeed: 0.15,
            },
            {
                id: 'barrel_right',
                offsetX: 0,
                offsetY: 6,
                length: 36,
                width: 6.5,
                projectileTypeId: 'twin_bubble',
                cooldownMs: 250,
                recoilRecoverySpeed: 0.15,
            },
        ],
    },
    {
        id: 'popocalypse_launcher',
        name: 'Чпококалиптическая мортира',
        body: {
            bubbles: [
                { id: 'turret_base', offsetX: 0, offsetY: 0, radius: 25, color: { hue: 355, tint: 0.85 } },
                { id: 'breech_back', offsetX: -16, offsetY: 0, zIndex: 1, radius: 18, attachedTo: 'turret_base', color: { hue: 355, tint: 0.85 } },
                { id: 'pylon_l1', offsetX: -6, offsetY: -20, zIndex: 1, radius: 13, attachedTo: 'turret_base', color: { hue: 355, tint: 0.85 } },
                { id: 'pylon_l2', offsetX: 8, offsetY: -20, zIndex: 2, radius: 10, attachedTo: 'pylon_l1', color: { hue: 355, tint: 0.85 } },
                { id: 'pylon_r1', offsetX: -6, offsetY: 20, zIndex: 1, radius: 13, attachedTo: 'turret_base', color: { hue: 355, tint: 0.85 } },
                { id: 'pylon_r2', offsetX: 8, offsetY: 20, zIndex: 2, radius: 10, attachedTo: 'pylon_r1', color: { hue: 355, tint: 0.85 } },
                { id: 'barrel_core1', offsetX: 16, offsetY: 0, zIndex: 1, radius: 16, attachedTo: 'turret_base', color: { hue: 355, tint: 0.85 } },
                { id: 'barrel_core2', offsetX: 30, offsetY: 0, zIndex: 2, radius: 18, attachedTo: 'barrel_core1', color: { hue: 355, tint: 0.85 } },
                { id: 'barrel_muzzle', offsetX: 44, offsetY: 0, zIndex: 3, radius: 21, attachedTo: 'barrel_core2', color: { hue: 355, tint: 0.85 } },
                { id: 'barrel_crown_top', offsetX: 48, offsetY: -14, zIndex: 4, radius: 9, attachedTo: 'barrel_muzzle', color: { hue: 355, tint: 0.85 } },
                { id: 'barrel_crown_bot', offsetX: 48, offsetY: 14, zIndex: 4, radius: 9, attachedTo: 'barrel_muzzle', color: { hue: 355, tint: 0.85 } },
            ],
        },
        barrels: [
            {
                id: 'barrel_0',
                offsetX: 0,
                offsetY: 0,
                length: 52,
                width: 24,
                projectileTypeId: 'popocalypse_charge',
                cooldownMs: 950,
                recoilRecoverySpeed: 0.08,
            },
        ],
    },
];

export const gunTypeRegistry = new Registry<GunType>('GunTypeRegistry');
