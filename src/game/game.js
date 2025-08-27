import Phaser from 'phaser';
import { WebFontLoaderPlugin } from 'phaser3-webfont-loader';
import GameScene from './scenes/Game.js';
import PreloadScene from './scenes/Preload.js';
import './game.css';

const GAME_WIDTH = 320;
const GAME_HEIGHT = 600;

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#1e272e',

  // Mobile-friendly scaling
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    expandParent: true,
  },

  // Keep pixel art crisp and movement stable
  render: {
    pixelArt: true,       // no smoothing on sprites
    roundPixels: true,    // avoid subpixel blurring
  },

  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 200 },
      // debug: true,
    },
  },

  input: {
    activePointers: 3, // allow multi-touch if needed
  },

  fps: {
    target: 60,
    forceSetTimeOut: false,
  },

  scene: [PreloadScene, GameScene],

  plugins: {
    global: [
      {
        key: 'WebFontLoader',
        plugin: WebFontLoaderPlugin,
        start: true,
      },
    ],
  },
};

let gameInstance = null;

export function startGame() {
  if (!gameInstance) gameInstance = new Phaser.Game(config);
  return gameInstance;
}

// Auto-start when the page loads (as current flow uses game.html)
window.addEventListener('load', startGame);

// Also expose a manual starter for landing-page buttons if you prefer:
// <button onclick="startGame()">Play</button>
window.startGame = startGame;

export default startGame;
