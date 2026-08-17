import Matter from 'matter-js';
import { BubblePopEvent, GAME_CONFIG, KILL_VERBS, ServerMessage } from '@bubble-wars/shared';
import { ServerProjectile } from './Projectile.js';
import { ServerTank } from './ServerTank.js';
import './matterTypes.js';

export interface CollisionContext {
  findTankById(id: string): ServerTank | null | undefined;
  addPopEvent(event: BubblePopEvent): void;
  broadcast(msg: ServerMessage): void;
  isMatchOver(): boolean;
  getFragLimit(): number;
  triggerGameOver(killer: ServerTank): void;
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
        this.handleProjectileWall(projectile, projectileBody);
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
      projA.isDestroyed = true;
      projB.isDestroyed = true;

      const midX = (bodyA.position.x + bodyB.position.x) / 2;
      const midY = (bodyA.position.y + bodyB.position.y) / 2;

      this.context.addPopEvent({
        id: `${Date.now()}_clash_${projA.id}`,
        x: midX,
        y: midY,
        radius: projA.radius * 1.8,
        hue: projA.hue,
        color: projA.color,
        isKill: false,
      });
      this.context.addPopEvent({
        id: `${Date.now()}_clash_${projB.id}`,
        x: midX,
        y: midY,
        radius: projB.radius * 1.8,
        hue: projB.hue,
        color: projB.color,
        isKill: false,
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

    projectile.isDestroyed = true;
    const killed = tank.takeDamage(GAME_CONFIG.PROJECTILE.DAMAGE);

    // Small pop effect for hit
    this.context.addPopEvent({
      id: `${Date.now()}_${Math.random()}`,
      x: projectileBody.position.x,
      y: projectileBody.position.y,
      radius: projectile.radius * 1.6,
      hue: projectile.hue,
      color: projectile.color,
      isKill: false,
    });

    if (killed) {
      const killer = this.context.findTankById(projectile.ownerId);
      if (killer) {
        killer.score += 100;
        killer.kills += 1;

        const verb = KILL_VERBS[Math.floor(Math.random() * KILL_VERBS.length)];
        this.context.broadcast({
          type: 'kill',
          killerName: killer.name,
          victimName: tank.name,
          killerColor: killer.color,
          victimColor: tank.color,
          killerHue: killer.hue,
          victimHue: tank.hue,
          verb,
        });

        if (!this.context.isMatchOver() && killer.kills >= this.context.getFragLimit()) {
          this.context.triggerGameOver(killer);
        }
      }

      // Big pop explosion on tank death
      this.context.addPopEvent({
        id: `${Date.now()}_kill_${tank.id}`,
        x: tank.body.position.x,
        y: tank.body.position.y,
        radius: GAME_CONFIG.TANK.BODY_RADIUS * 2.4,
        hue: tank.hue,
        color: tank.color,
        isKill: true,
      });
    }
  }

  private handleProjectileObstacle(
    projectile: ServerProjectile,
    projectileBody: Matter.Body,
    obstacleBody: Matter.Body
  ): void {
    projectile.isDestroyed = true;
    Matter.Body.applyForce(obstacleBody, projectileBody.position, {
      x: projectileBody.velocity.x * 0.0006,
      y: projectileBody.velocity.y * 0.0006,
    });
    this.context.addPopEvent({
      id: `${Date.now()}_${Math.random()}`,
      x: projectileBody.position.x,
      y: projectileBody.position.y,
      radius: projectile.radius * 1.5,
      hue: projectile.hue,
      color: projectile.color,
      isKill: false,
    });
  }

  private handleProjectileWall(projectile: ServerProjectile, projectileBody: Matter.Body): void {
    projectile.isDestroyed = true;
    this.context.addPopEvent({
      id: `${Date.now()}_${Math.random()}`,
      x: projectileBody.position.x,
      y: projectileBody.position.y,
      radius: projectile.radius * 1.4,
      hue: projectile.hue,
      color: projectile.color,
      isKill: false,
    });
  }

  private handleTankObstacle(tank: ServerTank | undefined): void {
    if (tank) tank.addWobble(Math.random() * Math.PI * 2, 0.18);
  }

  private handleTankTank(tankA: ServerTank | undefined, tankB: ServerTank | undefined): void {
    if (tankA) tankA.addWobble(Math.random() * Math.PI * 2, 0.22);
    if (tankB) tankB.addWobble(Math.random() * Math.PI * 2, 0.22);
  }
}
