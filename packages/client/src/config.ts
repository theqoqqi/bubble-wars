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
  },
  RENDER: {
    CAMERA_LERP: 0.1,
    MAX_DPR: 2,
  },
};
