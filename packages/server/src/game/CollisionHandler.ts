import Matter from 'matter-js';
import { BubblePopEvent, subPoints } from '@bubble-wars/shared';
import { ServerProjectile } from './Projectile.js';
import { ServerTank } from './ServerTank.js';
import { GameRoom } from './GameRoom.js';
import { ImpactContext, ImpactEffectExecutor } from './effects/ImpactEffectExecutor.js';
import './matterTypes.js';

export interface CollisionContext {
    game: GameRoom;
    impactExecutor: ImpactEffectExecutor;
    findTankById(id: string): ServerTank | null;
    addPopEvent(event: BubblePopEvent): void;
    isMatchOver(): boolean;
}

export class CollisionHandler {
    constructor(private context: CollisionContext) {}

    public setup(engine: Matter.Engine): void {
        Matter.Events.on(engine, 'collisionStart', (event) => {
            for (const pair of event.pairs) {
                this.handlePair(pair.bodyA, pair.bodyB);
            }
        });
    }

    private handlePair(bodyA: Matter.Body, bodyB: Matter.Body): void {
        // 1. Projectile vs Projectile (destroy each other on impact)
        if (bodyA.label === 'projectile' && bodyB.label === 'projectile') {
            this.handleProjectileProjectile(bodyA, bodyB);
            return;
        }

        // 2. Identify projectile and other entity
        let projectileBody: Matter.Body | null = null;
        let otherBody: Matter.Body | null = null;

        if (bodyA.label === 'projectile') {
            projectileBody = bodyA;
            otherBody = bodyB;
        } else if (bodyB.label === 'projectile') {
            projectileBody = bodyB;
            otherBody = bodyA;
        }

        if (projectileBody && otherBody) {
            const projectile = projectileBody.projectileInstance;
            if (!projectile || projectile.isDestroyed) return;

            if (otherBody.label === 'tank') {
                const tank = otherBody.tankInstance;
                if (tank) {
                    this.handleProjectileTank(projectile, projectileBody, tank);
                }
            } else if (otherBody.label === 'obstacle') {
                this.handleProjectileObstacle(projectile, projectileBody, otherBody);
            } else if (otherBody.label === 'wall') {
                this.handleProjectileMapBoundary(projectile, projectileBody);
            }
            return;
        }

        // 3. Tank vs Obstacle or Tank vs Tank (trigger bubble wobbles)
        if (bodyA.label === 'tank' && bodyB.label === 'obstacle') {
            this.handleTankObstacle(bodyA.tankInstance);
        } else if (bodyB.label === 'tank' && bodyA.label === 'obstacle') {
            this.handleTankObstacle(bodyB.tankInstance);
        } else if (bodyA.label === 'tank' && bodyB.label === 'tank') {
            this.handleTankTank(bodyA.tankInstance, bodyB.tankInstance);
        }
    }

    private handleProjectileProjectile(bodyA: Matter.Body, bodyB: Matter.Body): void {
        const projA = bodyA.projectileInstance;
        const projB = bodyB.projectileInstance;
        if (projA && projB && !projA.isDestroyed && !projB.isDestroyed) {
            // Projectiles from the same player never destroy each other
            if (projA.ownerId === projB.ownerId) {
                return;
            }

            const normalA = subPoints(bodyA.position, bodyB.position);
            const normalB = subPoints(bodyB.position, bodyA.position);

            const resA = projA.behaviors.handleCollision(projA, {
                targetType: 'projectile',
                target: { type: 'projectile', projectile: projB },
                normal: normalA,
            });
            if (resA.reflect) projA.reflectVelocity(normalA);
            if (!resA.preventDestroy) projA.isDestroyed = true;

            const resB = projB.behaviors.handleCollision(projB, {
                targetType: 'projectile',
                target: { type: 'projectile', projectile: projA },
                normal: normalB,
            });
            if (resB.reflect) projB.reflectVelocity(normalB);
            if (!resB.preventDestroy) projB.isDestroyed = true;

            const midX = (bodyA.position.x + bodyB.position.x) / 2;
            const midY = (bodyA.position.y + bodyB.position.y) / 2;

            const ctxA: ImpactContext = {
                game: this.context.game,
                position: { x: midX, y: midY },
                sourceTank: this.context.findTankById(projA.ownerId),
                target: { type: 'projectile', projectile: projB },
            };
            const ctxB: ImpactContext = {
                game: this.context.game,
                position: { x: midX, y: midY },
                sourceTank: this.context.findTankById(projB.ownerId),
                target: { type: 'projectile', projectile: projA },
            };

            this.context.impactExecutor.execute(projA.onHit, ctxA);
            this.context.impactExecutor.execute(projB.onHit, ctxB);

            this.context.addPopEvent({
                id: `${Date.now()}_clash_${projA.id}`,
                x: midX,
                y: midY,
                radius: projA.radius * 1.8,
                hue: projA.hue,
                color: projA.color,
                isKill: false,
                projectileTypeId: projA.projectileTypeId,
            });
            this.context.addPopEvent({
                id: `${Date.now()}_clash_${projB.id}`,
                x: midX,
                y: midY,
                radius: projB.radius * 1.8,
                hue: projB.hue,
                color: projB.color,
                isKill: false,
                projectileTypeId: projB.projectileTypeId,
            });
        }
    }

    private handleProjectileTank(
        projectile: ServerProjectile,
        projectileBody: Matter.Body,
        tank: ServerTank
    ): void {
        if (this.context.isMatchOver()) return;
        if (!tank || tank.id === projectile.ownerId || tank.isDead) return;

        const normal = subPoints(projectileBody.position, tank.body.position);

        const collisionCtx = {
            targetType: 'tank' as const,
            target: { type: 'tank' as const, tank },
            normal,
        };
        const result = projectile.behaviors.handleCollision(projectile, collisionCtx);
        if (result.skip) return;
        if (result.reflect) projectile.reflectVelocity(normal);
        if (!result.preventDestroy) projectile.isDestroyed = true;

        const killer = this.context.findTankById(projectile.ownerId);

        const ctx: ImpactContext = {
            game: this.context.game,
            position: { x: projectileBody.position.x, y: projectileBody.position.y },
            sourceTank: killer,
            target: { type: 'tank', tank },
        };

        // 1. Direct projectile damage
        if (projectile.damage > 0) {
            tank.takeDamage(projectile.damage, killer);
        }

        // 2. onHit impact effects
        this.context.impactExecutor.execute(projectile.onHit, ctx);

        // Small pop effect for hit
        this.context.addPopEvent({
            id: `${Date.now()}_${Math.random()}`,
            x: projectileBody.position.x,
            y: projectileBody.position.y,
            radius: projectile.radius * 1.6,
            hue: projectile.hue,
            color: projectile.color,
            isKill: false,
            projectileTypeId: projectile.projectileTypeId,
        });
    }

    private handleProjectileObstacle(
        projectile: ServerProjectile,
        projectileBody: Matter.Body,
        obstacleBody: Matter.Body
    ): void {
        Matter.Body.applyForce(obstacleBody, projectileBody.position, {
            x: projectileBody.velocity.x * 0.0006,
            y: projectileBody.velocity.y * 0.0006,
        });

        const normal = subPoints(projectileBody.position, obstacleBody.position);

        const collisionCtx = {
            targetType: 'obstacle' as const,
            target: { type: 'obstacle' as const, body: obstacleBody, obstacleId: obstacleBody.id },
            normal,
        };
        const result = projectile.behaviors.handleCollision(projectile, collisionCtx);
        if (result.skip) return;
        if (result.reflect) projectile.reflectVelocity(normal);
        if (!result.preventDestroy) projectile.isDestroyed = true;

        const ctx: ImpactContext = {
            game: this.context.game,
            position: { x: projectileBody.position.x, y: projectileBody.position.y },
            sourceTank: this.context.findTankById(projectile.ownerId),
            target: { type: 'obstacle', body: obstacleBody, obstacleId: obstacleBody.id },
        };
        this.context.impactExecutor.execute(projectile.onHit, ctx);

        this.context.addPopEvent({
            id: `${Date.now()}_${Math.random()}`,
            x: projectileBody.position.x,
            y: projectileBody.position.y,
            radius: projectile.radius * 1.5,
            hue: projectile.hue,
            color: projectile.color,
            isKill: false,
            projectileTypeId: projectile.projectileTypeId,
        });
    }

    private handleProjectileMapBoundary(
        projectile: ServerProjectile,
        projectileBody: Matter.Body
    ): void {
        const normal = {
            x: -projectileBody.position.x,
            y: -projectileBody.position.y,
        };

        const collisionCtx = {
            targetType: 'map_boundary' as const,
            target: { type: 'map_boundary' as const },
            normal,
        };
        const result = projectile.behaviors.handleCollision(projectile, collisionCtx);
        if (result.skip) return;
        if (result.reflect) projectile.reflectVelocity(normal);
        if (!result.preventDestroy) projectile.isDestroyed = true;

        const ctx: ImpactContext = {
            game: this.context.game,
            position: { x: projectileBody.position.x, y: projectileBody.position.y },
            sourceTank: this.context.findTankById(projectile.ownerId),
            target: { type: 'map_boundary' },
        };
        this.context.impactExecutor.execute(projectile.onHit, ctx);

        this.context.addPopEvent({
            id: `${Date.now()}_${Math.random()}`,
            x: projectileBody.position.x,
            y: projectileBody.position.y,
            radius: projectile.radius * 1.4,
            hue: projectile.hue,
            color: projectile.color,
            isKill: false,
            projectileTypeId: projectile.projectileTypeId,
        });
    }

    private handleTankObstacle(tank?: ServerTank): void {
        if (tank) tank.addWobble(Math.random() * Math.PI * 2, 0.18);
    }

    private handleTankTank(tankA?: ServerTank, tankB?: ServerTank): void {
        if (tankA) tankA.addWobble(Math.random() * Math.PI * 2, 0.22);
        if (tankB) tankB.addWobble(Math.random() * Math.PI * 2, 0.22);
    }
}
