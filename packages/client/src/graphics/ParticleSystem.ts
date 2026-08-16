import { Particle } from '../types.js';
import { hsla } from './render.js';

const PI2 = Math.PI * 2;

export class ParticleSystem {
  private particles: Particle[] = [];

  public update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.exp(-2.5 * dt);
      p.vy *= Math.exp(-2.5 * dt);
    }
  }

  public emitPop(x: number, y: number, radius: number, hue: number, isKill: boolean): void {
    const count = isKill ? 28 : 10;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * PI2;
      const sp = 70 + Math.random() * 260;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * sp,
        vy: Math.sin(angle) * sp,
        r: 2 + Math.random() * 3.5,
        life: 0.4 + Math.random() * 0.5,
        maxLife: 0.9,
        hue: hue + (Math.random() * 40 - 20),
        kind: 'drop',
      });
    }

    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      r: radius * 1.8,
      life: 0.4,
      maxLife: 0.4,
      hue,
      kind: 'ring',
    });

    if (isKill) {
      this.particles.push({
        x,
        y,
        vx: 0,
        vy: 0,
        r: radius * 2.8,
        life: 0.55,
        maxLife: 0.55,
        hue: hue + 40,
        kind: 'ring',
      });

      for (let i = 0; i < 7; i++) {
        const a = Math.random() * PI2;
        this.particles.push({
          x,
          y,
          vx: Math.cos(a) * (20 + Math.random() * 70),
          vy: Math.sin(a) * (20 + Math.random() * 70),
          r: 1 + Math.random() * 1.5,
          life: 0.3 + Math.random() * 0.2,
          maxLife: 0.5,
          hue: 0,
          kind: 'spark',
        });
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    for (const pt of this.particles) {
      const f = pt.life / pt.maxLife;
      if (pt.kind === 'drop') {
        ctx.fillStyle = hsla(pt.hue, 92, 72, f * 0.9);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r * (0.35 + f * 0.65), 0, PI2);
        ctx.fill();
      } else if (pt.kind === 'ring') {
        ctx.strokeStyle = hsla(pt.hue, 95, 76, f * 0.85);
        ctx.lineWidth = 1.5 + f * 3.5;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, (1 - f) * pt.r + 4, 0, PI2);
        ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(255,255,255,${f})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r, 0, PI2);
        ctx.fill();
      }
    }
  }

  public clear(): void {
    this.particles = [];
  }
}
