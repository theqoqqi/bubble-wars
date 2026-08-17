import { ColorDef } from '@bubble-wars/shared';
import { Game } from './game/Game.js';
import { networkManager } from './net/NetworkManager.js';
import { soundFx } from './audio/SoundFx.js';

const COLOR_HUES: Record<string, number> = {
    cyan: 192,
    coral: 326,
    lime: 130,
    violet: 280,
    amber: 42,
};

let selectedColor: ColorDef = { hue: 192 };

// 1. Initialize Game Instance & Start Native Game Loop
const game = new Game('game-container');
game.start();

// 2. DOM UI Bindings
window.addEventListener('DOMContentLoaded', () => {
    const joinModal = document.getElementById('join-modal');
    const gameHud = document.getElementById('game-hud');
    const joinForm = document.getElementById('join-form') as HTMLFormElement;
    const nameInput = document.getElementById('player-name-input') as HTMLInputElement;
    const serverInput = document.getElementById('server-url-input') as HTMLInputElement;
    const hudPlayerName = document.getElementById('hud-player-name');
    const btnMute = document.getElementById('btn-mute');
    const btnPlay = document.getElementById('btn-play');
    const btnRespawn = document.getElementById('btn-respawn');
    const colorDots = document.querySelectorAll('.color-dot, .color-btn');

    // Pre-fill server address input
    if (serverInput) {
        serverInput.value = networkManager.serverUrl;
        serverInput.addEventListener('input', () => {
            if (serverInput.value.trim()) {
                networkManager.setServerUrl(serverInput.value.trim());
            }
        });
    }

    // Color selection
    colorDots.forEach((btn) => {
        btn.addEventListener('click', (e) => {
            colorDots.forEach((b) => b.classList.remove('active'));
            const target = e.currentTarget as HTMLElement;
            target.classList.add('active');
            const colorName = target.dataset.color || 'cyan';
            selectedColor = { hue: COLOR_HUES[colorName] ?? 192 };
        });
    });

    // Sound toggle
    if (btnMute) {
        btnMute.addEventListener('click', () => {
            const isMuted = soundFx.toggleMute();
            btnMute.textContent = isMuted ? '🔇' : '🔊';
        });
    }

    const startGame = async () => {
        soundFx.unlock();

        const name = nameInput?.value.trim() || 'BubbleHero';
        if (hudPlayerName) hudPlayerName.textContent = name;

        if (serverInput && serverInput.value.trim()) {
            networkManager.setServerUrl(serverInput.value.trim());
        }

        try {
            await networkManager.connect();
            networkManager.join(name, selectedColor, 'classic');

            if (joinModal) joinModal.classList.add('hidden');
            if (gameHud) gameHud.classList.remove('hidden');
        } catch (err) {
            alert(
                `Не удалось подключиться к серверу Bubble Wars (${networkManager.serverUrl}).\nУбедитесь, что сервер запущен и доступен!`
            );
            console.error('Connection failed:', err);
        }
    };

    if (btnPlay) {
        btnPlay.addEventListener('click', startGame);
    }

    if (nameInput) {
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                startGame();
            }
        });
    }

    const leaveModal = document.getElementById('leave-modal');
    const deathModal = document.getElementById('death-modal');
    const gameoverModal = document.getElementById('gameover-modal');
    const btnLeaveConfirm = document.getElementById('btn-leave-confirm');
    const btnLeaveCancel = document.getElementById('btn-leave-cancel');

    const returnToMenu = () => {
        networkManager.disconnect();
        game.leaveGame();
        if (leaveModal) leaveModal.classList.add('hidden');
        if (gameoverModal) gameoverModal.classList.add('hidden');
        if (deathModal) deathModal.classList.add('hidden');
        if (gameHud) gameHud.classList.add('hidden');
        if (joinModal) joinModal.classList.remove('hidden');
    };

    const toggleLeaveModal = () => {
        // Only toggle leave modal if we are in an active game (menu is closed)
        if (joinModal && !joinModal.classList.contains('hidden')) {
            return;
        }
        if (!leaveModal) return;

        if (leaveModal.classList.contains('hidden')) {
            leaveModal.classList.remove('hidden');
        } else {
            leaveModal.classList.add('hidden');
        }
    };

    // Escape key handler for leaving lobby / closing confirmation
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            toggleLeaveModal();
        }
    });

    // Leave confirmation actions
    if (btnLeaveConfirm) {
        btnLeaveConfirm.addEventListener('click', returnToMenu);
    }

    if (btnLeaveCancel) {
        btnLeaveCancel.addEventListener('click', () => {
            if (leaveModal) leaveModal.classList.add('hidden');
        });
    }

    // Respawn button
    if (btnRespawn) {
        btnRespawn.addEventListener('click', () => {
            networkManager.respawn();
            if (deathModal) deathModal.classList.add('hidden');
        });
    }

    // Game Over Rematch button
    const btnRematch = document.getElementById('btn-rematch');
    if (btnRematch) {
        btnRematch.addEventListener('click', () => {
            networkManager.rematch();
            if (gameoverModal) gameoverModal.classList.add('hidden');
        });
    }

    // Game Over Menu button
    const btnGameOverMenu = document.getElementById('btn-gameover-menu');
    if (btnGameOverMenu) {
        btnGameOverMenu.addEventListener('click', returnToMenu);
    }
});
