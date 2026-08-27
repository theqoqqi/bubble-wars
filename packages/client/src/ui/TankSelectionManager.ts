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

export interface TankMetaInfo {
    role: string;
    description: string;
    speedRating: number; // 1 to 5
    damageRating: number; // 1 to 5
    difficulty: 'Легко' | 'Средне' | 'Сложно';
}

export const TANK_META: Record<string, TankMetaInfo> = {
    classic: {
        role: 'УНИВЕРСАЛ',
        description: 'Сбалансированный мыльный танк с хорошей подвижностью и надёжным орудием.',
        speedRating: 3,
        damageRating: 3,
        difficulty: 'Легко',
    },
    twin: {
        role: 'ШТУРМОВИК',
        description: 'Двухъядерный корпус с двумя независимыми мыломётами для плотного огня.',
        speedRating: 3,
        damageRating: 4,
        difficulty: 'Легко',
    },
    sniper: {
        role: 'СНАЙПЕР',
        description: 'Облегчённый подвижный корпус с длинноствольной трубкой. Высокий урон и скорость пули.',
        speedRating: 4,
        damageRating: 5,
        difficulty: 'Сложно',
    },
    shotgun: {
        role: 'ДРОБОВИК',
        description: 'Утолщённый мыльный пузырь с широким раструбом. Смертоносен на ближней дистанции.',
        speedRating: 3,
        damageRating: 4,
        difficulty: 'Средне',
    },
    machinegun: {
        role: 'ПУЛЕМЁТЧИК',
        description: 'Скорострельный пеногенератор с непрерывным потоком мелких мыльных пуль.',
        speedRating: 3,
        damageRating: 3,
        difficulty: 'Средне',
    },
    heavy: {
        role: 'ДЖАГГЕРНАУТ',
        description: 'Трёхъядерный бронированный пузырь с мортирой. Запускает огромный разрушительный шар.',
        speedRating: 1,
        damageRating: 5,
        difficulty: 'Средне',
    },
    popocalypse: {
        role: 'СУДНЫЙ ДЕНЬ',
        description: 'Запускает разрушительные мыльные заряды судного дня. Снаряд плавно замедляется и взрывается колоссальной ударной волной.',
        speedRating: 2,
        damageRating: 5,
        difficulty: 'Сложно',
    },
};

export class TankSelectionManager {
    public selectedBlueprintId: string;
    private currentHue: number = 192;
    private modalEl: HTMLElement | null = null;
    private gridEl: HTMLElement | null = null;
    private previewCardEl: HTMLElement | null = null;
    private previewCanvasEl: HTMLCanvasElement | null = null;
    private previewRoleEl: HTMLElement | null = null;
    private previewNameEl: HTMLElement | null = null;
    private previewDescEl: HTMLElement | null = null;
    private previewValHpEl: HTMLElement | null = null;
    private previewBarHpEl: HTMLElement | null = null;
    private previewValSpeedEl: HTMLElement | null = null;
    private previewBarSpeedEl: HTMLElement | null = null;
    private previewValDamageEl: HTMLElement | null = null;
    private previewBarDamageEl: HTMLElement | null = null;
    private previewWeaponTextEl: HTMLElement | null = null;
    private btnOpenHangarEl: HTMLElement | null = null;

    constructor(initialColor: ColorDef = { hue: 192 }) {
        this.currentHue = initialColor.hue ?? 192;
        const saved = localStorage.getItem('bubble_selected_tank');
        this.selectedBlueprintId =
            saved && tankBlueprintRegistry.has(saved) ? saved : 'classic';
    }

    public init(): void {
        this.modalEl = document.getElementById('tank-modal');
        this.gridEl = document.getElementById('tank-grid');
        this.previewCardEl = document.getElementById('tank-preview-card');
        this.previewCanvasEl = document.getElementById(
            'tank-preview-canvas'
        ) as HTMLCanvasElement;
        this.previewRoleEl = document.getElementById('tank-preview-role');
        this.previewNameEl = document.getElementById('tank-preview-name');
        this.previewDescEl = document.getElementById('tank-preview-desc');
        this.previewValHpEl = document.getElementById('tank-preview-val-hp');
        this.previewBarHpEl = document.getElementById('tank-preview-bar-hp');
        this.previewValSpeedEl = document.getElementById('tank-preview-val-speed');
        this.previewBarSpeedEl = document.getElementById('tank-preview-bar-speed');
        this.previewValDamageEl = document.getElementById('tank-preview-val-damage');
        this.previewBarDamageEl = document.getElementById('tank-preview-bar-damage');
        this.previewWeaponTextEl = document.getElementById('tank-preview-weapon-text');
        this.btnOpenHangarEl = document.getElementById('btn-open-hangar');

        // Click on panel or hangar button opens modal
        if (this.previewCardEl) {
            this.previewCardEl.addEventListener('click', () => this.openModal());
            this.previewCardEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.openModal();
                }
            });
        }
        if (this.btnOpenHangarEl) {
            this.btnOpenHangarEl.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openModal();
            });
        }

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

        this.renderMainPreview();
        this.buildModalGrid();
    }

    public setColor(color: ColorDef): void {
        this.currentHue = color.hue ?? 192;
        this.renderMainPreview();
        this.redrawAllModalCanvases();
    }

    public openModal(): void {
        if (!this.modalEl) return;
        this.modalEl.classList.remove('hidden');
        this.updateActiveCardClass();
        this.redrawAllModalCanvases();
    }

    public closeModal(): void {
        if (!this.modalEl) return;
        this.modalEl.classList.add('hidden');
    }

    public selectTank(blueprintId: string): void {
        if (!tankBlueprintRegistry.has(blueprintId)) return;
        this.selectedBlueprintId = blueprintId;
        localStorage.setItem('bubble_selected_tank', blueprintId);
        this.renderMainPreview();
        this.updateActiveCardClass();
        this.closeModal();
    }

    public renderMainPreview(): void {
        const bp = tankBlueprintRegistry.get(this.selectedBlueprintId);
        const meta = TANK_META[bp.id] || {
            role: 'БОЕВОЙ ТАНК',
            description: bp.name,
            speedRating: 3,
            damageRating: 3,
            difficulty: 'Средне',
        };

        const gunDef = bp.guns[0];
        const gunSpec = gunTypeRegistry.get(gunDef.gunTypeId);
        const barrel = gunSpec.barrels[0];
        const projType = projectileTypeRegistry.get(barrel.projectileTypeId);

        if (this.previewRoleEl) this.previewRoleEl.textContent = meta.role;
        if (this.previewNameEl) this.previewNameEl.textContent = bp.name;
        if (this.previewDescEl) this.previewDescEl.textContent = meta.description;

        if (this.previewValHpEl) this.previewValHpEl.textContent = `${bp.maxHp}`;
        if (this.previewBarHpEl) {
            this.previewBarHpEl.style.width = `${Math.min(100, (bp.maxHp / 160) * 100)}%`;
        }

        if (this.previewValSpeedEl) this.previewValSpeedEl.textContent = `${meta.speedRating}/5`;
        if (this.previewBarSpeedEl) {
            this.previewBarSpeedEl.style.width = `${(meta.speedRating / 5) * 100}%`;
        }

        if (this.previewValDamageEl) this.previewValDamageEl.textContent = `${meta.damageRating}/5`;
        if (this.previewBarDamageEl) {
            this.previewBarDamageEl.style.width = `${(meta.damageRating / 5) * 100}%`;
        }

        if (this.previewWeaponTextEl) {
            const countPrefix =
                bp.guns.length > 1
                    ? `${bp.guns.length}x `
                    : barrel.bulletsPerShot && barrel.bulletsPerShot > 1
                      ? `${barrel.bulletsPerShot}x `
                      : '';
            this.previewWeaponTextEl.textContent = `${countPrefix}${gunSpec.name} (${projType.damage} ур.)`;
        }

        if (this.previewCanvasEl) {
            this.drawTankOnCanvas(this.previewCanvasEl, bp, this.currentHue);
        }
    }

    private buildModalGrid(): void {
        if (!this.gridEl) return;
        this.gridEl.innerHTML = '';

        for (const bp of DEFAULT_TANK_BLUEPRINTS) {
            const meta = TANK_META[bp.id] || {
                role: 'ТАНК',
                description: bp.name,
                speedRating: 3,
                damageRating: 3,
                difficulty: 'Средне',
            };

            const card = document.createElement('div');
            card.className = `tank-card ${bp.id === this.selectedBlueprintId ? 'active' : ''}`;
            card.dataset.blueprintId = bp.id;

            // Compute main gun details
            const gunDef = bp.guns[0];
            const gunSpec = gunTypeRegistry.get(gunDef.gunTypeId);
            const barrel = gunSpec.barrels[0];
            const projType = projectileTypeRegistry.get(barrel.projectileTypeId);

            const countPrefix =
                bp.guns.length > 1
                    ? `${bp.guns.length}x `
                    : barrel.bulletsPerShot && barrel.bulletsPerShot > 1
                      ? `${barrel.bulletsPerShot}x `
                      : '';

            card.innerHTML = `
                <div class="tank-card-header">
                    <span class="tank-role-badge">${meta.role}</span>
                    <span class="tank-diff-badge">${meta.difficulty}</span>
                </div>
                <div class="tank-card-canvas-box">
                    <canvas class="tank-card-canvas" width="140" height="110" data-bp="${bp.id}"></canvas>
                </div>
                <div class="tank-card-body">
                    <h3 class="tank-card-title">${bp.name}</h3>
                    <p class="tank-card-desc">${meta.description}</p>

                    <div class="tank-stats-list">
                        <div class="tank-stat-row">
                            <span class="stat-label">Прочность (HP)</span>
                            <span class="stat-val">${bp.maxHp}</span>
                            <div class="stat-bar-bg"><div class="stat-bar-fill hp" style="width: ${Math.min(100, (bp.maxHp / 160) * 100)}%"></div></div>
                        </div>
                        <div class="tank-stat-row">
                            <span class="stat-label">Скорость</span>
                            <span class="stat-val">${meta.speedRating}/5</span>
                            <div class="stat-bar-bg"><div class="stat-bar-fill speed" style="width: ${(meta.speedRating / 5) * 100}%"></div></div>
                        </div>
                        <div class="tank-stat-row">
                            <span class="stat-label">Урон / Залп</span>
                            <span class="stat-val">${meta.damageRating}/5</span>
                            <div class="stat-bar-bg"><div class="stat-bar-fill damage" style="width: ${(meta.damageRating / 5) * 100}%"></div></div>
                        </div>
                    </div>

                    <div class="tank-weapon-info">
                        <span class="weapon-icon">🫧</span>
                        <span class="weapon-text">${countPrefix}${gunSpec.name} (${projType.damage} урона)</span>
                    </div>
                </div>
                <button class="btn-bubble btn-select-tank ${bp.id === this.selectedBlueprintId ? 'btn-active' : ''}">
                    ${bp.id === this.selectedBlueprintId ? '✓ ВЫБРАН' : 'ВЫБРАТЬ'}
                </button>
            `;

            card.addEventListener('click', () => {
                this.selectTank(bp.id);
            });

            this.gridEl.appendChild(card);
        }

        this.redrawAllModalCanvases();
    }

    private updateActiveCardClass(): void {
        if (!this.gridEl) return;
        const cards = this.gridEl.querySelectorAll('.tank-card');
        cards.forEach((c) => {
            const cardEl = c as HTMLElement;
            const isCurrent = cardEl.dataset.blueprintId === this.selectedBlueprintId;
            cardEl.classList.toggle('active', isCurrent);
            const btn = cardEl.querySelector('.btn-select-tank');
            if (btn) {
                btn.textContent = isCurrent ? '✓ ВЫБРАН' : 'ВЫБРАТЬ';
                btn.classList.toggle('btn-active', isCurrent);
            }
        });
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
