import Matter from 'matter-js';
import { SplashImpactEffect, SplashImpactEvent } from '@bubble-wars/shared';
import { ImpactHandler, ImpactContext } from '../ImpactEffectExecutor.js';

export class SplashImpactHandler extends ImpactHandler<SplashImpactEffect> {
    public readonly id = 'splash';

    public execute(effect: SplashImpactEffect, ctx: ImpactContext): void {
        const { x, y } = ctx.position;
        const radius = effect.radius;
        const damage = effect.damage;
        const pushForce = effect.pushForce ?? 0.04;
        const sourceTank = ctx.sourceTank;

        // 1. Broadcast impact event to all clients for rendering
        const impactEvent: SplashImpactEvent = {
            type: 'splash',
            x,
            y,
            radius,
            hue: effect.hue ?? 25,
        };
        ctx.game.addImpactEvent(impactEvent);

        // 2. Query all tanks in radius and apply splash damage & pushback force
        const allTanks = ctx.game.getAllTanks();
        for (const tank of allTanks) {
            if (tank.isDead) continue;
            if (sourceTank && tank.id === sourceTank.id) continue;

            // Расстояние от эпицентра взрыва до ближайшего края корпуса танка
            const edgeDistance = tank.getDistanceToPoint(x, y);

            if (edgeDistance <= radius) {
                // Спад урона от края корпуса к границе радиуса взрыва (от 100% до 50%)
                const falloff = 1 - (edgeDistance / radius) * 0.5;
                const appliedDamage = damage * falloff;

                tank.takeDamage(appliedDamage, sourceTank);

                // Направление импульса от эпицентра взрыва к центру танка
                const dx = tank.body.position.x - x;
                const dy = tank.body.position.y - y;
                const centerDist = Math.hypot(dx, dy);
                const angle = centerDist > 0.001 ? Math.atan2(dy, dx) : Math.random() * Math.PI * 2;

                tank.addWobble(angle, 0.4);

                // Физический импульс отталкивания с учетом спада
                const forceMagnitude = pushForce * (1 - edgeDistance / radius);
                const dirX = centerDist > 0.001 ? dx / centerDist : Math.cos(angle);
                const dirY = centerDist > 0.001 ? dy / centerDist : Math.sin(angle);

                Matter.Body.applyForce(tank.body, tank.body.position, {
                    x: dirX * forceMagnitude,
                    y: dirY * forceMagnitude,
                });
            }
        }
    }
}
