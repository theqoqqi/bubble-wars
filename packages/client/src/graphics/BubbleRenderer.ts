import Phaser from 'phaser';
import { GAME_CONFIG, TankColor } from '@bubble-wars/shared';

export class BubbleRenderer {
  public static generateAllTextures(scene: Phaser.Scene): void {
    const colors: TankColor[] = ['cyan', 'coral', 'lime', 'violet', 'amber', 'bot'];

    for (const color of colors) {
      this.generateBodyTexture(scene, color);
      this.generateTurretTexture(scene, color);
      this.generateBarrelTexture(scene, color);
      this.generateProjectileTexture(scene, color);
      this.generateDropletTexture(scene, color);
    }

    this.generateBackgroundTile(scene);
    this.generateWallTexture(scene);
  }

  private static generateBodyTexture(scene: Phaser.Scene, color: TankColor): void {
    const key = `bubble_body_${color}`;
    if (scene.textures.exists(key)) return;

    const radius = GAME_CONFIG.TANK.BODY_RADIUS;
    const size = (radius + 8) * 2;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cx = size / 2;
    const cy = size / 2;
    const colorConf = GAME_CONFIG.COLORS[color];

    // 1. Soft Outer Glow
    const glowGrad = ctx.createRadialGradient(cx, cy, radius * 0.7, cx, cy, radius + 6);
    glowGrad.addColorStop(0, 'rgba(0,0,0,0)');
    glowGrad.addColorStop(0.7, colorConf.glow + '44');
    glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 6, 0, Math.PI * 2);
    ctx.fill();

    // 2. Soap Bubble Body (Radial Gradient with Transparency)
    const bodyGrad = ctx.createRadialGradient(
      cx - radius * 0.25,
      cy - radius * 0.25,
      radius * 0.1,
      cx,
      cy,
      radius
    );
    bodyGrad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    bodyGrad.addColorStop(0.3, colorConf.primary + '33');
    bodyGrad.addColorStop(0.75, colorConf.secondary + '66');
    bodyGrad.addColorStop(0.95, colorConf.primary + 'bb');
    bodyGrad.addColorStop(1, colorConf.glow + 'ff');

    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // 3. Thin Film Iridescent Rim
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 4. Primary Specular Highlight (Top-Left Gloss)
    const highlightGrad = ctx.createRadialGradient(
      cx - radius * 0.4,
      cy - radius * 0.4,
      1,
      cx - radius * 0.4,
      cy - radius * 0.4,
      radius * 0.35
    );
    highlightGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    highlightGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.6)');
    highlightGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = highlightGrad;
    ctx.beginPath();
    ctx.ellipse(cx - radius * 0.38, cy - radius * 0.38, radius * 0.32, radius * 0.2, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

    // 5. Secondary Bounce Glare (Bottom-Right)
    const bounceGrad = ctx.createRadialGradient(
      cx + radius * 0.45,
      cy + radius * 0.45,
      1,
      cx + radius * 0.45,
      cy + radius * 0.45,
      radius * 0.25
    );
    bounceGrad.addColorStop(0, colorConf.glow + '88');
    bounceGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = bounceGrad;
    ctx.beginPath();
    ctx.arc(cx + radius * 0.45, cy + radius * 0.45, radius * 0.22, 0, Math.PI * 2);
    ctx.fill();

    scene.textures.addCanvas(key, canvas);
  }

  private static generateTurretTexture(scene: Phaser.Scene, color: TankColor): void {
    const key = `bubble_turret_${color}`;
    if (scene.textures.exists(key)) return;

    const radius = GAME_CONFIG.TANK.TURRET_RADIUS;
    const size = (radius + 6) * 2;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cx = size / 2;
    const cy = size / 2;
    const colorConf = GAME_CONFIG.COLORS[color];

    // Turret sphere
    const grad = ctx.createRadialGradient(cx - radius * 0.25, cy - radius * 0.25, 2, cx, cy, radius);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
    grad.addColorStop(0.4, colorConf.primary + '88');
    grad.addColorStop(0.9, colorConf.secondary + 'cc');
    grad.addColorStop(1, colorConf.glow + 'ff');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Rim
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Specular Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(cx - radius * 0.35, cy - radius * 0.35, radius * 0.25, 0, Math.PI * 2);
    ctx.fill();

    scene.textures.addCanvas(key, canvas);
  }

  private static generateBarrelTexture(scene: Phaser.Scene, color: TankColor): void {
    const key = `bubble_barrel_${color}`;
    if (scene.textures.exists(key)) return;

    const radius = GAME_CONFIG.TANK.BARREL_BUBBLE_1_RADIUS;
    const size = (radius + 4) * 2;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cx = size / 2;
    const cy = size / 2;
    const colorConf = GAME_CONFIG.COLORS[color];

    const grad = ctx.createRadialGradient(cx - radius * 0.2, cy - radius * 0.2, 1, cx, cy, radius);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.5, colorConf.primary + 'aa');
    grad.addColorStop(1, colorConf.secondary + 'ee');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    scene.textures.addCanvas(key, canvas);
  }

  private static generateProjectileTexture(scene: Phaser.Scene, color: TankColor): void {
    const key = `projectile_${color}`;
    if (scene.textures.exists(key)) return;

    const radius = GAME_CONFIG.PROJECTILE.RADIUS;
    const size = (radius + 6) * 2;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cx = size / 2;
    const cy = size / 2;
    const colorConf = GAME_CONFIG.COLORS[color];

    // Glow
    const glow = ctx.createRadialGradient(cx, cy, radius * 0.5, cx, cy, radius + 5);
    glow.addColorStop(0, colorConf.glow + '88');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 5, 0, Math.PI * 2);
    ctx.fill();

    // Core
    const grad = ctx.createRadialGradient(cx - radius * 0.2, cy - radius * 0.2, 1, cx, cy, radius);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, colorConf.primary);
    grad.addColorStop(1, colorConf.secondary);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    scene.textures.addCanvas(key, canvas);
  }

  private static generateDropletTexture(scene: Phaser.Scene, color: TankColor): void {
    const key = `droplet_${color}`;
    if (scene.textures.exists(key)) return;

    const size = 16;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cx = size / 2;
    const cy = size / 2;
    const radius = 6;
    const colorConf = GAME_CONFIG.COLORS[color];

    const grad = ctx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, radius);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.5, colorConf.primary);
    grad.addColorStop(1, colorConf.glow);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    scene.textures.addCanvas(key, canvas);
  }

  private static generateBackgroundTile(scene: Phaser.Scene): void {
    const key = 'arena_bg_tile';
    if (scene.textures.exists(key)) return;

    const size = 120;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dark soapy water background
    ctx.fillStyle = '#060d1f';
    ctx.fillRect(0, 0, size, size);

    // Subtle grid lines with neon sheen
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.04)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, size, size);

    // Subtle micro bubble dots in background
    ctx.fillStyle = 'rgba(0, 240, 255, 0.05)';
    ctx.beginPath();
    ctx.arc(30, 45, 14, 0, Math.PI * 2);
    ctx.arc(85, 90, 8, 0, Math.PI * 2);
    ctx.fill();

    scene.textures.addCanvas(key, canvas);
  }

  private static generateWallTexture(scene: Phaser.Scene): void {
    const key = 'arena_wall_border';
    if (scene.textures.exists(key)) return;

    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0a1a36';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, size, size);

    scene.textures.addCanvas(key, canvas);
  }
}
