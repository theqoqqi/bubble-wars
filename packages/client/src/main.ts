import { ColorDef, getRandomBotName } from '@bubble-wars/shared';
import { Game } from './game/Game.js';
import { networkManager } from './net/NetworkManager.js';
import { soundFx } from './audio/SoundFx.js';
import { TankSelectionManager } from './ui/TankSelectionManager.js';

const COLOR_HUES: Record<string, number> = {
    cyan: 192,
    coral: 326,
    lime: 130,
    violet: 280,
    amber: 42,
};

const savedColorName = localStorage.getItem('bubble_player_color') || 'cyan';
const initialHue = COLOR_HUES[savedColorName] ?? 192;
let selectedColor: ColorDef = { hue: initialHue };
const tankSelectionManager = new TankSelectionManager(selectedColor);

// 1. Initialize Game Instance & Start Native Game Loop
const game = new Game('game-container');
game.start();

// 2. DOM UI Bindings
window.addEventListener('DOMContentLoaded', () => {
    tankSelectionManager.init();

    const joinModal = document.getElementById('join-modal');
    const gameHud = document.getElementById('game-hud');
    const joinForm = document.getElementById('join-form') as HTMLFormElement;
    const nameInput = document.getElementById('player-name-input') as HTMLInputElement;
    const btnRandomName = document.getElementById('btn-random-name');
    const serverInput = document.getElementById('server-url-input') as HTMLInputElement;
    const hudPlayerName = document.getElementById('hud-player-name');
    const btnMute = document.getElementById('btn-mute');
    const volumeSlider = document.getElementById('sound-volume-slider') as HTMLInputElement | null;
    const volumeValue = document.getElementById('sound-volume-value');
    const sliderIcon = document.getElementById('sound-slider-icon');
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

    // Color selection & active state restoration
    colorDots.forEach((btn) => {
        const btnColor = (btn as HTMLElement).dataset.color || 'cyan';
        if (btnColor === savedColorName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }

        btn.addEventListener('click', (e) => {
            colorDots.forEach((b) => b.classList.remove('active'));
            const target = e.currentTarget as HTMLElement;
            target.classList.add('active');
            const colorName = target.dataset.color || 'cyan';
            localStorage.setItem('bubble_player_color', colorName);
            selectedColor = { hue: COLOR_HUES[colorName] ?? 192 };
            tankSelectionManager.setColor(selectedColor);
        });
    });

    const updateSoundUI = () => {
        const isMuted = soundFx.isMuted;
        const vol = soundFx.getVolume();
        const pct = Math.round(vol * 100);

        if (volumeSlider) {
            volumeSlider.value = isMuted ? '0' : pct.toString();
        }
        if (volumeValue) {
            volumeValue.textContent = isMuted ? '0%' : `${pct}%`;
        }

        const icon = isMuted || vol === 0 ? '🔇' : vol < 0.4 ? '🔉' : '🔊';
        if (btnMute) btnMute.textContent = icon;
        if (sliderIcon) sliderIcon.textContent = icon;
    };

    // Initialize sound UI with saved settings
    updateSoundUI();

    // Sound toggle & volume slider controls
    const soundControlWrap = document.getElementById('sound-control-wrap');
    const soundSliderPopup = document.getElementById('sound-slider-popup');
    let soundPopupHideTimer: number | null = null;
    let isDraggingVolume = false;

    const showSoundPopup = () => {
        if (soundPopupHideTimer !== null) {
            window.clearTimeout(soundPopupHideTimer);
            soundPopupHideTimer = null;
        }
        soundSliderPopup?.classList.add('active');
    };

    const scheduleHideSoundPopup = () => {
        if (isDraggingVolume) return;
        if (soundPopupHideTimer !== null) {
            window.clearTimeout(soundPopupHideTimer);
        }
        soundPopupHideTimer = window.setTimeout(() => {
            if (!isDraggingVolume) {
                soundSliderPopup?.classList.remove('active');
            }
            soundPopupHideTimer = null;
        }, 350);
    };

    if (soundControlWrap) {
        soundControlWrap.addEventListener('mouseenter', showSoundPopup);
        soundControlWrap.addEventListener('mouseleave', scheduleHideSoundPopup);
    }

    if (btnMute) {
        btnMute.addEventListener('click', () => {
            soundFx.toggleMute();
            updateSoundUI();
        });
    }

    if (volumeSlider) {
        volumeSlider.addEventListener('mousedown', () => {
            isDraggingVolume = true;
            showSoundPopup();
        });
        volumeSlider.addEventListener('touchstart', () => {
            isDraggingVolume = true;
            showSoundPopup();
        });
        volumeSlider.addEventListener('input', () => {
            const val = parseFloat(volumeSlider.value) / 100;
            soundFx.setVolume(val);
            updateSoundUI();
        });
    }

    window.addEventListener('mouseup', () => {
        if (isDraggingVolume) {
            isDraggingVolume = false;
            scheduleHideSoundPopup();
        }
    });
    window.addEventListener('touchend', () => {
        if (isDraggingVolume) {
            isDraggingVolume = false;
            scheduleHideSoundPopup();
        }
    });

    // Keyboard shortcut 'M' for mute/unmute
    window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyM') {
            const activeTag = (document.activeElement?.tagName || '').toLowerCase();
            if (activeTag === 'input' || activeTag === 'textarea') return;
            soundFx.toggleMute();
            updateSoundUI();
        }
    });

    const startGame = async (sessionToken?: string) => {
        soundFx.unlock();

        const name =
            nameInput?.value.trim() ||
            localStorage.getItem('bubble_player_name') ||
            'BubbleHero';
        localStorage.setItem('bubble_player_name', name);
        sessionStorage.setItem('bubble_game_active', 'true');
        if (hudPlayerName) hudPlayerName.textContent = name;

        if (serverInput && serverInput.value.trim()) {
            networkManager.setServerUrl(serverInput.value.trim());
        }

        try {
            await networkManager.connect();
            networkManager.join(
                name,
                selectedColor,
                tankSelectionManager.selectedBlueprintId,
                sessionToken
            );

            if (joinModal) joinModal.classList.add('hidden');
            if (gameHud) gameHud.classList.remove('hidden');
        } catch (err) {
            networkManager.clearSession();
            if (joinModal) joinModal.classList.remove('hidden');
            if (gameHud) gameHud.classList.add('hidden');
            alert(
                `Не удалось подключиться к серверу Bubble Wars (${networkManager.serverUrl}).\nУбедитесь, что сервер запущен и доступен!`
            );
            console.error('Connection failed:', err);
        }
    };

    if (btnPlay) {
        btnPlay.addEventListener('click', () => startGame());
    }

    if (nameInput) {
        const savedPlayerName = localStorage.getItem('bubble_player_name');
        if (savedPlayerName) {
            nameInput.value = savedPlayerName;
        }
        nameInput.addEventListener('input', () => {
            const trimmed = nameInput.value.trim();
            if (trimmed) {
                localStorage.setItem('bubble_player_name', trimmed);
            }
        });
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                startGame();
            }
        });

        if (btnRandomName) {
            let rollTimeout: number | null = null;

            btnRandomName.addEventListener('click', () => {
                if (rollTimeout !== null) {
                    clearTimeout(rollTimeout);
                    rollTimeout = null;
                }

                btnRandomName.classList.remove('spinning');
                void btnRandomName.offsetWidth; // force DOM reflow to restart animation
                btnRandomName.classList.add('spinning');

                const startTime = Date.now();
                const duration = 3000;

                const rollTick = () => {
                    const elapsed = Date.now() - startTime;
                    const progress = Math.min(1, elapsed / duration);
                    const randomName = getRandomBotName();
                    nameInput.value = randomName;
                    localStorage.setItem('bubble_player_name', randomName);

                    if (progress < 1) {
                        const nextDelay = 40 + Math.pow(progress, 2.5) * 360;
                        rollTimeout = window.setTimeout(rollTick, nextDelay);
                    } else {
                        rollTimeout = null;
                        nameInput.focus();
                        nameInput.select();
                    }
                };

                rollTick();
            });

            btnRandomName.addEventListener('animationend', () => {
                btnRandomName.classList.remove('spinning');
            });
        }
    }

    const leaveModal = document.getElementById('leave-modal');
    const deathModal = document.getElementById('death-modal');
    const gameoverModal = document.getElementById('gameover-modal');
    const btnLeaveConfirm = document.getElementById('btn-leave-confirm');
    const btnLeaveCancel = document.getElementById('btn-leave-cancel');

    const returnToMenu = () => {
        networkManager.leave();
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

    // In-game Tab match stats overlay (Hold Tab)
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Tab') {
            const activeEl = document.activeElement;
            const isInputFocused =
                activeEl &&
                (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
            const isJoinHidden = joinModal ? joinModal.classList.contains('hidden') : true;

            if (!isInputFocused && isJoinHidden) {
                e.preventDefault();
                game.showTabStats();
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'Tab') {
            e.preventDefault();
            game.hideTabStats();
        }
    });

    window.addEventListener('blur', () => {
        game.hideTabStats();
    });

    // Auto-reconnect if session was active in this specific tab before reload
    const isGameActive = sessionStorage.getItem('bubble_game_active') === 'true';
    const savedSessionToken = sessionStorage.getItem('bubble_session_token');
    if (isGameActive && savedSessionToken) {
        startGame(savedSessionToken);
    }
});
