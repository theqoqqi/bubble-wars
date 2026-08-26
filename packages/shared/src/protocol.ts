import {
    ArenaBounds,
    BubblePopEvent,
    ColorDef,
    LeaderboardEntry,
    ObstacleSnapshot,
    PlayerInfo,
    PlayerInput,
    ProjectileSnapshot,
    ProjectileSpawnData,
    TankSnapshot,
    TankSpawnData,
} from './types.js';
import { ImpactEvent } from './effects/index.js';

// Client -> Server
export interface JoinMessage {
    type: 'join';
    name: string;
    color?: ColorDef;
    blueprintId: string;
    sessionToken?: string;
}

export interface InputMessage {
    type: 'input';
    input: PlayerInput;
}

export interface PingMessage {
    type: 'ping';
    clientTime: number;
}

export interface RespawnMessage {
    type: 'respawn';
}

export interface RematchMessage {
    type: 'rematch';
}

export interface LeaveMessage {
    type: 'leave';
}

export type ClientMessage =
    | JoinMessage
    | InputMessage
    | PingMessage
    | RespawnMessage
    | RematchMessage
    | LeaveMessage;

export interface KillerInfo {
    name: string;
    hue: number;
    verb?: string;
}

// Server -> Client
export interface WelcomeMessage {
    type: 'welcome';
    playerId: string;
    sessionToken: string;
    reconnected?: boolean;
    arena: ArenaBounds;
    obstacles: ObstacleSnapshot[];
    fragLimit: number;
    players: PlayerInfo[];
    tanks: TankSpawnData[];
    isDead?: boolean;
    score?: number;
    killer?: KillerInfo | null;
}

export interface WorldStateMessage {
    type: 'world_state';
    tick: number;
    fragLimit: number;
    isMatchOver?: boolean;
    tanks: TankSnapshot[];
    projectiles: ProjectileSnapshot[];
    obstacles: ObstacleSnapshot[];
    leaderboard: LeaderboardEntry[];
}

export interface BubblePopMessage {
    type: 'bubble_pop';
    event: BubblePopEvent;
}

export interface PongMessage {
    type: 'pong';
    clientTime: number;
    serverTime: number;
}

export interface KillEventMessage {
    type: 'kill';
    killerId?: string;
    victimId?: string;
    killerName: string;
    victimName: string;
    killerColor: ColorDef;
    victimColor: ColorDef;
    killerHue: number;
    victimHue: number;
    verb: string;
}

export interface GameOverMessage {
    type: 'game_over';
    winnerId: string;
    winnerName: string;
    winnerColor: ColorDef;
    winnerHue: number;
    winnerIsBot: boolean;
    winnerKills: number;
    fragLimit: number;
    leaderboard: LeaderboardEntry[];
}

export interface ImpactMessage {
    type: 'impact';
    event: ImpactEvent;
}

export interface ProjectilesSpawnMessage {
    type: 'projectiles_spawn';
    projectiles: ProjectileSpawnData[];
}

export interface PlayerJoinedMessage {
    type: 'player_joined';
    player: PlayerInfo;
}

export interface PlayerLeftMessage {
    type: 'player_left';
    playerId: string;
}

export interface TankSpawnMessage {
    type: 'tank_spawn';
    tank: TankSpawnData;
}

export interface TankDespawnMessage {
    type: 'tank_despawn';
    tankId: string;
}

export type ServerMessage =
    | WelcomeMessage
    | WorldStateMessage
    | BubblePopMessage
    | PongMessage
    | KillEventMessage
    | GameOverMessage
    | ImpactMessage
    | ProjectilesSpawnMessage
    | PlayerJoinedMessage
    | PlayerLeftMessage
    | TankSpawnMessage
    | TankDespawnMessage;
