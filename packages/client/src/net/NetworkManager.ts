import {
  BubblePopEvent,
  ClientMessage,
  KillEventMessage,
  LeaderboardEntry,
  PlayerInput,
  ServerMessage,
  TankColor,
  WelcomeMessage,
  WorldStateMessage,
} from '@bubble-wars/shared';

export class NetworkManager {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  public playerId: string | null = null;
  public latency: number = 0;
  private pingInterval: number | null = null;

  public onWelcomeCallback: ((data: WelcomeMessage) => void) | null = null;
  public onWorldStateCallback: ((data: WorldStateMessage) => void) | null = null;
  public onBubblePopCallback: ((event: BubblePopEvent) => void) | null = null;
  public onKillCallback: ((data: KillEventMessage) => void) | null = null;
  public onDisconnectCallback: (() => void) | null = null;

  constructor() {
    const host = window.location.hostname || 'localhost';
    this.serverUrl = `ws://${host}:3000`;
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.serverUrl);

        this.ws.onopen = () => {
          console.log('[Network] Connected to Bubble Wars Server:', this.serverUrl);
          this.startPingLoop();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onclose = () => {
          console.warn('[Network] Disconnected from server');
          this.stopPingLoop();
          if (this.onDisconnectCallback) this.onDisconnectCallback();
        };

        this.ws.onerror = (err) => {
          console.error('[Network] WebSocket error:', err);
          reject(err);
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  private handleMessage(dataStr: string): void {
    try {
      const msg: ServerMessage = JSON.parse(dataStr);

      switch (msg.type) {
        case 'welcome': {
          this.playerId = msg.playerId;
          if (this.onWelcomeCallback) this.onWelcomeCallback(msg);
          break;
        }

        case 'world_state': {
          if (this.onWorldStateCallback) this.onWorldStateCallback(msg);
          break;
        }

        case 'bubble_pop': {
          if (this.onBubblePopCallback) this.onBubblePopCallback(msg.event);
          break;
        }

        case 'kill': {
          if (this.onKillCallback) this.onKillCallback(msg);
          break;
        }

        case 'pong': {
          this.latency = Math.max(0, Math.round((Date.now() - msg.clientTime) / 2));
          break;
        }
      }
    } catch (err) {
      console.error('[Network] Error parsing message:', err);
    }
  }

  public join(name: string, color: TankColor): void {
    this.sendMessage({
      type: 'join',
      name,
      color,
    });
  }

  public sendInput(input: PlayerInput): void {
    this.sendMessage({
      type: 'input',
      input,
    });
  }

  public respawn(): void {
    this.sendMessage({
      type: 'respawn',
    });
  }

  private sendMessage(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private startPingLoop(): void {
    this.stopPingLoop();
    this.pingInterval = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendMessage({
          type: 'ping',
          clientTime: Date.now(),
        });
      }
    }, 1000);
  }

  private stopPingLoop(): void {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

export const networkManager = new NetworkManager();
