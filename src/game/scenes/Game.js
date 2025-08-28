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
const SHARE_URL      = 'https://christianaiband.com/game.html'; // or your dev URL
const NOW_PLAYING_FALLBACK = 'Now Playing: Psalm 32';
const SONG_URL = 'https://youtu.be/nhCYQhJPPWo?si=DomJK051-IboPCYg';
const SOUND_HINT_MS = 2200; // how long to show the “check volume” hint





// timeline spawn config
const LOOKAHEAD = 1.6;

// webcam bubble
const CAMERA_BUBBLE_SIZE = 75;

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

    // (Phaser video fields kept in case you want to switch back later)
    this.webcamVideo = null;
    this.webcamMask = null;
    this.webcamMaskG = null;

    this.startBtn = null;

    // Debug anchor dot
    this._camDebug = null;

    // Sound Button
    this.soundBtn = null;
    this.isMuted = false;   // Phaser’s global mute mirror
    this._soundHint = null; // transient hint text

    // Rock mode / chorus extras
    this.rockModeActive = false;
    this.rockCountdownLabel = null;
    this.rockCountdownTimer = null;
    this.faceTracker = null;
    this.faceLoopHandle = null;
    this.snapshots = [];
    this.maxSnapshotsPerChorus = 3;
    this.snapshotCooldownMs = 800;
    this.lastSnapshotAt = 0;
    this.currentChorus = null;
    this.sunglasses = null;
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

    // chorus / rock-mode helpers
    this.initSnapshotState();
    this.createRockCountdownUI();
    this.createSunglassesSticker();

    


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

    // Camera toggle UI (starts OFF)
    this.createCameraToggle();

    // Prefer timeline title if present; otherwise fallback
const nowPlayingText = this._tl?.title || NOW_PLAYING_FALLBACK;
this.createNowPlayingBanner(nowPlayingText);


    this.setReady();
  }

  createNowPlayingBanner(text) {
  // Text
  const label = this.add.text(this.scale.width / 2, 10, text, {
  fontFamily: 'Teko',
  fontSize: '24px',
  color: '#4da6ff',  // hyperlink-style color
})
  .setOrigin(0.5, 0)
  .setDepth(3000)
  .setScrollFactor(0)
  .setStroke('#000000', 6)
  .setShadow(0, 2, '#000000', 4, true, true)
  .setInteractive({ useHandCursor: true }) // <-- clickable
  .on('pointerdown', (e) => e?.event?.stopPropagation())
  .on('pointerup', (e) => {
    e?.event?.stopPropagation();
    window.open(SONG_URL, '_blank', 'noopener,noreferrer');
  });

// Hover effect (desktop)
label.on('pointerover', () => label.setColor('#82c6ff'));
label.on('pointerout',  () => label.setColor('#4da6ff'));


  // Background pill (graphics)
  const padX = 12;
  const padY = 3;
  const bg = this.add.graphics().setDepth(2999).setScrollFactor(0);
  const drawBg = () => {
    bg.clear();
    const w = label.width + padX * 2;
    const h = label.height + padY * 2;
    const x = (this.scale.width - w) / 2;
    const y = 4; // top margin
    bg.fillStyle(0x000000, 0.35);
    bg.fillRoundedRect(x, y, w, h, 10);
  };
  drawBg();

  // Subtle animation (alpha pulse)
  this.tweens.add({
    targets: label,
    alpha: { from: 0.85, to: 1 },
    duration: 1200,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  // Keep positioned nicely on resize
  this.scale.on('resize', () => {
    label.x = this.scale.width / 2;
    label.y = 10;
    drawBg();
  });




  // Expose so you can update weekly if you want
  this.nowPlayingLabel = label;
  this.nowPlayingBg = bg;
}

updateNowPlaying(text) {
  if (!this.nowPlayingLabel) return;
  this.nowPlayingLabel.setText(text);
  // Redraw background to fit new width
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

    // subtle hover on desktop
    t.on('pointerover', () => t.setStyle({ backgroundColor: 'rgba(19, 121, 15, 1)' }));
    t.on('pointerout',  () => t.setStyle({ backgroundColor: 'hsla(337, 97%, 49%, 1.00)' }));
    return t;
  };

  const cx = width * 0.55;
  this.btnIG       = mkBtn('Follow on Instagram', cx - 110, () => this.openExternal(IG_PROFILE_URL));
  this.btnShare    = mkBtn('Share',               cx,       () => this.shareScore());
  this.btnLinktree = mkBtn('Our Music',            cx + 100,  () => this.openExternal(LINKTREE_URL));

  this.setSocialButtonsVisible(false);
}

setSocialButtonsVisible(v) {
  [this.btnIG, this.btnShare, this.btnLinktree].forEach(b => b && b.setVisible(v));
}

createSoundToggle() {
  // Top-right corner
  const x = this.scale.width - 10;
  const y = 8;

  this.soundBtn = this.add.text(x, y, this.isMuted ? '🔇' : '🔊', {
    fontFamily: 'Teko',
    fontSize: '28px',
    color: '#ffffff',
  })
    .setOrigin(1, 0)           // right/top align
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

  // Keep in the corner on resize
  this.scale.on('resize', () => {
    if (!this.soundBtn) return;
    this.soundBtn.x = this.scale.width - 10;
    this.soundBtn.y = 8;
  });
}

async toggleSound() {
  // Always unlock audio on explicit user gesture
  try { await resumeOnGesture(); } catch {}
  try { this.sound.unlock(); } catch {}

  this.isMuted = !this.isMuted;
  this.sound.mute = this.isMuted;        // Phaser global mute
  if (this.soundBtn) this.soundBtn.setText(this.isMuted ? '🔇' : '🔊');

  // If unmuted while game is playing, ensure track is actually started/resumed
  if (!this.isMuted && this.state === 'playing-state' && this._tl?.audio) {
    try { play(); } catch {}
  }

  // Optional: show a brief hint if still silent (OS mute/volume)
  if (!this.isMuted) {
    this.showSoundHint('If you still can’t hear audio,\nflip your mute switch or raise volume.');
  }
}

showSoundHint(msg) {
  // One at a time
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

  // Fade in, wait, fade out
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

  // Recenter on resize
  this.scale.on('resize', () => {
    if (!this._soundHint) return;
    this._soundHint.x = this.scale.width / 2;
  });
}


openExternal(url) {
  // open in a new tab safely
  window.open(url, '_blank', 'noopener,noreferrer');
}

shareScore() {
  const scoreMsg = `My score: ${this.score}`;
  const data = {
    title: SHARE_TITLE,
    text: `${SHARE_TEXT} ${scoreMsg}`,
    url: SHARE_URL
  };

  if (navigator.share) {
    navigator.share(data).catch(() => {});
  } else {
    // Fallback: copy to clipboard + open Instagram profile (or Linktree)
    navigator.clipboard?.writeText(`${data.text} ${data.url}`).catch(() => {});
    this.openExternal(IG_PROFILE_URL);
  }
}

  
  update() {
    // core loop
    this.animate();
    this.handleInputs();

    const now = getTime();
    this.maybeStartPreChorusCountdown(now);
    if (this.rockModeActive && this.currentChorus && now >= this.currentChorus.end) {
      this.exitRockMode();
    }
    if (this.rockModeActive) {
      this.maybeTakeSnapshot(performance.now());
    }

    if (this.state === PLAYING_STATE) {
      this.moveCollectibles();
      this.cleanupCollectibles();
      this.updateTimelineSpawns();

      if (this._tl?.duration && now >= this._tl.duration) {
        this.setGameOver();
        this.setSocialButtonsVisible(true);

      }
    }

    // --- DOM camera bubble follow ---
    if (this.domVideoEl && this.player) {
      const canvas = this.game.canvas;
      const rect = canvas.getBoundingClientRect();

      // scale from game coords -> CSS pixels
      const sx = rect.width / this.scale.gameSize.width;
      const sy = rect.height / this.scale.gameSize.height;

      const screenX = rect.left + this.player.x * sx;
      const screenY = rect.top + this.player.y * sy;


      this.domVideoEl.style.left = `${screenX}px`;
      this.domVideoEl.style.top = `${screenY}px`;
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
    // Only Space starts in READY
    if (this.state === READY_STATE) {
      if (this.cursors.space.isDown) { this.setPlaying(); }
    } else if (this.state === PLAYING_STATE) {
      // Flap on tap/space while playing
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
  }

  async setPlaying() {
    if (this.state === PLAYING_STATE) return;

    this.birdFlying.stop();
    this.readyMessage.visible = false;
    this.player.body.allowGravity = true;
    this.state = PLAYING_STATE;

    if (this.startBtn) this.startBtn.setVisible(false);
    // keep camBtn visible if you want mid-run toggling

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

      // NEW: show socials when game actually ends (collision or song end)
      this.setSocialButtonsVisible(true);

      const snapshotBonus = (this.snapshots?.length || 0) * 1000;
      if (snapshotBonus > 0) {
        this.addScore(snapshotBonus);
        this.createGalleryOverlay();
      } else if (!this.cameraEnabled) {
        this.add.text(this.scale.width / 2, this.scale.height * 0.55, 'Enable camera during chorus for bonus points 📸', {
          fontFamily: 'Teko', fontSize: '20px', color: '#ffffff', align: 'center'
        }).setOrigin(0.5).setDepth(5000);
      }

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
    this.clearScore();
    this.coinsGroup.clear(true, true);
    this.notesGroup.clear(true, true);
    this._nextNoteIdx = 0;
    this._nextCoinAt = 0;
    this.notesCollected = 0;
    this.setSocialButtonsVisible(false);

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

  // ---- timeline spawns ----
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

  addScore(n) { this.score += n; this.updateScoreText(); }

  // ---------------- camera UI & controls (DOM) ----------------
   createCameraToggle() {
    // Position relative to Start button if available
    const btnX = this.startBtn ? this.startBtn.x : 10 + 90;
    const btnY = this.startBtn ? this.startBtn.y + 90 : this.scale.height - 38;

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
      // optional glow for contrast
      video.style.boxShadow = '0 0 8px rgba(255,255,255,0.85)';

      document.body.appendChild(video);

      try { await video.play(); } catch {}

      this.domVideoEl = video;
      this.webcamStream = stream;
      this.cameraEnabled = true;
      this.camBtn?.setText('Disable Camera');

      // Replace the sprite visually
      this.player.setVisible(false);
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

    // Show the sprite again if you hid it
    this.player.setVisible(true);
  }

  // --------- rock mode helpers ---------

  enterFullscreenCameraBackground() {
    if (!this.domVideoEl) return;
    const v = this.domVideoEl;
    v.style.position = 'absolute';
    v.style.top = '0';
    v.style.left = '0';
    v.style.width = '100vw';
    v.style.height = '100vh';
    v.style.objectFit = 'cover';
    v.style.zIndex = '0';
    const canvas = this.game.canvas;
    canvas.style.zIndex = '1';
  }

  exitFullscreenCameraBackground() {
    if (!this.domVideoEl) return;
    const v = this.domVideoEl;
    v.style.width = `${this.domVideoSize}px`;
    v.style.height = `${this.domVideoSize}px`;
    v.style.borderRadius = '50%';
    v.style.zIndex = '9999';
    const canvas = this.game.canvas;
    canvas.style.zIndex = '';
  }

  initSnapshotState() {
    this.snapshots = [];
    this.lastSnapshotAt = 0;
  }

  maybeStartPreChorusCountdown(now) {
    if (!this._tl?.sections) return;
    const lead = this._tl.preChorusLead ?? 3;
    const upcoming = this._tl.sections.find((s) => s.type === 'chorus' && now < s.start);
    if (upcoming && upcoming.start - now <= lead && !this.rockCountdownTimer) {
      this.showRockCountdown(Math.ceil(upcoming.start - now));
      this.rockCountdownTimer = this.time.addEvent({
        delay: 1000,
        repeat: lead - 1,
        callback: () => {
          const remaining = Math.ceil(upcoming.start - getTime());
          if (remaining > 0) this.showRockCountdown(remaining);
          else {
            this.hideRockCountdown();
            this.enterRockMode(upcoming);
            this.rockCountdownTimer?.remove(false);
            this.rockCountdownTimer = null;
          }
        },
      });
    }
  }

  enterRockMode(section) {
    this.rockModeActive = true;
    this.currentChorus = section;
    this.enterFullscreenCameraBackground();
    this.initSnapshotState();
    this.startFaceLoop();
  }

  exitRockMode() {
    this.rockModeActive = false;
    this.currentChorus = null;
    this.stopFaceLoop();
    this.exitFullscreenCameraBackground();
  }

  maybeTakeSnapshot(nowMs) {
    if (!this.rockModeActive || !this.cameraEnabled || !this.domVideoEl) return;
    if (this.snapshots.length >= this.maxSnapshotsPerChorus) return;
    if (nowMs - this.lastSnapshotAt < this.snapshotCooldownMs) return;

    const canvas = document.createElement('canvas');
    const gameCanvas = this.game.canvas;
    canvas.width = gameCanvas.width;
    canvas.height = gameCanvas.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(this.domVideoEl, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      this.snapshots.push({ dataUrl, t: nowMs });
      this.lastSnapshotAt = nowMs;
    }
  }

  async initFaceTrackerIfNeeded() {
    if (this.faceTracker) return;
    try {
      const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs');
      const { FaceLandmarker, FilesetResolver } = vision;
      const filesetResolver = await FilesetResolver.forVisionTasks();
      this.faceTracker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: { modelAssetPath: undefined },
        numFaces: 1,
        runningMode: 'video',
      });
    } catch (e) {
      console.warn('Face tracker init failed', e);
    }
  }

  startFaceLoop() {
    if (this.faceLoopHandle || !this.domVideoEl) return;
    this.initFaceTrackerIfNeeded();
    const off = document.createElement('canvas');
    off.width = 256;
    off.height = 256;
    const ctx = off.getContext('2d');
    this.faceLoopHandle = setInterval(async () => {
      if (!ctx || !this.faceTracker || !this.domVideoEl) return;
      ctx.drawImage(this.domVideoEl, 0, 0, off.width, off.height);
      try {
        const res = await this.faceTracker.detectForVideo(this.domVideoEl, performance.now());
        if (res?.landmarks?.[0]) {
          this.positionSunglassesFromLandmarks(res.landmarks[0]);
        }
      } catch {}
    }, 100);
  }

  stopFaceLoop() {
    if (this.faceLoopHandle) {
      clearInterval(this.faceLoopHandle);
      this.faceLoopHandle = null;
    }
    if (this.sunglasses) this.sunglasses.setVisible(false);
  }

  createRockCountdownUI() {
    const { width, height } = this.scale;
    this.rockCountdownLabel = this.add.text(width / 2, height / 2, '', {
      fontFamily: 'Teko',
      fontSize: '48px',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(5000).setVisible(false);
  }

  showRockCountdown(n) {
    if (this.rockCountdownLabel) {
      this.rockCountdownLabel.setText(`GET READY TO ROCK ${n}`);
      this.rockCountdownLabel.setVisible(true);
    }
  }

  hideRockCountdown() {
    this.rockCountdownLabel?.setVisible(false);
  }

  createSunglassesSticker() {
    this.sunglasses = this.add.text(0, 0, '😎', {
      fontSize: '48px',
    }).setVisible(false).setDepth(4000);
  }

  positionSunglassesFromLandmarks(lm) {
    if (!this.sunglasses || !lm) return;
    const canvas = this.game.canvas;
    const x = lm[0].x * canvas.width;
    const y = lm[0].y * canvas.height;
    this.sunglasses.setPosition(x, y);
    this.sunglasses.setVisible(true);
  }

  createGalleryOverlay() {
    if (!this.snapshots.length) return;
    const div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.bottom = '10px';
    div.style.left = '50%';
    div.style.transform = 'translateX(-50%)';
    this.snapshots.forEach((s) => {
      const img = document.createElement('img');
      img.src = s.dataUrl;
      img.style.width = '60px';
      img.style.height = '60px';
      img.style.objectFit = 'cover';
      img.style.margin = '0 4px';
      div.appendChild(img);
    });
    document.body.appendChild(div);
  }
}