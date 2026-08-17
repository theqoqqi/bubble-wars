import {
    ArenaBounds,
    BubblePopEvent,
    LeaderboardEntry,
    ObstacleSnapshot,
    PlayerInput,
    ProjectileSnapshot,
    TankColor,
    TankSnapshot,
} from './types.js';

// Client -> Server
export interface JoinMessage {
    type: 'join';
    name: string;
    color?: TankColor;
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

export type ClientMessage =
    JoinMessage | InputMessage | PingMessage | RespawnMessage | RematchMessage;

// Server -> Client
export interface WelcomeMessage {
    type: 'welcome';
    playerId: string;
    arena: ArenaBounds;
    obstacles: ObstacleSnapshot[];
    fragLimit: number;
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
    killerColor: TankColor;
    victimColor: TankColor;
    killerHue: number;
    victimHue: number;
    verb: string;
}

export interface GameOverMessage {
    type: 'game_over';
    winnerId: string;
    winnerName: string;
    winnerColor: TankColor;
    winnerHue: number;
    winnerIsBot: boolean;
    winnerKills: number;
    fragLimit: number;
    leaderboard: LeaderboardEntry[];
}

export type ServerMessage =
    | WelcomeMessage
    | WorldStateMessage
    | BubblePopMessage
    | PongMessage
    | KillEventMessage
    | GameOverMessage;
