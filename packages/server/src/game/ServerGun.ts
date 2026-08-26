import {
    ColorDef,
    GunBarrelDef,
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

    constructor(config: GunBarrelDef) {
        this.config = config;
        this.projectileType = projectileTypeRegistry.get(config.projectileTypeId);
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
        now: number,
        gunId?: string
    ): ServerProjectile[] {
        this.lastShootTime = now;

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
                    this.projectileType,
                    gunId,
                    this.config.id
                )
            );
        }

        return projectiles;
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
}
