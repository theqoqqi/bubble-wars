import {
    getTankRootBubbleTransform,
    StatusSnapshot,
    tankBlueprintRegistry,
} from '@bubble-wars/shared';
import { ClientTankState } from '../../types.js';
import { ClientStatusContext, ClientStatusEffect } from '../ClientStatusEffect.js';
import { drawBubble, drawOrbitBubbles } from '../../graphics/render.js';

/**
 * Клиентский статус-эффект замедления («Липкая пена»)
 */
export class SlowClientStatusEffect extends ClientStatusEffect {
    public readonly id = 'slow';
    public readonly timerColor = '#5cd4ff';
    public readonly defaultDurationMs = 2200;

    public override onApply(
        tank: ClientTankState,
        _snapshot: StatusSnapshot,
        ctx: ClientStatusContext
    ): void {
        ctx.soundFx.playBubblePop(22);
        ctx.particleSystem.emitPop(tank.x, tank.y, 24, 195, false);
    }

    public override onRefresh(
        tank: ClientTankState,
        _snapshot: StatusSnapshot,
        ctx: ClientStatusContext
    ): void {
        ctx.particleSystem.emitPop(tank.x, tank.y, 14, 195, false);
    }

    public override renderWorldOverlay(
        ctx: CanvasRenderingContext2D,
        tank: ClientTankState,
        _snapshot: StatusSnapshot,
        gameTime: number
    ): void {
        const blueprint = tankBlueprintRegistry.get(tank.blueprintId);
        const { x, y, radius } = getTankRootBubbleTransform(tank, blueprint);

        // Отрисовка липких пенных пузырьков по периметру корневого пузыря
        drawOrbitBubbles(ctx, x, y, radius, gameTime, {
            count: 6,
            orbitOffset: 6,
            hue: 255,
            bubbleOpts: {
                glow: 0,
                tint: 0.7,
                rimAlpha: 0.9,
                fillAlpha: 0.8,
            },
        });
    }

    public override renderIcon(
        ctx: CanvasRenderingContext2D,
        cx: number,
        cy: number,
        radius: number,
        _snapshot: StatusSnapshot,
        _gameTime: number
    ): void {
        // Большой пузырёк
        const b1x = cx - 1.5;
        const b1y = cy + 1;
        const b1r = radius * 0.62;

        drawBubble(ctx, b1x, b1y, b1r, 195, {
            glow: 0,
            tint: 0.7,
            rimAlpha: 0.95,
            fillAlpha: 0.9,
        });

        // Маленький пузырёк
        const b2x = cx + radius * 0.45;
        const b2y = cy - radius * 0.45;
        const b2r = radius * 0.42;

        drawBubble(ctx, b2x, b2y, b2r, 195, {
            glow: 0,
            tint: 0.8,
            rimAlpha: 0.95,
            fillAlpha: 0.9,
        });
    }
}
