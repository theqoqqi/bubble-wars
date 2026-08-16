import Phaser from 'phaser';
import { TankColor } from '@bubble-wars/shared';
import { BootScene } from './scenes/BootScene.js';
import { ArenaScene } from './scenes/ArenaScene.js';
import { networkManager } from './net/NetworkManager.js';
import { soundFx } from './audio/SoundFx.js';

let selectedColor: TankColor = 'cyan';

// 1. Phaser Game Configuration
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#060d1f',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, ArenaScene],
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false,
  },
};

const game = new Phaser.Game(config);

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
      selectedColor = (target.dataset.color as TankColor) || 'cyan';
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
      networkManager.join(name, selectedColor);

      if (joinModal) joinModal.classList.add('hidden');
      if (gameHud) gameHud.classList.remove('hidden');
    } catch (err) {
      alert(`Не удалось подключиться к серверу Bubble Wars (${networkManager.serverUrl}).\nУбедитесь, что сервер запущен и доступен!`);
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

  // Respawn button
  if (btnRespawn) {
    btnRespawn.addEventListener('click', () => {
      networkManager.respawn();
      const deathModal = document.getElementById('death-modal');
      if (deathModal) deathModal.classList.add('hidden');
    });
  }

  // Game Over Rematch button
  const btnRematch = document.getElementById('btn-rematch');
  if (btnRematch) {
    btnRematch.addEventListener('click', () => {
      networkManager.rematch();
      const gameoverModal = document.getElementById('gameover-modal');
      if (gameoverModal) gameoverModal.classList.add('hidden');
    });
  }

  // Game Over Menu button
  const btnGameOverMenu = document.getElementById('btn-gameover-menu');
  if (btnGameOverMenu) {
    btnGameOverMenu.addEventListener('click', () => {
      networkManager.disconnect();
      const arenaScene = game.scene.getScene('ArenaScene') as ArenaScene;
      if (arenaScene) {
        arenaScene.leaveGame();
      }
      const gameoverModal = document.getElementById('gameover-modal');
      if (gameoverModal) gameoverModal.classList.add('hidden');
      const deathModal = document.getElementById('death-modal');
      if (deathModal) deathModal.classList.add('hidden');
      if (gameHud) gameHud.classList.add('hidden');
      if (joinModal) joinModal.classList.remove('hidden');
    });
  }
});
