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

import { play, pause, getTime, getDuration, resumeOnGesture } from '../audio.js';



const FLAP = 'flap';
const PIPE_HEIGHT = 320;
const PIPE_GAP_HEIGHT = 120;
const PIPE_GAP_LENGTH = 180;
const PIPE_PAIRS = 1;
const GROUND_HEIGHT = 100;
const FRAME_RATE = 5;
const BIRD_GRAVITY = 1000;
const BIRD_VELOCITY = -360;
const GAME_SPEED = 3;
const ELEVATION_ANGLE = 25;
const FALL_ANGLE = 100;
const DECLINE_ANGLE_DELTA = 2;
const MIN_PIPE_HEIGHT = -PIPE_HEIGHT * 0.7;
const READY_STATE = 'ready-state';
const PLAYING_STATE = 'playing-state';
const GAME_OVER_STATE = 'gameover-state';
const DIGIT_WIDTH = 24;
const BEST_SCORE_KEY = 'best-score';

// --- Social links (edit to yours) ---
const IG_PROFILE_URL = 'https://www.instagram.com/christianaiband/';
const LINKTREE_URL   = 'https://linktr.ee/lostboyfound';
const SHARE_TITLE    = 'How about...Flappy Bird but make it Christian';
const SHARE_TEXT     = 'Try to beat my score in this Christian music Flappy clone 🎶';
const SHARE_URL      = 'https://christianaiband.com/game.html';
const NOW_PLAYING_FALLBACK = 'Now Playing: Psalm 150';
const SONG_URL = 'https://christianaiband.com/game.html';

// timeline spawn config
const LOOKAHEAD = 1.6;

// webcam bubble
const CAMERA_BUBBLE_SIZE = 65;

// progress / award
const SONG_BONUS_POINTS = 10000;
const PROGRESS_HEIGHT   = 10;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super(GAME_SCENE_KEY);
    this.score = 0;
    this._tl = null;
    this._nextNoteIdx = 0;
    this._nextCoinAt = 0;
    this.notesCollected = 0;

    // Camera state (DOM approach)
    this.webcamStream = null;
    this.domVideoEl = null;       // <video> element
    this.domVideoSize = CAMERA_BUBBLE_SIZE;
    this.cameraEnabled = false;
    this.camBtn = null;
    this.camStatusText = null;

    // (Phaser video fields kept in case you want to switch back later)
    this.webcamVideo = null;
    this.webcamMask = null;
    this.webcamMaskG = null;

    this.startBtn = null;

    // Progress UI
    this.progressBg = null;
    this.progressFill = null;
    this.timeLeftLabel = null;
    this._songFinishedAwarded = false;

    // Debug anchor dot
    this._camDebug = null;
  }

  create() {
    this.createBackground();

    this.pipes = this.createPipes();
    this.ground = this.createGround();
    this.player = this.createPlayer();
    this.readyMessage = this.createReadyMessage();
    this.gameoverMessage = this.createGameOverMessage();
    this.scoreText = this.createScoreText();
    this.bestScoreText = this.createBestScoreText();
    this.createSocialButtons();

    // Start button (READY only)
    const { width, height } = this.scale;
    this.startBtn = this.add.image(width * 0.5, height * 0.7, START_BUTTON)
      .setInteractive()
      .setDepth(1600)
      .on('pointerdown', (e) => e?.event?.stopPropagation())
      .on('pointerup', async (e) => {
        e?.event?.stopPropagation();
        await this.setPlaying();
      });

    // Restart button (GAME OVER)
    this.restartButton = this.add.image(width * 0.5, height * 0.8, START_BUTTON)
      .setInteractive()
      .setDepth(2601)
      .setVisible(false)
      .on('pointerdown', (e) => e?.event?.stopPropagation())
      .on('pointerup', (e) => { e?.event?.stopPropagation(); this.restart(); });

    // Sounds
    this.pointSound = this.sound.add(POINT_SOUND);
    this.flapSound = this.sound.add(FLAP_SOUND);
    this.swooshSound = this.sound.add(SWOOSH_SOUND);
    this.hitSound = this.sound.add(HIT_SOUND);
    this.dieSound = this.sound.add(DIE_SOUND);

    // Colliders
    this.physics.add.existing(this.ground, true);
    this.physics.add.collider(this.player, this.ground, this.setGameOver, null, this);
    this.physics.add.collider(this.player, this.pipes.topPipes, this.setGameOver, this.handleFall, this);
    this.physics.add.collider(this.player, this.pipes.bottomPipes, this.setGameOver, this.handleFall, this);

    this.cursors = this.input.keyboard.createCursorKeys();

    // Collectibles
    this.coinsGroup = this.physics.add.group();
    this.notesGroup = this.physics.add.group();
    this.physics.add.overlap(this.player, this.coinsGroup, (_, coin) => {
      coin?.disableBody?.(true, true);
      const now = getTime();
      const chorus = this._tl?.chorusWindows?.find((w) => now >= w.start && now <= w.end);
      const mult = chorus ? (chorus.multiplier || 2) : 1;
      this.addScore(1 * mult);
      this.bumpStreak?.();
    });
    this.physics.add.overlap(this.player, this.notesGroup, (_, note) => {
      note?.disableBody?.(true, true);
      this.notesCollected += 1;
      this.addScore(5);
      this.bumpStreak?.();
    });

// Timeline + audio
    this._tl = this.cache.json.get('timeline') || {};
    if (this._tl.audio && !this._tl.duration) {
      this._tl.duration = Math.round(getDuration()) || 0;
    }



    // Progress UI
    this.createProgressUI();

    // Camera toggle UI (starts OFF) — position right below Start
    this.createCameraToggle();

    // Now Playing (clickable)
    const nowPlayingText = this._tl?.title || NOW_PLAYING_FALLBACK;
    this.createNowPlayingBanner(nowPlayingText);

    // FX and particles
    if (this.createFX) this.createFX();

    // Cleanup handlers
    this.events.once('shutdown', () => this.disableWebcamDom());

    this.setReady();
  }

  // ---------- Now Playing ----------
  createNowPlayingBanner(text) {
    const label = this.add.text(this.scale.width / 2, 10, text, {
      fontFamily: 'Teko',
      fontSize: '24px',
      color: '#4da6ff',
    })
      .setOrigin(0.5, 0)
      .setDepth(3000)
      .setScrollFactor(0)
      .setStroke('#000000', 6)
      .setShadow(0, 2, '#000000', 4, true, true)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (e) => e?.event?.stopPropagation())
      .on('pointerup', (e) => {
        e?.event?.stopPropagation();
        window.open(SONG_URL, '_blank', 'noopener,noreferrer');
      });

    label.on('pointerover', () => label.setColor('#82c6ff'));
    label.on('pointerout',  () => label.setColor('#4da6ff'));

    const padX = 12;
    const padY = 3;
    const bg = this.add.graphics().setDepth(2999).setScrollFactor(0);
    const drawBg = () => {
      bg.clear();
      const w = label.width + padX * 2;
      const h = label.height + padY * 2;
      const x = (this.scale.width - w) / 2;
      const y = 4;
      bg.fillStyle(0x000000, 0.35);
      bg.fillRoundedRect(x, y, w, h, 10);
    };
    drawBg();

    this.tweens.add({
      targets: label,
      alpha: { from: 0.85, to: 1 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.scale.on('resize', () => {
      label.x = this.scale.width / 2;
      label.y = 10;
      drawBg();
    });

    this.nowPlayingLabel = label;
    this.nowPlayingBg = bg;
  }

  updateNowPlaying(text) {
    if (!this.nowPlayingLabel) return;
    this.nowPlayingLabel.setText(text);
    if (this.nowPlayingBg) {
      const padX = 12, padY = 6;
      const w = this.nowPlayingLabel.width + padX * 2;
      const h = this.nowPlayingLabel.height + padY * 2;
      const x = (this.scale.width - w) / 2;
      const y = 6;
      this.nowPlayingBg.clear();
      this.nowPlayingBg.fillStyle(0x000000, 0.35);
      this.nowPlayingBg.fillRoundedRect(x, y, w, h, 10);
    }
  }

  // ---------- Social buttons ----------
  createSocialButtons() {
    const { width, height } = this.scale;
    const yBase = height * 0.78;

    const mkBtn = (label, x, onClick) => {
      const t = this.add.text(x, yBase, label, {
        fontFamily: 'Teko',
        fontSize: '15px',
        color: '#ffffff',
        backgroundColor: '#13ad28ff',
        padding: { x: 6, y: 3 }
      })
        .setOrigin(0.5)
        .setDepth(2000)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', (e) => e?.event?.stopPropagation())
        .on('pointerup',   (e) => { e?.event?.stopPropagation(); onClick(); });

      t.on('pointerover', () => t.setStyle({ backgroundColor: 'rgba(37, 206, 32, 1)' }));
      t.on('pointerout',  () => t.setStyle({ backgroundColor: 'hsla(318, 58%, 34%, 1.00)' }));
      return t;
    };

    const cx = width * 0.55;
    this.btnIG       = mkBtn('Follow on Instagram', cx - 110, () => this.openExternal(IG_PROFILE_URL));
    this.btnShare    = mkBtn('Share',               cx,        () => this.shareScore()); // fixed extra arg
    this.btnLinktree = mkBtn('Our Music',           cx + 100,  () => this.openExternal(LINKTREE_URL));

    this.setSocialButtonsVisible(false);
  }

  setSocialButtonsVisible(v) {
    [this.btnIG, this.btnShare, this.btnLinktree].forEach(b => b && b.setVisible(v));
  }

  openExternal(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  shareScore() {
    const scoreMsg = `My score: ${this.score}`;
    const data = {
      title: SHARE_TITLE,
      text: `Try to beat my score in this Christian music Flappy clone! ${scoreMsg}`,
      url: SHARE_URL
    };
    if (navigator.share) {
      navigator.share(data).catch(() => {});
    } else {
      navigator.clipboard?.writeText(`${data.text} ${data.url}`).catch(() => {});
      this.openExternal(IG_PROFILE_URL);
    }
  }

  // ---------- Progress UI ----------
createProgressUI() {
  this.progressBg   = this.add.graphics().setDepth(2500).setScrollFactor(0);
  this.progressFill = this.add.graphics().setDepth(2501).setScrollFactor(0);

  this.timeLeftLabel = this.add.text(this.scale.width - 10, 20, '0:00', {
    fontFamily: 'Teko', fontSize: '20px', color: '#ffffff',
  })
    .setOrigin(1, 0)
    .setStroke('#000000', 4)
    .setShadow(0, 2, '#000000', 4, true, true)
    .setDepth(2502)
    .setScrollFactor(0);

  const redraw = () => {
    this.progressBg.clear();
    this.progressBg.fillStyle(0x000000, 0.35);
    this.progressBg.fillRoundedRect(8, 40, this.scale.width - 16, PROGRESS_HEIGHT, 6);
  };
  redraw();
  this.scale.on('resize', redraw);

  // initialize bar against whatever duration we have right now
  this.updateProgressUI(0, this._tl?.duration || 0);
}

// *** Keep THIS one; remove the other definition ***
updateProgressUI(nowSec = null, totalOverride = null) {
  if (!this.progressFill) return;

  const dur = totalOverride ?? (this._tl?.duration || 0);
  const t   = Phaser.Math.Clamp(nowSec ?? getTime(), 0, dur);
  const pct = dur > 0 ? t / dur : 0;

  const x = 8, y = 40, w = this.scale.width - 16;
  const fillW = Math.max(0, Math.min(w * pct, w));

  this.progressFill.clear();
  this.progressFill.fillStyle(0x22cc88, 0.9);
  this.progressFill.fillRoundedRect(x, y, fillW, PROGRESS_HEIGHT, 6);

  const remaining = Math.max(0, Math.ceil(dur - t));
  this.timeLeftLabel.setText(this.formatTime(remaining));
}


  formatTime(s) {
    const m = Math.floor(s / 60);
    const ss = String(s % 60).padStart(2, '0');
    return `${m}:${ss}`;
  }

  awardSongCompletion() {
    if (this._songFinishedAwarded) return;
    this._songFinishedAwarded = true;

    this.addScore(SONG_BONUS_POINTS);

    const digits = this.scoreText?.getChildren?.() || [];
    digits.forEach((d, i) => {
      d.setTint(0xffd700);
      this.tweens.add({
        targets: d,
        scaleX: 1.25, scaleY: 1.25,
        yoyo: true,
        duration: 120,
        delay: i * 40,
        repeat: 2,
        onComplete: () => d.clearTint()
      });
    });

    const popup = this.add.text(this.scale.width / 2, this.scale.height * 0.12, `+${SONG_BONUS_POINTS.toLocaleString()}`, {
      fontFamily: 'Teko',
      fontSize: '36px',
      color: '#ffd700',
    })
      .setOrigin(0.5)
      .setStroke('#000', 6)
      .setDepth(3000);

    this.tweens.add({
      targets: popup,
      y: '-=30',
      alpha: { from: 1, to: 0 },
      scaleX: { from: 1, to: 1.2 },
      scaleY: { from: 1, to: 1.2 },
      duration: 900,
      ease: 'Cubic.easeOut',
      onComplete: () => popup.destroy()
    });

    // Confetti burst celebration
    if (this._particleEmitter) {
      for (let i = 0; i < 6; i += 1) {
        this._particleEmitter.explode(30, this.scale.width * Math.random(), this.scale.height * 0.25 + Math.random() * 40);
      }
    }
  }

  // ---------- Update loop ----------
  update() {
    this.animate();
    this.handleInputs();

    // progress bar + countdown
    if (this.progressActive) {
  this.updateProgressUI();   // uses current audio time
}

    if (this.state === PLAYING_STATE) {
      this.moveCollectibles();
      this.cleanupCollectibles();
      this.updateTimelineSpawns();

      // Song-end handling: award + celebrate, then end shortly after
      if (this._tl?.duration) {
        const dur = this._tl.duration;
        if (getTime() >= dur && !this._songFinishedAwarded) {
          this.awardSongCompletion();
          this.time.delayedCall(600, () => this.setGameOver());
        }
      }
    }

    // --- DOM camera bubble follow + visibility ---
    if (this.domVideoEl && this.player) {
      const canvas = this.game.canvas;
      const rect = canvas.getBoundingClientRect();

      const sx = rect.width / this.scale.gameSize.width;
      const sy = rect.height / this.scale.gameSize.height;

      // Show bubble in READY and PLAYING, hide in GAME_OVER
      const shouldShow = (this.state !== GAME_OVER_STATE) && this.cameraEnabled;
      this.domVideoEl.style.display = shouldShow ? 'block' : 'none';
      if (shouldShow) {
        // Clamp within canvas rect to avoid drifting off-screen
        const localX = Phaser.Math.Clamp(this.player.x * sx, 0, rect.width);
        const localY = Phaser.Math.Clamp(this.player.y * sy, 0, rect.height);
        const screenX = rect.left + localX;
        const screenY = rect.top + localY;
        this.domVideoEl.style.transform = `translate3d(${screenX}px, ${screenY}px, 0) translate(-50%, -50%)`;
      }
    }

    // (debug dot removed by default; keep if you still use it)
    if (this._camDebug && this.player) {
      this._camDebug.x = this.player.x;
      this._camDebug.y = this.player.y - 22;
      this._camDebug.setDepth(1000);
    }
  }

  // ---------------- gameplay loop ----------------
  animate() {
    switch (this.state) {
      case READY_STATE: this.moveGround(); break;
      case PLAYING_STATE:
        this.fall();
        this.movePipes(); this.loopPipes(); this.moveGround();
        break;
      case GAME_OVER_STATE: this.fall(); break;
      default: break;
    }
  }

  handleInputs() {
    if (this.state === READY_STATE) {
      if (this.cursors.space.isDown) { this.setPlaying(); }
    } else if (this.state === PLAYING_STATE) {
      if (this.cursors.space.isDown || this.input.activePointer.primaryDown) {
        if (!this.isPlayerFlapping) { this.isPlayerFlapping = true; this.flap(); }
      }
      if (this.isReleased() && this.isPlayerFlapping) this.isPlayerFlapping = false;
    } else if (this.state === GAME_OVER_STATE) {
      if (this.cursors.space.isDown && this.isAllowedToRestart) this.restart();
    }
  }

  isReleased() { return this.cursors.space.isUp && !this.input.activePointer.primaryDown; }

  setReady() {
    this.swooshSound.play();
    this.gameoverMessage.visible = false;
    this.bestScoreText.visible = false;
    this.restartButton.visible = false;
    if (this.btnIG) this.setSocialButtonsVisible(false);

    this.player.body.allowGravity = false;
    this.player.anims.play(FLAP, true);
    this.state = READY_STATE;
    this.birdFlying = this.flyBirdWhileWaitingForPlayer();
    this.isPlayerFlapping = false;

    if (this.startBtn) this.startBtn.setVisible(true);
    if (this.camBtn) this.camBtn.setVisible(true);

    this.progressActive = false;
    this.updateProgressUI(0, this._tl?.duration || 0); // reset bar & label
    if (this.setDomVideoVisible) this.setDomVideoVisible(this.cameraEnabled); // show bubble if cam enabled
  }

  async setPlaying() {
    if (this.state === PLAYING_STATE) return;

    this.birdFlying.stop();
    this.readyMessage.visible = false;
    this.player.body.allowGravity = true;
    this.state = PLAYING_STATE;

    if (this.startBtn) this.startBtn.setVisible(false);
    if (this.camBtn) this.camBtn.setVisible(false);

    try {
      await resumeOnGesture();
      if (this._tl?.audio) play(0);
    } catch (_) {}
    this.progressActive = true;  // start advancing the bar with the music
    if (this.cameraEnabled && this.setDomVideoVisible) this.setDomVideoVisible(true);

  }

  setGameOver() {
  if (this.state !== GAME_OVER_STATE) {
    this.state = GAME_OVER_STATE;

    try { pause(); } catch {}        // <-- freeze audio/progress

    this.gameoverMessage.visible = true;
    this.bestScoreText.visible = true;
    this.restartButton.visible = true;
    this.isAllowedToRestart = false;
    this.hitSound.play();
    this.player.anims.stop();
    this.setSocialButtonsVisible(true);
    if (this.camBtn) this.camBtn.setVisible(false);

    const currentBest = Number(localStorage.getItem(BEST_SCORE_KEY) || 0);
    const bestScore = Math.max(currentBest, this.score);
    localStorage.setItem(BEST_SCORE_KEY, bestScore);
    this.bestScoreText.setText(`High Score : ${bestScore}`);

    this.slideStartButton();
    if (this.setDomVideoVisible) this.setDomVideoVisible(false); // hide bubble in Game Over
    // Fully remove webcam element to avoid any stray overlay issues
    if (this.cameraEnabled) this.disableWebcamDom();
  }
}


  flyBirdWhileWaitingForPlayer() {
    return this.tweens.add({ targets: this.player, y: this.player.y + 5, duration: 300, yoyo: true, repeat: -1 });
  }

  slideStartButton() {
    this.tweens.add({
      targets: this.restartButton, y: this.scale.height * 0.6, duration: 500,
      onComplete: () => { this.isAllowedToRestart = true; },
    });
  }

  handleFall() { if (this.state !== GAME_OVER_STATE) this.dieSound.play(); return true; }

  restart() {
    this.clearScore();
    this.coinsGroup.clear(true, true);
    this.notesGroup.clear(true, true);
    this._nextNoteIdx = 0;
    this._nextCoinAt = 0;
    this.notesCollected = 0;
    this._songFinishedAwarded = false;
    this.setSocialButtonsVisible(false);
    this.progressActive = false;
this.updateProgressUI(0, this._tl?.duration || 0); // show full time remaining again


    // optional: turn off camera on restart
    // this.disableWebcamDom();

    this.scene.restart();
    this.setReady();
  }

  clearScore() { this.score = 0; this.lastRecordedPipe = null; }

  flap() {
    this.player.setVelocityY(BIRD_VELOCITY);
    this.player.anims.play(FLAP, true);
    this.player.angle = -ELEVATION_ANGLE;
    this.flapSound.play();
    if (this._particleEmitter) this._particleEmitter.explode(10, this.player.x - 10, this.player.y);
  }

  fall() { if (this.player.angle < FALL_ANGLE) this.player.angle += DECLINE_ANGLE_DELTA; }

  moveGround() { this.ground.tilePositionX += GAME_SPEED; }

  movePipes() { this.pipes.topPipes.incX(-GAME_SPEED); this.pipes.bottomPipes.incX(-GAME_SPEED); }

  moveCollectibles() {
    this.coinsGroup.getChildren().forEach((c) => { c.x -= GAME_SPEED; });
    this.notesGroup.getChildren().forEach((n) => { n.x -= GAME_SPEED; });
  }

  cleanupCollectibles() {
    this.coinsGroup.getChildren().forEach((c) => { if (c.getBounds().right < 0) c.destroy(); });
    this.notesGroup.getChildren().forEach((n) => { if (n.getBounds().right < 0) n.destroy(); });
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
    if (!this.anims.exists || !this.anims.exists(FLAP)) {
      this.anims.create({ key: FLAP, frames: this.anims.generateFrameNumbers(BIRD, { start: 0, end: 2 }), frameRate: FRAME_RATE, repeat: -1 });
    }
    return player;
  }

  createReadyMessage() { const { width, height } = this.scale; return this.add.image(width * 0.5, height * 0.4, READY_MESSAGE); }
  createGameOverMessage() { const { width, height } = this.scale; return this.add.image(width * 0.5, height * 0.3, GAME_OVER_MESSAGE); }

  createScoreText() {
    const { width, height } = this.scale;
    const score = this.physics.add.staticGroup();
    const x = width * 0.5, y = height * 0.08;
    const digits = String(this.score).split('');
    const length = digits.length * DIGIT_WIDTH;
    const offsetX = x - length / 2;
    digits.forEach((d, i) => score.create(offsetX + (i * DIGIT_WIDTH), y, d));
    score.setOrigin(0, 0);
    return score;
  }

  createBestScoreText() {
    const { width, height } = this.scale;
    return this.add.text(width * 0.5, height * 0.4, '', {
      fontFamily: 'Teko', fontSize: '25px', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5);
  }

  createGround() {
    const { width, height } = this.scale;
    const x = width * 0.5, y = height - GROUND_HEIGHT * 0.3;
    return this.add.tileSprite(x, y, width, GROUND_HEIGHT, GROUND);
  }

  createPipePair(x, y) {
    const top = this.physics.add.image(x, y, PIPE);
    top.flipY = true; top.body.moves = false; top.setOrigin(0, 0);
    const bottomY = y + PIPE_GAP_HEIGHT + PIPE_HEIGHT;
    const bottom = this.physics.add.image(x, bottomY, PIPE);
    bottom.body.moves = false; bottom.setOrigin(0, 0);
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
      topPipes.add(top); bottomPipes.add(bottom);
    }
    return { topPipes, bottomPipes };
  }

  resetPipesPosition(top, bottom) {
    const x = this.scale.width + PIPE_GAP_LENGTH;
    const y = Phaser.Math.Between(MIN_PIPE_HEIGHT, 0);
    const bottomY = y + PIPE_GAP_HEIGHT + PIPE_HEIGHT;
    top.y = y; top.x = x;
    bottom.x = x; bottom.y = bottomY;
  }

  updateScoreText() {
    const digits = String(this.score).split('');
    const children = this.scoreText.getChildren();
    if (children.length === digits.length) {
      const x = this.scale.width * 0.5, y = this.scale.height * 0.08;
      const length = digits.length * DIGIT_WIDTH;
      const offsetX = x - length / 2;
      for (let i = 0; i < digits.length; i += 1) {
        const s = children[i];
        s.setTexture(digits[i]);
        s.setX(offsetX + (i * DIGIT_WIDTH));
        s.setY(y);
      }
      this.pointSound.play();
      return;
    }
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

  // ---- timeline spawns ----
  updateTimelineSpawns() {
    if (!this._tl) return;
    const now = getTime();

    // notes
    const notes = this._tl.noteMilestones || [];
    while (this._nextNoteIdx < notes.length && notes[this._nextNoteIdx].t <= now + LOOKAHEAD) {
      const evt = this._nextNoteIdx < notes.length ? notes[this._nextNoteIdx++] : null;
      if (!evt) break;
      const yClamped = Phaser.Math.Clamp(evt.y ?? 240, 80, this.scale.height - 140);
      this.spawnNote(this.scale.width + 40, yClamped);
    }

    // coins
    const inChorus = (this._tl.chorusWindows || []).some((w) => now >= w.start && now <= w.end);
    const chorusWin = inChorus ? (this._tl.chorusWindows || []).find((w) => now >= w.start && now <= w.end) : null;
    const rate = inChorus ? (chorusWin?.coinRate || 3.0) : (this._tl.ambientCoins?.rate || 0.7);

    if (now >= this._nextCoinAt) {
      const range = this._tl.ambientCoins?.yRange || [140, 360];
      this.spawnCoinCluster(!!inChorus, range);
      const baseGap = Math.max(this._tl.ambientCoins?.minGap || 1.0, 1.0 / rate);
      this._nextCoinAt = now + baseGap;
    }

    // Visuals when entering/exiting chorus
    if (this.setChorusVisuals) this.setChorusVisuals(inChorus, chorusWin?.multiplier || 1);
  }

  spawnCoin(x, y) {
    const c = this.coinsGroup.get(x, y, 'coin');
    if (!c) return null;
    c.setActive(true).setVisible(true);
    if (c.body) { c.body.enable = true; c.body.allowGravity = false; }
    return c;
  }

  spawnNote(x, y) {
    const n = this.notesGroup.get(x, y, 'note');
    if (!n) return null;
    n.setActive(true).setVisible(true);
    if (n.body) { n.body.enable = true; n.body.allowGravity = false; }
    return n;
  }

  spawnCoinCluster(inChorus, yRange) {
    const rows = inChorus ? 3 : 1;
    for (let i = 0; i < rows; i += 1) {
      const y = Phaser.Math.Between(yRange[0], yRange[1]);
      this.spawnCoin(this.scale.width + 40 + i * 18, y);
    }
  }

  addScore(n) { this.score += n; this.updateScoreText(); }

  // ---------------- camera UI & controls (DOM) ----------------
  createCameraToggle() {
    // Position relative to Start button if available
    const btnX = this.startBtn ? this.startBtn.x : 10 + 90;
    const btnY = this.startBtn ? this.startBtn.y + 50 : this.scale.height - 38;

    this.camBtn = this.add.text(btnX, btnY, 'Enable Camera 😆', {
      fontFamily: 'Teko',
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#e7157eff',
      padding: { x: 8, y: 4 }
    })
      .setOrigin(0.5) // center under Start
      .setScrollFactor(0)
      .setDepth(1000)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (e) => e?.event?.stopPropagation())
      .on('pointerup', async (e) => {
        e?.event?.stopPropagation();
        if (!this.cameraEnabled) await this.enableWebcamDom();
        else this.disableWebcamDom();
      });

    // keep under Start if resized
    this.scale.on('resize', () => {
      if (this.startBtn && this.camBtn) {
        this.camBtn.x = this.startBtn.x;
        this.camBtn.y = this.startBtn.y + 50;
      }
    });

    // Ensure clean label text
    this.camBtn?.setText('Enable Camera');
  }

  async enableWebcamDom() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 300 }, height: { ideal: 300 } },
        audio: false
      });

      const video = document.createElement('video');
      video.playsInline = true;
      video.muted = true;
      video.autoplay = true;
      video.srcObject = stream;
      video.style.position = 'fixed';
      video.style.left = '0px';
      video.style.top = '0px';
      video.style.width = `${this.domVideoSize}px`;
      video.style.height = `${this.domVideoSize}px`;
      video.style.borderRadius = '50%';
      video.style.objectFit = 'cover';
      video.style.pointerEvents = 'none';
      video.style.zIndex = '9999';
      video.style.transform = 'translate3d(0, 0, 0) translate(-50%, -50%)';
      video.style.willChange = 'transform';
      video.style.border = '5px solid white';
      // optional glow for contrast
      video.style.boxShadow = '0 0 8px rgba(255,255,255,0.85)';
      // show bubble in READY or PLAYING
      video.style.display = (this.state !== GAME_OVER_STATE) ? 'block' : 'none';

      document.body.appendChild(video);

      try { await video.play(); } catch {}

      this.domVideoEl = video;
      this.webcamStream = stream;
      this.cameraEnabled = true;
      this.camBtn?.setText('Disable Camera');

      // Replace the sprite visually immediately
      this.player.setVisible(false);
    } catch (err) {
      console.warn('Webcam error:', err);
      this.showCamToast?.('Camera blocked or unavailable. Check permissions and try again.');
    }
  }

  disableWebcamDom() {
    try {
      if (this.domVideoEl) {
        if (this.domVideoEl.parentNode) this.domVideoEl.parentNode.removeChild(this.domVideoEl);
        this.domVideoEl.srcObject = null;
        this.domVideoEl = null;
      }
      if (this.webcamStream) {
        this.webcamStream.getTracks().forEach(t => t.stop());
        this.webcamStream = null;
      }
    } catch {}
    this.cameraEnabled = false;
    this.camBtn?.setText('Enable Camera');

    // Show the sprite again if you hid it
    this.player.setVisible(true);
  }

  // Helper to toggle DOM video visibility safely
  setDomVideoVisible(v) { if (this.domVideoEl) this.domVideoEl.style.display = v ? 'block' : 'none'; }

  // Small toast near camera button for permission/status
  showCamToast(msg) {
    try { if (this.camStatusText) { this.camStatusText.destroy(); this.camStatusText = null; } } catch {}
    const x = this.camBtn ? this.camBtn.x : this.scale.width / 2;
    const y = this.camBtn ? (this.camBtn.y + 26) : (this.scale.height * 0.85);
    const t = this.add.text(x, y, msg, {
      fontFamily: 'Teko', fontSize: '18px', color: '#ffffff', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(3001).setScrollFactor(0);
    this.camStatusText = t;
    this.tweens.add({ targets: t, alpha: { from: 1, to: 0 }, y: '+=8', duration: 1800, ease: 'Cubic.easeOut', onComplete: () => { t.destroy(); this.camStatusText = null; } });
  }

  // ---------------- FX helpers ----------------
  createFX() {
    // Simple circle texture for particles
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture('dot', 8, 8);
    g.destroy();

    const pm = this.add.particles('dot');
    this._particleEmitter = pm.createEmitter({
      quantity: 6,
      speed: { min: 40, max: 120 },
      angle: { min: 160, max: 200 },
      lifespan: { min: 300, max: 600 },
      scale: { start: 0.8, end: 0.2 },
      alpha: { start: 0.9, end: 0 },
      gravityY: 0,
      tint: [0xffffff, 0xffd700, 0x82c6ff, 0xff66aa],
      on: false,
      follow: null,
      blendMode: 'ADD',
    });
  }

  bumpStreak() {
    this._streak += 1;
    if (this._streakTimer) this._streakTimer.remove(false);
    this._streakTimer = this.time.delayedCall(1200, () => { this._streak = 0; });
    if (this._streak >= 3) {
      this.showPopupText(`Amen x${this._streak}`, '#ffd700');
    }
  }

  showPopupText(text, color = '#ffffff') {
    const p = this.add.text(this.player.x, Math.max(40, this.player.y - 40), text, {
      fontFamily: 'Teko', fontSize: '24px', color,
      stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(2000);
    this.tweens.add({ targets: p, y: '-=20', alpha: { from: 1, to: 0 }, duration: 650, ease: 'Cubic.easeOut', onComplete: () => p.destroy() });
  }

  setChorusVisuals(active, mult) {
    if (active === this._lastChorusActive && mult === this._chorusActiveMultiplier) return;
    this._lastChorusActive = active;
    this._chorusActiveMultiplier = mult;

    // Pipe tint + pulse
    const allTop = this.pipes?.topPipes?.getChildren?.() || [];
    const allBot = this.pipes?.bottomPipes?.getChildren?.() || [];
    if (active) {
      [...allTop, ...allBot].forEach(p => p && p.setTint(0x8e44ad));
      if (this._chorusPulseTween) this._chorusPulseTween.stop();
      this._chorusPulseTween = this.tweens.add({
        targets: [...allTop, ...allBot],
        scaleX: { from: 1.0, to: 1.05 },
        scaleY: { from: 1.0, to: 1.05 },
        yoyo: true,
        duration: 260,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else {
      if (this._chorusPulseTween) { this._chorusPulseTween.stop(); this._chorusPulseTween = null; }
      [...allTop, ...allBot].forEach(p => p && p.clearTint() && (p.scaleX = 1) && (p.scaleY = 1));
    }

    // Multiplier banner
    if (active && mult > 1) {
      if (!this._chorusLabel) {
        this._chorusLabel = this.add.text(this.scale.width / 2, this.scale.height * 0.12, '', {
          fontFamily: 'Teko', fontSize: '32px', color: '#ffd700', stroke: '#000', strokeThickness: 8,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2400);
      }
      this._chorusLabel.setText(`x${mult} Chorus Hype!`);
      this._chorusLabel.setVisible(true);
      this.tweens.add({ targets: this._chorusLabel, scaleX: { from: 1, to: 1.12 }, scaleY: { from: 1, to: 1.12 }, yoyo: true, duration: 320, repeat: 3 });
      // Webcam bling
      if (this.domVideoEl) {
        this.domVideoEl.style.border = '5px solid gold';
        this.domVideoEl.style.boxShadow = '0 0 12px rgba(255,215,0,0.9)';
      }
    } else if (this._chorusLabel) {
      this._chorusLabel.setVisible(false);
      if (this.domVideoEl) {
        this.domVideoEl.style.border = '5px solid white';
        this.domVideoEl.style.boxShadow = '0 0 8px rgba(255,255,255,0.85)';
      }
    }
  }
}
