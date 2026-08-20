import { Identifiable, StatusSnapshot } from '@bubble-wars/shared';
import { ClientTankState } from '../types.js';
import { SoundFx } from '../audio/SoundFx.js';
import { ParticleSystem } from '../graphics/ParticleSystem.js';

export interface ClientStatusContext {
    soundFx: SoundFx;
    particleSystem: ParticleSystem;
    gameTime: number;
}

/**
 * Базовый абстрактный класс для клиентских статус-эффектов
 */
export abstract class ClientStatusEffect implements Identifiable {

    public abstract readonly id: string;

    /**
     * Цвет круговой дуги таймера обратного отсчёта на бейдже
     */
    public readonly timerColor: string = '#60c0ff';

    /**
     * Номинальная длительность эффекта по умолчанию (для расчёта процента отката)
     */
    public readonly defaultDurationMs: number = 2200;

    // ─── Жизненный цикл ──────────────────────────────────────────────

    /**
     * Вызывается однократно при первом наложении статуса на танк
     */
    public onApply(
        tank: ClientTankState,
        snapshot: StatusSnapshot,
        ctx: ClientStatusContext
    ): void {}

    /**
     * Вызывается при повторном наложении / продлении времени статуса
     */
    public onRefresh(
        tank: ClientTankState,
        snapshot: StatusSnapshot,
        ctx: ClientStatusContext
    ): void {}

    /**
     * Вызывается каждый кадр (60+ FPS) для непрерывных эффектов (шлейфы, партиклы)
     */
    public onUpdate(
        tank: ClientTankState,
        snapshot: StatusSnapshot,
        dt: number,
        ctx: ClientStatusContext
    ): void {}

    /**
     * Вызывается при истечении или снятии статуса с танка
     */
    public onRemove(tank: ClientTankState, ctx: ClientStatusContext): void {}

    // ─── Отрисовка ───────────────────────────────────────────────────

    /**
     * Отрисовка оверлея в мировом пространстве вокруг корпуса танка (ауры, щиты, пузыри)
     */
    public renderWorldOverlay(
        ctx: CanvasRenderingContext2D,
        tank: ClientTankState,
        snapshot: StatusSnapshot,
        gameTime: number
    ): void {}

    /**
     * Отрисовка содержимого иконки бейджа (в центре cx, cy с радиусом radius)
     */
    public renderIcon(
        ctx: CanvasRenderingContext2D,
        cx: number,
        cy: number,
        radius: number,
        snapshot: StatusSnapshot,
        gameTime: number
    ): void {}
}
