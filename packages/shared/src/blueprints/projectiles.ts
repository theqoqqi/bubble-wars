import { Registry } from '../Registry.js';
import { ProjectileType } from '../types.js';

export const DEFAULT_PROJECTILE_TYPES: ProjectileType[] = [
    {
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
    },
    {
        id: 'twin_bubble',
        name: 'Сдвоенный мыльный снаряд',
        damage: 11,
        speed: 28,
        lifetime: 2400,
        body: {
            bubbles: [
                { id: 'core', offsetX: 0, offsetY: 0, radius: 8, color: { hue: 28, tint: 0.9 } },
            ],
        },
    },
    {
        id: 'piercing_bubble',
        name: 'Пронзающий мыльный снаряд',
        damage: 75,
        speed: 55,
        lifetime: 2200,
        body: {
            bubbles: [
                { id: 'core', offsetX: 0, offsetY: 0, radius: 10, color: { hue: 28, tint: 0.9 } },
            ],
        },
    },
    {
        id: 'pellet',
        name: 'Мыльная дробь',
        damage: 6,
        speed: 26,
        lifetime: 1400,
        body: {
            bubbles: [
                { id: 'core', offsetX: 0, offsetY: 0, radius: 5, color: { hue: 28, tint: 0.9 } },
            ],
        },
    },
    {
        id: 'foam_round',
        name: 'Пенная пуля',
        damage: 8,
        speed: 29,
        lifetime: 1600,
        body: {
            bubbles: [
                { id: 'core', offsetX: 0, offsetY: 0, radius: 7, color: { hue: 28, tint: 0.9 } },
            ],
        },
    },
    {
        id: 'heavy_bubble',
        name: 'Тяжёлый мыльный пузырь',
        damage: 58,
        speed: 20,
        lifetime: 3500,
        body: {
            bubbles: [
                { id: 'core', offsetX: 0, offsetY: 0, radius: 18, color: { hue: 28, tint: 0.9 } },
            ],
        },
    },
];

export const projectileTypeRegistry = new Registry<ProjectileType>('ProjectileTypeRegistry');
