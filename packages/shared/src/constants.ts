import { ArenaBounds, TankColor } from './types.js';

export const COLOR_TO_HUE: Record<TankColor, number> = {
  cyan: 192,
  coral: 326,
  lime: 130,
  violet: 280,
  amber: 42,
  bot: 350,
};

export const KILL_VERBS = [
  'лопает',
  'сдувает',
  'распыляет',
  'протыкает',
  'смывает',
  'взрывает',
];

export const BOT_DEFS = [
  { name: 'Капитан Мыло', color: 'coral' as TankColor, hue: 326, skill: 0.85 },
  { name: 'Пузырь-3000', color: 'amber' as TankColor, hue: 48, skill: 0.70 },
  { name: 'Мисс Пена', color: 'lime' as TankColor, hue: 130, skill: 0.95 },
  { name: 'Гроза Пены', color: 'violet' as TankColor, hue: 280, skill: 0.80 },
];

export const GAME_CONFIG = {
  TICK_RATE: 40, // 40 FPS server tick
  TICK_INTERVAL_MS: 1000 / 40, // 25ms

  ARENA: {
    width: 2400,
    height: 1800,
    SPAWN_MARGIN: 300,
  } as ArenaBounds & { SPAWN_MARGIN: number },

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
    THRUST_FORCE: 0.038, // Fast, punchy acceleration
    MAX_SPEED: 32, // High top speed
    LINEAR_DAMPING: 0.035, // Smooth soap drift
    RECOIL_RECOVERY_SPEED: 0.22,
    RESPAWN_DELAY_MS: 3000,
    INVULN_TIME_MS: 2200,
  },

  PROJECTILE: {
    RADIUS: 9,
    SPEED: 42, // Fast projectiles to match agile tanks
    DAMAGE: 16,
    MAX_LIFETIME_MS: 1800,
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
    { fx: 0.24, fy: 0.30, fr: 0.075, hue: 210 },
    { fx: 0.76, fy: 0.30, fr: 0.065, hue: 250 },
    { fx: 0.50, fy: 0.52, fr: 0.095, hue: 225 },
    { fx: 0.24, fy: 0.74, fr: 0.060, hue: 265 },
    { fx: 0.76, fy: 0.74, fr: 0.078, hue: 200 },
    { fx: 0.50, fy: 0.18, fr: 0.052, hue: 235 },
    { fx: 0.50, fy: 0.84, fr: 0.055, hue: 190 },
    { fx: 0.15, fy: 0.52, fr: 0.065, hue: 215 },
    { fx: 0.85, fy: 0.52, fr: 0.065, hue: 245 },
  ],

  COLORS: {
    cyan: { primary: '#00f0ff', secondary: '#0077ff', glow: '#00ffff' },
    coral: { primary: '#ff3366', secondary: '#ff6600', glow: '#ff0055' },
    lime: { primary: '#39ff14', secondary: '#00cc66', glow: '#66ff33' },
    violet: { primary: '#b026ff', secondary: '#6600cc', glow: '#d066ff' },
    amber: { primary: '#ffaa00', secondary: '#ff6600', glow: '#ffcc00' },
    bot: { primary: '#ff2a2a', secondary: '#880000', glow: '#ff4444' },
  } as Record<TankColor, { primary: string; secondary: string; glow: string }>,
};

