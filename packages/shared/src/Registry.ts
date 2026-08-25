export interface Identifiable {
    id: string;
}

/**
 * Universal type-safe runtime registry for game objects (GunType, AmmoType, TankBlueprint, etc.)
 */
export class Registry<T extends Identifiable> {
    private items = new Map<string, T>();

    constructor(public readonly name: string) {}

    public register(item: T): void {
        this.items.set(item.id, item);
    }

    public get(id: string): T {
        const item = this.items.get(id);
        if (!item) {
            throw new Error(`[${this.name}] Элемент с id '${id}' не найден в реестре`);
        }
        return item;
    }

    public tryGet(id: string): T | null {
        return this.items.get(id) ?? null;
    }

    public getAll(): T[] {
        return Array.from(this.items.values());
    }

    public has(id: string): boolean {
        return this.items.has(id);
    }

    public clear(): void {
        this.items.clear();
    }
}
