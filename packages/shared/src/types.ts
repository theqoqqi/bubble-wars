export interface PlayerInput {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
    aimAngle: number;
    shooting: boolean;
    seq: number;
}

export type TankColor = 'cyan' | 'coral' | 'lime' | 'violet' | 'amber' | 'bot';

export interface ObstacleSnapshot {
    id: number;
    x: number;
    y: number;
    r: number;
    hue: number;
}

export interface TankSnapshot {
    id: string;
    name: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    aimAngle: number;
    hp: number;
    maxHp: number;
    color: TankColor;
    hue: number;
    score: number;
    kills: number;
    deaths: number;
    isBot: boolean;
    isDead: boolean;
    recoil: number;
    invulnT: number;
    flash: number;
    wobbleS: number;
    wobbleA: number;
}

export interface ProjectileSnapshot {
    id: number;
    ownerId: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    r: number;
    hue: number;
    color: TankColor;
}

export interface BubblePopEvent {
    id: string;
    x: number;
    y: number;
    radius: number;
    hue: number;
    color: TankColor;
    isKill: boolean;
}

export interface ArenaBounds {
    width: number;
    height: number;
}

export interface LeaderboardEntry {
    id: string;
    name: string;
    score: number;
    kills: number;
    deaths: number;
    isBot: boolean;
    color: TankColor;
    hue: number;
}
