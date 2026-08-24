import { ClientStatusManager } from './ClientStatusManager.js';
import { SlowClientStatusEffect } from './handlers/index.js';

/**
 * Инициализация и регистрация стандартных клиентских статус-эффектов
 */
export function initClientStatuses(manager: ClientStatusManager): void {
    manager.register(new SlowClientStatusEffect());
}
