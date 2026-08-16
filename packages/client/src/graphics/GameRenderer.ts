import { GAME_CONFIG } from '@bubble-wars/shared';
import { ClientObstacle, ClientProjectile, ClientTankState } from '../types.js';
import { ParticleSystem } from './ParticleSystem.js';
import {
  AmbientBubble,
  createAmbient,
  drawBackdrop,
  drawBubble,
  drawVignette,
  hsla,
} from './render.js';

const PI2 = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export class GameRenderer {
  private customCanvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private ambient: AmbientBubble[] = [];
  private onResize = () => this.resizeCanvas();

  constructor(parentContainerId: string = 'game-container') {
    const { width, height } = GAME_CONFIG.ARENA;

    this.customCanvas = document.createElement('canvas');
    this.customCanvas.id = 'bubble-canvas';
    this.customCanvas.style.position = 'absolute';
    this.customCanvas.style.top = '0';
    this.customCanvas.style.left = '0';
    this.customCanvas.style.width = '100vw';
    this.customCanvas.style.height = '100vh';
    this.customCanvas.style.zIndex = '5';
    this.customCanvas.style.pointerEvents = 'none';

    document.getElementById(parentContainerId)?.appendChild(this.customCanvas);
    this.ctx = this.customCanvas.getContext('2d')!;

    this.resizeCanvas();
    window.addEventListener('resize', this.onResize);

    this.ambient = createAmbient(width, height);
  }

  public resizeCanvas(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.customCanvas.width = Math.floor(window.innerWidth * dpr);
    this.customCanvas.height = Math.floor(window.innerHeight * dpr);
  }

  public render(
    gameTime: number,
    shake: number,
    playerFlash: number,
    myTank: ClientTankState | null | undefined,
    tanks: Iterable<ClientTankState>,
    projectiles: Iterable<ClientProjectile>,
    obstacles: Iterable<ClientObstacle>,
    particleSystem: ParticleSystem
  ): void {
    if (!this.ctx) return;
    const { ctx } = this;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 1. Draw dynamic underwater backdrop with floating ambient bubbles
    drawBackdrop(ctx, viewW, viewH, gameTime, this.ambient, 0.016);

    // 2. Camera Transform centered on Player Tank
    const camX = myTank ? myTank.x : GAME_CONFIG.ARENA.width / 2;
    const camY = myTank ? myTank.y : GAME_CONFIG.ARENA.height / 2;

    const sx = (Math.random() - 0.5) * 2 * shake;
    const sy = (Math.random() - 0.5) * 2 * shake;

    ctx.save();
    ctx.translate(viewW / 2 + sx, viewH / 2 + sy);
    ctx.translate(-camX, -camY);

    // 3. Draw Arena Boundary Walls
    const { width: aW, height: aH } = GAME_CONFIG.ARENA;
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
    ctx.lineWidth = 14;
    ctx.strokeRect(0, 0, aW, aH);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.75)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, aW, aH);
    ctx.restore();

    // 4. Draw Obstacles (Giant pulsing iridescent bubbles smoothly migrating)
    for (const o of obstacles) {
      const idle = Math.sin(gameTime * 1.8 + o.id) * 0.02;
      drawBubble(ctx, o.x, o.y, o.r, o.hue, {
        squash: idle,
        rimAlpha: 0.85,
        fillAlpha: 0.8,
        glow: 0.45,
      });
    }

    // 5. Draw Tanks (Body, Turret, Double Barrel with recoil, Health Arc, Invuln Ring, Name)
    for (const t of tanks) {
      if (t.isDead) continue;

      const blink = t.invulnT > 0 ? 0.55 + 0.45 * Math.sin(gameTime * 18) : 1;
      const idle = Math.sin(gameTime * 2.6 + t.x) * 0.02;
      const ca = Math.cos(t.aimAngle);
      const sa = Math.sin(t.aimAngle);

      // Barrel connector bubbles
      for (let i = 1; i >= 0; i--) {
        const d =
          GAME_CONFIG.TANK.TURRET_RADIUS +
          5 +
          GAME_CONFIG.TANK.BARREL_BUBBLE_1_RADIUS +
          i * (GAME_CONFIG.TANK.BARREL_BUBBLE_1_RADIUS * 2 + 1) -
          t.recoil * 8;
        drawBubble(
          ctx,
          t.x + ca * d,
          t.y + sa * d,
          GAME_CONFIG.TANK.BARREL_BUBBLE_1_RADIUS - i * 1.5,
          t.hue + 45,
          {
            alpha: blink,
            glow: 0.6,
          }
        );
      }

      // Main Tank Body
      drawBubble(ctx, t.x, t.y, GAME_CONFIG.TANK.BODY_RADIUS, t.hue, {
        squash: clamp(t.wobbleS + idle, -0.42, 0.42),
        sqAngle: t.wobbleA,
        alpha: blink,
        flash: t.flash * 0.85,
        glow: 0.55,
      });

      // Turret Bubble
      drawBubble(ctx, t.x + ca * 2, t.y + sa * 2, GAME_CONFIG.TANK.TURRET_RADIUS, t.hue + 22, {
        alpha: blink,
        rimAlpha: 0.9,
        glow: 0.35,
      });

      // Turret Center Gloss
      ctx.save();
      ctx.globalAlpha = blink;
      ctx.fillStyle = hsla(t.hue, 70, 22, 0.75);
      ctx.beginPath();
      ctx.arc(t.x + ca * 6, t.y + sa * 6, 5.5, 0, PI2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(t.x + ca * 4.8 - 1.5, t.y + sa * 4.8 - 1.5, 1.6, 0, PI2);
      ctx.fill();
      ctx.restore();

      // Circular Health Arc
      const pct = clamp(t.hp / t.maxHp, 0, 1);
      ctx.save();
      ctx.globalAlpha = blink;
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.arc(t.x, t.y, GAME_CONFIG.TANK.BODY_RADIUS + 10, 0, PI2);
      ctx.stroke();
      ctx.strokeStyle = hsla(8 + pct * 130, 92, 62, 0.95);
      ctx.beginPath();
      ctx.arc(
        t.x,
        t.y,
        GAME_CONFIG.TANK.BODY_RADIUS + 10,
        -Math.PI / 2,
        -Math.PI / 2 + Math.max(0.03, pct) * PI2
      );
      ctx.stroke();
      ctx.restore();

      // Invulnerability Ring
      if (t.invulnT > 0) {
        ctx.save();
        ctx.globalAlpha = 0.4 + 0.3 * Math.sin(gameTime * 14);
        ctx.setLineDash([6, 8]);
        ctx.lineDashOffset = -gameTime * 40;
        ctx.strokeStyle = hsla(t.hue, 95, 75, 1);
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(t.x, t.y, GAME_CONFIG.TANK.BODY_RADIUS + 18, 0, PI2);
        ctx.stroke();
        ctx.restore();
      }

      // Name Text
      ctx.save();
      ctx.font = '800 13px Outfit, Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(3,10,22,0.9)';
      ctx.shadowBlur = 6;
      ctx.fillStyle = hsla(t.hue, 92, 80, 0.96 * blink);
      ctx.fillText(t.name, t.x, t.y - GAME_CONFIG.TANK.BODY_RADIUS - 22);
      ctx.restore();
    }

    // 6. Draw Projectiles with Trails
    for (const p of projectiles) {
      for (let i = 0; i < p.trail.length; i++) {
        const f = (i + 1) / p.trail.length;
        ctx.fillStyle = hsla(p.hue, 90, 72, f * 0.18);
        ctx.beginPath();
        ctx.arc(p.trail[i].x, p.trail[i].y, p.r * f * 0.85, 0, PI2);
        ctx.fill();
      }
      drawBubble(ctx, p.x, p.y, p.r, p.hue, { glow: 1, rimAlpha: 1 });
    }

    // 7. Draw Particles
    particleSystem.render(ctx);

    ctx.restore();

    // 8. Draw Vignette & Low HP Red Alert Pulse
    drawVignette(ctx, viewW, viewH);

    const lowHp = myTank && !myTank.isDead && myTank.hp <= 30 ? 0.16 + 0.12 * Math.sin(gameTime * 7) : 0;
    const redA = Math.max(playerFlash * 0.35, lowHp);
    if (redA > 0.01) {
      const rg = ctx.createRadialGradient(
        viewW / 2,
        viewH / 2,
        Math.min(viewW, viewH) * 0.3,
        viewW / 2,
        viewH / 2,
        Math.max(viewW, viewH) * 0.72
      );
      rg.addColorStop(0, 'rgba(255,64,96,0)');
      rg.addColorStop(1, `rgba(255,64,96,${redA})`);
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, viewW, viewH);
    }
  }

  public destroy(): void {
    window.removeEventListener('resize', this.onResize);
    this.customCanvas.remove();
  }
}
