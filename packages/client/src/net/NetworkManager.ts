import {
    BubblePopEvent,
    ClientMessage,
    ColorDef,
    ErrorMessage,
    EventBus,
    GameOverMessage,
    HostChangedMessage,
    ImpactEvent,
    KillEventMessage,
    PlayerJoinedMessage,
    PlayerLeftMessage,
    PlayerInput,
    ProjectilesSpawnMessage,
    RoomConfigUpdateMessage,
    RoomConfigUpdatedMessage,
    RoomConfigEditingMessage,
    RoomConfigEditingStateMessage,
    RoomCreateMessage,
    RoomCreatedMessage,
    RoomJoinedMessage,
    RoomJoinMessage,
    RoomListMessage,
    RoomListRequestMessage,
    ServerMessage,
    TankDespawnMessage,
    TankSpawnMessage,
    WorldStateMessage,
} from '@bubble-wars/shared';

export interface NetworkEvents {
    room_joined: RoomJoinedMessage;
    room_created: RoomCreatedMessage;
    room_list: RoomListMessage;
    room_config_updated: RoomConfigUpdatedMessage;
    room_config_editing_state: RoomConfigEditingStateMessage;
    host_changed: HostChangedMessage;
    error: ErrorMessage;
    world_state: WorldStateMessage;
    projectiles_spawn: ProjectilesSpawnMessage;
    player_joined: PlayerJoinedMessage;
    player_left: PlayerLeftMessage;
    tank_spawn: TankSpawnMessage;
    tank_despawn: TankDespawnMessage;
    bubble_pop: BubblePopEvent;
    kill: KillEventMessage;
    game_over: GameOverMessage;
    disconnect: void;
    impact: ImpactEvent;
}

export class NetworkManager extends EventBus<NetworkEvents> {
    private ws: WebSocket | null = null;
    public serverUrl: string;
    public playerId: string | null = null;
    public sessionToken: string | null = null;
    public roomId: string | null = null;
    public hostId: string | null = null;
    public latency: number = 0;
    public inboundKbps: number = 0;
    public avgPacketBytes: number = 0;
    public packetsPerSec: number = 0;
    public lastPacketBytes: number = 0;

    public get isHost(): boolean {
        return this.hostId !== null && this.hostId === this.playerId;
    }

    private bytesInWindow: number = 0;
    private packetsInWindow: number = 0;
    private lastStatsCalcTime: number = performance.now();
    private pingInterval: number | null = null;

    constructor() {
        super();
        this.serverUrl = this.resolveServerUrl();
        this.sessionToken = sessionStorage.getItem('bubble_session_token');
        this.roomId = sessionStorage.getItem('bubble_room_id');
    }

    public setServerUrl(url: string): void {
        let clean = url.trim();
        if (!clean.startsWith('ws://') && !clean.startsWith('wss://')) {
            const isHttps = window.location.protocol === 'https:';
            clean = `${isHttps ? 'wss://' : 'ws://'}${clean}`;
        }
        this.serverUrl = clean;
        localStorage.setItem('bubble_server_url', clean);
    }

    public resolveServerUrl(): string {
        // 1. URL Query param override (e.g. ?server=ws://123.45.67.89:3000 or ?server=wss://game.domain.com)
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const queryServer = urlParams.get('server');
            if (queryServer) {
                let clean = queryServer.trim();
                if (!clean.startsWith('ws://') && !clean.startsWith('wss://')) {
                    clean = `${window.location.protocol === 'https:' ? 'wss://' : 'ws://'}${clean}`;
                }
                localStorage.setItem('bubble_server_url', clean);
                return clean;
            }
        } catch {
            /* ignore */
        }

        // 2. LocalStorage override
        try {
            const saved = localStorage.getItem('bubble_server_url');
            if (saved) return saved;
        } catch {
            /* ignore */
        }

        // 3. Vite environment variable (VITE_WS_URL)
        const envUrl = (import.meta as any).env?.VITE_WS_URL;
        if (envUrl && typeof envUrl === 'string') {
            return envUrl.trim();
        }

        // 4. Smart host / protocol fallback
        const isHttps = window.location.protocol === 'https:';
        const proto = isHttps ? 'wss:' : 'ws:';
        const host = window.location.hostname || 'localhost';

        // If client is served from the same server / port or reverse proxy
        if (window.location.port === '3000' || (isHttps && !window.location.port)) {
            return `${proto}//${window.location.host}`;
        }

        return `${proto}//${host}:3000`;
    }

    public connect(): Promise<void> {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            try {
                console.log('[Network] Connecting to Bubble Wars Server:', this.serverUrl);
                this.ws = new WebSocket(this.serverUrl);

                this.ws.onopen = () => {
                    console.log('[Network] Successfully connected to:', this.serverUrl);
                    this.startPingLoop();
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    this.handleMessage(event.data);
                };

                this.ws.onclose = () => {
                    console.warn('[Network] Disconnected from server');
                    this.stopPingLoop();
                    this.emit('disconnect');
                };

                this.ws.onerror = (err) => {
                    console.error('[Network] WebSocket error on', this.serverUrl, err);
                    reject(err);
                };
            } catch (e) {
                reject(e);
            }
        });
    }

    public isConnected(): boolean {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }

    public disconnect(): void {
        this.stopPingLoop();
        if (this.ws) {
            try {
                this.ws.close();
            } catch {
                /* ignore */
            }
            this.ws = null;
        }
        this.playerId = null;
        this.hostId = null;
    }

    public clearSession(): void {
        this.sessionToken = null;
        this.roomId = null;
        this.hostId = null;
        sessionStorage.removeItem('bubble_session_token');
        sessionStorage.removeItem('bubble_room_id');
        sessionStorage.removeItem('bubble_game_active');
    }

    private handleMessage(dataStr: string): void {
        const rawBytes = typeof dataStr === 'string' ? dataStr.length : (dataStr as any).byteLength ?? 0;
        this.lastPacketBytes = rawBytes;
        this.bytesInWindow += rawBytes;
        this.packetsInWindow++;

        const now = performance.now();
        const elapsed = now - this.lastStatsCalcTime;
        if (elapsed >= 500) {
            this.inboundKbps = (this.bytesInWindow / 1024) / (elapsed / 1000);
            this.avgPacketBytes = this.packetsInWindow > 0 ? Math.round(this.bytesInWindow / this.packetsInWindow) : 0;
            this.packetsPerSec = Math.round(this.packetsInWindow / (elapsed / 1000));
            this.bytesInWindow = 0;
            this.packetsInWindow = 0;
            this.lastStatsCalcTime = now;
        }

        try {
            const msg: ServerMessage = JSON.parse(dataStr);

            switch (msg.type) {
                case 'room_joined': {
                    this.playerId = msg.playerId;
                    this.roomId = msg.roomId;
                    this.hostId = msg.hostId || null;
                    if (msg.sessionToken) {
                        this.sessionToken = msg.sessionToken;
                        sessionStorage.setItem('bubble_session_token', msg.sessionToken);
                        sessionStorage.setItem('bubble_room_id', msg.roomId);
                    }
                    this.emit('room_joined', msg);
                    break;
                }

                case 'room_created': {
                    this.emit('room_created', msg);
                    break;
                }

                case 'room_list': {
                    this.emit('room_list', msg);
                    break;
                }

                case 'room_config_updated': {
                    this.emit('room_config_updated', msg);
                    break;
                }

                case 'room_config_editing_state': {
                    this.emit('room_config_editing_state', msg);
                    break;
                }

                case 'host_changed': {
                    this.hostId = msg.hostId;
                    this.emit('host_changed', msg);
                    break;
                }

                case 'error': {
                    if (msg.code === 'room_not_found' || msg.code === 'room_full' || !msg.code) {
                        this.clearSession();
                    }
                    this.emit('error', msg);
                    break;
                }

                case 'world_state': {
                    this.emit('world_state', msg);
                    break;
                }

                case 'projectiles_spawn': {
                    this.emit('projectiles_spawn', msg);
                    break;
                }

                case 'player_joined': {
                    this.emit('player_joined', msg);
                    break;
                }

                case 'player_left': {
                    this.emit('player_left', msg);
                    break;
                }

                case 'tank_spawn': {
                    this.emit('tank_spawn', msg);
                    break;
                }

                case 'tank_despawn': {
                    this.emit('tank_despawn', msg);
                    break;
                }

                case 'bubble_pop': {
                    this.emit('bubble_pop', msg.event);
                    break;
                }

                case 'kill': {
                    this.emit('kill', msg);
                    break;
                }

                case 'game_over': {
                    this.emit('game_over', msg);
                    break;
                }

                case 'pong': {
                    this.latency = Math.max(0, Math.round((Date.now() - msg.clientTime) / 2));
                    break;
                }

                case 'impact': {
                    this.emit('impact', msg.event);
                    break;
                }
            }
        } catch (err) {
            console.error('[Network] Error parsing message:', err);
        }
    }

    public requestRoomList(): void {
        const msg: RoomListRequestMessage = {
            type: 'room_list',
        };
        this.sendMessage(msg);
    }

    public createRoom(name: string, options?: Partial<Omit<RoomCreateMessage, 'type' | 'name'>>): void {
        const msg: RoomCreateMessage = {
            type: 'room_create',
            name,
            ...options,
        };
        this.sendMessage(msg);
    }

    public updateRoomConfig(config: Partial<Omit<RoomConfigUpdateMessage, 'type'>>): void {
        const msg: RoomConfigUpdateMessage = {
            type: 'room_config_update',
            ...config,
        };
        this.sendMessage(msg);
    }

    public setConfigEditing(isEditing: boolean): void {
        const msg: RoomConfigEditingMessage = {
            type: 'room_config_editing',
            isEditing,
        };
        this.sendMessage(msg);
    }

    public join(
        name: string,
        color: ColorDef,
        blueprintId: string,
        roomId: string,
        sessionToken?: string | null
    ): void {
        const token = sessionToken || this.sessionToken;
        const msg: RoomJoinMessage = {
            type: 'room_join',
            name,
            roomId,
            color,
            blueprintId,
            ...(token ? { sessionToken: token } : {}),
        };
        this.sendMessage(msg);
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

    public rematch(): void {
        this.sendMessage({
            type: 'rematch',
        });
    }

    public leave(keepConnection: boolean = false): void {
        this.sendMessage({
            type: 'leave',
        });
        this.clearSession();
        if (!keepConnection) {
            this.disconnect();
        }
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
