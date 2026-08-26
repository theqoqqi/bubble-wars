import { ArenaBounds, ColorDef } from './types.js';

export const COLOR_TO_HUE: Record<string, number> = {
    cyan: 192,
    coral: 326,
    lime: 130,
    violet: 280,
    amber: 42,
    bot: 350,
    gunmetal: 230,
    red: 355,
    slate: 215,
};

export const DEFAULT_BUBBLE_COLOR: ColorDef = {
    hue: 195,
    tint: 0.5,
};

export const KILL_VERBS = ['лопает', 'сдувает', 'распыляет', 'протыкает', 'смывает', 'взрывает'];

import botNamesJson from './data/botNames.json';

export interface BotDef {
    name: string;
    color: ColorDef;
    hue: number;
    skill: number;
    blueprintId: string;
}

export const BOT_NAMES: readonly string[] = botNamesJson;

export const BOT_BLUEPRINTS = ['classic', 'twin', 'sniper', 'shotgun', 'machinegun', 'heavy'];
export const BOT_HUES = [326, 48, 130, 280, 192, 15, 80, 160, 220, 260, 350];

export const BOT_DEFS: BotDef[] = BOT_NAMES.map((name, i) => {
    const hue = BOT_HUES[i % BOT_HUES.length];
    return {
        name,
        color: { hue },
        hue,
        skill: 0.7 + ((i * 7) % 25) / 100,
        blueprintId: BOT_BLUEPRINTS[i % BOT_BLUEPRINTS.length],
    };
});

export function getRandomBotName(excludeNames?: Set<string>): string {
    const availableNames =
        excludeNames && excludeNames.size < BOT_NAMES.length
            ? BOT_NAMES.filter((n) => !excludeNames.has(n))
            : BOT_NAMES;
    return availableNames[Math.floor(Math.random() * availableNames.length)];
}

export function getRandomBotDef(excludeNames?: Set<string>): BotDef {
    const name = getRandomBotName(excludeNames);
    const hue = BOT_HUES[Math.floor(Math.random() * BOT_HUES.length)];
    const blueprintId = BOT_BLUEPRINTS[Math.floor(Math.random() * BOT_BLUEPRINTS.length)];
    const skill = 0.65 + Math.random() * 0.28;

    return {
        name,
        color: { hue },
        hue,
        skill,
        blueprintId,
    };
}

export const GAME_CONFIG = {
    TICK_RATE: 40, // 40 FPS server tick
    TICK_INTERVAL_MS: 1000 / 40, // 25ms
    PHYSICS: {
        SUB_STEPS: 3,
    },

    ARENA: {
        radius: 1800,
        SPAWN_MARGIN: 300,
    } as ArenaBounds & { SPAWN_MARGIN: number },

    PLAYER: {
        RECONNECT_TIMEOUT_MS: 30000, // 30 секунд ожидания реконнекта игрока
    },

    MATCH: {
        DEFAULT_FRAG_LIMIT: 10,
        AUTO_RESET_DELAY_MS: 12000,
    },

    TANK: {
        BODY_RADIUS: 32,
        TURRET_RADIUS: 17,
        BARREL_BUBBLE_1_RADIUS: 8.5,
        BARREL_BUBBLE_2_RADIUS: 7,
        BARREL_LENGTH: 40,
        MAX_HP: 100,
        THRUST_FORCE: 0.022, // Balanced smooth acceleration
        MAX_SPEED: 18, // Controlled top speed
        LINEAR_DAMPING: 0.04, // Smooth soap drift
        RECOIL_RECOVERY_SPEED: 0.22,
        RESPAWN_DELAY_MS: 3000,
        INVULN_TIME_MS: 2200,
    },

    PROJECTILE: {
        RADIUS: 9,
        SPEED: 28, // Smooth visible projectile flight
        DAMAGE: 16,
        MAX_LIFETIME_MS: 2400,
        COOLDOWN_MS: 200,
        BOT_COOLDOWN_MS: 440,
        RECOIL_IMPULSE: 1.0,
    },

    BOT: {
        SPAWN_COUNT: 3, // Enable smart bots
        VIEW_DISTANCE: 850,
        ATTACK_DISTANCE: 420,
        MIN_DISTANCE: 200,
    },

    OBSTACLES: [
        { x: -750, y: -600, r: 220, hue: 210 },
        { x: 750, y: -600, r: 195, hue: 250 },
        { x: 0, y: 50, r: 285, hue: 225 },
        { x: -750, y: 700, r: 180, hue: 265 },
        { x: 750, y: 700, r: 235, hue: 200 },
        { x: 0, y: -950, r: 155, hue: 235 },
        { x: 0, y: 1000, r: 165, hue: 190 },
        { x: -1050, y: 50, r: 195, hue: 215 },
        { x: 1050, y: 50, r: 195, hue: 245 },
    ],

    COLORS: {
        cyan: { primary: '#00f0ff', secondary: '#0077ff', glow: '#00ffff' },
        coral: { primary: '#ff3366', secondary: '#ff6600', glow: '#ff0055' },
        lime: { primary: '#39ff14', secondary: '#00cc66', glow: '#66ff33' },
        violet: { primary: '#b026ff', secondary: '#6600cc', glow: '#d066ff' },
        amber: { primary: '#ffaa00', secondary: '#ff6600', glow: '#ffcc00' },
        bot: { primary: '#ff2a2a', secondary: '#880000', glow: '#ff4444' },
    } as Record<string, { primary: string; secondary: string; glow: string }>,
};
