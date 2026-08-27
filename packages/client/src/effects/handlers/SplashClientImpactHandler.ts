import { SplashImpactEvent } from '@bubble-wars/shared';
import { ClientImpactHandler, ClientImpactContext } from '../ClientImpactHandler.js';

export class SplashClientImpactHandler extends ClientImpactHandler<SplashImpactEvent> {
    public readonly id = 'splash';

    public handle(event: SplashImpactEvent, ctx: ClientImpactContext): void {
        const hue = event.hue ?? 25; // Огненно-оранжевый по умолчанию

        ctx.particleSystem.emitPop(event.x, event.y, event.radius, hue, true);
        ctx.soundFx.playExplosion(event.radius);
    }
}
