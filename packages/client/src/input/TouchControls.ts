import { CLIENT_CONFIG } from '../config.js';

export interface TouchInputState {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
    aimAngle: number;
    hasAim: boolean;
    shooting: boolean;
}

interface VirtualStick {
    touchId: number | null;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    active: boolean;
    startTime: number;
    elementBase: HTMLElement | null;
    elementKnob: HTMLElement | null;
    elementPointer?: HTMLElement | null;
    elementGlyph?: HTMLElement | null;
}

export class TouchControls {
    private enabled: boolean = false;
    private isTouchDevice: boolean = false;

    private state: TouchInputState = {
        up: false,
        down: false,
        left: false,
        right: false,
        aimAngle: 0,
        hasAim: false,
        shooting: false,
    };

    private moveStick: VirtualStick = {
        touchId: null,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        active: false,
        startTime: 0,
        elementBase: null,
        elementKnob: null,
        elementGlyph: null,
    };

    private aimStick: VirtualStick = {
        touchId: null,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        active: false,
        startTime: 0,
        elementBase: null,
        elementKnob: null,
        elementPointer: null,
        elementGlyph: null,
    };

    private tapShotTimer: number | null = null;
    private container: HTMLElement | null = null;

    constructor() {
        const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
        const isMobileUserAgent = /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent);

        this.isTouchDevice = isCoarsePointer || isMobileUserAgent;

        if (this.isTouchDevice) {
            document.body.classList.add('is-touch-device');
        }

        this.createElements();
        this.setupListeners();
    }


    public getIsTouchDevice(): boolean {
        return this.isTouchDevice;
    }

    public setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        if (!enabled) {
            this.reset();
        } else {
            this.updateIdlePositions();
        }
        this.updateContainerVisibility();
    }

    public getState(): TouchInputState {
        return this.state;
    }

    private createElements(): void {
        const root = document.createElement('div');
        root.id = 'touch-controls-overlay';
        root.className = 'touch-controls-overlay';
        root.style.position = 'fixed';
        root.style.top = '0';
        root.style.left = '0';
        root.style.width = '100vw';
        root.style.height = '100vh';
        root.style.pointerEvents = 'none';
        root.style.zIndex = '15';
        root.style.userSelect = 'none';
        root.style.display = 'none';

        // 1. Move Stick Elements (Left)
        const moveBase = document.createElement('div');
        moveBase.className = 'touch-stick-base touch-move-base is-idle';

        const moveGlyph = document.createElement('div');
        moveGlyph.className = 'touch-stick-glyph';
        moveGlyph.innerHTML = `
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3v4M12 17v4M3 12h4M17 12h4"/>
                <path d="M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"/>
            </svg>
        `;

        const moveKnob = document.createElement('div');
        moveKnob.className = 'touch-stick-knob touch-move-knob';

        moveBase.appendChild(moveGlyph);
        moveBase.appendChild(moveKnob);
        root.appendChild(moveBase);

        this.moveStick.elementBase = moveBase;
        this.moveStick.elementKnob = moveKnob;
        this.moveStick.elementGlyph = moveGlyph;

        // 2. Aim Stick Elements (Right)
        const aimBase = document.createElement('div');
        aimBase.className = 'touch-stick-base touch-aim-base is-idle';

        const aimGlyph = document.createElement('div');
        aimGlyph.className = 'touch-stick-glyph';
        aimGlyph.innerHTML = `
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="8"/>
                <circle cx="12" cy="12" r="3" fill="currentColor"/>
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
            </svg>
        `;

        const aimKnob = document.createElement('div');
        aimKnob.className = 'touch-stick-knob touch-aim-knob';
        const aimPointer = document.createElement('div');
        aimPointer.className = 'touch-aim-pointer';

        aimBase.appendChild(aimGlyph);
        aimBase.appendChild(aimPointer);
        aimBase.appendChild(aimKnob);
        root.appendChild(aimBase);

        this.aimStick.elementBase = aimBase;
        this.aimStick.elementKnob = aimKnob;
        this.aimStick.elementPointer = aimPointer;
        this.aimStick.elementGlyph = aimGlyph;

        document.body.appendChild(root);
        this.container = root;

        this.updateIdlePositions();
    }

    private setupListeners(): void {
        window.addEventListener('touchstart', this.onTouchStart, { passive: false });
        window.addEventListener('touchmove', this.onTouchMove, { passive: false });
        window.addEventListener('touchend', this.onTouchEnd, { passive: false });
        window.addEventListener('touchcancel', this.onTouchCancel, { passive: false });
        window.addEventListener('resize', this.onResize);
    }

    private onResize = (): void => {
        if (this.enabled) {
            this.updateIdlePositions();
        }
    };

    private isInteractiveElement(target: EventTarget | null): boolean {
        if (!target || !(target instanceof HTMLElement)) return false;
        return !!target.closest(
            'button, input, a, select, textarea, .overlay:not(.hidden), .hud-actions, .sound-slider-popup, .name-input-row, .color-picker-row'
        );
    }

    private getIdlePosition(isLeft: boolean): { x: number; y: number } {
        const marginX = Math.max(75, Math.min(130, window.innerWidth * 0.14));
        const marginY = Math.max(75, Math.min(105, window.innerHeight * 0.22));

        return {
            x: isLeft ? marginX : window.innerWidth - marginX,
            y: window.innerHeight - marginY,
        };
    }

    private updateIdlePositions(): void {
        if (!this.moveStick.active && this.moveStick.elementBase) {
            const pos = this.getIdlePosition(true);
            this.moveStick.elementBase.style.left = `${pos.x}px`;
            this.moveStick.elementBase.style.top = `${pos.y}px`;
            this.moveStick.elementBase.classList.add('is-idle');
            this.moveStick.elementBase.classList.remove('is-active');
            if (this.moveStick.elementKnob) {
                this.moveStick.elementKnob.style.transform = 'translate(0px, 0px)';
            }
        }

        if (!this.aimStick.active && this.aimStick.elementBase) {
            const pos = this.getIdlePosition(false);
            this.aimStick.elementBase.style.left = `${pos.x}px`;
            this.aimStick.elementBase.style.top = `${pos.y}px`;
            this.aimStick.elementBase.classList.add('is-idle');
            this.aimStick.elementBase.classList.remove('is-active');
            if (this.aimStick.elementKnob) {
                this.aimStick.elementKnob.style.transform = 'translate(0px, 0px)';
            }
            if (this.aimStick.elementPointer) {
                this.aimStick.elementPointer.style.opacity = '0';
            }
        }
    }

    private onTouchStart = (e: TouchEvent): void => {
        if (!this.isTouchDevice) {
            this.isTouchDevice = true;
            document.body.classList.add('is-touch-device');
        }

        if (!this.enabled) return;

        let handledAny = false;

        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (this.isInteractiveElement(touch.target)) continue;

            const isLeft = touch.clientX < window.innerWidth / 2;

            if (isLeft && this.moveStick.touchId === null) {
                handledAny = true;
                this.moveStick.touchId = touch.identifier;
                this.moveStick.startX = touch.clientX;
                this.moveStick.startY = touch.clientY;
                this.moveStick.currentX = touch.clientX;
                this.moveStick.currentY = touch.clientY;
                this.moveStick.active = true;
                this.moveStick.startTime = performance.now();

                this.showActiveStick(this.moveStick, touch.clientX, touch.clientY);
            } else if (!isLeft && this.aimStick.touchId === null) {
                handledAny = true;
                this.aimStick.touchId = touch.identifier;
                this.aimStick.startX = touch.clientX;
                this.aimStick.startY = touch.clientY;
                this.aimStick.currentX = touch.clientX;
                this.aimStick.currentY = touch.clientY;
                this.aimStick.active = true;
                this.aimStick.startTime = performance.now();

                this.showActiveStick(this.aimStick, touch.clientX, touch.clientY);
            }
        }

        if (handledAny) {
            this.updateContainerVisibility();
            e.preventDefault();
        }
    };

    private onTouchMove = (e: TouchEvent): void => {
        if (!this.enabled) return;

        let handledAny = false;
        const maxRadius = CLIENT_CONFIG.TOUCH.MAX_STICK_RADIUS;

        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];

            if (touch.identifier === this.moveStick.touchId) {
                handledAny = true;
                const dx = touch.clientX - this.moveStick.startX;
                const dy = touch.clientY - this.moveStick.startY;
                const dist = Math.hypot(dx, dy);

                const clampedDist = Math.min(dist, maxRadius);
                const angle = Math.atan2(dy, dx);
                const knobX = Math.cos(angle) * clampedDist;
                const knobY = Math.sin(angle) * clampedDist;

                this.moveStick.currentX = this.moveStick.startX + knobX;
                this.moveStick.currentY = this.moveStick.startY + knobY;

                if (this.moveStick.elementKnob) {
                    this.moveStick.elementKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;
                }

                // Calculate 8-directional movement with deadzone
                if (dist > CLIENT_CONFIG.TOUCH.DEADZONE_MOVE) {
                    this.state.right = Math.cos(angle) > 0.38;
                    this.state.left = Math.cos(angle) < -0.38;
                    this.state.down = Math.sin(angle) > 0.38;
                    this.state.up = Math.sin(angle) < -0.38;
                } else {
                    this.state.up = false;
                    this.state.down = false;
                    this.state.left = false;
                    this.state.right = false;
                }
            } else if (touch.identifier === this.aimStick.touchId) {
                handledAny = true;
                const dx = touch.clientX - this.aimStick.startX;
                const dy = touch.clientY - this.aimStick.startY;
                const dist = Math.hypot(dx, dy);

                const clampedDist = Math.min(dist, maxRadius);
                const angle = Math.atan2(dy, dx);
                const knobX = Math.cos(angle) * clampedDist;
                const knobY = Math.sin(angle) * clampedDist;

                this.aimStick.currentX = this.aimStick.startX + knobX;
                this.aimStick.currentY = this.aimStick.startY + knobY;

                if (this.aimStick.elementKnob) {
                    this.aimStick.elementKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;
                }

                if (this.aimStick.elementPointer) {
                    this.aimStick.elementPointer.style.transform = `rotate(${angle}rad)`;
                    this.aimStick.elementPointer.style.opacity = dist > CLIENT_CONFIG.TOUCH.DEADZONE_AIM ? '1' : '0.2';
                }

                if (dist > CLIENT_CONFIG.TOUCH.DEADZONE_AIM) {
                    this.state.aimAngle = angle;
                    this.state.hasAim = true;
                }

                // Continuous autofire when dragged past autofire threshold
                this.state.shooting = dist > CLIENT_CONFIG.TOUCH.AUTOFIRE_THRESHOLD;
            }
        }

        if (handledAny) {
            e.preventDefault();
        }
    };

    private onTouchEnd = (e: TouchEvent): void => {
        let handledAny = false;

        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];

            if (touch.identifier === this.moveStick.touchId) {
                handledAny = true;
                this.releaseStick(this.moveStick, true);
                this.state.up = false;
                this.state.down = false;
                this.state.left = false;
                this.state.right = false;
            } else if (touch.identifier === this.aimStick.touchId) {
                handledAny = true;

                // Check for quick tap (single tap shot)
                const duration = performance.now() - this.aimStick.startTime;
                const dist = Math.hypot(
                    touch.clientX - this.aimStick.startX,
                    touch.clientY - this.aimStick.startY
                );

                if (duration < 220 && dist < 18) {
                    this.triggerTapShot();
                }

                this.releaseStick(this.aimStick, false);
                this.state.shooting = false;
                this.state.hasAim = false;
            }
        }

        if (handledAny) {
            this.updateContainerVisibility();
            e.preventDefault();
        }
    };

    private onTouchCancel = (e: TouchEvent): void => {
        this.onTouchEnd(e);
    };

    private triggerTapShot(): void {
        this.state.shooting = true;
        if (this.tapShotTimer !== null) {
            window.clearTimeout(this.tapShotTimer);
        }
        this.tapShotTimer = window.setTimeout(() => {
            if (this.aimStick.touchId === null) {
                this.state.shooting = false;
            }
            this.tapShotTimer = null;
        }, 120);
    }

    private showActiveStick(stick: VirtualStick, x: number, y: number): void {
        if (!stick.elementBase || !stick.elementKnob) return;
        stick.elementBase.style.left = `${x}px`;
        stick.elementBase.style.top = `${y}px`;
        stick.elementBase.classList.remove('is-idle');
        stick.elementBase.classList.add('is-active');
        stick.elementKnob.style.transform = 'translate(0px, 0px)';
        if (stick.elementPointer) {
            stick.elementPointer.style.opacity = '0';
        }
    }

    private releaseStick(stick: VirtualStick, isLeft: boolean): void {
        stick.touchId = null;
        stick.active = false;
        if (stick.elementBase) {
            const idlePos = this.getIdlePosition(isLeft);
            stick.elementBase.style.left = `${idlePos.x}px`;
            stick.elementBase.style.top = `${idlePos.y}px`;
            stick.elementBase.classList.remove('is-active');
            stick.elementBase.classList.add('is-idle');
        }
        if (stick.elementKnob) {
            stick.elementKnob.style.transform = 'translate(0px, 0px)';
        }
        if (stick.elementPointer) {
            stick.elementPointer.style.opacity = '0';
        }
    }

    private updateContainerVisibility(): void {
        if (!this.container) return;
        const shouldShow = this.enabled && this.isTouchDevice;
        this.container.style.display = shouldShow ? 'block' : 'none';
    }


    public reset(): void {
        this.releaseStick(this.moveStick, true);
        this.releaseStick(this.aimStick, false);
        this.state.up = false;
        this.state.down = false;
        this.state.left = false;
        this.state.right = false;
        this.state.shooting = false;
        this.state.hasAim = false;
        if (this.tapShotTimer !== null) {
            window.clearTimeout(this.tapShotTimer);
            this.tapShotTimer = null;
        }
        this.updateContainerVisibility();
    }

    public destroy(): void {
        window.removeEventListener('touchstart', this.onTouchStart);
        window.removeEventListener('touchmove', this.onTouchMove);
        window.removeEventListener('touchend', this.onTouchEnd);
        window.removeEventListener('touchcancel', this.onTouchCancel);
        window.removeEventListener('resize', this.onResize);
        this.reset();
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}
