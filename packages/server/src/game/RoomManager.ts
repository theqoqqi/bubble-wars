import { RoomConfig, RoomInfo } from '@bubble-wars/shared';
import { GameRoom } from './GameRoom.js';

export class RoomManager {
    private rooms: Map<string, GameRoom> = new Map();
    private defaultRoomId: string = 'default';
    private emptyRoomTimers: Map<string, number> = new Map();
    private gcInterval: NodeJS.Timeout | null = null;

    constructor() {
        this.getOrCreateDefaultRoom();
        this.startGc();
    }

    public generateRoomId(): string {
        return `room_${Math.random().toString(36).substring(2, 8)}`;
    }

    public getOrCreateDefaultRoom(): GameRoom {
        let room = this.rooms.get(this.defaultRoomId);
        if (!room) {
            room = new GameRoom(this.defaultRoomId, {
                name: 'Основная арена',
            });
            this.rooms.set(this.defaultRoomId, room);
        }
        return room;
    }

    public getDefaultRoom(): GameRoom {
        return this.getOrCreateDefaultRoom();
    }

    public createRoom(roomId?: string, config?: Partial<RoomConfig>): GameRoom {
        const finalId = roomId || this.generateRoomId();
        if (this.rooms.has(finalId)) {
            return this.rooms.get(finalId)!;
        }
        const room = new GameRoom(finalId, config);
        this.rooms.set(finalId, room);
        return room;
    }

    public getRoom(roomId: string): GameRoom | null {
        return this.rooms.get(roomId) || null;
    }

    public deleteRoom(roomId: string): boolean {
        if (roomId === this.defaultRoomId) {
            return false;
        }
        const room = this.rooms.get(roomId);
        if (room) {
            room.cleanup();
            this.rooms.delete(roomId);
            this.emptyRoomTimers.delete(roomId);
            return true;
        }
        return false;
    }

    public getAllRooms(): GameRoom[] {
        return Array.from(this.rooms.values());
    }

    public getPublicRoomInfos(): RoomInfo[] {
        return this.getAllRooms()
            .map((r) => r.getRoomInfo());
    }

    private startGc(): void {
        this.gcInterval = setInterval(() => {
            const now = Date.now();
            for (const [roomId, room] of this.rooms.entries()) {
                if (roomId === this.defaultRoomId) continue;

                if (room.isEmpty()) {
                    const emptySince = this.emptyRoomTimers.get(roomId);
                    if (!emptySince) {
                        this.emptyRoomTimers.set(roomId, now);
                    } else if (now - emptySince > 60000) {
                        console.log(`🧹 [RoomManager] Garbage collecting empty room: "${room.roomName}" (${roomId})`);
                        this.deleteRoom(roomId);
                    }
                } else {
                    this.emptyRoomTimers.delete(roomId);
                }
            }
        }, 15000);
    }

    public cleanup(): void {
        if (this.gcInterval) {
            clearInterval(this.gcInterval);
            this.gcInterval = null;
        }
        for (const room of this.rooms.values()) {
            room.cleanup();
        }
        this.rooms.clear();
        this.emptyRoomTimers.clear();
    }
}
