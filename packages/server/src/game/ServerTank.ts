import Matter from 'matter-js';
import { COLOR_TO_HUE, GAME_CONFIG, PlayerInput, TankColor, TankSnapshot } from '@bubble-wars/shared';
import { COLLISION_CATEGORIES } from './PhysicsWorld.js';
import { ServerProjectile } from './Projectile.js';

export class ServerTank {
  public id: string;
  public name: string;
  public color: TankColor;
  public hue: number;
  public isBot: boolean;
  public isDead: boolean = false;
  public score: number = 0;
  public kills: number = 0;
  public deaths: number = 0;

  public hp: number;
  public maxHp: number;
  public aimAngle: number = 0;
  public recoil: number = 0;
  public recoilV: number = 0;
  public lastShootTime: number = 0;
  public lastInputSeq: number = 0;
  public deathTime: number = 0;
  public invulnerableUntil: number = 0;

  public flash: number = 0;
  public wobbleS: number = 0;
  public wobbleA: number = 0;
  public wobbleV: number = 0;

  public body: Matter.Body;

  constructor(
    id: string,
    name: string,
    color: TankColor,
    x: number,
    y: number,
    isBot: boolean = false,
    hue?: number
  ) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.hue = hue ?? COLOR_TO_HUE[color] ?? 192;
    this.isBot = isBot;
    this.maxHp = GAME_CONFIG.TANK.MAX_HP;
    this.hp = this.maxHp;
    this.invulnerableUntil = Date.now() + GAME_CONFIG.TANK.INVULN_TIME_MS;

    const radius = GAME_CONFIG.TANK.BODY_RADIUS;
    this.body = Matter.Bodies.circle(x, y, radius, {
      restitution: 0.82, // Bouncy soap bubble
      friction: 0.02,
      frictionAir: GAME_CONFIG.TANK.LINEAR_DAMPING,
      density: 0.005,
      collisionFilter: {
        category: COLLISION_CATEGORIES.TANK,
        mask:
          COLLISION_CATEGORIES.TANK |
          COLLISION_CATEGORIES.WALL |
          COLLISION_CATEGORIES.PROJECTILE |
          COLLISION_CATEGORIES.OBSTACLE,
      },
      label: 'tank',
    });

    (this.body as any).tankInstance = this;
  }

  public applyInput(input: PlayerInput, now: number): ServerProjectile | null {
    if (this.isDead) return null;

    this.lastInputSeq = input.seq;
    this.aimAngle = input.aimAngle;

    // Movement force calculation
    let fx = 0;
    let fy = 0;
    if (input.up) fy -= 1;
    if (input.down) fy += 1;
    if (input.left) fx -= 1;
    if (input.right) fx += 1;

    if (fx !== 0 || fy !== 0) {
      const len = Math.hypot(fx, fy);
      const forceMag = GAME_CONFIG.TANK.THRUST_FORCE;
      const normalizedFx = (fx / len) * forceMag;
      const normalizedFy = (fy / len) * forceMag;

      Matter.Body.applyForce(this.body, this.body.position, { x: normalizedFx, y: normalizedFy });
    }

    // Clamp max velocity
    const maxSpeed = GAME_CONFIG.TANK.MAX_SPEED;
    const speed = Math.hypot(this.body.velocity.x, this.body.velocity.y);
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      Matter.Body.setVelocity(this.body, {
        x: this.body.velocity.x * scale,
        y: this.body.velocity.y * scale,
      });
    }

    // Shooting
    const cooldown = this.isBot ? GAME_CONFIG.PROJECTILE.BOT_COOLDOWN_MS : GAME_CONFIG.PROJECTILE.COOLDOWN_MS;
    if (input.shooting && now - this.lastShootTime >= cooldown) {
      this.lastShootTime = now;
      this.recoil = 1.0;
      this.recoilV = 180;

      const barrelLen = GAME_CONFIG.TANK.BARREL_LENGTH;
      const spawnX = this.body.position.x + Math.cos(this.aimAngle) * barrelLen;
      const spawnY = this.body.position.y + Math.sin(this.aimAngle) * barrelLen;

      // Apply recoil impulse to the tank
      const recoilImpulse = GAME_CONFIG.PROJECTILE.RECOIL_IMPULSE;
      Matter.Body.applyForce(this.body, this.body.position, {
        x: -Math.cos(this.aimAngle) * recoilImpulse * 0.008,
        y: -Math.sin(this.aimAngle) * recoilImpulse * 0.008,
      });

      return new ServerProjectile(this.id, spawnX, spawnY, this.aimAngle, this.color, this.hue);
    }

    return null;
  }

  public update(deltaMs: number): void {
    const dt = deltaMs / 1000;

    // Flash decay
    this.flash = Math.max(0, this.flash - dt * 3.2);

    // Spring wobble simulation
    this.wobbleV += (-this.wobbleS * 170 - this.wobbleV * 9) * dt;
    this.wobbleS = Math.max(-0.45, Math.min(0.45, this.wobbleS + this.wobbleV * dt));

    // Recoil recovery
    if (this.recoil > 0) {
      this.recoil = Math.max(0, this.recoil - GAME_CONFIG.TANK.RECOIL_RECOVERY_SPEED);
    }
  }

  public addWobble(angle: number, strength: number): void {
    this.wobbleS = Math.max(-0.45, Math.min(0.45, this.wobbleS + strength));
    this.wobbleA = angle;
    this.wobbleV += strength * 7;
  }

  public takeDamage(amount: number): boolean {
    if (this.isDead || Date.now() < this.invulnerableUntil) return false;

    this.flash = 1.0;
    this.addWobble(Math.random() * Math.PI * 2, 0.25);
    this.hp = Math.max(0, this.hp - amount);

    if (this.hp <= 0) {
      this.isDead = true;
      this.deaths++;
      this.deathTime = Date.now();
      return true; // Tank was killed
    }
    return false;
  }

  public respawn(x: number, y: number): void {
    this.hp = this.maxHp;
    this.isDead = false;
    this.recoil = 0;
    this.flash = 0;
    this.wobbleS = 0;
    this.invulnerableUntil = Date.now() + GAME_CONFIG.TANK.INVULN_TIME_MS;
    Matter.Body.setPosition(this.body, { x, y });
    Matter.Body.setVelocity(this.body, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(this.body, 0);
  }

  public toSnapshot(): TankSnapshot {
    const invulnLeftMs = Math.max(0, this.invulnerableUntil - Date.now());

    return {
      id: this.id,
      name: this.name,
      x: Math.round(this.body.position.x * 10) / 10,
      y: Math.round(this.body.position.y * 10) / 10,
      vx: Math.round(this.body.velocity.x * 10) / 10,
      vy: Math.round(this.body.velocity.y * 10) / 10,
      aimAngle: Math.round(this.aimAngle * 100) / 100,
      hp: this.hp,
      maxHp: this.maxHp,
      color: this.color,
      hue: this.hue,
      score: this.score,
      kills: this.kills,
      deaths: this.deaths,
      isBot: this.isBot,
      isDead: this.isDead,
      recoil: Math.round(this.recoil * 100) / 100,
      invulnT: Math.round((invulnLeftMs / 1000) * 10) / 10,
      flash: Math.round(this.flash * 100) / 100,
      wobbleS: Math.round(this.wobbleS * 100) / 100,
      wobbleA: Math.round(this.wobbleA * 100) / 100,
    };
  }
}
