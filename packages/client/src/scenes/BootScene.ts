import Phaser from 'phaser';
import { BubbleRenderer } from '../graphics/BubbleRenderer.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  public create(): void {
    console.log('[BootScene] Initializing procedural textures...');
    BubbleRenderer.generateAllTextures(this);

    // Launch Arena Scene
    this.scene.start('ArenaScene');
  }
}
