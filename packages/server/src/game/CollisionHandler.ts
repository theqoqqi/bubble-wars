import Matter from 'matter-js';
import { BubblePopEvent, subPoints } from '@bubble-wars/shared';
import { ServerProjectile } from './Projectile.js';
import { ServerTank } from './ServerTank.js';
import { GameRoom } from './GameRoom.js';
import { ImpactEffectExecutor, ImpactTarget } from './effects/ImpactEffectExecutor.js';
import './matterTypes.js';

export interface CollisionContext {
    game: GameRoom;
    impactExecutor: ImpactEffectExecutor;
    findTankById(id: string): ServerTank | null;
    addPopEvent(event: BubblePopEvent): void;
    isMatchOver(): boolean;
}

interface ProcessProjectileHitOptions {
    target: ImpactTarget;
    popRadiusMultiplier?: number;
    position?: { x: number; y: number };
    beforeEffects?: (sourceTank: ServerTank | null) => void;
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
        const projPair = this.findPairByLabel(bodyA, bodyB, 'projectile');
        if (projPair) {
            this.handleProjectile(projPair[0], projPair[1]);
            return;
        }

        const tankPair = this.findPairByLabel(bodyA, bodyB, 'tank');
        if (tankPair) {
            this.handleTank(tankPair[0], tankPair[1]);
        }
    }

    private handleProjectile(projBody: Matter.Body, other: Matter.Body): void {
        const projectile = projBody.projectileInstance;
        if (!projectile || projectile.isDestroyed) {
            return;
        }

        if (other.label === 'tank' && other.tankInstance) {
            this.handleProjectileTank(projectile, other.tankInstance);
            return;
        }

        if (other.label === 'obstacle') {
            this.handleProjectileObstacle(projectile, other);
            return;
        }

        if (other.label === 'wall') {
            this.handleProjectileMapBoundary(projectile);
            return;
        }

        if (other.label === 'projectile') {
            this.handleProjectileProjectile(projBody, other);
            return;
        }
    }

    private handleTank(tankBody: Matter.Body, other: Matter.Body): void {
        if (other.label === 'obstacle') {
            this.handleTankObstacle(tankBody.tankInstance);
            return;
        }

        if (other.label === 'tank') {
            this.handleTankTank(tankBody.tankInstance, other.tankInstance);
            return;
        }
    }

    private handleProjectileProjectile(bodyA: Matter.Body, bodyB: Matter.Body): void {
        const projA = bodyA.projectileInstance;
        const projB = bodyB.projectileInstance;

        if (!projA || !projB || projA.isDestroyed || projB.isDestroyed || projA.ownerId === projB.ownerId) {
            return;
        }

        const impactPos = {
            x: (bodyA.position.x + bodyB.position.x) / 2,
            y: (bodyA.position.y + bodyB.position.y) / 2,
        };

        this.processProjectileHit(projA, {
            target: { type: 'projectile', projectile: projB },
            position: impactPos,
            popRadiusMultiplier: 1.8,
        });
        this.processProjectileHit(projB, {
            target: { type: 'projectile', projectile: projA },
            position: impactPos,
            popRadiusMultiplier: 1.8,
        });
    }

    private handleProjectileTank(projectile: ServerProjectile, tank: ServerTank): void {
        if (this.context.isMatchOver() || !tank || tank.id === projectile.ownerId || tank.isDead) {
            return;
        }

        this.processProjectileHit(projectile, {
            target: { type: 'tank', tank },
            popRadiusMultiplier: 1.6,
            beforeEffects: (sourceTank) => {
                if (projectile.damage > 0) {
                    tank.takeDamage(projectile.damage, sourceTank);
                }
            },
        });
    }

    private handleProjectileObstacle(
        projectile: ServerProjectile,
        obstacleBody: Matter.Body
    ): void {
        Matter.Body.applyForce(obstacleBody, projectile.body.position, {
            x: projectile.body.velocity.x * 0.0006,
            y: projectile.body.velocity.y * 0.0006,
        });

        this.processProjectileHit(projectile, {
            target: {
                type: 'obstacle',
                body: obstacleBody,
                obstacleId: obstacleBody.id,
            },
            popRadiusMultiplier: 1.5,
        });
    }

    private handleProjectileMapBoundary(projectile: ServerProjectile): void {
        this.processProjectileHit(projectile, {
            target: { type: 'map_boundary' },
            popRadiusMultiplier: 1.4,
        });
    }

    private handleTankObstacle(tank?: ServerTank): void {
        tank?.addRandomWobble(0.18);
    }

    private handleTankTank(tankA?: ServerTank, tankB?: ServerTank): void {
        tankA?.addRandomWobble(0.22);
        tankB?.addRandomWobble(0.22);
    }

    /**
     * Централизованный конвейер попадания снаряда в любую цель
     */
    private processProjectileHit(
        projectile: ServerProjectile,
        options: ProcessProjectileHitOptions
    ): boolean {
        const { target } = options;
        const normal = this.getCollisionNormal(projectile, target);

        const result = projectile.behaviors.handleCollision(projectile, {
            targetType: target.type,
            target,
            normal,
        });

        if (result.skip) {
            return false;
        }

        if (result.reflect) {
            projectile.reflectVelocity(normal);
        }

        if (!result.preventDestroy) {
            projectile.isDestroyed = true;
        }

        const sourceTank = this.context.findTankById(projectile.ownerId);

        options.beforeEffects?.(sourceTank);

        if (!projectile.isDestroyed) {
            return true;
        }

        const position = options.position ?? {
            x: projectile.body.position.x,
            y: projectile.body.position.y,
        };

        this.context.impactExecutor.execute(projectile.onHit, {
            game: this.context.game,
            position,
            sourceTank,
            target,
        });

        const multiplier = options.popRadiusMultiplier ?? 1.5;
        this.emitPopEvent(projectile, position, multiplier);

        return true;
    }

    private getCollisionNormal(
        projectile: ServerProjectile,
        target: ImpactTarget
    ): { x: number; y: number } {
        switch (target.type) {
            case 'tank':
                return subPoints(projectile.body.position, target.tank.body.position);
            case 'obstacle':
                return subPoints(projectile.body.position, target.body.position);
            case 'projectile':
                return subPoints(projectile.body.position, target.projectile.body.position);
            case 'map_boundary':
                return {
                    x: -projectile.body.position.x,
                    y: -projectile.body.position.y,
                };
        }
    }

    private emitPopEvent(
        projectile: ServerProjectile,
        position: { x: number; y: number },
        radiusMultiplier: number
    ): void {
        this.context.addPopEvent({
            id: `${Date.now()}_${Math.random()}`,
            x: position.x,
            y: position.y,
            radius: projectile.radius * radiusMultiplier,
            hue: projectile.hue,
            color: projectile.color,
            isKill: false,
            projectileTypeId: projectile.projectileTypeId,
        });
    }

    private findPairByLabel(
        bodyA: Matter.Body,
        bodyB: Matter.Body,
        label: string
    ): [Matter.Body, Matter.Body] | null {
        if (bodyA.label === label) {
            return [bodyA, bodyB];
        }

        if (bodyB.label === label) {
            return [bodyB, bodyA];
        }

        return null;
    }
}
