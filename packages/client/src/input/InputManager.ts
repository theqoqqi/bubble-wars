import { PlayerInput } from '@bubble-wars/shared';
import { TouchControls } from './TouchControls.js';

export class InputManager {
    private keys = new Set<string>();
    private mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2, down: false };
    private touchControls: TouchControls;
    private inputSeq: number = 0;
    private lastAimAngle: number = 0;

    private onKeyDown = (e: KeyboardEvent) => this.keys.add(e.code);
    private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
    private onMouseMove = (e: MouseEvent) => {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
    };
    private onMouseDown = (e: MouseEvent) => {
        if (e.button === 0) {
            this.mouse.down = true;
        } else {
            e.preventDefault();
        }
    };
    private onMouseUp = (e: MouseEvent) => {
        if (e.button === 0) {
            this.mouse.down = false;
        } else {
            e.preventDefault();
        }
    };
    private onContextMenu = (e: MouseEvent) => {
        e.preventDefault();
    };
    private onAuxClick = (e: MouseEvent) => {
        e.preventDefault();
    };

    constructor() {
        this.touchControls = new TouchControls();
        this.setupListeners();
    }

    private setupListeners(): void {
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        window.addEventListener('mousemove', this.onMouseMove);
        window.addEventListener('mousedown', this.onMouseDown);
        window.addEventListener('mouseup', this.onMouseUp);
        window.addEventListener('contextmenu', this.onContextMenu);
        window.addEventListener('auxclick', this.onAuxClick);
    }

    public setTouchEnabled(enabled: boolean): void {
        this.touchControls.setEnabled(enabled);
    }

    public isTouchDevice(): boolean {
        return this.touchControls.getIsTouchDevice();
    }

    public getInput(): PlayerInput {
        const keyUp = this.keys.has('KeyW') || this.keys.has('ArrowUp');
        const keyDown = this.keys.has('KeyS') || this.keys.has('ArrowDown');
        const keyLeft = this.keys.has('KeyA') || this.keys.has('ArrowLeft');
        const keyRight = this.keys.has('KeyD') || this.keys.has('ArrowRight');

        const touch = this.touchControls.getState();

        const up = keyUp || touch.up;
        const down = keyDown || touch.down;
        const left = keyLeft || touch.left;
        const right = keyRight || touch.right;

        let aimAngle: number;
        if (touch.hasAim) {
            aimAngle = touch.aimAngle;
            this.lastAimAngle = aimAngle;
        } else if (!this.touchControls.getIsTouchDevice() || this.mouse.down) {
            const screenCenterX = window.innerWidth / 2;
            const screenCenterY = window.innerHeight / 2;
            aimAngle = Math.atan2(this.mouse.y - screenCenterY, this.mouse.x - screenCenterX);
            this.lastAimAngle = aimAngle;
        } else {
            aimAngle = this.lastAimAngle;
        }

        const shooting = this.mouse.down || this.keys.has('Space') || touch.shooting;

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

    public getMouse(): { x: number; y: number; down: boolean } {
        return this.mouse;
    }

    public reset(): void {
        this.keys.clear();
        this.mouse.down = false;
        this.touchControls.reset();
    }

    public destroy(): void {
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        window.removeEventListener('mousemove', this.onMouseMove);
        window.removeEventListener('mousedown', this.onMouseDown);
        window.removeEventListener('mouseup', this.onMouseUp);
        window.removeEventListener('contextmenu', this.onContextMenu);
        window.removeEventListener('auxclick', this.onAuxClick);
        this.touchControls.destroy();
        this.reset();
    }
}

