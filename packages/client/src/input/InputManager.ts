import { GAME_CONFIG, PlayerInput } from '@bubble-wars/shared';
import { soundFx } from '../audio/SoundFx.js';

export class InputManager {
  private keys = new Set<string>();
  private mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2, down: false };
  private inputSeq: number = 0;
  private lastShootTime: number = 0;

  private onKeyDown = (e: KeyboardEvent) => this.keys.add(e.code);
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
  private onMouseMove = (e: MouseEvent) => {
    this.mouse.x = e.clientX;
    this.mouse.y = e.clientY;
  };
  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) this.mouse.down = true;
  };
  private onMouseUp = () => {
    this.mouse.down = false;
  };

  constructor() {
    this.setupListeners();
  }

  private setupListeners(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
  }

  public getInput(): PlayerInput {
    const up = this.keys.has('KeyW') || this.keys.has('ArrowUp');
    const down = this.keys.has('KeyS') || this.keys.has('ArrowDown');
    const left = this.keys.has('KeyA') || this.keys.has('ArrowLeft');
    const right = this.keys.has('KeyD') || this.keys.has('ArrowRight');

    const screenCenterX = window.innerWidth / 2;
    const screenCenterY = window.innerHeight / 2;
    const aimAngle = Math.atan2(this.mouse.y - screenCenterY, this.mouse.x - screenCenterX);

    const shooting = this.mouse.down || this.keys.has('Space');

    if (shooting && Date.now() - this.lastShootTime >= GAME_CONFIG.PROJECTILE.COOLDOWN_MS) {
      soundFx.playShoot();
      this.lastShootTime = Date.now();
    }

    return {
      up: !!up,
      down: !!down,
      left: !!left,
      right: !!right,
      aimAngle,
      shooting: !!shooting,
      seq: ++this.inputSeq,
    };
  }

  public reset(): void {
    this.keys.clear();
    this.mouse.down = false;
  }

  public destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.reset();
  }
}
