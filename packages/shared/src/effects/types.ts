/**
 * Базовый интерфейс-маркер для наследования серверных эффектов
 */
export interface BaseImpactEffect {
    type: string;
}

/**
 * Базовый полиморфный контракт клиентского сетевого события импакта
 */
export interface ImpactEvent {
    type: string;
    x: number;
    y: number;
}
