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
        shootSound: [
            { type: 'oscillator', wave: 'sine', fromFreq: 470, toFreq: 790, duration: 0.08, volume: 0.26 },
            { type: 'noise', freq: 3400, q: 1, duration: 0.03, volume: 0.1 },
        ],
        hitSound: [
            { type: 'oscillator', wave: 'triangle', fromFreq: 320, toFreq: 140, duration: 0.08, volume: 0.28 },
            { type: 'noise', freq: 2200, q: 1.2, duration: 0.04, volume: 0.15 },
        ],
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
        shootSound: [
            { type: 'oscillator', wave: 'sine', fromFreq: 520, toFreq: 820, duration: 0.06, volume: 0.12 },
            { type: 'noise', freq: 3200, q: 0.9, duration: 0.03, volume: 0.1 },
        ],
        hitSound: [
            { type: 'oscillator', wave: 'triangle', fromFreq: 360, toFreq: 160, duration: 0.06, volume: 0.2 },
            { type: 'noise', freq: 2400, q: 1.1, duration: 0.03, volume: 0.12 },
        ],
    },
    {
        id: 'piercing_bubble',
        name: 'Пронзающий мыльный снаряд',
        damage: 75,
        speed: 55,
        lifetime: 2200,
        body: {
            bubbles: [
                { id: 'core', offsetX: 0, offsetY: 0, radius: 6, stretch: 2, color: { hue: 28, tint: 0.9 } },
            ],
        },
        shootSound: [
            { type: 'oscillator', wave: 'sine', fromFreq: 880, toFreq: 220, duration: 0.14, volume: 0.38 },
            { type: 'noise', freq: 4500, q: 1.4, duration: 0.06, volume: 0.22 },
        ],
        hitSound: [
            { type: 'oscillator', wave: 'sine', fromFreq: 420, toFreq: 110, duration: 0.16, volume: 0.32 },
            { type: 'noise', freq: 10600, q: 4.8, duration: 0.44, volume: 0.28 },
            { type: 'oscillator', wave: 'triangle', fromFreq: 340, toFreq: 50, duration: 0.06, volume: 0.24 },
        ],
        behaviors: [
            { type: 'pierce', maxHits: 3 },
            { type: 'bounce', bounces: 3, bounceFrom: ['map_boundary', 'obstacle'] },
        ],
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
        shootSound: [
            { type: 'oscillator', wave: 'triangle', fromFreq: 320, toFreq: 90, duration: 0.1, volume: 0.06 },
            { type: 'noise', freq: 2800, q: 1.2, duration: 0.08, volume: 0.08 },
        ],
        hitSound: [
            { type: 'oscillator', wave: 'triangle', fromFreq: 280, toFreq: 120, duration: 0.06, volume: 0.08 },
            { type: 'noise', freq: 2000, q: 1.0, duration: 0.04, volume: 0.08 },
        ],
    },
    {
        id: 'foam_round',
        name: 'Пенная пуля',
        damage: 5,
        speed: 15,
        lifetime: 3000,
        body: {
            bubbles: [
                { id: 'core', offsetX: 0, offsetY: 0, radius: 7, color: { hue: 28, tint: 0.9 } },
            ],
        },
        shootSound: [
            { type: 'oscillator', wave: 'sine', fromFreq: 220, toFreq: 440, duration: 0.14, volume: 0.18 },
            { type: 'noise', freq: 3800, q: 0.8, duration: 0.02, volume: 0.08 },
        ],
        hitSound: [
            { type: 'oscillator', wave: 'sine', fromFreq: 80, toFreq: 20, duration: 0.05, volume: 0.0016 },
            { type: 'noise', freq: 100, q: 0.9, duration: 0.8, volume: 0.08 },
        ],
        onHit: [
            { type: 'status', effectId: 'slow', durationMs: 2200, intensity: 0.7 },
        ],
        onExpire: [],
    },
    {
        id: 'heavy_bubble',
        name: 'Тяжёлый мыльный пузырь',
        damage: 50,
        speed: 20,
        lifetime: 3500,
        body: {
            bubbles: [
                { id: 'core', offsetX: 0, offsetY: 0, radius: 18, color: { hue: 28, tint: 0.9 } },
            ],
        },
        shootSound: [
            { type: 'oscillator', wave: 'sine', fromFreq: 220, toFreq: 50, duration: 0.42, volume: 0.85 },
            { type: 'noise', freq: 1200, q: 1.2, duration: 0.12, volume: 0.35 },
        ],
        hitSound: [
            { type: 'oscillator', wave: 'sine', fromFreq: 200, toFreq: 40, duration: 0.32, volume: 0.65 },
            { type: 'noise', freq: 800, q: 1.3, duration: 0.18, volume: 0.35 },
        ],
        onHit: [
            { type: 'splash', radius: 140, damage: 35, pushForce: 0.035, hue: 28 },
        ],
        onExpire: [],
    },
    {
        id: 'popocalypse_charge',
        name: 'Чпококалиптический заряд',
        damage: 25,
        speed: 20,
        lifetime: 1000,
        body: {
            bubbles: [
                { id: 'core', offsetX: 0, offsetY: 0, radius: 26, color: { hue: 28, tint: 0.95 } },
                { id: 'front_bulb', offsetX: 16, offsetY: 0, radius: 16, color: { hue: 28, tint: 0.9 } },
                { id: 'rear_bulb', offsetX: -16, offsetY: 0, radius: 16, color: { hue: 28, tint: 0.9 } },
                { id: 'top_bulb', offsetX: 0, offsetY: -16, radius: 16, color: { hue: 28, tint: 0.9 } },
                { id: 'bot_bulb', offsetX: 0, offsetY: 16, radius: 16, color: { hue: 28, tint: 0.9 } },
                { id: 'diag_fl', offsetX: 14, offsetY: -14, radius: 12, color: { hue: 15, tint: 0.85 } },
                { id: 'diag_fr', offsetX: 14, offsetY: 14, radius: 12, color: { hue: 15, tint: 0.85 } },
                { id: 'diag_bl', offsetX: -14, offsetY: -14, radius: 12, color: { hue: 15, tint: 0.85 } },
                { id: 'diag_br', offsetX: -14, offsetY: 14, radius: 12, color: { hue: 15, tint: 0.85 } },
            ],
        },
        shootSound: [
            { type: 'oscillator', wave: 'sine', fromFreq: 260, toFreq: 35, duration: 0.35, volume: 1.0 },
            { type: 'oscillator', wave: 'triangle', fromFreq: 150, toFreq: 30, duration: 0.45, volume: 0.85 },
            { type: 'noise', freq: 500, q: 0.8, duration: 0.3, volume: 0.9 },
        ],
        hitSound: [
            { type: 'oscillator', wave: 'sine', fromFreq: 240, toFreq: 24, duration: 0.6, volume: 1.0 },
            { type: 'oscillator', wave: 'sawtooth', fromFreq: 125, toFreq: 20, duration: 0.45, volume: 0.8 },
            { type: 'noise', freq: 400, q: 0.7, duration: 0.55, volume: 0.95 },
        ],
        behaviors: [
            { type: 'deceleration', rate: 0.92 },
        ],
        onHit: [
            { type: 'splash', radius: 250, damage: 85, pushForce: 0.05, hue: 15 },
        ],
        onExpire: [
            { type: 'splash', radius: 250, damage: 85, pushForce: 0.05, hue: 15 },
        ],
    },
];

export const projectileTypeRegistry = new Registry<ProjectileType>('ProjectileTypeRegistry');
