import {
    DEFAULT_BUBBLE_COLOR,
    GAME_CONFIG,
    gunTypeRegistry,
    projectileTypeRegistry,
    tankBlueprintRegistry,
    transformLocalPoint,
} from '@bubble-wars/shared';
import { ClientObstacle, ClientProjectile, ClientTankState, KillNotification } from '../types.js';
import { ParticleSystem } from './ParticleSystem.js';
import { CLIENT_CONFIG } from '../config.js';
import {
    AmbientBubble,
    createAmbient,
    drawBackdrop,
    drawBubble,
    drawBubbleGraph,
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
        const dpr = Math.min(CLIENT_CONFIG.RENDER.MAX_DPR, window.devicePixelRatio || 1);
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
        particleSystem: ParticleSystem,
        killNotifications?: readonly KillNotification[],
        crosshair?: { x: number; y: number; down: boolean; visible: boolean; hue?: number }
    ): void {
        if (!this.ctx) return;
        const { ctx } = this;
        const dpr = Math.min(CLIENT_CONFIG.RENDER.MAX_DPR, window.devicePixelRatio || 1);
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

        // 5. Draw Tanks (Modular Blueprints, Compound Bodies, Turrets, Barrels with recoil, Health Arc, Invuln Ring, Name)
        for (const t of tanks) {
            if (t.isDead) continue;

            const blink = t.invulnT > 0 ? 0.55 + 0.45 * Math.sin(gameTime * 18) : 1;
            const idle = Math.sin(gameTime * 2.6 + t.x) * 0.02;
            const bodyAngle = t.bodyAngle;

            // Resolve Blueprint directly from registry
            const blueprint = tankBlueprintRegistry.get(t.blueprintId);

            // 5.1. Render Tank Hull Compound Body (with squash/wobble)
            drawBubbleGraph(
                ctx,
                blueprint.body.bubbles,
                t.x,
                t.y,
                bodyAngle,
                t.hue,
                {
                    squash: clamp(t.wobbleS + idle, -0.42, 0.42),
                    sqAngle: t.wobbleA,
                    alpha: blink,
                    flash: t.flash * 0.85,
                    glow: 0.55,
                }
            );

            // 5.2. Render Guns mounted on Hull Bubbles
            for (const gunDef of blueprint.guns) {
                const parentBubble =
                    blueprint.body.bubbles.find((b) => b.id === gunDef.attachedTo) ||
                    blueprint.body.bubbles[0];

                const mountPos = transformLocalPoint(
                    t.x,
                    t.y,
                    bodyAngle,
                    parentBubble ? parentBubble.offsetX : 0,
                    parentBubble ? parentBubble.offsetY : 0
                );

                const gunSpec = gunTypeRegistry.get(gunDef.gunTypeId);
                const gunAngle = t.aimAngle + gunDef.offsetAngle;
                const gunSnapshot = t.guns.find((g) => g.id === gunDef.id);

                const barrels = gunSpec.barrels;
                const barrelSnapshots = gunSnapshot?.barrels;

                // Adjust individual bubbles according to barrel recoil
                const recoiledBubbles = gunSpec.body.bubbles.map((b) => {
                    let recoilVal = 0;
                    if (barrelSnapshots && barrelSnapshots.length > 0) {
                        const matchedBarrelDef = barrels.find(
                            (bar) => Math.abs(bar.offsetY - b.offsetY) < 2
                        );
                        if (matchedBarrelDef) {
                            const matchedSnap = barrelSnapshots.find(
                                (s) => s.id === matchedBarrelDef.id
                            );
                            recoilVal = matchedSnap?.recoil ?? 0;
                        } else {
                            recoilVal =
                                (barrelSnapshots.reduce((max, s) => Math.max(max, s.recoil), 0) ??
                                    0) * 0.4;
                        }
                    } else {
                        recoilVal = t.recoil;
                    }
                    return {
                        ...b,
                        offsetX: b.offsetX - recoilVal * 6,
                    };
                });

                // Render Gun Bubble Body (turret base and nozzles)
                drawBubbleGraph(
                    ctx,
                    recoiledBubbles,
                    mountPos.x,
                    mountPos.y,
                    gunAngle,
                    t.hue + 22,
                    {
                        alpha: blink,
                        rimAlpha: 0.9,
                        glow: 0.35,
                    }
                );

                // Muzzle flash on specific barrel tips during fire
                if (barrelSnapshots && barrelSnapshots.length > 0) {
                    for (const barrelDef of gunSpec.barrels) {
                        const bSnap = barrelSnapshots.find((s) => s.id === barrelDef.id);
                        const bRecoil = bSnap?.recoil ?? 0;
                        if (bRecoil > 0.35) {
                            const tipPos = transformLocalPoint(
                                mountPos.x,
                                mountPos.y,
                                gunAngle,
                                barrelDef.length + 2,
                                barrelDef.offsetY
                            );
                            ctx.save();
                            ctx.fillStyle = `rgba(255, 255, 255, ${bRecoil * 0.85})`;
                            ctx.beginPath();
                            ctx.arc(
                                tipPos.x,
                                tipPos.y,
                                (barrelDef.width ?? 6) * bRecoil * 1.1,
                                0,
                                PI2
                            );
                            ctx.fill();
                            ctx.restore();
                        }
                    }
                }
            }

            // 5.3. Calculate Dynamic Bounding Radius for HUD elements
            let maxRadius = GAME_CONFIG.TANK.BODY_RADIUS;
            for (const b of blueprint.body.bubbles) {
                const dist = Math.hypot(b.offsetX, b.offsetY) + b.radius;
                if (dist > maxRadius) maxRadius = dist;
            }

            // Circular Health Arc
            const pct = clamp(t.hp / t.maxHp, 0, 1);
            ctx.save();
            ctx.globalAlpha = blink;
            ctx.lineWidth = 4.5;
            ctx.lineCap = 'round';
            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.beginPath();
            ctx.arc(t.x, t.y, maxRadius + 10, 0, PI2);
            ctx.stroke();
            ctx.strokeStyle = hsla(8 + pct * 130, 92, 62, 0.95);
            ctx.beginPath();
            ctx.arc(
                t.x,
                t.y,
                maxRadius + 10,
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
                ctx.arc(t.x, t.y, maxRadius + 18, 0, PI2);
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
            ctx.fillText(t.name, t.x, t.y - maxRadius - 22);
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

            const projType = p.projectileTypeId ? projectileTypeRegistry.get(p.projectileTypeId) : null;
            const angle = Math.atan2(p.vy, p.vx);
            if (projType && projType.body && projType.body.bubbles.length > 0) {
                drawBubbleGraph(ctx, projType.body.bubbles, p.x, p.y, angle, p.hue, {
                    glow: 1,
                    rimAlpha: 1,
                });
            } else {
                drawBubble(ctx, p.x, p.y, p.r, p.hue, { glow: 1, rimAlpha: 1 });
            }
        }

        // 7. Draw Particles
        particleSystem.render(ctx);

        // 8. Draw In-World Kill Notifications under Player Tank
        if (myTank && !myTank.isDead && killNotifications && killNotifications.length > 0) {
            this.drawKillNotifications(ctx, myTank, killNotifications, gameTime);
        }

        ctx.restore();

        // 9. Draw Vignette & Low HP Red Alert Pulse
        drawVignette(ctx, viewW, viewH);

        const lowHp =
            myTank && !myTank.isDead && myTank.hp <= 30 ? 0.16 + 0.12 * Math.sin(gameTime * 7) : 0;
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

        // 10. Draw In-Game Custom Bubble Crosshair
        if (crosshair && crosshair.visible) {
            this.drawCrosshair(ctx, crosshair, gameTime);
        }
    }

    private drawCrosshair(
        ctx: CanvasRenderingContext2D,
        crosshair: { x: number; y: number; down: boolean; hue?: number },
        gameTime: number
    ): void {
        const { x, y, down } = crosshair;
        const hue = crosshair.hue ?? 192;

        ctx.save();
        ctx.translate(x, y);

        const baseRadius = down ? 20 : 16;
        const ringColor = hsla(hue, 100, 70, down ? 0.95 : 0.85);
        const glowColor = hsla(hue, 100, 60, down ? 0.9 : 0.6);

        // Subtle continuous rotation
        const rot = gameTime * 1.5;

        ctx.shadowColor = glowColor;
        ctx.shadowBlur = down ? 14 : 8;

        // 1. Draw outer segmented arcs
        ctx.lineWidth = down ? 2.2 : 1.8;
        ctx.strokeStyle = ringColor;

        const arcLen = Math.PI * 0.36;
        const gap = Math.PI * 0.14;
        for (let i = 0; i < 4; i++) {
            const startAngle = rot + i * (arcLen + gap);
            ctx.beginPath();
            ctx.arc(0, 0, baseRadius, startAngle, startAngle + arcLen);
            ctx.stroke();
        }

        // 2. Soap bubble highlight glint (top-left)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(-baseRadius * 0.55, -baseRadius * 0.55, 1.8, 0, PI2);
        ctx.fill();

        // 3. Four directional ticks
        const innerDist = down ? 7 : 5;
        const outerDist = down ? 13 : 10;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        // Top
        ctx.moveTo(0, -innerDist);
        ctx.lineTo(0, -outerDist);
        // Bottom
        ctx.moveTo(0, innerDist);
        ctx.lineTo(0, outerDist);
        // Left
        ctx.moveTo(-innerDist, 0);
        ctx.lineTo(-outerDist, 0);
        // Right
        ctx.moveTo(innerDist, 0);
        ctx.lineTo(outerDist, 0);
        ctx.stroke();

        // 4. Center Dot
        ctx.fillStyle = down ? '#ffffff' : hsla(hue, 100, 85, 0.95);
        ctx.shadowBlur = down ? 10 : 6;
        ctx.beginPath();
        ctx.arc(0, 0, down ? 2.5 : 2, 0, PI2);
        ctx.fill();

        ctx.restore();
    }

    private drawKillNotifications(
        ctx: CanvasRenderingContext2D,
        myTank: ClientTankState,
        killAlerts: readonly KillNotification[],
        gameTime: number
    ): void {
        if (!killAlerts || killAlerts.length === 0) return;

        const baseX = myTank.x;
        const baseY = myTank.y + GAME_CONFIG.TANK.BODY_RADIUS + 40;

        killAlerts.forEach((notif, idx) => {
            const progress = clamp(notif.timeRemaining / notif.totalTime, 0, 1);
            const elapsed = notif.totalTime - notif.timeRemaining;

            // 1. Pop-in scale bounce (first 0.22s)
            const enterT = Math.min(1, elapsed / 0.22);
            const scale = enterT < 1 ? 0.6 + 0.5 * Math.sin(enterT * Math.PI * 0.5) : 1;

            // 2. Fade-out alpha (last 0.45s)
            const exitT = Math.min(1, notif.timeRemaining / 0.45);
            const alpha = clamp(exitT, 0, 1);

            // 3. Float down slightly over lifetime
            const floatOffset = (1 - progress) * 12 + idx * 48;
            const notifY = baseY + floatOffset;

            ctx.save();
            ctx.translate(baseX, notifY);
            ctx.scale(scale, scale);
            ctx.globalAlpha = alpha;

            // Measure components
            const prefixText = '💥 ';
            const victimText = notif.victimName;
            const scoreText = ' +100';

            ctx.font = '800 20px Outfit, Nunito, sans-serif';
            const preW = ctx.measureText(prefixText).width;
            ctx.font = '800 25px Outfit, Nunito, sans-serif';
            const vicW = ctx.measureText(victimText).width;
            ctx.font = '800 20px Outfit, Nunito, sans-serif';
            const scW = ctx.measureText(scoreText).width;

            const padX = 18;
            const totalW = preW + vicW + scW + padX * 2;
            const totalH = 40;
            const halfW = totalW / 2;
            const halfH = totalH / 2;

            // Draw Glassmorphic Pill Background
            ctx.save();
            ctx.shadowColor = hsla(48, 95, 60, 0.75 * alpha);
            ctx.shadowBlur = 18;

            // Background rounded pill
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(-halfW, -halfH, totalW, totalH, 20);
            } else {
                ctx.rect(-halfW, -halfH, totalW, totalH);
            }
            ctx.fillStyle = 'rgba(6, 20, 42, 0.92)';
            ctx.fill();

            // Border outline with gold shimmer
            const borderHue = 45 + Math.sin(gameTime * 6) * 15;
            ctx.strokeStyle = hsla(borderHue, 95, 65, 0.9);
            ctx.lineWidth = 2.2;
            ctx.stroke();
            ctx.restore();

            // Draw Texts with Middle Baseline Alignment
            ctx.textBaseline = 'middle';
            let curX = -halfW + padX;
            const textY = 1;

            // Prefix "💥 "
            ctx.font = '800 20px Outfit, Nunito, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillStyle = '#ffe36e';
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 6;
            ctx.fillText(prefixText, curX, textY);
            curX += preW;

            // Victim Name in their tank hue
            ctx.font = '800 25px Outfit, Nunito, sans-serif';
            ctx.fillStyle = hsla(notif.victimHue, 95, 75, 1);
            ctx.shadowColor = hsla(notif.victimHue, 95, 60, 0.9);
            ctx.shadowBlur = 12;
            ctx.fillText(victimText, curX, textY);
            curX += vicW;

            // Score " +100"
            ctx.font = '800 20px Outfit, Nunito, sans-serif';
            ctx.fillStyle = '#35e0ff';
            ctx.shadowColor = 'rgba(53, 224, 255, 0.85)';
            ctx.shadowBlur = 10;
            ctx.fillText(scoreText, curX, textY);

            ctx.restore();
        });
    }

    public destroy(): void {
        window.removeEventListener('resize', this.onResize);
        this.customCanvas.remove();
    }
}
