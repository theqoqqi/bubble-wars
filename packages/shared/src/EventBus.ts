export type EventCallback<T> = T extends void ? () => void : (data: T) => void;

export class EventBus<Events extends Record<string, any>> {
    private listeners: { [K in keyof Events]?: Set<EventCallback<Events[K]>> } = {};

    public on<K extends keyof Events>(event: K, listener: EventCallback<Events[K]>): () => void {
        if (!this.listeners[event]) {
            this.listeners[event] = new Set();
        }
        this.listeners[event]!.add(listener);
        return () => this.off(event, listener);
    }

    public once<K extends keyof Events>(event: K, listener: EventCallback<Events[K]>): () => void {
        const wrapper = ((data?: any) => {
            this.off(event, wrapper as any);
            (listener as any)(data);
        }) as EventCallback<Events[K]>;

        return this.on(event, wrapper);
    }

    public off<K extends keyof Events>(event: K, listener: EventCallback<Events[K]>): void {
        const set = this.listeners[event];
        if (set) {
            set.delete(listener);
            if (set.size === 0) {
                delete this.listeners[event];
            }
        }
    }

    public emit<K extends keyof Events>(
        event: K,
        ...args: Events[K] extends void ? [] : [Events[K]]
    ): void {
        const set = this.listeners[event];
        if (set) {
            for (const listener of Array.from(set)) {
                try {
                    (listener as any)(args[0]);
                } catch (err) {
                    console.error(
                        `[EventBus] Error in listener for event "${String(event)}":`,
                        err
                    );
                }
            }
        }
    }

    public removeAllListeners<K extends keyof Events>(event?: K): void {
        if (event) {
            delete this.listeners[event];
        } else {
            this.listeners = {};
        }
    }
}
