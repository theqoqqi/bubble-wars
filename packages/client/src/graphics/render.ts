import { BubbleDef, DEFAULT_BUBBLE_COLOR } from '@bubble-wars/shared';

export const hsla = (h: number, s: number, l: number, a: number) => `hsla(${h},${s}%,${l}%,${a})`;

export interface BubbleOpts {
    squash?: number;
    sqAngle?: number;
    alpha?: number;
    rimAlpha?: number;
    fillAlpha?: number;
    flash?: number;
    glow?: number;
    tint?: number;
    stretch?: number;
    rotation?: number;
}

export interface BubbleGraphOpts extends BubbleOpts {}

type ConicCtx = CanvasRenderingContext2D & {
    createConicGradient?: (startAngle: number, x: number, y: number) => CanvasGradient;
};

export function iridescentStroke(
    ctx: CanvasRenderingContext2D,
    r: number,
    hue: number,
    alpha: number
) {
    const c = ctx as ConicCtx;
    if (c.createConicGradient) {
        const g = c.createConicGradient(0, 0, 0);
        const stops = [hue, hue + 70, hue + 150, hue + 230, hue + 310, hue];
        stops.forEach((h, i) => g.addColorStop(i / (stops.length - 1), hsla(h, 95, 72, alpha)));
        ctx.strokeStyle = g;
    } else {
        ctx.strokeStyle = hsla(hue, 95, 72, alpha);
    }
    ctx.lineWidth = Math.max(1.6, r * 0.13);
    ctx.beginPath();
    ctx.arc(0, 0, r - ctx.lineWidth * 0.35, 0, Math.PI * 2);
    ctx.stroke();
}

export function drawBubble(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    hue: number = DEFAULT_BUBBLE_COLOR.hue,
    o: BubbleOpts = {}
) {
    const {
        squash = 0,
        sqAngle = 0,
        alpha = 1,
        rimAlpha = 0.95,
        fillAlpha = 1,
        flash = 0,
        glow = 0.5,
        tint = DEFAULT_BUBBLE_COLOR.tint ?? 0.5,
        stretch = 1,
        rotation = 0,
    } = o;

    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha;

    if (rotation !== 0) {
        ctx.rotate(rotation);
    }

    if (stretch !== 1) {
        ctx.scale(stretch, 1);
    }

    if (squash !== 0) {
        ctx.rotate(sqAngle);
        ctx.scale(1 - squash, 1 + squash * 0.9);
        ctx.rotate(-sqAngle);
    }

    if (glow > 0 || tint > 0) {
        const glowAlpha = (0.14 * glow + 0.22 * tint) * alpha;
        const gg = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 1.35);
        gg.addColorStop(0, hsla(hue, 95, 70, 0));
        gg.addColorStop(0.72, hsla(hue, 95, 70, glowAlpha));
        gg.addColorStop(1, hsla(hue, 95, 70, 0));
        ctx.fillStyle = gg;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.35, 0, Math.PI * 2);
        ctx.fill();
    }

    // 1. Base Soap Film Fill
    const g = ctx.createRadialGradient(-r * 0.32, -r * 0.32, r * 0.1, 0, 0, r);
    g.addColorStop(0, hsla(hue, 100, 94, 0.12 * fillAlpha));
    g.addColorStop(0.55, hsla(hue, 95, 76, 0.09 * fillAlpha));
    g.addColorStop(0.82, hsla(hue, 95, 68, 0.3 * fillAlpha));
    g.addColorStop(1, hsla(hue, 100, 62, 0.42 * fillAlpha));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // 2. Tint Overlay (if tint > 0)
    if (tint > 0) {
        const gTint = ctx.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.05, 0, 0, r);
        gTint.addColorStop(0, hsla(hue, 92, 85, tint * alpha));
        gTint.addColorStop(0.45, hsla(hue, 95, 62, tint * alpha));
        gTint.addColorStop(0.82, hsla(hue, 95, 48, tint * alpha));
        gTint.addColorStop(1, hsla(hue, 100, 42, tint * alpha));
        ctx.fillStyle = gTint;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
    }

    // 3. Iridescent Outer Ring
    iridescentStroke(ctx, r, hue, rimAlpha * alpha);

    // 4. Tinted Outer Rim Stroke (if tint > 0)
    if (tint > 0) {
        ctx.strokeStyle = hsla(hue, 95, 65, 0.9 * tint * alpha);
        ctx.lineWidth = Math.max(1.8, r * 0.14);
        ctx.beginPath();
        ctx.arc(0, 0, r - ctx.lineWidth * 0.35, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.strokeStyle = hsla(hue + 90, 100, 82, 0.28 * alpha);
    ctx.lineWidth = Math.max(1.2, r * 0.07);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.8, 0.5, 1.75);
    ctx.stroke();

    ctx.save();
    ctx.translate(-r * 0.38, -r * 0.42);
    ctx.rotate(-0.6);
    ctx.fillStyle = `rgba(255,255,255,${0.75 * alpha})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.26, r * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = `rgba(255,255,255,${0.3 * alpha})`;
    ctx.beginPath();
    ctx.arc(r * 0.34, r * 0.38, r * 0.08, 0, Math.PI * 2);
    ctx.fill();

    if (flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${Math.min(0.85, flash)})`;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

/**
 * Universal procedural renderer for any graph of connected BubbleDef items (tank hull, turret, obstacle clusters, etc.)
 */
export function drawBubbleGraph(
    ctx: CanvasRenderingContext2D,
    bubbles: readonly BubbleDef[],
    originX: number,
    originY: number,
    angle: number,
    hue: number,
    options: BubbleGraphOpts = {}
): void {
    if (!bubbles || bubbles.length === 0) return;

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // 1. Calculate world coordinates, hue, tint, and zIndex for each bubble
    const items: Array<{
        x: number;
        y: number;
        r: number;
        attachedTo?: string;
        hue: number;
        tint: number;
        zIndex: number;
        stretch: number;
        rotation: number;
        originalIndex: number;
    }> = [];

    for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i];
        const wx = originX + b.offsetX * cos - b.offsetY * sin;
        const wy = originY + b.offsetX * sin + b.offsetY * cos;
        const bubbleHue = b.color?.hue ?? hue ?? DEFAULT_BUBBLE_COLOR.hue;
        const bubbleTint = b.color?.tint ?? options.tint ?? (DEFAULT_BUBBLE_COLOR.tint ?? 0.5);
        const bubbleZIndex = b.zIndex ?? 0;
        const bubbleStretch = b.stretch ?? 1;
        const bubbleRotation = angle + (b.rotation ?? 0);
        items.push({
            x: wx,
            y: wy,
            r: b.radius,
            attachedTo: b.attachedTo,
            hue: bubbleHue,
            tint: bubbleTint,
            zIndex: bubbleZIndex,
            stretch: bubbleStretch,
            rotation: bubbleRotation,
            originalIndex: i,
        });
    }

    // 2. Sort bubbles by zIndex (ascending: lower zIndex rendered first / underneath).
    // If zIndex is equal, preserve reverse order so children render under root by default.
    items.sort((a, b) => {
        if (a.zIndex !== b.zIndex) {
            return a.zIndex - b.zIndex;
        }
        return b.originalIndex - a.originalIndex;
    });

    for (const p of items) {
        drawBubble(ctx, p.x, p.y, p.r, p.hue, {
            ...options,
            tint: p.tint,
            stretch: p.stretch,
            rotation: p.rotation,
        });
    }
}

export interface OrbitBubblesOpts {
    count?: number;
    orbitOffset?: number;
    speed?: number;
    baseRadius?: number;
    radiusVariance?: number;
    wobbleAmplitude?: number;
    wobbleSpeed?: number;
    hue?: number;
    bubbleOpts?: BubbleOpts;
}

/**
 * Procedural renderer for orbiting bubbles around a parent bubble center.
 */
export function drawOrbitBubbles(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    hostRadius: number,
    gameTime: number,
    opts: OrbitBubblesOpts = {}
): void {
    const {
        count = 6,
        orbitOffset = 6,
        speed = 1.8,
        baseRadius = 5.5,
        radiusVariance = 1.2,
        wobbleAmplitude = 3,
        wobbleSpeed = 4.5,
        hue = 255,
        bubbleOpts = {
            glow: 0,
            tint: 0.7,
            rimAlpha: 0.9,
            fillAlpha: 0.8,
        },
    } = opts;

    ctx.save();

    const orbitRadius = hostRadius + orbitOffset;

    for (let i = 0; i < count; i++) {
        const angle = gameTime * speed + (i * Math.PI * 2) / count;
        const wobble = Math.sin(gameTime * wobbleSpeed + i * 1.5) * wobbleAmplitude;
        const r = baseRadius + Math.sin(gameTime * 3 + i) * radiusVariance;

        const bx = cx + Math.cos(angle) * (orbitRadius + wobble);
        const by = cy + Math.sin(angle) * (orbitRadius + wobble);

        drawBubble(ctx, bx, by, r, hue, bubbleOpts);
    }

    ctx.restore();
}

export interface AmbientBubble {
    x: number;
    y: number;
    r: number;
    s: number;
    drift: number;
    hue: number;
    a: number;
}

export function createAmbient(w: number, h: number): AmbientBubble[] {
    const hues = [190, 210, 300, 50, 160];
    const arr: AmbientBubble[] = [];
    for (let i = 0; i < 40; i++) {
        arr.push({
            x: Math.random() * w,
            y: Math.random() * h,
            r: 2 + Math.random() * 8,
            s: 12 + Math.random() * 26,
            drift: Math.random() * Math.PI * 2,
            hue: hues[i % hues.length],
            a: 0.045 + Math.random() * 0.1,
        });
    }
    return arr;
}

export function drawBackdrop(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    t: number,
    ambient: AmbientBubble[],
    dt: number
) {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#071a30');
    bg.addColorStop(0.55, '#092442');
    bg.addColorStop(1, '#0b2c50');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const core = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.62);
    core.addColorStop(0, 'rgba(56,160,220,0.10)');
    core.addColorStop(1, 'rgba(56,160,220,0)');
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
        const cx = w * (0.5 + 0.36 * Math.sin(t * 0.1 + i * 2.1));
        const cy = h * (0.5 + 0.34 * Math.cos(t * 0.13 + i * 1.7));
        const rr = Math.min(w, h) * (0.34 + i * 0.08);
        const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
        cg.addColorStop(0, hsla(190 + i * 26, 90, 60, 0.055));
        cg.addColorStop(1, hsla(190 + i * 26, 90, 60, 0));
        ctx.fillStyle = cg;
        ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();

    for (const b of ambient) {
        b.y -= b.s * dt;
        b.x += Math.sin(t * 0.8 + b.drift) * 7 * dt;
        if (b.y < -24) {
            b.y = h + 24;
            b.x = Math.random() * w;
        }
        ctx.strokeStyle = hsla(b.hue, 85, 78, b.a);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(255,255,255,${b.a * 0.9})`;
        ctx.beginPath();
        ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.4, b.r * 0.22, 0, Math.PI * 2);
        ctx.fill();
    }

    const hue = 196 + Math.sin(t * 0.7) * 14;
    roundRectPath(ctx, 9, 9, w - 18, h - 18, 26);
    ctx.strokeStyle = hsla(hue, 95, 66, 0.09);
    ctx.lineWidth = 9;
    ctx.stroke();
    roundRectPath(ctx, 9, 9, w - 18, h - 18, 26);
    ctx.strokeStyle = hsla(hue, 95, 68, 0.34);
    ctx.lineWidth = 2.5;
    ctx.stroke();
    roundRectPath(ctx, 15, 15, w - 30, h - 30, 21);
    ctx.strokeStyle = 'rgba(230,250,255,0.10)';
    ctx.lineWidth = 1;
    ctx.stroke();
}

export function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const v = ctx.createRadialGradient(
        w / 2,
        h / 2,
        Math.min(w, h) * 0.36,
        w / 2,
        h / 2,
        Math.max(w, h) * 0.74
    );
    v.addColorStop(0, 'rgba(2,8,18,0)');
    v.addColorStop(1, 'rgba(2,8,18,0.5)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
}

export function roundRectPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}
