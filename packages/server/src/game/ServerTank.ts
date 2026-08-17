import Matter from 'matter-js';
import {
    ColorDef,
    GAME_CONFIG,
    PlayerInput,
    TankBlueprint,
    TankSnapshot,
    gunTypeRegistry,
    round1,
    round2,
    tankBlueprintRegistry,
    transformLocalPoint,
} from '@bubble-wars/shared';
import { COLLISION_CATEGORIES } from './PhysicsWorld.js';
import { ServerProjectile } from './Projectile.js';
import { ServerGun } from './ServerGun.js';
import './matterTypes.js';

export class ServerTank {
    public id: string;
    public name: string;
    public color: ColorDef;
    public hue: number;
    public isBot: boolean;
    public isDead: boolean = false;
    public score: number = 0;
    public kills: number = 0;
    public deaths: number = 0;

    public blueprint: TankBlueprint;
    public guns: ServerGun[];
    public bodyAngle: number = 0;

    public hp: number;
    public maxHp: number;
    public aimAngle: number = 0;
    public recoil: number = 0;
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
        color: ColorDef,
        x: number,
        y: number,
        isBot: boolean = false,
        hue?: number,
        blueprintId: string = 'classic'
    ) {
        this.id = id;
        this.name = name;
        this.color = color;
        this.hue = hue ?? color.hue;
        this.isBot = isBot;

        this.blueprint = tankBlueprintRegistry.get(blueprintId);
        this.maxHp = this.blueprint.maxHp;
        this.hp = this.maxHp;
        this.invulnerableUntil = Date.now() + GAME_CONFIG.TANK.INVULN_TIME_MS;

        this.guns = this.blueprint.guns.map((g) => {
            const spec = gunTypeRegistry.get(g.gunTypeId);
            return new ServerGun(g, spec);
        });

        // Compound body from blueprint bubbles
        const partsList = this.blueprint.body.bubbles.map((b) =>
            Matter.Bodies.circle(x + b.offsetX, y + b.offsetY, b.radius, {
                label: 'tank',
            })
        );

        this.body = Matter.Body.create({
            parts: partsList,
            restitution: 0.82,
            friction: 0.02,
            frictionAir: this.blueprint.linearDamping,
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

        this.body.tankInstance = this;
        for (const part of this.body.parts) {
            part.tankInstance = this;
        }
    }

    public applyInput(input: PlayerInput, now: number): ServerProjectile[] {
        if (this.isDead) return [];

        this.lastInputSeq = input.seq;
        this.aimAngle = input.aimAngle;

        // Smoothly rotate body towards aim angle
        let diff = (this.aimAngle - this.bodyAngle) % (Math.PI * 2);
        if (diff > Math.PI) diff -= Math.PI * 2;
        if (diff < -Math.PI) diff += Math.PI * 2;
        this.bodyAngle += diff * 0.2;

        // Movement force calculation
        let fx = 0;
        let fy = 0;
        if (input.up) fy -= 1;
        if (input.down) fy += 1;
        if (input.left) fx -= 1;
        if (input.right) fx += 1;

        if (fx !== 0 || fy !== 0) {
            const len = Math.hypot(fx, fy);
            const forceMag = this.blueprint.thrustForce;
            const normalizedFx = (fx / len) * forceMag;
            const normalizedFy = (fy / len) * forceMag;

            Matter.Body.applyForce(this.body, this.body.position, {
                x: normalizedFx,
                y: normalizedFy,
            });
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

        // Modular multi-gun shooting
        const projectiles: ServerProjectile[] = [];

        if (input.shooting) {
            for (const gun of this.guns) {
                const gunAngle = this.aimAngle + gun.mount.offsetAngle;
                const parentBubble =
                    this.blueprint.body.bubbles.find(
                        (b) => b.id === gun.mount.attachedTo
                    ) || this.blueprint.body.bubbles[0];

                const mountPos = transformLocalPoint(
                    this.body.position.x,
                    this.body.position.y,
                    this.bodyAngle,
                    parentBubble ? parentBubble.offsetX : 0,
                    parentBubble ? parentBubble.offsetY : 0
                );

                for (const barrel of gun.barrels) {
                    if (barrel.canShoot(now, this.isBot)) {
                        const spawned = barrel.shoot(
                            this.id,
                            mountPos.x,
                            mountPos.y,
                            gunAngle,
                            this.color,
                            this.hue,
                            now
                        );

                        if (spawned.length > 0) {
                            projectiles.push(...spawned);

                            const totalDamage = spawned.reduce((s, p) => s + p.damage, 0);
                            const impulseMag = Math.min(0.04, totalDamage * 0.00035);
                            Matter.Body.applyForce(this.body, this.body.position, {
                                x: -Math.cos(gunAngle) * impulseMag,
                                y: -Math.sin(gunAngle) * impulseMag,
                            });
                            this.recoil = 1.0;
                        }
                    }
                }
            }
        }

        return projectiles;
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

        // Update gun barrels
        for (const gun of this.guns) {
            gun.update(dt);
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
            blueprintId: this.blueprint.id,
            bodyAngle: round2(this.bodyAngle),
            x: round1(this.body.position.x),
            y: round1(this.body.position.y),
            vx: round1(this.body.velocity.x),
            vy: round1(this.body.velocity.y),
            aimAngle: round2(this.aimAngle),
            hp: this.hp,
            maxHp: this.maxHp,
            color: this.color,
            hue: this.hue,
            score: this.score,
            kills: this.kills,
            deaths: this.deaths,
            isBot: this.isBot,
            isDead: this.isDead,
            recoil: round2(this.recoil),
            guns: this.guns.map((g) => g.toSnapshot()),
            invulnT: round1(invulnLeftMs / 1000),
            flash: round2(this.flash),
            wobbleS: round2(this.wobbleS),
            wobbleA: round2(this.wobbleA),
        };
    }
}
