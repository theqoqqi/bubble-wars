import {BaseImpactEffect, ImpactEffect} from './effects/index.js';
import {BaseProjectileBehavior, ProjectileBehavior} from './behaviors/index.js';

import { Identifiable } from './Registry.js';

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

export interface PlayerInfo {
    id: string;
    name: string;
    blueprintId: string;
    color: ColorDef;
    hue: number;
    isBot: boolean;
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

export type TargetType = 'map_boundary' | 'obstacle' | 'tank' | 'projectile';

/**
 * Contract for registering status effect types in statusEffectRegistry
 */
export interface StatusEffectDef extends Identifiable {
    id: string;
    name: string;
    description?: string;
}

/**
 * Network snapshot of an active status effect on a tank
 */
export interface StatusSnapshot {
    id: string;
    remainingMs: number;
}

/**
 * Procedural Web Audio synthesis specifications
 */
export type SoundWaveType = 'sine' | 'triangle' | 'square' | 'sawtooth';

export interface BaseSoundLayer {
    duration: number;
    volume: number;
    delay?: number;
}

export interface OscillatorSoundLayer extends BaseSoundLayer {
    type: 'oscillator';
    wave: SoundWaveType;
    fromFreq: number;
    toFreq: number;
}

export interface NoiseSoundLayer extends BaseSoundLayer {
    type: 'noise';
    freq: number;
    q: number;
}

export type SoundLayerSpec = OscillatorSoundLayer | NoiseSoundLayer;
export type ProceduralSoundSpec = SoundLayerSpec[];

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
    behaviors?: ProjectileBehavior[];
    bounces?: number;
    bounceFrom?: TargetType[];
    onHit?: ImpactEffect[];
    onExpire?: ImpactEffect[];
    shootSound?: ProceduralSoundSpec;
    hitSound?: ProceduralSoundSpec;
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

export interface ObstacleSnapshot {
    id: number;
    x: number;
    y: number;
    r: number;
    hue: number;
}

export interface TankSpawnData {
    id: string;
    playerId: string;
    blueprintId: string;
    x: number;
    y: number;
    bodyAngle: number;
    hp: number;
    invulnT?: number;
}

export interface TankSnapshot {
    id: string;
    bodyAngle: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    aimAngle: number;
    hp: number;
    invulnT: number;
    flash: number;
    wobbleS: number;
    wobbleA: number;
    effects: StatusSnapshot[];
}

/**
 * Compact tuple representing dynamic projectile state: [id, x, y]
 */
export type ProjectileSnapshot = [
    id: number,
    x: number,
    y: number
];

export interface ProjectileSpawnData {
    id: number;
    ownerId: string;
    gunId?: string;
    barrelId?: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    hue: number;
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
    projectileTypeId?: string;
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
    assists: number;
    damageDealt: number;
    damageTaken: number;
    isBot: boolean;
    color: ColorDef;
    hue: number;
}
