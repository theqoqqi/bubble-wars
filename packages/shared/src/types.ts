export interface PlayerInput {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
    aimAngle: number;
    shooting: boolean;
    seq: number;
}

export interface ColorDef {
    hue: number;
    tint?: number;
}

/**
 * Universal bubble definition for tank hulls, turrets, etc
 */
export interface BubbleDef {
    id: string;
    radius: number;
    offsetX: number;
    offsetY: number;
    attachedTo?: string;
    color?: ColorDef;
    zIndex?: number;
    stretch?: number;
    rotation?: number;
}

/**
 * Structure defining a composite body made of interconnected bubbles (tank hull, gun visual body, etc.)
 */
export interface BubbleBodyDef {
    bubbles: BubbleDef[];
}

/**
 * Tactical projectile / ammunition definition
 */
export interface ProjectileType {
    id: string;
    name: string;
    damage: number;
    speed: number;
    lifetime?: number;
    body: BubbleBodyDef;
}

/**
 * Weapon barrel slot configuration (fire point & shooting mechanics)
 */
export interface GunBarrelDef {
    id: string;
    offsetX: number;
    offsetY: number;
    length: number;
    width: number;
    projectileTypeId: string;
    cooldownMs: number;
    recoilRecoverySpeed: number;
    spreadAngle?: number;
    bulletsPerShot?: number;
}

/**
 * Weapon type specification (combines visual bubble body and firing barrels)
 */
export interface GunType {
    id: string;
    name: string;
    body: BubbleBodyDef;
    barrels: GunBarrelDef[];
}

/**
 * Mounting a gun onto a tank blueprint bubble slot
 */
export interface TankGunDef {
    id: string;
    attachedTo: string;
    gunTypeId: string;
    offsetAngle: number;
}

/**
 * Complete blueprint schema for assembling a tank
 */
export interface TankBlueprint {
    id: string;
    name: string;
    description?: string;
    maxHp: number;
    thrustForce: number;
    linearDamping: number;
    body: BubbleBodyDef;
    guns: TankGunDef[];
}

export interface GunBarrelSnapshot {
    id: string;
    recoil: number;
}

export interface GunSnapshot {
    id: string;
    barrels: GunBarrelSnapshot[];
}

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
    blueprintId: string;
    bodyAngle: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    aimAngle: number;
    hp: number;
    maxHp: number;
    color: ColorDef;
    hue: number;
    score: number;
    kills: number;
    deaths: number;
    isBot: boolean;
    isDead: boolean;
    recoil: number;
    guns: GunSnapshot[];
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
    color: ColorDef;
    projectileTypeId: string;
}

export interface BubblePopEvent {
    id: string;
    x: number;
    y: number;
    radius: number;
    hue: number;
    color: ColorDef;
    isKill: boolean;
}

export interface ArenaBounds {
    radius: number;
}

export interface LeaderboardEntry {
    id: string;
    name: string;
    score: number;
    kills: number;
    deaths: number;
    isBot: boolean;
    color: ColorDef;
    hue: number;
}
