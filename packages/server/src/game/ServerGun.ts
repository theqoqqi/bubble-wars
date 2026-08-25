import {
    ColorDef,
    GunBarrelDef,
    GunBarrelSnapshot,
    GunSnapshot,
    GunType,
    ProjectileType,
    TankGunDef,
    projectileTypeRegistry,
    transformLocalPoint,
} from '@bubble-wars/shared';
import { ServerProjectile } from './Projectile.js';

export class ServerGunBarrel {
    public config: GunBarrelDef;
    public projectileType: ProjectileType;
    public lastShootTime: number = 0;
    public recoil: number = 0;

    constructor(config: GunBarrelDef) {
        this.config = config;
        this.projectileType = projectileTypeRegistry.get(config.projectileTypeId);
    }

    public update(dt: number): void {
        if (this.recoil > 0) {
            this.recoil = Math.max(
                0,
                this.recoil - dt * (this.config.recoilRecoverySpeed * 40)
            );
        }
    }

    public canShoot(now: number): boolean {
        return now - this.lastShootTime >= this.config.cooldownMs;
    }

    public shoot(
        ownerId: string,
        mountX: number,
        mountY: number,
        gunAngle: number,
        color: ColorDef,
        hue: number,
        now: number
    ): ServerProjectile[] {
        this.lastShootTime = now;
        this.recoil = 1.0;

        const count = this.config.bulletsPerShot ?? 1;
        const spread = this.config.spreadAngle ?? 0;
        const projectiles: ServerProjectile[] = [];

        // Fire point at the tip of the barrel
        const firePos = transformLocalPoint(
            mountX,
            mountY,
            gunAngle,
            this.config.offsetX + this.config.length,
            this.config.offsetY
        );

        for (let i = 0; i < count; i++) {
            let angle = gunAngle;
            if (count > 1 && spread > 0) {
                const fraction = i / (count - 1) - 0.5;
                angle += fraction * spread;
            } else if (spread > 0) {
                angle += (Math.random() - 0.5) * spread;
            }

            projectiles.push(
                new ServerProjectile(
                    ownerId,
                    firePos.x,
                    firePos.y,
                    angle,
                    color,
                    hue,
                    this.projectileType
                )
            );
        }

        return projectiles;
    }

    public toSnapshot(): GunBarrelSnapshot {
        return {
            id: this.config.id,
            recoil: this.recoil,
        };
    }
}

export class ServerGun {
    public mount: TankGunDef;
    public spec: GunType;
    public barrels: ServerGunBarrel[];

    constructor(mount: TankGunDef, spec: GunType) {
        this.mount = mount;
        this.spec = spec;
        this.barrels = spec.barrels.map((b) => new ServerGunBarrel(b));
    }

    public update(dt: number): void {
        for (const barrel of this.barrels) {
            barrel.update(dt);
        }
    }

    public toSnapshot(): GunSnapshot {
        return {
            id: this.mount.id,
            barrels: this.barrels.map((b) => b.toSnapshot()),
        };
    }
}
