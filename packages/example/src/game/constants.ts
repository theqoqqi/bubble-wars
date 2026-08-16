/* Баланс и константы мира (аналог packages/shared/constants.ts) */

export const BAL = {
  TANK_R: 30,
  TURRET_R: 16.5,
  BARREL_R: 8,
  PROJ_R: 9,
  PROJ_SPEED: 545,
  PROJ_LIFE: 1.5,
  PROJ_DMG: 13,
  FIRE_CD: 0.24,
  BOT_FIRE_CD: 0.55,
  ACCEL: 1550,
  MAX_SPEED: 278,
  HP: 100,
  FRAG_LIMIT: 7,
  MATCH_TIME: 180,
  RESPAWN: 3,
  INVULN: 2.2,
  RESTITUTION: 0.82,
  KNOCKBACK: 200,
} as const;

export const PLAYER_HUE = 192;

export const BOT_DEFS = [
  { name: 'Капитан Мыло', hue: 326, skill: 0.82 },
  { name: 'Пузырь-3000', hue: 48, skill: 0.66 },
  { name: 'Мисс Пена', hue: 130, skill: 0.95 },
] as const;

export const KILL_VERBS = ['лопает', 'сдувает', 'распыляет', 'протыкает', 'смывает'];

export const OBSTACLE_SPOTS: Array<{ fx: number; fy: number; fr: number; hue: number }> = [
  { fx: 0.24, fy: 0.3, fr: 0.075, hue: 210 },
  { fx: 0.76, fy: 0.3, fr: 0.065, hue: 250 },
  { fx: 0.5, fy: 0.52, fr: 0.095, hue: 225 },
  { fx: 0.24, fy: 0.74, fr: 0.06, hue: 265 },
  { fx: 0.76, fy: 0.74, fr: 0.078, hue: 200 },
  { fx: 0.5, fy: 0.16, fr: 0.05, hue: 235 },
  { fx: 0.5, fy: 0.86, fr: 0.052, hue: 190 },
];
