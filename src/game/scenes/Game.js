import Phaser from 'phaser';
import {
  GAME_SCENE_KEY,
  GROUND,
  BACKGROUND,
  BIRD,
  PIPE,
  GAME_OVER_MESSAGE,
  READY_MESSAGE,
  POINT_SOUND,
  FLAP_SOUND,
  SWOOSH_SOUND,
  HIT_SOUND,
  DIE_SOUND,
  START_BUTTON,
} from './shared.js';

// NEW: audio helpers (create src/audio.js as provided earlier)
import { loadTrack, play, getTime, resumeOnGesture } from '../audio.js';

const FLAP = 'flap';
const PIPE_HEIGHT = 320;
const PIPE_GAP_HEIGHT = 100;
const PIPE_GAP_LENGTH = 180;
const PIPE_PAIRS = 3;
const GROUND_HEIGHT = 112;
const FRAME_RATE = 10;
const BIRD_GRAVITY = 1000;
const BIRD_VELOCITY = -360;
const GAME_SPEED = 2; // world scroll speed in px/frame (pipes/ground are moved manually)
const ELEVATION_ANGLE = 25;
const FALL_ANGLE = 90;
const DECLINE_ANGLE_DELTA = 2;
const MIN_PIPE_HEIGHT = -PIPE_HEIGHT * 0.7;
const READY_STATE = 'ready-state';
const PLAYING_STATE = 'playing-state';
const GAME_OVER_STATE = 'gameover-state';
const DIGIT_WIDTH = 24;
const BEST_SCORE_KEY = 'best-score';

// NEW: timeline spawn config
const LOOKAHEAD = 1.6; // seconds to spawn items ahead of current song time

export default class GameScene extends Phaser.Scene {
  constructor() {
    super(GAME_SCENE_KEY);
    this.score = 0;

    // NEW: timeline/runtime fields
    this._tl = null;
    this._nextNoteIdx = 0;
    this._nextCoinAt = 0;
    this.notesCollected = 0;
  }

  create() {
    // --- WORLD SETUP (unchanged base) --------------------------------------
    this.createBackground();

    this.pipes = this.createPipes();
    this.ground = this.createGround();
    this.player = this.createPlayer();
    this.readyMessage = this.createReadyMessage();
    this.gameoverMessage = this.createGameOverMessage();
    this.scoreText = this.createScoreText();
    this.bestScoreText = this.createBestScoreText();
    this.restartButton = this.createRestartButton();

    this.pointSound = this.sound.add(POINT_SOUND);
    this.flapSound = this.sound.add(FLAP_SOUND);
    this.swooshSound = this.sound.add(SWOOSH_SOUND);
    this.hitSound = this.sound.add(HIT_SOUND);
    this.dieSound = this.sound.add(DIE_SOUND);

    this.physics.add.existing(this.ground, true);
    this.physics.add.collider(this.player, this.ground, this.setGameOver, null, this);
    this.physics.add.collider(
      this.player,
      this.pipes.topPipes,
      this.setGameOver,
      this.handleFall,
      this,
    );
    this.physics.add.collider(
      this.player,
      this.pipes.bottomPipes,
      this.setGameOver,
      this.handleFall,
      this,
    );
    this.restartButton.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, this.restart, this);

    this.cursors = this.input.keyboard.createCursorKeys();

    // --- NEW: collectibles groups ------------------------------------------
    this.coinsGroup = this.physics.add.group(); // timeline coins
    this.notesGroup = this.physics.add.group(); // 12 milestone notes
    // coins/notes should not fall with gravity; we move them manually with the world
    this.coinsGroup.children.iterate((c) => { if (c?.body) c.body.allowGravity = false; });
    this.notesGroup.children.iterate((n) => { if (n?.body) n.body.allowGravity = false; });

    // collisions for collectibles
    this.physics.add.overlap(this.player, this.coinsGroup, (_, coin) => {
      coin.destroy();
      const now = getTime();
      const chorus = this._tl?.chorusWindows?.find((w) => now >= w.start && now <= w.end);
      const mult = chorus ? (chorus.multiplier || 2) : 1;
      // coins add smaller points; keep pipe pass as your main score mechanic
      this.addScore(1 * mult);
    });

    this.physics.add.overlap(this.player, this.notesGroup, (_, note) => {
      note.destroy();
      this.notesCollected += 1;
      // make notes feel valuable
      this.addScore(5);
    });

    // --- NEW: fetch timeline JSON & preload audio buffer --------------------
    this._tl = this.cache.json.get('timeline') || null;
    if (this._tl?.audio) {
      loadTrack(this._tl.audio).catch((e) => console.warn('Audio failed to load:', e));
    }
    this._nextNoteIdx = 0;
    this._nextCoinAt = 0;
    this.notesCollected = 0;

    // Start state
    this.setReady();
  }

  update() {
    this.animate();
    this.handleInputs();

    // NEW: when playing, move collectibles with the world & spawn by timeline
    if (this.state === PLAYING_STATE) {
      this.moveCollectibles();
      this.cleanupCollectibles();
      this.updateTimelineSpawns();
      // Optional: end automatically at song end if duration is defined
      if (this._tl?.duration && getTime() >= this._tl.duration) {
        this.setGameOver();
      }
    }
  }

  // --- ORIGINAL FLOW --------------------------------------------------------

  animate() {
    switch (this.state) {
      case READY_STATE: {
        this.moveGround();
        break;
      }
      case PLAYING_STATE: {
        this.fall();
        this.movePipes();
        this.loopPipes();
        this.moveGround();
        break;
      }
      case GAME_OVER_STATE: {
        this.fall();
        break;
      }
      default:
        break;
    }
  }

  handleInputs() {
    if (this.isTapped()) {
      switch (this.state) {
        case READY_STATE:
          this.setPlaying();
          break;
        case PLAYING_STATE:
          if (!this.isPlayerFlapping) {
            this.isPlayerFlapping = true;
            this.flap();
          }
          break;
        default:
          break;
      }
    }
    if (this.state === GAME_OVER_STATE && this.cursors.space.isDown && this.isAllowedToRestart) {
      this.restart();
    }
    if (this.isReleased() && this.isPlayerFlapping) {
      this.isPlayerFlapping = false;
    }
  }

  isTapped() {
    return this.cursors.space.isDown || this.input.activePointer.primaryDown;
  }

  isReleased() {
    return this.cursors.space.isUp && !this.input.activePointer.primaryDown;
  }

  setReady() {
    this.swooshSound.play();
    this.gameoverMessage.visible = false;
    this.bestScoreText.visible = false;
    this.restartButton.visible = false;
    this.player.body.allowGravity = false;
    this.player.anims.play(FLAP, true);
    this.state = READY_STATE;
    this.birdFlying = this.flyBirdWhileWaitingForPlayer();
    this.isPlayerFlapping = false;
  }

  async setPlaying() {
    this.birdFlying.stop();
    this.readyMessage.visible = false;
    this.player.body.allowGravity = true;
    this.state = PLAYING_STATE;

    // NEW: start music on first play (iOS requires user gesture resume)
    try {
      await resumeOnGesture();
      if (this._tl?.audio) play(0);
    } catch (e) {
      // ignore; game still plays without music
    }
  }

  setGameOver() {
    if (this.state !== GAME_OVER_STATE) {
      this.state = GAME_OVER_STATE;
      this.gameoverMessage.visible = true;
      this.bestScoreText.visible = true;
      this.restartButton.visible = true;
      this.isAllowedToRestart = false;
      this.hitSound.play();
      this.player.anims.stop();

      const currentBest = localStorage.getItem(BEST_SCORE_KEY) || 0;
      const bestScore = Math.max(currentBest, this.score);
      localStorage.setItem(BEST_SCORE_KEY, Math.max(this.score, bestScore));
      this.bestScoreText.setText(`High Score : ${currentBest}`);

      this.slideStartButton();
    }
  }

  flyBirdWhileWaitingForPlayer() {
    return this.tweens.add({
      targets: this.player,
      y: this.player.y + 5,
      duration: 300,
      yoyo: true,
      repeat: -1,
    });
  }

  slideStartButton() {
    this.tweens.add({
      targets: this.restartButton,
      y: this.scale.height * 0.6,
      duration: 500,
      onComplete: () => {
        this.isAllowedToRestart = true;
      },
    });
  }

  handleFall() {
    if (this.state !== GAME_OVER_STATE) {
      this.dieSound.play();
    }
    return true;
  }

  restart() {
    this.clearScore();
    // clear collectibles
    this.coinsGroup.clear(true, true);
    this.notesGroup.clear(true, true);
    // reset timeline cursors
    this._nextNoteIdx = 0;
    this._nextCoinAt = 0;
    this.notesCollected = 0;

    this.scene.restart();
    this.setReady();
  }

  clearScore() {
    this.score = 0;
    this.lastRecordedPipe = null;
  }

  flap() {
    this.player.setVelocityY(BIRD_VELOCITY);
    this.player.anims.play(FLAP, true);
    this.player.angle = -ELEVATION_ANGLE;
    this.flapSound.play();
  }

  fall() {
    if (this.player.angle < FALL_ANGLE) {
      this.player.angle += DECLINE_ANGLE_DELTA;
    }
  }

  moveGround() {
    this.ground.tilePositionX += GAME_SPEED;
  }

  movePipes() {
    this.pipes.topPipes.incX(-GAME_SPEED);
    this.pipes.bottomPipes.incX(-GAME_SPEED);
  }

  // NEW: move collectibles with the same world speed
  moveCollectibles() {
    this.coinsGroup.getChildren().forEach((c) => { c.x -= GAME_SPEED; });
    this.notesGroup.getChildren().forEach((n) => { n.x -= GAME_SPEED; });
  }

  // NEW: clean up off-screen coins/notes
  cleanupCollectibles() {
    this.coinsGroup.getChildren().forEach((c) => {
      if (c.getBounds().right < 0) c.destroy();
    });
    this.notesGroup.getChildren().forEach((n) => {
      if (n.getBounds().right < 0) n.destroy();
    });
  }

  createRestartButton() {
    const { width, height } = this.scale;
    const button = this.add.image(width * 0.5, height * 0.8, START_BUTTON).setInteractive();

    return button;
  }

  createBackground() {
    const { width, height } = this.scale;
    this.physics.add.staticImage(width * 0.5, height * 0.5, BACKGROUND).setScale(1.5).refreshBody();
  }

  createPlayer() {
    const { width, height } = this.scale;
    const player = this.physics.add.sprite(width * 0.3, height * 0.5, BIRD);
    player.setCollideWorldBounds(true);
    player.setGravityY(BIRD_GRAVITY);
    player.body.allowGravity = false;

    this.anims.create({
      key: FLAP,
      frames: this.anims.generateFrameNumbers(BIRD, { start: 0, end: 2 }),
      frameRate: FRAME_RATE,
      repeat: -1,
    });

    return player;
  }

  createReadyMessage() {
    const { width, height } = this.scale;

    return this.add.image(width * 0.5, height * 0.4, READY_MESSAGE);
  }

  createGameOverMessage() {
    const { width, height } = this.scale;

    return this.add.image(width * 0.5, height * 0.3, GAME_OVER_MESSAGE);
  }

  createScoreText() {
    const { width, height } = this.scale;
    const score = this.physics.add.staticGroup();

    const x = width * 0.5;
    const y = height * 0.08;
    const digits = String(this.score).split('');
    const length = digits.length * DIGIT_WIDTH;
    const offsetX = x - length / 2;
    digits.forEach((digit, index) => {
      score.create(offsetX + (index * DIGIT_WIDTH), y, digit);
    });

    score.setOrigin(0, 0);

    return score;
  }

  createBestScoreText() {
    const { width, height } = this.scale;
    const score = this.add.text(width * 0.5, height * 0.4, '', {
      fontFamily: 'Teko',
      fontSize: '25px',
      stroke: '#000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    return score;
  }

  createGround() {
    const { width, height } = this.scale;
    const x = width * 0.5;
    const y = height - GROUND_HEIGHT * 0.3;
    const ground = this.add.tileSprite(x, y, width, GROUND_HEIGHT, GROUND);

    return ground;
  }

  createPipePair(x, y) {
    const top = this.physics.add.image(x, y, PIPE);
    top.flipY = true;
    top.body.moves = false;
    top.setOrigin(0, 0);

    const bottomY = y + PIPE_GAP_HEIGHT + PIPE_HEIGHT;
    const bottom = this.physics.add.image(x, bottomY, PIPE);
    bottom.body.moves = false;
    bottom.setOrigin(0, 0);

    return [top, bottom];
  }

  createPipes() {
    const { width } = this.scale;
    const topPipes = this.physics.add.group();
    const bottomPipes = this.physics.add.group();

    const offsetX = width + PIPE_GAP_LENGTH;

    for (let i = 0; i < PIPE_PAIRS; i += 1) {
      const y = Phaser.Math.Between(MIN_PIPE_HEIGHT, 0);
      const deltaX = offsetX + (i * PIPE_GAP_LENGTH);

      const [top, bottom] = this.createPipePair(deltaX, y);

      topPipes.add(top);
      bottomPipes.add(bottom);
    }

    return { topPipes, bottomPipes };
  }

  resetPipesPosition(top, bottom) {
    const x = this.scale.width + PIPE_GAP_LENGTH;
    const y = Phaser.Math.Between(MIN_PIPE_HEIGHT, 0);
    const bottomY = y + PIPE_GAP_HEIGHT + PIPE_HEIGHT;

    top.y = y;
    top.x = x;

    bottom.x = x;
    bottom.y = bottomY;
  }

  updateScoreText() {
    this.scoreText.clear(true, true);
    this.scoreText = this.createScoreText();
    this.pointSound.play();
  }

  updateScore(pipeMiddle, currentPipe) {
    const { right } = this.player.getBounds();
    if (pipeMiddle < right && this.lastRecordedPipe !== currentPipe) {
      this.score += 1;
      this.lastRecordedPipe = currentPipe;
      this.updateScoreText();
    }
  }

  loopPipes() {
    this.pipes.bottomPipes.getChildren().forEach((bottom, index) => {
      const { right, centerX } = bottom.getBounds();
      if (right < 0) {
        const top = this.pipes.topPipes.getChildren()[index];
        this.resetPipesPosition(top, bottom);
      }
      this.updateScore(centerX, index);
    });
  }

  // --- NEW: timeline-driven spawns -----------------------------------------

  updateTimelineSpawns() {
    if (!this._tl) return;

    const now = getTime();

    // Spawn milestone notes (12) at their scheduled times
    const notes = this._tl.noteMilestones || [];
    while (this._nextNoteIdx < notes.length && notes[this._nextNoteIdx].t <= now + LOOKAHEAD) {
      const evt = notes[this._nextNoteIdx++];
      const yClamped = Phaser.Math.Clamp(evt.y ?? 240, 80, this.scale.height - 140);
      // spawn just off the right edge to scroll in with the world
      this.spawnNote(this.scale.width + 40, yClamped);
    }

    // Spawn coins at a rate; surge during chorus windows
    const inChorus = (this._tl.chorusWindows || []).some((w) => now >= w.start && now <= w.end);
    const chorusWin = inChorus
      ? (this._tl.chorusWindows || []).find((w) => now >= w.start && now <= w.end)
      : null;

    const rate = inChorus
      ? (chorusWin.coinRate || 3.0)
      : (this._tl.ambientCoins?.rate || 0.7);

    if (now >= this._nextCoinAt) {
      const range = this._tl.ambientCoins?.yRange || [140, 360];
      this.spawnCoinCluster(!!inChorus, range);
      const baseGap = Math.max(this._tl.ambientCoins?.minGap || 1.0, 1.0 / rate);
      this._nextCoinAt = now + baseGap;
    }
  }

  spawnCoin(x, y) {
    const c = this.coinsGroup.create(x, y, 'coin');
    if (c?.body) c.body.allowGravity = false;
    return c;
  }

  spawnNote(x, y) {
    const n = this.notesGroup.create(x, y, 'note');
    if (n?.body) n.body.allowGravity = false;
    return n;
  }

  spawnCoinCluster(inChorus, yRange) {
    const rows = inChorus ? 3 : 1;
    for (let i = 0; i < rows; i += 1) {
      const y = Phaser.Math.Between(yRange[0], yRange[1]);
      this.spawnCoin(this.scale.width + 40 + i * 18, y);
    }
  }

  addScore(n) {
    this.score += n;
    this.updateScoreText();
  }
}
