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

import { loadTrack, play, getTime, resumeOnGesture } from '../audio.js';

const FLAP = 'flap';
const PIPE_HEIGHT = 320;
const PIPE_GAP_HEIGHT = 105;
const PIPE_GAP_LENGTH = 180;
const PIPE_PAIRS = 2;
const GROUND_HEIGHT = 112;
const FRAME_RATE = 5;
const BIRD_GRAVITY = 1000;
const BIRD_VELOCITY = -320;
const GAME_SPEED = 3;
const ELEVATION_ANGLE = 25;
const FALL_ANGLE = 90;
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
const NOW_PLAYING_FALLBACK = 'Now Playing: Psalm 32';
const SONG_URL = 'https://youtu.be/nhCYQhJPPWo?si=DomJK051-IboPCYg';
const SOUND_HINT_MS = 2200;

// timeline spawn config
const LOOKAHEAD = 1.6;

// webcam bubble
const CAMERA_BUBBLE_SIZE = 75;

// Rock Mode / snapshots
const SNAPSHOT_POINTS = 1000;            // bonus per snapshot
const MAX_SNAPS_PER_CHORUS = 3;
const SNAPSHOT_COOLDOWN_MS = 800;        // min gap between snaps
const DEFAULT_PRECHORUS_LEAD = 3;        // seconds before chorus to show countdown

// Song completion
const SONG_COMPLETION_BONUS = 10000;

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

    // (Phaser Video kept here if you switch back later)
    this.webcamVideo = null;
    this.webcamMask = null;
    this.webcamMaskG = null;

    this.startBtn = null;

    // Debug anchor dot
    this._camDebug = null;

    // Sound Button
    this.soundBtn = null;
    this.isMuted = false;
    this._soundHint = null;

    // Progress UI
    this.progressBg = null;
    this.progressFill = null;
    this.timeLabel = null;

    // Rock Mode / countdown
    this.rockModeActive = false;
    this.rockCountdownLabel = null;
    this.countdownActive = false;
    this.currentChorus = null;

    // Snapshots
    this.snapshots = [];
    this.lastSnapshotAt = 0;
    this.snapshotStripDiv = null;

    // Song / bonus
    this.songBonusAwarded = false;

    // CSS pulse style injection
    this._pulseStyleInjected = false;
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
    this.createSoundToggle();

    // Start button (READY only)
    const { width, height } = this.scale;
    this.startBtn = this.add.image(width * 0.5, height * 0.7, START_BUTTON)
      .setInteractive()
      .on('pointerdown', (e) => e?.event?.stopPropagation())
      .on('pointerup', async (e) => {
        e?.event?.stopPropagation();
        await this.setPlaying();
      });

    // Restart button (GAME OVER)
    this.restartButton = this.add.image(width * 0.5, height * 0.8, START_BUTTON)
      .setInteractive()
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
      coin.destroy();
      const now = getTime();
      const chorus = this._tl?.chorusWindows?.find((w) => now >= w.start && now <= w.end);
      const mult = chorus ? (chorus.multiplier || 2) : 1;
      this.addScore(1 * mult);
    });
    this.physics.add.overlap(this.player, this.notesGroup, (_, note) => {
      note.destroy();
      this.notesCollected += 1;
      this.addScore(5);
    });

    // Timeline + audio
    this._tl = this.cache.json.get('timeline') || null;
    if (this._tl?.audio) {
      loadTrack(this._tl.audio).catch((e) => console.warn('Audio load failed:', e));
    }

    // Progress bar / time remaining
    this.createProgressUI();

    // Camera toggle UI (starts OFF) – under Start button
    this.createCameraToggle();

    // Now Playing banner
    const nowPlayingText = this._tl?.title || NOW_PLAYING_FALLBACK;
    this.createNowPlayingBanner(nowPlayingText);

    // Snapshot state
    this.initSnapshotState();

    this.setReady();
  }

  // ---------- Now Playing (clickable) ----------
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

  // ---------- Socials ----------
  createSocialButtons() {
    const { width, height } = this.scale;
    const yBase = height * 0.78;

    const mkBtn = (label, x, onClick) => {
      const t = this.add.text(x, yBase, label, {
        fontFamily: 'Teko',
        fontSize: '15px',
        color: '#ffffff',
        backgroundColor: 'rgba(37, 78, 214, 1)',
        padding: { x: 6, y: 3 }
      })
        .setOrigin(0.5)
        .setDepth(2000)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', (e) => e?.event?.stopPropagation())
        .on('pointerup',   (e) => { e?.event?.stopPropagation(); onClick(); });

      t.on('pointerover', () => t.setStyle({ backgroundColor: 'rgba(19, 121, 15, 1)' }));
      t.on('pointerout',  () => t.setStyle({ backgroundColor: 'hsla(337, 97%, 49%, 1.00)' }));
      return t;
    };

    const cx = width * 0.55;
    this.btnIG       = mkBtn('Follow on Instagram', cx - 110, () => this.openExternal(IG_PROFILE_URL));
    this.btnShare    = mkBtn('Share',               cx,       () => this.shareScore());
    this.btnLinktree = mkBtn('Our Music',           cx + 100, () => this.openExternal(LINKTREE_URL));

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
    const data = { title: SHARE_TITLE, text: `${SHARE_TEXT} ${scoreMsg}`, url: SHARE_URL };
    if (navigator.share) {
      navigator.share(data).catch(() => {});
    } else {
      navigator.clipboard?.writeText(`${data.text} ${data.url}`).catch(() => {});
      this.openExternal(IG_PROFILE_URL);
    }
  }

  // ---------- Sound toggle ----------
  createSoundToggle() {
    const x = this.scale.width - 10;
    const y = 8;

    this.soundBtn = this.add.text(x, y, this.isMuted ? '🔇' : '🔊', {
      fontFamily: 'Teko',
      fontSize: '28px',
      color: '#ffffff',
    })
      .setOrigin(1, 0)
      .setDepth(3001)
      .setScrollFactor(0)
      .setStroke('#000000', 6)
      .setShadow(0, 2, '#000000', 4, true, true)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (e) => e?.event?.stopPropagation())
      .on('pointerup', async (e) => {
        e?.event?.stopPropagation();
        await this.toggleSound();
      });

    this.scale.on('resize', () => {
      if (!this.soundBtn) return;
      this.soundBtn.x = this.scale.width - 10;
      this.soundBtn.y = 8;
    });
  }

  async toggleSound() {
    try { await resumeOnGesture(); } catch {}
    try { this.sound.unlock(); } catch {}
    this.isMuted = !this.isMuted;
    this.sound.mute = this.isMuted;
    if (this.soundBtn) this.soundBtn.setText(this.isMuted ? '🔇' : '🔊');
    if (!this.isMuted && this.state === PLAYING_STATE && this._tl?.audio) {
      try { play(); } catch {}
    }
    if (!this.isMuted) {
      this.showSoundHint('If you still can’t hear audio,\nflip your mute switch or raise volume.');
    }
  }

  showSoundHint(msg) {
    if (this._soundHint) { this._soundHint.destroy(); this._soundHint = null; }
    const label = this.add.text(this.scale.width / 2, 64, msg, {
      fontFamily: 'Teko',
      fontSize: '18px',
      color: '#ffffff',
      align: 'center',
    })
      .setOrigin(0.5, 0)
      .setDepth(3000)
      .setScrollFactor(0)
      .setStroke('#000000', 6)
      .setShadow(0, 2, '#000000', 4, true, true)
      .setAlpha(0);

    this._soundHint = label;

    this.tweens.add({
      targets: label,
      alpha: { from: 0, to: 1 },
      duration: 200,
      onComplete: () => {
        this.time.delayedCall(SOUND_HINT_MS, () => {
          this.tweens.add({
            targets: label,
            alpha: { from: 1, to: 0 },
            duration: 250,
            onComplete: () => { label.destroy(); if (this._soundHint === label) this._soundHint = null; }
          });
        });
      }
    });

    this.scale.on('resize', () => {
      if (!this._soundHint) return;
      this._soundHint.x = this.scale.width / 2;
    });
  }

  // ---------- Progress UI ----------
  createProgressUI() {
    const w = this.scale.width * 0.7;
    const h = 8;
    const x = (this.scale.width - w) / 2;
    const y = 40;

    this.progressBg = this.add.graphics().setDepth(2500).setScrollFactor(0);
    this.progressBg.fillStyle(0x000000, 0.35).fillRoundedRect(x, y, w, h, 4);

    this.progressFill = this.add.graphics().setDepth(2501).setScrollFactor(0);
    this.progressFill.fillStyle(0xffd200, 0.9).fillRoundedRect(x, y, 0.0001, h, 4);

    this.timeLabel = this.add.text(this.scale.width / 2, y + h + 6, '0:00 / 0:00', {
      fontFamily: 'Teko',
      fontSize: '16px',
      color: '#ffffff',
    })
      .setOrigin(0.5, 0)
      .setDepth(2502)
      .setScrollFactor(0)
      .setStroke('#000000', 5)
      .setShadow(0, 2, '#000000', 4, true, true);

    this.scale.on('resize', () => {
      this.progressBg.clear();
      this.progressFill.clear();
      const w2 = this.scale.width * 0.7;
      const x2 = (this.scale.width - w2) / 2;
      const y2 = 40;
      this.progressBg.fillStyle(0x000000, 0.35).fillRoundedRect(x2, y2, w2, h, 4);
      this.timeLabel.x = this.scale.width / 2;
      this.timeLabel.y = y2 + h + 6;
    });
  }

  updateProgressUI() {
    if (!this._tl?.duration || !this.progressBg || !this.progressFill) return;
    const total = this._tl.duration;
    const now = Phaser.Math.Clamp(getTime(), 0, total);
    const pct = total > 0 ? now / total : 0;

    const w = this.scale.width * 0.7;
    const h = 8;
    const x = (this.scale.width - w) / 2;
    const y = 40;

    this.progressFill.clear();
    this.progressFill.fillStyle(0xffd200, 0.95).fillRoundedRect(x, y, Math.max(1, w * pct), h, 4);

    const fmt = (s) => {
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return `${m}:${sec.toString().padStart(2, '0')}`;
    };
    this.timeLabel.setText(`${fmt(now)} / ${fmt(total)}`);
  }

  // ---------- Update loop ----------
  update() {
    this.animate();
    this.handleInputs();

    if (this.state === PLAYING_STATE) {
      this.moveCollectibles();
      this.cleanupCollectibles();
      this.updateTimelineSpawns();
      this.updateProgressUI();

      // Song end → award bonus once, then game over
      if (this._tl?.duration && getTime() >= this._tl.duration) {
        if (!this.songBonusAwarded) {
          this.songBonusAwarded = true;
          this.addScore(SONG_COMPLETION_BONUS);
          this.animateScoreGold();
        }
        this.setGameOver();
        this.setSocialButtonsVisible(true);
      }

      // Chorus orchestration
      this.maybeStartPreChorusCountdown(getTime());

      if (this.rockModeActive && this.currentChorus && getTime() >= this.currentChorus.end) {
        this.exitRockMode();
      }

      // Snapshots during Rock Mode
      if (this.rockModeActive) this.maybeTakeSnapshot(performance.now());
    }

    // --- DOM camera bubble follow (when not fullscreen) ---
    if (this.domVideoEl && this.player && !this.rockModeActive) {
      const canvas = this.game.canvas;
      const rect = canvas.getBoundingClientRect();
      const sx = rect.width / this.scale.gameSize.width;
      const sy = rect.height / this.scale.gameSize.height;
      const screenX = rect.left + this.player.x * sx;
      const screenY = rect.top + this.player.y * sy;
      this.domVideoEl.style.left = `${screenX}px`;
      this.domVideoEl.style.top = `${screenY}px`;
      this.domVideoEl.style.width = `${this.domVideoSize}px`;
      this.domVideoEl.style.height = `${this.domVideoSize}px`;
      this.domVideoEl.style.borderRadius = '50%';
      this.domVideoEl.style.border = '5px solid white';
      this.domVideoEl.style.boxShadow = '0 0 8px rgba(255,255,255,0.85)';
      this.domVideoEl.style.zIndex = '9999';
      this.domVideoEl.style.transform = 'translate(-50%, -50%)';
    }

    // Move the debug dot EVERY frame
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

  // ---------- States ----------
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
    this.songBonusAwarded = false;
  }

  async setPlaying() {
    if (this.state === PLAYING_STATE) return;

    this.birdFlying.stop();
    this.readyMessage.visible = false;
    this.player.body.allowGravity = true;
    this.state = PLAYING_STATE;

    if (this.startBtn) this.startBtn.setVisible(false);

    try {
      await resumeOnGesture();
      if (this._tl?.audio) play(0);
    } catch (_) {}
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

      // show socials
      this.setSocialButtonsVisible(true);

      // gallery (if any snapshots)
      this.showSnapshotGallery();

      const currentBest = localStorage.getItem(BEST_SCORE_KEY) || 0;
      const bestScore = Math.max(currentBest, this.score);
      localStorage.setItem(BEST_SCORE_KEY, Math.max(this.score, bestScore));
      this.bestScoreText.setText(`High Score : ${currentBest}`);

      this.slideStartButton();
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
    // Cleanup snapshots gallery DOM if present
    if (this.snapshotStripDiv && this.snapshotStripDiv.parentNode) {
      this.snapshotStripDiv.parentNode.removeChild(this.snapshotStripDiv);
      this.snapshotStripDiv = null;
    }

    this.clearScore();
    this.coinsGroup.clear(true, true);
    this.notesGroup.clear(true, true);
    this._nextNoteIdx = 0;
    this._nextCoinAt = 0;
    this.notesCollected = 0;
    this.setSocialButtonsVisible(false);
    this.exitRockMode(true); // force exit if active
    this.initSnapshotState();

    this.scene.restart();
    this.setReady();
  }

  clearScore() { this.score = 0; this.lastRecordedPipe = null; }

  addScore(n) { this.score += n; this.updateScoreText(); }

  animateScoreGold() {
    // tint + scale bounce all score digits
    const kids = this.scoreText.getChildren ? this.scoreText.getChildren() : [];
    kids.forEach((img) => img.setTint(0xFFD700));
    this.tweens.add({
      targets: kids,
      scale: { from: 1.0, to: 1.25 },
      yoyo: true,
      duration: 180,
      ease: 'Quad.easeOut'
    });
    // clear tint after a moment
    this.time.delayedCall(600, () => kids.forEach((img) => img.clearTint()));
  }

  // ---------- Movement / objects ----------
  flap() {
    this.player.setVelocityY(BIRD_VELOCITY);
    this.player.anims.play(FLAP, true);
    this.player.angle = -ELEVATION_ANGLE;
    this.flapSound.play();
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
    this.physics.add.staticImage(width * 0.5, height * 0.5, BACKGROUND).setScale(1.7).refreshBody();
  }

  createPlayer() {
    const { width, height } = this.scale;
    const player = this.physics.add.sprite(width * 0.3, height * 0.5, BIRD);
    player.setCollideWorldBounds(true);
    player.setGravityY(BIRD_GRAVITY);
    player.body.allowGravity = false;
    this.anims.create({ key: FLAP, frames: this.anims.generateFrameNumbers(BIRD, { start: 0, end: 2 }), frameRate: FRAME_RATE, repeat: -1 });
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

  // ---------- Timeline spawns ----------
  updateTimelineSpawns() {
    if (!this._tl) return;
    const now = getTime();

    // notes
    const notes = this._tl.noteMilestones || [];
    while (this._nextNoteIdx < notes.length && notes[this._nextNoteIdx].t <= now + LOOKAHEAD) {
      const evt = notes[this._nextNoteIdx++];
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

  // ---------- Camera UI & controls (DOM) ----------
  createCameraToggle() {
    const btnX = this.startBtn ? this.startBtn.x : 100;
    const btnY = this.startBtn ? this.startBtn.y + 50 : this.scale.height - 38;

    this.camBtn = this.add.text(btnX, btnY, 'Enable Camera 😆', {
      fontFamily: 'Teko',
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#e7157eff',
      padding: { x: 8, y: 4 }
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1000)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (e) => e?.event?.stopPropagation())
      .on('pointerup', async (e) => {
        e?.event?.stopPropagation();
        if (!this.cameraEnabled) await this.enableWebcamDom();
        else this.disableWebcamDom();
      });

    this.scale.on('resize', () => {
      if (this.startBtn && this.camBtn) {
        this.camBtn.x = this.startBtn.x;
        this.camBtn.y = this.startBtn.y + 50;
      }
    });
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
      video.style.position = 'absolute';
      video.style.width = `${this.domVideoSize}px`;
      video.style.height = `${this.domVideoSize}px`;
      video.style.borderRadius = '50%';
      video.style.objectFit = 'cover';
      video.style.pointerEvents = 'none';
      video.style.zIndex = '9999';
      video.style.transform = 'translate(-50%, -50%)';
      video.style.border = '5px solid white';
      video.style.boxShadow = '0 0 8px rgba(255,255,255,0.85)';

      document.body.appendChild(video);

      try { await video.play(); } catch {}

      this.domVideoEl = video;
      this.webcamStream = stream;
      this.cameraEnabled = true;
      this.camBtn?.setText('Disable Camera');

      // Replace the sprite visually
      this.player.setVisible(false);

      // Debug dot (optional)
      // this._camDebug = this.add.circle(this.player.x, this.player.y - 22, 2, 0xff00ff, 1).setDepth(1000);
    } catch (err) {
      console.warn('Webcam error:', err);
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
    this.player.setVisible(true);
  }

  // ---------- Rock Mode orchestration ----------
  initSnapshotState() {
    this.snapshots = [];
    this.lastSnapshotAt = 0;
    this.snapshotCountThisChorus = 0;
  }

  maybeStartPreChorusCountdown(nowSec) {
    if (!this._tl?.sections || this.countdownActive || this.rockModeActive) return;

    const nextChorus = this._tl.sections.find(s => s.type === 'chorus' && s.start > nowSec);
    if (!nextChorus) return;

    const lead = Math.max(1, this._tl.preChorusLead ?? DEFAULT_PRECHORUS_LEAD);
    const timeToChorus = nextChorus.start - nowSec;

    if (timeToChorus <= lead && timeToChorus > 0) {
      this.countdownActive = true;
      this.showRockCountdown(Math.ceil(timeToChorus), () => {
        // at zero
        this.enterRockMode(nextChorus);
      });
    }
  }

  showRockCountdown(seconds, onZero) {
    if (this.rockCountdownLabel) this.rockCountdownLabel.destroy();

    const label = this.add.text(this.scale.width / 2, this.scale.height * 0.25, 'GET READY TO ROCK', {
      fontFamily: 'Teko',
      fontSize: '40px',
      color: '#ffffff',
    })
      .setOrigin(0.5)
      .setDepth(2600)
      .setStroke('#000000', 8)
      .setShadow(0, 4, '#000000', 8, true, true);

    const num = this.add.text(this.scale.width / 2, this.scale.height * 0.35, `${seconds}`, {
      fontFamily: 'Teko',
      fontSize: '64px',
      color: '#ffd200',
    })
      .setOrigin(0.5)
      .setDepth(2600)
      .setStroke('#000000', 8)
      .setShadow(0, 4, '#000000', 8, true, true);

    this.rockCountdownLabel = this.add.container(0, 0, [label, num]);

    const tick = () => {
      seconds -= 1;
      if (seconds <= 0) {
        this.rockCountdownLabel.destroy();
        this.rockCountdownLabel = null;
        this.countdownActive = false;
        if (onZero) onZero();
        return;
      }
      num.setText(`${seconds}`);
      this.tweens.add({
        targets: num,
        scale: { from: 1.2, to: 1.0 },
        duration: 250,
        ease: 'Quad.easeOut',
      });
      this.time.delayedCall(1000, tick);
    };

    this.tweens.add({
      targets: label,
      alpha: { from: 0, to: 1 },
      duration: 200
    });
    this.time.delayedCall(1000, tick);
  }

  enterRockMode(chorusSection) {
    this.rockModeActive = true;
    this.currentChorus = chorusSection;
    this.snapshotCountThisChorus = 0;
    this.injectPulseCssOnce();

    if (this.cameraEnabled && this.domVideoEl) {
      // Fullscreen camera background with a subtle pulse
      const v = this.domVideoEl;
      v.style.position = 'fixed';
      v.style.left = '0';
      v.style.top = '0';
      v.style.width = '100vw';
      v.style.height = '100vh';
      v.style.transform = 'none';
      v.style.border = 'none';
      v.style.borderRadius = '0';
      v.style.boxShadow = 'none';
      v.style.objectFit = 'cover';
      v.style.zIndex = '0';
      v.classList.add('rock-pulse');
      // Ensure canvas is above
      this.game.canvas.style.position = 'relative';
      this.game.canvas.style.zIndex = '1';
    } else {
      // No camera: optional tint flash on background
      this.flashBackgroundTint();
    }
  }

  exitRockMode(force = false) {
    if (!this.rockModeActive && !force) return;
    this.rockModeActive = false;
    this.currentChorus = null;

    if (this.cameraEnabled && this.domVideoEl) {
      const v = this.domVideoEl;
      v.classList.remove('rock-pulse');
      // restore to circle
      const rect = this.game.canvas.getBoundingClientRect();
      const sx = rect.width / this.scale.gameSize.width;
      const sy = rect.height / this.scale.gameSize.height;
      const screenX = rect.left + this.player.x * sx;
      const screenY = rect.top + this.player.y * sy;

      v.style.position = 'absolute';
      v.style.left = `${screenX}px`;
      v.style.top = `${screenY}px`;
      v.style.width = `${this.domVideoSize}px`;
      v.style.height = `${this.domVideoSize}px`;
      v.style.borderRadius = '50%';
      v.style.transform = 'translate(-50%, -50%)';
      v.style.border = '5px solid white';
      v.style.boxShadow = '0 0 8px rgba(255,255,255,0.85)';
      v.style.zIndex = '9999';
    }
  }

  flashBackgroundTint() {
    // Quick pulse on the whole scene if no camera
    const g = this.add.rectangle(this.scale.width/2, this.scale.height/2, this.scale.width, this.scale.height, 0xffd200, 0.08)
      .setDepth(1);
    this.tweens.add({
      targets: g,
      alpha: { from: 0.08, to: 0.0 },
      duration: 600,
      onComplete: () => g.destroy()
    });
  }

  injectPulseCssOnce() {
    if (this._pulseStyleInjected) return;
    const style = document.createElement('style');
    style.textContent = `
      @keyframes rockPulse {
        0% { filter: contrast(1.05) saturate(1.2) hue-rotate(0deg) brightness(1.0); }
        50% { filter: contrast(1.15) saturate(1.35) hue-rotate(12deg) brightness(1.1); }
        100% { filter: contrast(1.05) saturate(1.2) hue-rotate(0deg) brightness(1.0); }
      }
      video.rock-pulse { animation: rockPulse 1.2s ease-in-out infinite; }
    `;
    document.head.appendChild(style);
    this._pulseStyleInjected = true;
  }

  // ---------- Snapshots ----------
  maybeTakeSnapshot(nowMs) {
    if (!this.cameraEnabled || !this.domVideoEl || !this.rockModeActive) return;
    if (this.snapshotCountThisChorus >= MAX_SNAPS_PER_CHORUS) return;
    if (nowMs - this.lastSnapshotAt < SNAPSHOT_COOLDOWN_MS) return;

    // Capture from camera to an offscreen canvas
    const video = this.domVideoEl;
    const w = 320; const h = 320; // moderate size
    if (!this._snapCanvas) {
      this._snapCanvas = document.createElement('canvas');
      this._snapCanvas.width = w;
      this._snapCanvas.height = h;
      this._snapCtx = this._snapCanvas.getContext('2d');
    }
    const ctx = this._snapCtx;
    ctx.drawImage(video, 0, 0, w, h);

    try {
      const dataUrl = this._snapCanvas.toDataURL('image/jpeg', 0.85);
      this.snapshots.push({ dataUrl, t: getTime() });
      this.snapshotCountThisChorus += 1;
      this.lastSnapshotAt = nowMs;

      // Award snapshot points immediately (feels good)
      this.addScore(SNAPSHOT_POINTS);
      this.animateScoreGold();
    } catch (e) {
      // ignore capture errors
    }
  }

  showSnapshotGallery() {
    if (!this.snapshots || this.snapshots.length === 0) return;

    // Build a small DOM strip under the canvas
    const strip = document.createElement('div');
    strip.style.position = 'fixed';
    strip.style.left = '50%';
    strip.style.bottom = '16px';
    strip.style.transform = 'translateX(-50%)';
    strip.style.display = 'flex';
    strip.style.gap = '8px';
    strip.style.padding = '8px 10px';
    strip.style.background = 'rgba(0,0,0,0.35)';
    strip.style.borderRadius = '10px';
    strip.style.zIndex = '20000';

    this.snapshots.forEach((s) => {
      const img = document.createElement('img');
      img.src = s.dataUrl;
      img.style.width = '72px';
      img.style.height = '72px';
      img.style.objectFit = 'cover';
      img.style.borderRadius = '8px';
      img.style.border = '2px solid #ffd200';
      strip.appendChild(img);
    });

    const bonus = document.createElement('div');
    bonus.textContent = `Rock Shots: +${this.snapshots.length}  (Bonus +${this.snapshots.length * SNAPSHOT_POINTS})`;
    bonus.style.color = '#ffd200';
    bonus.style.fontFamily = 'Teko, sans-serif';
    bonus.style.fontSize = '18px';
    bonus.style.marginLeft = '10px';
    strip.appendChild(bonus);

    document.body.appendChild(strip);
    this.snapshotStripDiv = strip;
  }

  // --------------------------------------------------
  // (rest of file ends here)
}
