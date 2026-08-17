export const hsla = (h: number, s: number, l: number, a: number) => `hsla(${h},${s}%,${l}%,${a})`;

export interface BubbleOpts {
    squash?: number;
    sqAngle?: number;
    alpha?: number;
    rimAlpha?: number;
    fillAlpha?: number;
    flash?: number;
    glow?: number;
}

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
    hue: number,
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
    } = o;

    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha;

    if (squash !== 0) {
        ctx.rotate(sqAngle);
        ctx.scale(1 - squash, 1 + squash * 0.9);
        ctx.rotate(-sqAngle);
    }

    if (glow > 0) {
        const gg = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 1.35);
        gg.addColorStop(0, hsla(hue, 95, 70, 0));
        gg.addColorStop(0.72, hsla(hue, 95, 70, 0.14 * glow));
        gg.addColorStop(1, hsla(hue, 95, 70, 0));
        ctx.fillStyle = gg;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.35, 0, Math.PI * 2);
        ctx.fill();
    }

    const g = ctx.createRadialGradient(-r * 0.32, -r * 0.32, r * 0.1, 0, 0, r);
    g.addColorStop(0, hsla(hue, 100, 94, 0.12 * fillAlpha));
    g.addColorStop(0.55, hsla(hue, 95, 76, 0.09 * fillAlpha));
    g.addColorStop(0.82, hsla(hue, 95, 68, 0.3 * fillAlpha));
    g.addColorStop(1, hsla(hue, 100, 62, 0.42 * fillAlpha));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    iridescentStroke(ctx, r, hue, rimAlpha * alpha);

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
