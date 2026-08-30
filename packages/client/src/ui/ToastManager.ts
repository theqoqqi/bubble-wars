export type ToastType = 'error' | 'warn' | 'success' | 'info';

function escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

export class ToastManager {
    private container: HTMLElement | null = null;

    public init(): void {
        let el = document.getElementById('toast-container');
        if (!el) {
            el = document.createElement('div');
            el.id = 'toast-container';
            el.className = 'toast-container';
            document.body.appendChild(el);
        }
        this.container = el;
    }

    public show(message: string, type: ToastType = 'error', durationMs: number = 4000): void {
        if (!this.container) {
            this.init();
        }
        if (!this.container) return;

        const toast = document.createElement('div');
        toast.className = `toast-item toast-${type}`;

        const icon =
            type === 'error'
                ? '⚠️'
                : type === 'warn'
                ? '⚡'
                : type === 'success'
                ? '✅'
                : 'ℹ️';

        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <span class="toast-message">${escapeHtml(message)}</span>
            <button class="toast-close" type="button" aria-label="Закрыть">&times;</button>
        `;

        const removeToast = () => {
            if (toast.classList.contains('toast-leaving')) return;
            toast.classList.add('toast-leaving');
            toast.addEventListener(
                'animationend',
                () => {
                    toast.remove();
                },
                { once: true }
            );
        };

        const closeBtn = toast.querySelector('.toast-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeToast();
            });
        }

        toast.addEventListener('click', removeToast);

        this.container.appendChild(toast);

        if (durationMs > 0) {
            setTimeout(removeToast, durationMs);
        }
    }

    public error(message: string, durationMs?: number): void {
        this.show(message, 'error', durationMs);
    }

    public warn(message: string, durationMs?: number): void {
        this.show(message, 'warn', durationMs);
    }

    public success(message: string, durationMs?: number): void {
        this.show(message, 'success', durationMs);
    }

    public info(message: string, durationMs?: number): void {
        this.show(message, 'info', durationMs);
    }
}

export const toastManager = new ToastManager();
