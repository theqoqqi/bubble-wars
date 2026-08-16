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

export type ClientMessage =
  | JoinMessage
  | InputMessage
  | PingMessage
  | RespawnMessage;

// Server -> Client
export interface WelcomeMessage {
  type: 'welcome';
  playerId: string;
  arena: ArenaBounds;
  obstacles: ObstacleSnapshot[];
}

export interface WorldStateMessage {
  type: 'world_state';
  tick: number;
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
  killerName: string;
  victimName: string;
  killerColor: TankColor;
  victimColor: TankColor;
  killerHue: number;
  victimHue: number;
  verb: string;
}

export type ServerMessage =
  | WelcomeMessage
  | WorldStateMessage
  | BubblePopMessage
  | PongMessage
  | KillEventMessage;
