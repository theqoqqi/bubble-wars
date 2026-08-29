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
export interface RoomJoinMessage {
    type: 'room_join';
    name: string;
    roomId: string;
    color?: ColorDef;
    blueprintId: string;
    sessionToken?: string;
}

export interface RoomCreateMessage {
    type: 'room_create';
    name: string;
    maxPlayers?: number;
    botCount?: number;
    fragLimit?: number;
}

export interface RoomListRequestMessage {
    type: 'room_list';
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

export interface RoomConfigUpdateMessage {
    type: 'room_config_update';
    name?: string;
    maxPlayers?: number;
    botCount?: number;
    fragLimit?: number;
}

export interface RoomConfigEditingMessage {
    type: 'room_config_editing';
    isEditing: boolean;
}

export type ClientMessage =
    | RoomJoinMessage
    | RoomCreateMessage
    | RoomListRequestMessage
    | RoomConfigUpdateMessage
    | RoomConfigEditingMessage
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
export interface RoomConfig {
    name?: string;
    maxPlayers?: number;
    botCount?: number;
    fragLimit?: number;
}

export interface RoomInfo {
    roomId: string;
    name: string;
    playerCount: number;
    maxPlayers: number;
    botCount: number;
    fragLimit: number;
    isMatchOver: boolean;
}

export interface RoomJoinedMessage {
    type: 'room_joined';
    playerId: string;
    sessionToken: string;
    roomId: string;
    hostId: string | null;
    roomName: string;
    maxPlayers: number;
    botCount: number;
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

export interface HostChangedMessage {
    type: 'host_changed';
    hostId: string | null;
    hostName?: string;
}

export interface RoomCreatedMessage {
    type: 'room_created';
    roomId: string;
    roomName: string;
}

export interface RoomConfigUpdatedMessage {
    type: 'room_config_updated';
    name: string;
    maxPlayers: number;
    botCount: number;
    fragLimit: number;
}

export interface RoomConfigEditingStateMessage {
    type: 'room_config_editing_state';
    isEditing: boolean;
}

export interface RoomListMessage {
    type: 'room_list';
    rooms: RoomInfo[];
}

export interface ErrorMessage {
    type: 'error';
    code: string;
    message: string;
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
    | RoomJoinedMessage
    | RoomCreatedMessage
    | RoomListMessage
    | RoomConfigUpdatedMessage
    | RoomConfigEditingStateMessage
    | HostChangedMessage
    | ErrorMessage
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
