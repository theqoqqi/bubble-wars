import { TankColor } from '@bubble-wars/shared';

export interface ClientTankState {
  id: string;
  name: string;
  color: TankColor;
  hue: number;
  isBot: boolean;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  aimAngle: number;
  hp: number;
  maxHp: number;
  isDead: boolean;
  score: number;
  kills: number;
  deaths: number;
  recoil: number;
  invulnT: number;
  flash: number;
  wobbleS: number;
  wobbleA: number;
  wobbleV: number;
}

export interface ClientProjectile {
  id: number;
  ownerId: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  r: number;
  hue: number;
  color: TankColor;
  trail: Array<{ x: number; y: number }>;
}

export interface ClientObstacle {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  r: number;
  hue: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  maxLife: number;
  hue: number;
  kind: 'drop' | 'ring' | 'spark';
}
