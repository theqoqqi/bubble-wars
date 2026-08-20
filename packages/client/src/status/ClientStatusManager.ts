import { Registry, StatusSnapshot } from '@bubble-wars/shared';
import { ClientTankState } from '../types.js';
import { ClientStatusContext, ClientStatusEffect } from './ClientStatusEffect.js';

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

interface ActiveStatusState {
    lastRemainingMs: number;
    totalDurationMs: number;
}

/**
 * Центральный менеджер клиентских статус-эффектов.
 * Управляет жизненным циклом (apply/refresh/update/remove) и отрисовкой оверлеев и бейджей.
 */
export class ClientStatusManager {
    private registry = new Registry<ClientStatusEffect>('ClientStatusRegistry');
    private tankStatuses = new Map<string, Map<string, ActiveStatusState>>();

    public register(effect: ClientStatusEffect): void {
        this.registry.register(effect);
    }

    public get(id: string): ClientStatusEffect {
        return this.registry.get(id);
    }

    public tryGet(id: string): ClientStatusEffect | undefined {
        return this.registry.tryGet(id);
    }

    /**
     * Синхронизирует статусы танка из сетевого снапшота и вызывает хуки жизненного цикла
     */
    public syncTankStatuses(
        tank: ClientTankState,
        snapshots: StatusSnapshot[] | undefined,
        ctx: ClientStatusContext
    ): void {
        let activeMap = this.tankStatuses.get(tank.id);
        if (!activeMap) {
            activeMap = new Map();
            this.tankStatuses.set(tank.id, activeMap);
        }

        const currentIds = new Set<string>();

        if (snapshots && snapshots.length > 0) {
            for (const snap of snapshots) {
                currentIds.add(snap.id);
                const handler = this.registry.tryGet(snap.id);
                const existing = activeMap.get(snap.id);

                if (!existing) {
                    // 1. Новое наложение статуса (Apply)
                    const totalDuration = snap.remainingMs > 0 ? snap.remainingMs : (handler?.defaultDurationMs ?? 2200);
                    activeMap.set(snap.id, {
                        lastRemainingMs: snap.remainingMs,
                        totalDurationMs: totalDuration,
                    });
                    if (handler) {
                        handler.onApply(tank, snap, ctx);
                    }
                } else {
                    // 2. Продление статуса (Refresh: таймер внезапно вырос)
                    if (snap.remainingMs > existing.lastRemainingMs + 150) {
                        existing.totalDurationMs = Math.max(existing.totalDurationMs, snap.remainingMs);
                        if (handler) {
                            handler.onRefresh(tank, snap, ctx);
                        }
                    }
                    existing.lastRemainingMs = snap.remainingMs;
                }
            }
        }

        // 3. Снятие исчезнувших статусов (Remove)
        for (const [id] of activeMap) {
            if (!currentIds.has(id)) {
                const handler = this.registry.tryGet(id);
                if (handler) {
                    handler.onRemove(tank, ctx);
                }
                activeMap.delete(id);
            }
        }
    }

    /**
     * Очищает все активные статусы танка (при смерти или выходе)
     */
    public clearTank(tankId: string, ctx: ClientStatusContext): void {
        const activeMap = this.tankStatuses.get(tankId);
        if (activeMap) {
            // Создаём пустой объект танка для вызова onRemove при очистке
            for (const [id] of activeMap) {
                const handler = this.registry.tryGet(id);
                if (handler) {
                    handler.onRemove({ id: tankId } as ClientTankState, ctx);
                }
            }
            this.tankStatuses.delete(tankId);
        }
    }

    /**
     * Покадровое обновление непрерывных эффектов (частицы, шлейфы)
     */
    public update(
        dt: number,
        tanks: Iterable<ClientTankState>,
        ctx: ClientStatusContext
    ): void {
        for (const tank of tanks) {
            if (tank.isDead || !tank.effects || tank.effects.length === 0) continue;

            for (const snap of tank.effects) {
                const handler = this.registry.tryGet(snap.id);
                if (handler) {
                    handler.onUpdate(tank, snap, dt, ctx);
                }
            }
        }
    }

    /**
     * Отрисовка оверлеев вокруг корпуса танка в игровом мире
     */
    public renderWorldOverlays(
        ctx2d: CanvasRenderingContext2D,
        tank: ClientTankState,
        gameTime: number
    ): void {
        if (!tank.effects || tank.effects.length === 0) return;

        for (const snap of tank.effects) {
            const handler = this.registry.tryGet(snap.id);
            if (handler) {
                handler.renderWorldOverlay(ctx2d, tank, snap, gameTime);
            }
        }
    }

    /**
     * Отрисовка горизонтального ряда стеклянных бейджей с таймерами и иконками под танком
     */
    public renderBadges(
        ctx2d: CanvasRenderingContext2D,
        tank: ClientTankState,
        centerX: number,
        centerY: number,
        gameTime: number
    ): void {
        if (!tank.effects || tank.effects.length === 0) return;

        const activeMap = this.tankStatuses.get(tank.id);
        const badgeRadius = 10.5;
        const badgeDiameter = badgeRadius * 2;
        const spacing = 5;
        const count = tank.effects.length;
        const totalWidth = count * badgeDiameter + (count - 1) * spacing;
        const startX = centerX - totalWidth / 2 + badgeRadius;

        for (let i = 0; i < count; i++) {
            const snap = tank.effects[i];
            const handler = this.registry.tryGet(snap.id);
            if (!handler) continue;

            const bx = startX + i * (badgeDiameter + spacing);
            const by = centerY;

            // Расчёт прогресса таймера (0..1)
            const state = activeMap?.get(snap.id);
            const totalDuration = state?.totalDurationMs || handler.defaultDurationMs || 2200;
            const progress = clamp(snap.remainingMs / totalDuration, 0, 1);

            ctx2d.save();

            // 1. Тёмная стеклянная подложка
            ctx2d.fillStyle = 'rgba(6, 14, 28, 0.72)';
            ctx2d.beginPath();
            ctx2d.arc(bx, by, badgeRadius, 0, Math.PI * 2);
            ctx2d.fill();

            // 2. Фоновый тонкий ободок
            ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.18)';
            ctx2d.lineWidth = 1.2;
            ctx2d.stroke();

            // 3. Круговой индикатор таймера отката
            if (progress > 0) {
                ctx2d.strokeStyle = handler.timerColor || '#60c0ff';
                ctx2d.lineWidth = 2.2;
                ctx2d.lineCap = 'round';
                ctx2d.beginPath();
                ctx2d.arc(
                    bx,
                    by,
                    badgeRadius - 0.5,
                    -Math.PI / 2,
                    -Math.PI / 2 + progress * Math.PI * 2
                );
                ctx2d.stroke();
            }

            // 4. Отрисовка внутренней кастомной иконки эффекта
            handler.renderIcon(ctx2d, bx, by, badgeRadius - 4, snap, gameTime);

            ctx2d.restore();
        }
    }
}
