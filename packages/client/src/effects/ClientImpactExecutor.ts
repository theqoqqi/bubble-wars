import { Registry, ImpactEvent } from '@bubble-wars/shared';
import { ClientImpactHandler, ClientImpactContext } from './ClientImpactHandler.js';

/**
 * Диспетчер исполнения клиентских обработчиков импактов на базе Registry
 */
export class ClientImpactExecutor {
    public readonly registry = new Registry<ClientImpactHandler<any>>('ClientImpactHandlerRegistry');

    public register(handler: ClientImpactHandler<any>): this {
        this.registry.register(handler);
        return this;
    }

    public execute(event: ImpactEvent | null | undefined, ctx: ClientImpactContext): void {
        if (!event || !event.type) return;

        const handler = this.registry.tryGet(event.type);
        if (handler) {
            handler.handle(event, ctx);
        }
    }
}
