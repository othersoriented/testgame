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
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    expandParent: true,
  },
  render: {
    pixelArt: true,
    roundPixels: true,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 200 } },
  },
  scene: [PreloadScene, GameScene],
  plugins: {
    global: [
      { key: 'WebFontLoader', plugin: WebFontLoaderPlugin, start: true },
    ],
  },
};

let gameInstance = null;

export function startGame() {
  if (!gameInstance) gameInstance = new Phaser.Game(config);
  return gameInstance;
}

window.addEventListener('load', startGame);
window.startGame = startGame;

export default startGame;
