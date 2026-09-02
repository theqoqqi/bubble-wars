/**
 * Client visual, interpolation and animation constants
 */
export const CLIENT_CONFIG = {
    INTERPOLATION: {
        TANK: 0.45,
        OBSTACLE: 0.4,
        PROJECTILE: 0.6,
    },
    ANIMATION: {
        FLASH_DECAY_TANK: 3.2,
        FLASH_DECAY_PLAYER: 2.0,
        SHAKE_DECAY: 28,
        WOBBLE_SPRING: 170,
        WOBBLE_DAMPING: 9,
        WOBBLE_MAX: 0.45,
        TRAIL_MAX_LENGTH: 5,
    },
    SHAKE: {
        HIT: 12,
        KILL_POP: 14,
        MAX: 18,
    },
    HUD: {
        KILL_FEED_TIMEOUT_MS: 4000,
        KILL_ALERT_DURATION_SEC: 1.5,
        /**
         * Коэффициент перевода физической скорости Matter.js (body.velocity)
         * в характеристику скорости из конфига танка (blueprint.speed):
         * (60 * 60) / 1000 = 3600 / 1000 = 3.6
         * - 60 — базовая частота Matter.js (Body._baseDelta = 1000 / 60 мс)
         * - 60 * 60 = 3600 — квадрат частоты из квадратичного шага времени (deltaTime^2) в интеграторе Верле
         * - 1000 — делитель миллисекунд в формуле тяги ServerTank.ts ((speed * mass * damping) / 1000)
         */
        VELOCITY_TO_BLUEPRINT_SPEED: (60 * 60) / 1000,
    },
    RENDER: {
        CAMERA_LERP: 0.1,
        MAX_DPR: 2,
    },
    TOUCH: {
        MAX_STICK_RADIUS: 55,
        DEADZONE_MOVE: 14,
        DEADZONE_AIM: 12,
        AUTOFIRE_THRESHOLD: 20,
    },
};
