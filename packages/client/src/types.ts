import { ColorDef, GunSnapshot } from '@bubble-wars/shared';

export interface ClientTankState {
    id: string;
    name: string;
    blueprintId: string;
    bodyAngle: number;
    targetBodyAngle: number;
    color: ColorDef;
    hue: number;
    isBot: boolean;
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    vx: number;
    vy: number;
    aimAngle: number;
    guns: GunSnapshot[];
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
    projectileTypeId: string;
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    vx: number;
    vy: number;
    r: number;
    hue: number;
    color: ColorDef;
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

export interface KillNotification {
    id: number;
    victimName: string;
    victimHue: number;
    timeRemaining: number;
    totalTime: number;
}
