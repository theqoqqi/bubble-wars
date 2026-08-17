import type { ServerTank } from './ServerTank.js';
import type { ServerProjectile } from './Projectile.js';

export interface ObstacleData {
  id: number;
  r: number;
  hue: number;
}

export type BodyLabel = 'tank' | 'projectile' | 'obstacle' | 'wall';

declare module 'matter-js' {
  interface Body {
    tankInstance?: ServerTank;
    projectileInstance?: ServerProjectile;
    obstacleData?: ObstacleData;
  }
}
