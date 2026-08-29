import { ColorDef, getRandomBotName, RoomInfo } from '@bubble-wars/shared';
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

function escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// 2. DOM UI Bindings
window.addEventListener('DOMContentLoaded', () => {
    tankSelectionManager.init();

    // Modals & Screens
    const joinModal = document.getElementById('join-modal');
    const lobbyModal = document.getElementById('lobby-modal');
    const createRoomModal = document.getElementById('create-room-modal');
    const tankModal = document.getElementById('tank-modal');
    const gameHud = document.getElementById('game-hud');
    const leaveModal = document.getElementById('leave-modal');
    const deathModal = document.getElementById('death-modal');
    const gameoverModal = document.getElementById('gameover-modal');

    // Pilot Setup inputs & buttons
    const nameInput = document.getElementById('player-name-input') as HTMLInputElement;
    const btnRandomName = document.getElementById('btn-random-name');
    const serverInput = document.getElementById('server-url-input') as HTMLInputElement;
    const hudPlayerName = document.getElementById('hud-player-name');
    const btnPlay = document.getElementById('btn-play');
    const colorDots = document.querySelectorAll('.color-dot, .color-btn');

    // Lobby Browser elements
    const btnBackToPilot = document.getElementById('btn-back-to-pilot');
    const btnRefreshRooms = document.getElementById('btn-refresh-rooms');
    const btnOpenCreateRoom = document.getElementById('btn-open-create-room');
    const lobbyRoomsGrid = document.getElementById('lobby-rooms-grid');
    const lobbyRoomCount = document.getElementById('lobby-room-count');

    // Create Room Modal elements
    const createRoomNameInput = document.getElementById('create-room-name-input') as HTMLInputElement;
    const createRoomMaxPlayers = document.getElementById('create-room-max-players') as HTMLInputElement | null;
    const createRoomMaxPlayersVal = document.getElementById('create-room-max-players-val');
    const createRoomBots = document.getElementById('create-room-bots') as HTMLInputElement | null;
    const createRoomBotsVal = document.getElementById('create-room-bots-val');
    const createRoomFragLimit = document.getElementById('create-room-frag-limit') as HTMLInputElement | null;
    const createRoomFragLimitVal = document.getElementById('create-room-frag-limit-val');
    const btnCreateRoomSubmit = document.getElementById('btn-create-room-submit');
    const btnCreateRoomCancel = document.getElementById('btn-create-room-cancel');
    const btnCloseCreateModal = document.getElementById('btn-close-create-modal');

    // Edit Room Modal elements (Host only)
    const editRoomModal = document.getElementById('edit-room-modal');
    const editRoomNameInput = document.getElementById('edit-room-name-input') as HTMLInputElement | null;
    const editRoomMaxPlayers = document.getElementById('edit-room-max-players') as HTMLInputElement | null;
    const editRoomMaxPlayersVal = document.getElementById('edit-room-max-players-val');
    const editRoomBots = document.getElementById('edit-room-bots') as HTMLInputElement | null;
    const editRoomBotsVal = document.getElementById('edit-room-bots-val');
    const editRoomFragLimit = document.getElementById('edit-room-frag-limit') as HTMLInputElement | null;
    const editRoomFragLimitVal = document.getElementById('edit-room-frag-limit-val');
    const btnEditRoomSave = document.getElementById('btn-edit-room-save');
    const btnEditRoomCancel = document.getElementById('btn-edit-room-cancel');
    const btnCloseEditModal = document.getElementById('btn-close-edit-modal');
    const btnGameOverHostConfig = document.getElementById('btn-gameover-host-config');

    // Tank Modal elements
    const tankModalSubtitle = document.getElementById('tank-modal-subtitle');
    const btnTankConfirmJoin = document.getElementById('btn-tank-confirm-join');
    const btnCloseTankModal = document.getElementById('btn-close-tank-modal');

    // Sound elements
    const btnMute = document.getElementById('btn-mute');
    const volumeSlider = document.getElementById('sound-volume-slider') as HTMLInputElement | null;
    const volumeValue = document.getElementById('sound-volume-value');
    const sliderIcon = document.getElementById('sound-slider-icon');
    const soundControlWrap = document.getElementById('sound-control-wrap');
    const soundSliderPopup = document.getElementById('sound-slider-popup');

    // Game Action buttons
    const btnRespawn = document.getElementById('btn-respawn');
    const btnLeaveConfirm = document.getElementById('btn-leave-confirm');
    const btnLeaveCancel = document.getElementById('btn-leave-cancel');
    const btnRematch = document.getElementById('btn-rematch');
    const btnGameOverMenu = document.getElementById('btn-gameover-menu');

    // Navigation & State
    let currentSelectedRoomId: string | null = null;
    let currentRoomName: string = '';
    let lobbyPollTimer: number | null = null;
    let currentRoomConfig = {
        name: 'Основная арена',
        maxPlayers: 16,
        botCount: 8,
        fragLimit: 10,
    };

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

    // Sound UI
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

    updateSoundUI();

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

    window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyM') {
            const activeTag = (document.activeElement?.tagName || '').toLowerCase();
            if (activeTag === 'input' || activeTag === 'textarea') return;
            soundFx.toggleMute();
            updateSoundUI();
        }
    });

    // Player Nickname input
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
                openLobbyBrowser();
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
                void btnRandomName.offsetWidth;
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

    // Screen Management
    const showScreen = (screen: 'pilot' | 'lobby' | 'game') => {
        if (lobbyPollTimer !== null) {
            clearInterval(lobbyPollTimer);
            lobbyPollTimer = null;
        }

        if (screen === 'pilot') {
            joinModal?.classList.remove('hidden');
            lobbyModal?.classList.add('hidden');
            createRoomModal?.classList.add('hidden');
            tankModal?.classList.add('hidden');
            gameHud?.classList.add('hidden');
            leaveModal?.classList.add('hidden');
            deathModal?.classList.add('hidden');
            gameoverModal?.classList.add('hidden');
        } else if (screen === 'lobby') {
            joinModal?.classList.add('hidden');
            lobbyModal?.classList.remove('hidden');
            createRoomModal?.classList.add('hidden');
            tankModal?.classList.add('hidden');
            gameHud?.classList.add('hidden');
            leaveModal?.classList.add('hidden');
            deathModal?.classList.add('hidden');
            gameoverModal?.classList.add('hidden');

            networkManager.requestRoomList();
            lobbyPollTimer = window.setInterval(() => {
                if (!lobbyModal?.classList.contains('hidden')) {
                    networkManager.requestRoomList();
                }
            }, 3500);
        } else if (screen === 'game') {
            joinModal?.classList.add('hidden');
            lobbyModal?.classList.add('hidden');
            createRoomModal?.classList.add('hidden');
            tankModal?.classList.add('hidden');
            gameHud?.classList.remove('hidden');
            leaveModal?.classList.add('hidden');
            deathModal?.classList.add('hidden');
            gameoverModal?.classList.add('hidden');
        }
    };

    // Open Lobby Browser
    const openLobbyBrowser = async () => {
        soundFx.unlock();

        const name = nameInput?.value.trim() || 'SoapWarrior';
        localStorage.setItem('bubble_player_name', name);
        if (hudPlayerName) hudPlayerName.textContent = name;

        if (serverInput && serverInput.value.trim()) {
            networkManager.setServerUrl(serverInput.value.trim());
        }

        try {
            await networkManager.connect();
            showScreen('lobby');
        } catch (err) {
            alert(
                `Не удалось подключиться к серверу Bubble Wars (${networkManager.serverUrl}).\nУбедитесь, что сервер запущен и доступен!`
            );
            console.error('Connection to server failed:', err);
        }
    };

    if (btnPlay) {
        btnPlay.addEventListener('click', () => openLobbyBrowser());
    }

    if (btnBackToPilot) {
        btnBackToPilot.addEventListener('click', () => showScreen('pilot'));
    }

    if (btnRefreshRooms) {
        btnRefreshRooms.addEventListener('click', () => networkManager.requestRoomList());
    }

    // Render Rooms in Lobby with change detection to prevent unnecessary DOM re-renders and flicker
    let lastRoomsJson = '';
    const renderRooms = (rooms: RoomInfo[]) => {
        if (!lobbyRoomsGrid) return;
        if (lobbyRoomCount) lobbyRoomCount.textContent = rooms.length.toString();

        const currentJson = JSON.stringify(rooms);
        if (currentJson === lastRoomsJson) {
            return;
        }
        lastRoomsJson = currentJson;

        if (rooms.length === 0) {
            lobbyRoomsGrid.innerHTML = `
                <div class="rooms-empty-state">
                    Нет активных арен.<br>Нажмите «➕ Создать арену», чтобы начать битву!
                </div>
            `;
            return;
        }

        lobbyRoomsGrid.innerHTML = rooms
            .map((room) => {
                const statusClass = room.isMatchOver ? 'waiting' : 'in-battle';
                const statusText = room.isMatchOver ? 'Ожидание' : 'В бою';
                return `
                    <div class="room-row">
                        <div class="room-row-info">
                            <h3 class="room-row-title">${escapeHtml(room.name)}</h3>
                            <span class="room-status-badge ${statusClass}">${statusText}</span>
                        </div>
                        <div class="room-row-meta">
                            <span class="room-meta-item" title="Занято слотов (игроки и боты)">👤 ${room.playerCount + room.botCount} / ${room.maxPlayers}</span>
                            <span class="room-meta-item" title="Боты">🤖 ${room.botCount}</span>
                            <span class="room-meta-item" title="Лимит фрагов">🎯 ${room.fragLimit}</span>
                        </div>
                        <button class="btn-bubble room-row-btn" data-room-id="${room.roomId}" data-room-name="${escapeHtml(room.name)}">
                            Войти в бой 🚀
                        </button>
                    </div>
                `;
            })
            .join('');

        // Attach click events on room buttons
        lobbyRoomsGrid.querySelectorAll<HTMLButtonElement>('.room-row-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const roomId = btn.dataset.roomId;
                const roomName = btn.dataset.roomName || 'Арена';
                if (roomId) {
                    currentSelectedRoomId = roomId;
                    currentRoomName = roomName;
                    if (tankModalSubtitle) {
                        tankModalSubtitle.textContent = `ВЫБЕРИТЕ ПУЗЫРЬ ДЛЯ АРЕНЫ: ${roomName.toUpperCase()}`;
                    }
                    tankSelectionManager.openModal();
                }
            });
        });
    };

    // Create Room Modal controls
    if (createRoomMaxPlayers) {
        createRoomMaxPlayers.addEventListener('input', () => {
            const maxVal = parseInt(createRoomMaxPlayers.value, 10) || 16;
            if (createRoomMaxPlayersVal) createRoomMaxPlayersVal.textContent = maxVal.toString();
            if (createRoomBots) {
                createRoomBots.max = maxVal.toString();
                const currentBotVal = parseInt(createRoomBots.value, 10) || 0;
                if (currentBotVal > maxVal) {
                    createRoomBots.value = maxVal.toString();
                }
                if (createRoomBotsVal) {
                    createRoomBotsVal.textContent = createRoomBots.value;
                }
            }
        });
    }

    if (createRoomBots) {
        createRoomBots.addEventListener('input', () => {
            const botVal = parseInt(createRoomBots.value, 10) || 0;
            if (createRoomBotsVal) createRoomBotsVal.textContent = botVal.toString();
        });
    }

    if (createRoomFragLimit) {
        createRoomFragLimit.addEventListener('input', () => {
            const fragVal = parseInt(createRoomFragLimit.value, 10) || 10;
            if (createRoomFragLimitVal) createRoomFragLimitVal.textContent = fragVal.toString();
        });
    }

    if (btnOpenCreateRoom) {
        btnOpenCreateRoom.addEventListener('click', () => {
            if (createRoomNameInput) {
                createRoomNameInput.value = `Арена #${Math.floor(100 + Math.random() * 900)}`;
            }
            if (createRoomMaxPlayers) {
                createRoomMaxPlayers.value = '16';
                if (createRoomMaxPlayersVal) createRoomMaxPlayersVal.textContent = '16';
            }
            if (createRoomBots) {
                createRoomBots.max = '16';
                createRoomBots.value = '8';
                if (createRoomBotsVal) createRoomBotsVal.textContent = '8';
            }
            if (createRoomFragLimit) {
                createRoomFragLimit.value = '10';
                if (createRoomFragLimitVal) createRoomFragLimitVal.textContent = '10';
            }
            createRoomModal?.classList.remove('hidden');
            createRoomNameInput?.focus();
            createRoomNameInput?.select();
        });
    }

    const closeCreateModal = () => {
        createRoomModal?.classList.add('hidden');
    };

    if (btnCreateRoomCancel) btnCreateRoomCancel.addEventListener('click', closeCreateModal);
    if (btnCloseCreateModal) btnCloseCreateModal.addEventListener('click', closeCreateModal);

    const submitCreateRoom = () => {
        const roomName = createRoomNameInput?.value.trim() || 'Мыльная Арена';
        const maxPlayers = createRoomMaxPlayers ? parseInt(createRoomMaxPlayers.value, 10) : 16;
        const botCount = createRoomBots ? parseInt(createRoomBots.value, 10) : 8;
        const fragLimit = createRoomFragLimit ? parseInt(createRoomFragLimit.value, 10) : 10;

        networkManager.createRoom(roomName, {
            maxPlayers,
            botCount,
            fragLimit,
        });
        closeCreateModal();
    };

    if (btnCreateRoomSubmit) {
        btnCreateRoomSubmit.addEventListener('click', submitCreateRoom);
    }
    if (createRoomNameInput) {
        createRoomNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                submitCreateRoom();
            }
        });
    }

    // Edit Room Modal controls (Host only)
    if (editRoomMaxPlayers) {
        editRoomMaxPlayers.addEventListener('input', () => {
            const maxVal = parseInt(editRoomMaxPlayers.value, 10) || 16;
            if (editRoomMaxPlayersVal) editRoomMaxPlayersVal.textContent = maxVal.toString();
            if (editRoomBots) {
                editRoomBots.max = maxVal.toString();
                const currentBotVal = parseInt(editRoomBots.value, 10) || 0;
                if (currentBotVal > maxVal) {
                    editRoomBots.value = maxVal.toString();
                }
                if (editRoomBotsVal) {
                    editRoomBotsVal.textContent = editRoomBots.value;
                }
            }
        });
    }

    if (editRoomBots) {
        editRoomBots.addEventListener('input', () => {
            const botVal = parseInt(editRoomBots.value, 10) || 0;
            if (editRoomBotsVal) editRoomBotsVal.textContent = botVal.toString();
        });
    }

    if (editRoomFragLimit) {
        editRoomFragLimit.addEventListener('input', () => {
            const fragVal = parseInt(editRoomFragLimit.value, 10) || 10;
            if (editRoomFragLimitVal) editRoomFragLimitVal.textContent = fragVal.toString();
        });
    }

    const openEditModal = () => {
        if (!networkManager.isHost) return;
        if (editRoomNameInput) editRoomNameInput.value = currentRoomConfig.name;
        if (editRoomMaxPlayers) {
            editRoomMaxPlayers.value = currentRoomConfig.maxPlayers.toString();
            if (editRoomMaxPlayersVal) editRoomMaxPlayersVal.textContent = currentRoomConfig.maxPlayers.toString();
        }
        if (editRoomBots) {
            editRoomBots.max = currentRoomConfig.maxPlayers.toString();
            editRoomBots.value = currentRoomConfig.botCount.toString();
            if (editRoomBotsVal) editRoomBotsVal.textContent = currentRoomConfig.botCount.toString();
        }
        if (editRoomFragLimit) {
            editRoomFragLimit.value = currentRoomConfig.fragLimit.toString();
            if (editRoomFragLimitVal) editRoomFragLimitVal.textContent = currentRoomConfig.fragLimit.toString();
        }
        editRoomModal?.classList.remove('hidden');
        editRoomNameInput?.focus();
        editRoomNameInput?.select();
    };

    const closeEditModal = () => {
        editRoomModal?.classList.add('hidden');
    };

    if (btnGameOverHostConfig) {
        btnGameOverHostConfig.addEventListener('click', openEditModal);
    }
    if (btnEditRoomCancel) btnEditRoomCancel.addEventListener('click', closeEditModal);
    if (btnCloseEditModal) btnCloseEditModal.addEventListener('click', closeEditModal);

    const submitEditRoom = () => {
        if (!networkManager.isHost) return;
        const name = editRoomNameInput?.value.trim() || currentRoomConfig.name;
        const maxPlayers = editRoomMaxPlayers ? parseInt(editRoomMaxPlayers.value, 10) : currentRoomConfig.maxPlayers;
        const botCount = editRoomBots ? parseInt(editRoomBots.value, 10) : currentRoomConfig.botCount;
        const fragLimit = editRoomFragLimit ? parseInt(editRoomFragLimit.value, 10) : currentRoomConfig.fragLimit;

        networkManager.updateRoomConfig({
            name,
            maxPlayers,
            botCount,
            fragLimit,
        });
        closeEditModal();
    };

    if (btnEditRoomSave) {
        btnEditRoomSave.addEventListener('click', submitEditRoom);
    }
    if (editRoomNameInput) {
        editRoomNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                submitEditRoom();
            }
        });
    }

    // Join room with selected tank
    const joinCurrentRoom = (sessionToken?: string) => {
        if (!currentSelectedRoomId) return;

        const name = nameInput?.value.trim() || 'SoapWarrior';
        localStorage.setItem('bubble_player_name', name);
        sessionStorage.setItem('bubble_game_active', 'true');
        if (hudPlayerName) hudPlayerName.textContent = name;

        networkManager.join(
            name,
            selectedColor,
            tankSelectionManager.selectedBlueprintId,
            currentSelectedRoomId,
            sessionToken
        );

        tankSelectionManager.closeModal();
    };

    tankSelectionManager.onConfirm = () => {
        joinCurrentRoom();
    };

    if (btnTankConfirmJoin) {
        btnTankConfirmJoin.addEventListener('click', () => {
            joinCurrentRoom();
        });
    }

    if (btnCloseTankModal) {
        btnCloseTankModal.addEventListener('click', () => {
            tankSelectionManager.closeModal();
        });
    }

    // Network Event Handlers
    networkManager.on('room_list', (msg) => {
        renderRooms(msg.rooms);
    });

    networkManager.on('room_created', (msg) => {
        currentSelectedRoomId = msg.roomId;
        currentRoomName = msg.roomName;
        if (tankModalSubtitle) {
            tankModalSubtitle.textContent = `ВЫБЕРИТЕ ПУЗЫРЬ ДЛЯ АРЕНЫ: ${msg.roomName.toUpperCase()}`;
        }
        tankSelectionManager.openModal();
    });

    networkManager.on('room_joined', (msg) => {
        currentRoomConfig = {
            name: msg.roomName || currentRoomConfig.name,
            maxPlayers: msg.maxPlayers || currentRoomConfig.maxPlayers,
            botCount: msg.botCount !== undefined ? msg.botCount : currentRoomConfig.botCount,
            fragLimit: msg.fragLimit || currentRoomConfig.fragLimit,
        };
        currentRoomName = msg.roomName || currentRoomName;
        showScreen('game');
    });

    networkManager.on('room_config_updated', (msg) => {
        currentRoomConfig = {
            name: msg.name,
            maxPlayers: msg.maxPlayers,
            botCount: msg.botCount,
            fragLimit: msg.fragLimit,
        };
        currentRoomName = msg.name;
    });

    networkManager.on('error', (msg) => {
        networkManager.clearSession();
        currentSelectedRoomId = null;
        alert(`Ошибка подключения: ${msg.message}`);
        showScreen('lobby');
    });

    // In-game Exit / Return to Lobby
    const returnToMenu = () => {
        networkManager.leave(true); // Keep WebSocket connection open for lobby browsing
        game.leaveGame();
        showScreen('lobby');
    };

    const toggleLeaveModal = () => {
        const isGameVisible = gameHud && !gameHud.classList.contains('hidden');
        if (!isGameVisible || !leaveModal) return;

        if (leaveModal.classList.contains('hidden')) {
            leaveModal.classList.remove('hidden');
        } else {
            leaveModal.classList.add('hidden');
        }
    };

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (tankModal && !tankModal.classList.contains('hidden')) {
                tankSelectionManager.closeModal();
                return;
            }
            if (createRoomModal && !createRoomModal.classList.contains('hidden')) {
                closeCreateModal();
                return;
            }
            if (editRoomModal && !editRoomModal.classList.contains('hidden')) {
                closeEditModal();
                return;
            }
            toggleLeaveModal();
        }
    });

    if (btnLeaveConfirm) {
        btnLeaveConfirm.addEventListener('click', returnToMenu);
    }

    if (btnLeaveCancel) {
        btnLeaveCancel.addEventListener('click', () => {
            leaveModal?.classList.add('hidden');
        });
    }

    if (btnRespawn) {
        btnRespawn.addEventListener('click', () => {
            networkManager.respawn();
            deathModal?.classList.add('hidden');
        });
    }

    if (btnRematch) {
        btnRematch.addEventListener('click', () => {
            networkManager.rematch();
            gameoverModal?.classList.add('hidden');
        });
    }

    if (btnGameOverMenu) {
        btnGameOverMenu.addEventListener('click', returnToMenu);
    }

    // In-game Tab match stats
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Tab') {
            const activeEl = document.activeElement;
            const isInputFocused =
                activeEl &&
                (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
            const isGameVisible = gameHud && !gameHud.classList.contains('hidden');

            if (!isInputFocused && isGameVisible) {
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

    // Auto-reconnect if session was active in this tab before reload
    const isGameActive = sessionStorage.getItem('bubble_game_active') === 'true';
    const savedSessionToken = sessionStorage.getItem('bubble_session_token');
    const savedRoomId = sessionStorage.getItem('bubble_room_id');

    if (isGameActive && savedSessionToken && savedRoomId) {
        currentSelectedRoomId = savedRoomId;
        networkManager
            .connect()
            .then(() => {
                joinCurrentRoom(savedSessionToken);
            })
            .catch(() => {
                networkManager.clearSession();
                showScreen('pilot');
            });
    }
});
