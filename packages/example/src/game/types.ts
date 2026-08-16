/* Общие контракты (аналог packages/shared) */

export interface PlayerInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  aimAngle: number;
  shooting: boolean;
  seq: number;
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
  isBot: boolean;
  hue: number;
  kills: number;
  deaths: number;
  alive: boolean;
}

export interface HudPlayer {
  id: string;
  name: string;
  hue: number;
  kills: number;
  deaths: number;
  isPlayer: boolean;
  alive: boolean;
  hp: number;
}

export interface HudSnapshot {
  timeLeft: number;
  suddenDeath: boolean;
  players: HudPlayer[];
  player: HudPlayer;
  fragLimit: number;
  respawnT: number;
  muted: boolean;
  running: boolean;
}

export interface KillMsg {
  id: number;
  killer: string;
  victim: string;
  killerHue: number;
  victimHue: number;
  verb: string;
  you: boolean;
}

export interface MatchStats {
  kills: number;
  deaths: number;
  accuracy: number;
  damage: number;
}

export interface MatchResult {
  winnerName: string;
  winnerIsPlayer: boolean;
  winnerHue: number;
  players: HudPlayer[];
  stats: MatchStats;
  reason: 'frags' | 'time';
}

export interface EngineCallbacks {
  onHud: (h: HudSnapshot) => void;
  onKill: (k: KillMsg) => void;
  onOver: (r: MatchResult) => void;
  onPauseRequest: () => void;
}
