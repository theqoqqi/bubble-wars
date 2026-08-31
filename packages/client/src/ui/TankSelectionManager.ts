import {
    ColorDef,
    DEFAULT_TANK_BLUEPRINTS,
    TankBlueprint,
    gunTypeRegistry,
    projectileTypeRegistry,
    tankBlueprintRegistry,
    transformLocalPoint,
} from '@bubble-wars/shared';
import { drawBubbleGraph } from '../graphics/render.js';

export class TankSelectionManager {
    private currentHue: number = 192;
    private modalEl: HTMLElement | null = null;
    private gridEl: HTMLElement | null = null;

    public onSelectTank: ((blueprintId: string) => void) | null = null;

    constructor(initialColor: ColorDef = { hue: 192 }) {
        this.currentHue = initialColor.hue ?? 192;
    }

    public init(): void {
        this.modalEl = document.getElementById('tank-modal');
        this.gridEl = document.getElementById('tank-grid');

        const btnClose = document.getElementById('btn-close-tank-modal');
        if (btnClose) {
            btnClose.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeModal();
            });
        }

        // Close on backdrop click
        if (this.modalEl) {
            this.modalEl.addEventListener('click', (e) => {
                if (e.target === this.modalEl) {
                    this.closeModal();
                }
            });
        }

        // Close on Escape key
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modalEl && !this.modalEl.classList.contains('hidden')) {
                this.closeModal();
            }
        });

        this.buildModalGrid();
    }

    public setColor(color: ColorDef): void {
        this.currentHue = color.hue ?? 192;
        this.redrawAllModalCanvases();
    }

    public openModal(): void {
        if (!this.modalEl) return;
        this.modalEl.classList.remove('hidden');
        this.redrawAllModalCanvases();
    }

    public closeModal(): void {
        if (!this.modalEl) return;
        this.modalEl.classList.add('hidden');
    }

    private buildModalGrid(): void {
        if (!this.gridEl) return;
        this.gridEl.innerHTML = '';

        for (const bp of DEFAULT_TANK_BLUEPRINTS) {
            const card = document.createElement('div');
            card.className = 'tank-card';
            card.dataset.blueprintId = bp.id;

            // Compute combat parameters
            const gunDef = bp.guns[0];
            const gunSpec = gunTypeRegistry.get(gunDef.gunTypeId);
            const barrel = gunSpec.barrels[0];
            const projType = projectileTypeRegistry.get(barrel.projectileTypeId);

            const bulletsCount =
                (barrel.bulletsPerShot && barrel.bulletsPerShot > 1
                    ? barrel.bulletsPerShot
                    : 1) * bp.guns.length;
            const splashBehavior = projType.onHit?.find((h: any) => h.type === 'splash') as
                | { damage?: number }
                | undefined;
            const splashDamage = splashBehavior?.damage || 0;
            const totalShotDamage = (projType.damage + splashDamage) * bulletsCount;
            const shotsPerSec = 1000 / barrel.cooldownMs;
            const dps = Math.round(totalShotDamage * shotsPerSec);
            const fireRateStr = shotsPerSec.toFixed(1);

            // Compute real physical steady-state speed
            const totalArea = bp.body.bubbles.reduce(
                (sum, b) => sum + Math.PI * b.radius * b.radius,
                0
            );
            const mass = totalArea * 0.005;
            const steadySpeed = Math.round(
                ((bp as any).thrustForce / (mass * bp.linearDamping)) * 10000
            );
            const speedPercent = Math.min(100, Math.round((steadySpeed / 350) * 100));

            card.innerHTML = `
                <div class="tank-card-header">
                    <h3 class="tank-card-title">${bp.name}</h3>
                </div>

                <div class="tank-card-body-row">
                    <!-- Колонка 1: Картинка танка -->
                    <div class="tank-card-canvas-box">
                        <canvas class="tank-card-canvas" width="100" height="100" data-bp="${bp.id}"></canvas>
                    </div>

                    <!-- Колонка 2: Названия и значения статов -->
                    <div class="tank-stats-labels-col">
                        <div class="tank-stat-text-row">
                            <span class="stat-label">HP</span>
                            <span class="stat-val">${bp.maxHp}</span>
                        </div>
                        <div class="tank-stat-text-row">
                            <span class="stat-label">ДПС</span>
                            <span class="stat-val">${dps}/с</span>
                        </div>
                        <div class="tank-stat-text-row">
                            <span class="stat-label">ТЕМП</span>
                            <span class="stat-val">${fireRateStr} в/с</span>
                        </div>
                        <div class="tank-stat-text-row">
                            <span class="stat-label">СКОР.</span>
                            <span class="stat-val">${steadySpeed}</span>
                        </div>
                    </div>

                    <!-- Колонка 3: Полоски прогресса -->
                    <div class="tank-stats-bars-col">
                        <div class="stat-bar-track">
                            <div class="stat-bar-bg"><div class="stat-bar-fill hp" style="width: ${Math.min(100, (bp.maxHp / 160) * 100)}%"></div></div>
                        </div>
                        <div class="stat-bar-track">
                            <div class="stat-bar-bg"><div class="stat-bar-fill damage" style="width: ${Math.min(100, (dps / 125) * 100)}%"></div></div>
                        </div>
                        <div class="stat-bar-track">
                            <div class="stat-bar-bg"><div class="stat-bar-fill fire-rate" style="width: ${Math.min(100, (parseFloat(fireRateStr) / 10.5) * 100)}%"></div></div>
                        </div>
                        <div class="stat-bar-track">
                            <div class="stat-bar-bg"><div class="stat-bar-fill speed" style="width: ${speedPercent}%"></div></div>
                        </div>
                    </div>
                </div>
            `;

            card.addEventListener('click', () => {
                this.closeModal();
                if (this.onSelectTank) {
                    this.onSelectTank(bp.id);
                }
            });

            this.gridEl.appendChild(card);
        }

        this.redrawAllModalCanvases();
    }

    private redrawAllModalCanvases(): void {
        if (!this.gridEl) return;
        const canvases = this.gridEl.querySelectorAll<HTMLCanvasElement>('.tank-card-canvas');
        canvases.forEach((canvas) => {
            const bpId = canvas.dataset.bp;
            if (bpId && tankBlueprintRegistry.has(bpId)) {
                const bp = tankBlueprintRegistry.get(bpId);
                this.drawTankOnCanvas(canvas, bp, this.currentHue);
            }
        });
    }

    public drawTankOnCanvas(
        canvas: HTMLCanvasElement,
        blueprint: TankBlueprint,
        hue: number
    ): void {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        // 1. Calculate bounding box of the hull
        let hullMinX = Infinity;
        let hullMaxX = -Infinity;
        let hullMinY = Infinity;
        let hullMaxY = -Infinity;

        for (const b of blueprint.body.bubbles) {
            hullMinX = Math.min(hullMinX, b.offsetX - b.radius);
            hullMaxX = Math.max(hullMaxX, b.offsetX + b.radius);
            hullMinY = Math.min(hullMinY, b.offsetY - b.radius);
            hullMaxY = Math.max(hullMaxY, b.offsetY + b.radius);
        }

        const hullCenterX = (hullMinX + hullMaxX) / 2;
        const hullCenterY = (hullMinY + hullMaxY) / 2;

        // 2. Calculate total bounds including hull, gun bubbles and gun barrels
        let totalMinX = hullMinX;
        let totalMaxX = hullMaxX;
        let totalMinY = hullMinY;
        let totalMaxY = hullMaxY;

        for (const gunDef of blueprint.guns) {
            const parent =
                blueprint.body.bubbles.find((b) => b.id === gunDef.attachedTo) ||
                blueprint.body.bubbles[0];
            const px = parent ? parent.offsetX : 0;
            const py = parent ? parent.offsetY : 0;
            const spec = gunTypeRegistry.get(gunDef.gunTypeId);

            for (const gb of spec.body.bubbles) {
                totalMinX = Math.min(totalMinX, px + gb.offsetX - gb.radius);
                totalMaxX = Math.max(totalMaxX, px + gb.offsetX + gb.radius);
                totalMinY = Math.min(totalMinY, py + gb.offsetY - gb.radius);
                totalMaxY = Math.max(totalMaxY, py + gb.offsetY + gb.radius);
            }

            for (const barrel of spec.barrels) {
                const tipX = px + barrel.offsetX + barrel.length;
                const tipY = py + barrel.offsetY;
                totalMinX = Math.min(totalMinX, tipX - 10);
                totalMaxX = Math.max(totalMaxX, tipX + 10);
                totalMinY = Math.min(totalMinY, tipY - 10);
                totalMaxY = Math.max(totalMaxY, tipY + 10);
            }
        }

        // 3. Symmetrical extent from hull center so the hull body stays dead center on canvas
        const maxExtentX = Math.max(
            Math.abs(totalMinX - hullCenterX),
            Math.abs(totalMaxX - hullCenterX)
        );
        const maxExtentY = Math.max(
            Math.abs(totalMinY - hullCenterY),
            Math.abs(totalMaxY - hullCenterY)
        );

        const boundW = Math.max(60, maxExtentX * 2 + 18);
        const boundH = Math.max(60, maxExtentY * 2 + 18);
        const scale = Math.min(w / boundW, h / boundH) * 0.90;

        const centerX = w / 2 - hullCenterX * scale;
        const centerY = h / 2 - hullCenterY * scale;

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(scale, scale);

        // 4. Draw Hull
        drawBubbleGraph(ctx, blueprint.body.bubbles, 0, 0, 0, hue, {
            glow: 0.6,
        });

        // 5. Draw Mounted Guns
        for (const gunDef of blueprint.guns) {
            const parent =
                blueprint.body.bubbles.find((b) => b.id === gunDef.attachedTo) ||
                blueprint.body.bubbles[0];
            const mountPos = transformLocalPoint(
                0,
                0,
                0,
                parent ? parent.offsetX : 0,
                parent ? parent.offsetY : 0
            );
            const gunSpec = gunTypeRegistry.get(gunDef.gunTypeId);
            drawBubbleGraph(
                ctx,
                gunSpec.body.bubbles,
                mountPos.x,
                mountPos.y,
                gunDef.offsetAngle,
                hue
            );
        }

        ctx.restore();
    }
}
