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
const PIPE_GAP_HEIGHT = 100;
const PIPE_GAP_LENGTH = 170;
const PIPE_PAIRS = 1;
const GROUND_HEIGHT = 110;
const FRAME_RATE = 5;
const BIRD_GRAVITY = 1000;
const BIRD_VELOCITY = -300;
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
const NOW_PLAYING_FALLBACK = 'Now Playing: Psalm 150';
const SONG_URL = 'https://christianaiband.com/game.html';

// timeline spawn config
const LOOKAHEAD = 1.6;

// webcam bubble
const CAMERA_BUBBLE_SIZE = 65;

// progress / award
const SONG_BONUS_POINTS = 10000;
const PROGRESS_HEIGHT   = 10;
// Chorus webcam snapshots
const SNAPSHOT_POINTS_PER = 1000;      // points per snapshot
const SNAPSHOT_INTERVAL_MS = 500;      // legacy (unused in new scheduling)
const SNAPSHOT_MAX_PER_WINDOW = 6;     // safety cap
const SNAPSHOT_COUNT_PER_WINDOW = 3;   // exactly 3 snapshots per chorus

// Chorus countdown
const CHORUS_COUNTDOWN_LEAD = 3;       // seconds before chorus start
const LYRIC_SPAWN_LAG = 0.12;          // positive = spawn a bit later (sec)
const LYRIC_DESPAWN_GRACE = 0.75;      // keep for reference (not used to expire)
const LYRIC_BASE_POINTS = 5;           // base points per lyric
const LYRIC_STREAK_WINDOW_MS = 1600;   // time window to chain lyric streaks
// (no-op duplicate removed) 

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
    this.progressFillRect = null;
    this.timeLeftLabel = null;
    this._songFinishedAwarded = false;

    // Debug anchor dot
    this._camDebug = null;

    // View metrics + throttles
    this._viewRect = { left: 0, top: 0, width: 0, height: 0, sx: 1, sy: 1 };
    this._lastDomUpdate = 0;
    this._domUpdateMs = 16; // ~60fps DOM video follow
    this._lastProgressUpdate = 0;
    this._progressUpdateMs = 100; // ~10fps progress redraw
    this._lastProgressDrawW = -1;

    // Chorus webcam BG and snapshots
    this._chorusBGActive = false;
    this._prevCanvasZ = '';
    this.domVideoBG = null;       // DOM video filling background during chorus
    this._snapTimer = null;
    this._snapshots = [];         // dataURLs for share on game over
    this._chorusRetryEvt = null;
    this._snapshotSchedule = [];
    this._wasInChorus = false;

    // Countdown UI state
    this._countdownTarget = null;   // absolute time (sec) of next chorus start
    this._countdownLabel = null;
    this._countdownNumber = null;

    // Lyrics data/cache
    this._lyrics = { words: [], nextIdx: 0 };
    this._lyricTex = new Map();
    this._lyricSpawned = new Set();
    this._lyricActive = null;         // currently spawned lyric token (single)
    this._lyricPM = null;             // particles manager for shimmer
    this._lyricStreak = 0;
    this._lyricStreakTimer = null;
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
    this.lyricGroup = this.physics.add.group();
    this.physics.add.overlap(this.player, this.coinsGroup, (_, coin) => {
      coin?.disableBody?.(true, true);
      const now = getTime();
      const chorus = this._tl?.chorusWindows?.find((w) => now >= w.start && now <= w.end);
      const mult = chorus ? (chorus.multiplier || 2) : 1;
      this.addScore(1 * mult);
      this.bumpStreak?.();
      try { navigator?.vibrate?.(15); } catch {}
    });
    this.physics.add.overlap(this.player, this.notesGroup, (_, note) => {
      note?.disableBody?.(true, true);
      this.notesCollected += 1;
      this.addScore(5);
      this.bumpStreak?.();
    });
    this.physics.add.overlap(this.player, this.lyricGroup, (_, token) => this.onLyricPickup(token));

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
    // Keep webcam stream across scene restarts; explicit toggle handles cleanup.

    // Cache canvas metrics now and on resize
    this.refreshViewMetrics();
    this.scale.on('resize', () => this.refreshViewMetrics());

    // Countdown UI (hidden initially)
    this.createCountdownUI();

    // Load lyrics if provided
    this.loadLyricsIfAny?.();

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
    const text = `Try to beat my score in this Christian music Flappy clone! ${scoreMsg}`;

    // Try to share a snapshot if supported
    const firstSnap = (this._snapshots && this._snapshots[0]) ? this._snapshots[0] : null;
    const tryShareWithImage = async () => {
      try {
        if (!firstSnap) return false;
        const res = await fetch(firstSnap); const blob = await res.blob();
        const file = new File([blob], 'snapshot.jpg', { type: 'image/jpeg' });
        const payload = { title: SHARE_TITLE, text, files: [file] };
        if (navigator.canShare && navigator.canShare(payload)) {
          await navigator.share(payload);
          return true;
        }
      } catch {}
      return false;
    };

    const fallbackShare = () => {
      const data = { title: SHARE_TITLE, text, url: SHARE_URL };
      if (navigator.share) { navigator.share(data).catch(() => {}); }
      else {
        navigator.clipboard?.writeText(`${data.text} ${data.url}`).catch(() => {});
        if (firstSnap) window.open(firstSnap, '_blank'); else this.openExternal(IG_PROFILE_URL);
      }
    };

    tryShareWithImage().then((ok) => { if (!ok) fallbackShare(); });
  }

  // ---------- Progress UI ----------
createProgressUI() {
  this.progressBg   = this.add.graphics().setDepth(2500).setScrollFactor(0);
  this.progressFillRect = this.add.rectangle(8, 40, 0, PROGRESS_HEIGHT, 0x22cc88, 0.9)
    .setOrigin(0, 0)
    .setDepth(2501)
    .setScrollFactor(0);

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
  if (!this.progressFillRect) return;

  const dur = totalOverride ?? (this._tl?.duration || 0);
  const t   = Phaser.Math.Clamp(nowSec ?? getTime(), 0, dur);
  const pct = dur > 0 ? t / dur : 0;

  const x = 8, y = 40, w = this.scale.width - 16;
  const fillW = Math.max(0, Math.min(w * pct, w));
  if (Math.abs(fillW - this._lastProgressDrawW) >= 1) {
    this._lastProgressDrawW = fillW;
    this.progressFillRect.x = x;
    this.progressFillRect.y = y;
    // Resize rectangle without redrawing graphics
    this.progressFillRect.setSize(fillW, PROGRESS_HEIGHT);
    this.progressFillRect.setDisplaySize(fillW, PROGRESS_HEIGHT);
  }

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

    // countdown update
    this.updateCountdownUI?.();

    // progress bar + countdown (throttled)
    if (this.progressActive) {
      const nowMs = this.time?.now || performance.now();
      if (nowMs - this._lastProgressUpdate >= this._progressUpdateMs) {
        this._lastProgressUpdate = nowMs;
        this.updateProgressUI();   // uses current audio time
      }
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

    // --- DOM camera bubble follow + visibility (throttled, cached metrics) ---
    if (this.domVideoEl && this.player) {
      const rect = this._viewRect;
      const shouldShow = (this.state !== GAME_OVER_STATE) && this.cameraEnabled;
      this.domVideoEl.style.display = shouldShow ? 'block' : 'none';
      if (shouldShow) {
        const nowMs = this.time?.now || performance.now();
        if (nowMs - this._lastDomUpdate >= this._domUpdateMs) {
          this._lastDomUpdate = nowMs;
          const localX = Phaser.Math.Clamp(this.player.x * rect.sx, 0, rect.width);
          const localY = Phaser.Math.Clamp(this.player.y * rect.sy, 0, rect.height);
          const screenX = rect.left + localX;
          const screenY = rect.top + localY;
          this.domVideoEl.style.transform = `translate3d(${screenX}px, ${screenY}px, 0) translate(-50%, -50%)`;
        }
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
    // Reset lyric active token for new ready state
    this._lyricActive = null;
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

    // Smooth out initial spawns for the first half-second
    try {
      const now = getTime();
      this._nextCoinAt = Math.max(this._nextCoinAt, now + 0.4);
    } catch {}

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
    // Keep stream alive for next run; just hide UI. Pointer events are already none.
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
    this.lyricGroup?.clear(true, true);
    this._nextNoteIdx = 0;
    this._nextCoinAt = 0;
    this.notesCollected = 0;
    this._songFinishedAwarded = false;
    this.setSocialButtonsVisible(false);
    this.progressActive = false;
this.updateProgressUI(0, this._tl?.duration || 0); // show full time remaining again


    // optional: turn off camera on restart
    // this.disableWebcamDom();

    // reset lyrics scheduling
    if (this._lyrics) this._lyrics.nextIdx = 0;
    this._lyricActive = null;
    if (this._lyricSpawned) this._lyricSpawned.clear();

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
    if (this.lyricGroup) this.lyricGroup.getChildren().forEach((l) => { l.x -= GAME_SPEED; });
  }

  cleanupCollectibles() {
    this.coinsGroup.getChildren().forEach((c) => { if (c.getBounds().right < 0) c.destroy(); });
    this.notesGroup.getChildren().forEach((n) => { if (n.getBounds().right < 0) n.destroy(); });
    if (this.lyricGroup) this.lyricGroup.getChildren().forEach((l) => { if (l.getBounds().right < 0) l.destroy(); });
  }

  createBackground() {
    const { width, height } = this.scale;
    this.bgImage = this.physics.add.staticImage(width * 0.5, height * 0.5, BACKGROUND).setScale(1.7).refreshBody();
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

    // coins (or lyrics replacement)
    const windows = this._tl.chorusWindows || [];
    const inChorus = windows.some((w) => now >= w.start && now <= w.end);
    const chorusWin = inChorus ? windows.find((w) => now >= w.start && now <= w.end) : null;
    const rate = inChorus ? (chorusWin?.coinRate || 3.0) : (this._tl.ambientCoins?.rate || 0.7);

    const hasLyrics = (this._lyrics?.words?.length || 0) > 0;
    if (hasLyrics) {
      // Multi-token scheduler with travel-time alignment (keeps order, allows overlap)
      const words = this._lyrics.words;
      let i = this._lyrics.nextIdx;
      const fps = Math.max(30, Math.min(120, Math.round(this.game?.loop?.actualFps || 60)));
      const v = GAME_SPEED * fps; // px per second (approximate)
      const spawnX = this.scale.width + 40;
      const targetX = this.scale.width - 80; // where it first appears clearly
      const travelSec = Math.max(0, (spawnX - targetX) / Math.max(1, v));

      while (i < words.length && (words[i].t0 - travelSec + LYRIC_SPAWN_LAG) <= now + LOOKAHEAD) {
        const w = words[i];
        const skey = `${w.text}|${Math.round(w.t0 * 1000)}`;
        if (!this._lyricSpawned?.has(skey)) {
          this.spawnLyricToken(w);
          this._lyricSpawned?.add(skey);
        }
        i += 1;
      }
      this._lyrics.nextIdx = i;
    } else {
      if (now >= this._nextCoinAt) {
        const range = this._tl.ambientCoins?.yRange || [140, 360];
        this.spawnCoinCluster(!!inChorus, range);
        const baseGap = Math.max(this._tl.ambientCoins?.minGap || 1.0, 1.0 / rate);
        this._nextCoinAt = now + baseGap;
      }
    }

    // Visuals when entering/exiting chorus
    if (this.setChorusVisuals) this.setChorusVisuals(inChorus, chorusWin?.multiplier || 1);

    // Countdown: schedule when approaching next chorus
    if (!inChorus && this._countdownTarget == null) {
      const upNext = windows.find((w) => w.start > now && (w.start - now) <= CHORUS_COUNTDOWN_LEAD);
      if (upNext) this._countdownTarget = upNext.start;
    }

    // Entering chorus: schedule snapshots (3 random times)
    if (inChorus && !this._wasInChorus && chorusWin) {
      const s = chorusWin.start, e = chorusWin.end;
      const dur = Math.max(0, e - s);
      const pad = Math.min(0.5, dur / 6);
      const slots = [];
      for (let i = 0; i < SNAPSHOT_COUNT_PER_WINDOW; i += 1) {
        const r = Math.random();
        const t = s + pad + r * Math.max(0, (e - pad) - (s + pad));
        slots.push(t);
      }
      slots.sort((a,b)=>a-b);
      this._snapshotSchedule = slots;
    }

    // Fire scheduled snapshots when times hit
    if (this._snapshotSchedule && this._snapshotSchedule.length > 0) {
      while (this._snapshotSchedule.length > 0 && now >= this._snapshotSchedule[0]) {
        this._snapshotSchedule.shift();
        this.captureSnapshot();
        this.addScore(SNAPSHOT_POINTS_PER);
        this.showPopupText(`+${SNAPSHOT_POINTS_PER.toLocaleString()}`, '#82c6ff');
      }
    }

    this._wasInChorus = inChorus;
  }

  // ---------- Lyrics support ----------
  loadLyricsIfAny() {
    try {
      const lyr = this.cache.json.get('lyrics');
      const words = lyr?.mapped?.words || [];
      const seen = new Set();
      const norm = [];
      for (const w of words) {
        const text = String(w.text || '').trim();
        const t0 = Number(w.t0 || 0);
        const t1 = Number(w.t1 || (t0 + 1));
        if (!text) continue;
        const key = `${text}|${Math.round(t0 * 1000)}`;
        if (seen.has(key)) continue; // drop duplicates that share the same start
        seen.add(key);
        norm.push({ text, t0, t1, _spawned: false });
      }
      norm.sort((a,b)=>a.t0-b.t0);
      this._lyrics = { words: norm, nextIdx: 0 };
    } catch {}
  }

  ensureLyricTexture(text) {
    const key = 'lyric_' + text;
    if (this._lyricTex?.has(text)) return key;
    // Render text to a RenderTexture and save as a texture key
    const t = this.make.text({ x: 0, y: 0, text, add: false, style: { fontFamily: 'Teko', fontSize: '28px', color: '#ffd700', stroke: '#2a2000', strokeThickness: 6 } });
    t.setPadding(6, 2, 6, 2);
    t.setOrigin(0, 0); // top-left to avoid cropping when drawing to RT
    t.updateText();
    const w = Math.max(1, Math.ceil(t.width + 2));
    const h = Math.max(1, Math.ceil(t.height + 2));
    const rt = this.make.renderTexture({ x: 0, y: 0, width: w, height: h, add: false });
    // Draw at top-left so the whole glyphs fit in the texture
    rt.draw(t, 0, 0);
    rt.saveTexture(key);
    rt.destroy();
    t.destroy();
    this._lyricTex?.set(text, key);
    return key;
  }

  spawnLyricToken(word) {
    const key = this.ensureLyricTexture(word.text || '');
    const x = this.scale.width + 40;
    const safeTop = 120, safeBot = this.scale.height - 180;
    const y = Phaser.Math.Between(safeTop, Math.max(safeTop, safeBot));
    // Create a fresh sprite to avoid pooling nulls
    const s = this.lyricGroup.create(x, y, key);
    if (!s) return null;
    s.setActive(true).setVisible(true);
    if (s.body) { s.body.allowGravity = false; }
    s._wordMeta = word;

    // Shimmer effect
    s.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: s, alpha: { from: 0.9, to: 1 }, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // Gold dust trail
    if (this._lyricPM) {
      const emitter = this._lyricPM.createEmitter({
        quantity: 1,
        frequency: 110,
        lifespan: 320,
        speedX: { min: -10, max: -30 },
        speedY: { min: -10, max: 10 },
        scale: { start: 0.35, end: 0.05 },
        alpha: { start: 0.8, end: 0 },
        tint: [0xffd700, 0xfff3b0],
        blendMode: 'ADD',
        follow: s,
      });
      s._le = emitter;
    }
    return s;
  }

  onLyricPickup(token) {
    if (!token) return;
    token?.disableBody?.(true, true);
    const now = getTime();
    const chorus = this._tl?.chorusWindows?.find((w) => now >= w.start && now <= w.end);
    const mult = chorus ? (chorus.multiplier || 2) : 1;

    // Lyric streak multiplier
    this._lyricStreak += 1;
    if (this._lyricStreakTimer) this._lyricStreakTimer.remove(false);
    this._lyricStreakTimer = this.time.delayedCall(LYRIC_STREAK_WINDOW_MS, () => { this._lyricStreak = 0; });
    const points = (LYRIC_BASE_POINTS + Math.max(0, this._lyricStreak - 1) * 2) * mult;
    this.addScore(points);
    this.showPopupText(`+${points} (x${this._lyricStreak})`, '#ffd700');
    try { navigator?.vibrate?.(15); } catch {}

    // Advance pointer if this was the active token
    if (this._lyricActive === token) {
      this._lyricActive = null;
      if (this._lyrics) this._lyrics.nextIdx = Math.min(this._lyrics.nextIdx + 1, (this._lyrics.words?.length || 0));
    }

    // Confetti burst and clean up emitter
    if (this._particleEmitter) this._particleEmitter.explode(16, token.x, token.y);
    try { token._le?.stop(); this.time.delayedCall(300, () => token._le?.remove()); } catch {}
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

      // Prepare Phaser webcam video for chorus background
      this.ensurePhaserWebcamVideo?.();
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

    // Hide Phaser video if present
    if (this.webcamVideo) {
      try { this.webcamVideo.stop(); } catch {}
      this.webcamVideo.setVisible(false);
    }
  }

  // ------------- Countdown UI -------------
  createCountdownUI() {
    const cx = this.scale.width * 0.5;
    const cy = this.scale.height * 0.2;
    this._countdownLabel = this.add.text(cx, cy - 30, 'Get Ready To Rock', {
      fontFamily: 'Teko', fontSize: '36px', color: '#ffd700', stroke: '#000', strokeThickness: 8,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2800).setVisible(false);
    this._countdownNumber = this.add.text(cx, cy + 10, '', {
      fontFamily: 'Teko', fontSize: '72px', color: '#ffffff', stroke: '#000', strokeThickness: 10,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2801).setVisible(false);
    this.scale.on('resize', () => {
      const cxx = this.scale.width * 0.5;
      const cyy = this.scale.height * 0.2;
      if (this._countdownLabel) { this._countdownLabel.setPosition(cxx, cyy - 30); }
      if (this._countdownNumber) { this._countdownNumber.setPosition(cxx, cyy + 10); }
    });
  }

  updateCountdownUI() {
    if (this._countdownTarget == null || this.state !== PLAYING_STATE) return;
    const now = getTime();
    const rem = Math.ceil(this._countdownTarget - now);
    if (rem <= 0) {
      // flash GO
      if (this._countdownNumber && this._countdownLabel) {
        this._countdownLabel.setVisible(true);
        this._countdownNumber.setVisible(true).setText('GO!');
        this.tweens.add({ targets: this._countdownNumber, scaleX: { from: 1.1, to: 1 }, scaleY: { from: 1.1, to: 1 }, duration: 220, yoyo: true });
        this.time.delayedCall(450, () => {
          this._countdownLabel.setVisible(false);
          this._countdownNumber.setVisible(false).setText('');
        });
      }
      this._countdownTarget = null;
      return;
    }
    if (rem <= CHORUS_COUNTDOWN_LEAD) {
      this._countdownLabel?.setVisible(true);
      this._countdownNumber?.setVisible(true).setText(String(rem));
    }
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

  // ------- Chorus webcam background + snapshots -------
  ensureBackgroundWebcamVideo() {
    if (this.domVideoBG || !this.webcamStream) return;
    const v = document.createElement('video');
    v.playsInline = true; v.muted = true; v.autoplay = true; v.srcObject = this.webcamStream;
    v.style.position = 'fixed';
    v.style.left = '0px'; v.style.top = '0px';
    v.style.objectFit = 'cover';
    v.style.pointerEvents = 'none';
    v.style.zIndex = '1'; // canvas above (we set canvas z-index higher when active)
    v.style.display = 'none';
    // initial size/pos
    const r = this._viewRect;
    v.style.width = `${r.width}px`;
    v.style.height = `${r.height}px`;
    v.style.transform = `translate3d(${r.left}px, ${r.top}px, 0)`;
    document.body.appendChild(v);
    try { v.play(); } catch {}
    this.domVideoBG = v;
  }

  enterChorusBackground() {
    if (!this.cameraEnabled) return;
    // Try to ensure Phaser video is ready
    const phaserReady = this.ensurePhaserWebcamVideo();

    if (phaserReady) {
      // Hide sprite background only after we have a real video frame
      if (this.bgImage) this.bgImage.setVisible(false);
      // raise canvas above anything behind it
      const c = this.game?.canvas;
      if (c) { this._prevCanvasZ = c.style.zIndex; c.style.position = 'relative'; c.style.zIndex = '2'; }
      this._chorusBGActive = true;
      this.startSnapshotTimer();
      return;
    }

    // If Phaser video isn’t ready yet, keep background visible and keep trying.
    // Kick off a lightweight retry loop while chorus is active.
    if (!this._chorusRetryEvt) {
      this._chorusRetryEvt = this.time.addEvent({
        delay: 150,
        loop: true,
        callback: () => {
          // Stop retrying if chorus ended
          if (!this._lastChorusActive) { this._chorusRetryEvt.remove(false); this._chorusRetryEvt = null; return; }
          const ok = this.ensurePhaserWebcamVideo();
          if (ok) {
            if (this.bgImage) this.bgImage.setVisible(false);
            const c = this.game?.canvas; if (c) { this._prevCanvasZ = c.style.zIndex; c.style.position = 'relative'; c.style.zIndex = '2'; }
            this._chorusBGActive = true;
            this.startSnapshotTimer();
            this._chorusRetryEvt.remove(false); this._chorusRetryEvt = null;
          }
        }
      });
    }
  }

  exitChorusBackground() {
    if (!this._chorusBGActive) return;
    this._chorusBGActive = false;
    if (this._chorusRetryEvt) { this._chorusRetryEvt.remove(false); this._chorusRetryEvt = null; }
    if (this.domVideoBG) this.domVideoBG.style.display = 'none';
    if (this.webcamVideo) this.webcamVideo.setVisible(false);
    if (this.bgImage) this.bgImage.setVisible(true);
    const c = this.game?.canvas; if (c) { c.style.zIndex = this._prevCanvasZ || ''; }
    this.stopSnapshotTimer(true);
  }

  startSnapshotTimer() {
    if (!this.webcamStream) return;
    if (this._snapTimer) return;
    this._snapshots = [];
    this._snapTimer = setInterval(() => this.captureSnapshot(), SNAPSHOT_INTERVAL_MS);
  }

  stopSnapshotTimer(award) {
    if (this._snapTimer) { clearInterval(this._snapTimer); this._snapTimer = null; }
    if (award) {
      const gained = (this._snapshots?.length || 0) * SNAPSHOT_POINTS_PER;
      if (gained > 0) {
        this.addScore(gained);
        this.showPopupText(`Snapshots +${gained}`, '#82c6ff');
      }
    }
  }

  captureSnapshot() {
    try {
      const src = (this.webcamVideo && this.webcamVideo.video) || this.domVideoBG || this.domVideoEl;
      if (!src) return;
      if ((this._snapshots?.length || 0) >= SNAPSHOT_MAX_PER_WINDOW) return;
      const vw = src.videoWidth || 320, vh = src.videoHeight || 240;
      if (!vw || !vh) return;
      const outW = 320, outH = 180; // lightweight
      const cx = document.createElement('canvas');
      cx.width = outW; cx.height = outH;
      const ctx = cx.getContext('2d');
      // cover fit crop
      const s = Math.max(outW / vw, outH / vh);
      const rw = vw * s, rh = vh * s;
      const sx = (outW - rw) / 2, sy = (outH - rh) / 2;
      ctx.drawImage(src, sx, sy, rw, rh);
      const url = cx.toDataURL('image/jpeg', 0.85);
      this._snapshots.push(url);
    } catch {}
  }

  // Create Phaser Video object from webcam stream and size to canvas.
  // Returns true if created or already available.
  ensurePhaserWebcamVideo() {
    try {
      if (!this.webcamStream) return false;
      // If an old video object exists from a previous scene, discard it
      if (this.webcamVideo && this.webcamVideo.scene !== this) {
        try { this.webcamVideo.destroy(); } catch {}
        this.webcamVideo = null;
      }
      if (!this.webcamVideo) {
        const v = this.add.video(0, 0);
        v.setOrigin(0, 0).setScrollFactor(0).setDepth(-50).setVisible(false);
        // Prefer Phaser's stream loader (sets internal texture)
        let loadedViaPhaser = false;
        try { if (v.loadMediaStream) { v.loadMediaStream(this.webcamStream, true); loadedViaPhaser = true; } } catch {}
        const el = v.video;
        if (el) {
          el.muted = true; el.autoplay = true; el.playsInline = true;
          if (!loadedViaPhaser) el.srcObject = this.webcamStream;
          try { const p = el.play(); if (p && p.catch) p.catch(() => {}); } catch {}
          const readyHandler = () => {
            try {
              v.setPosition(0, 0);
              v.setDisplaySize(this.scale.width, this.scale.height);
              v.setVisible(true);
            } catch {}
          };
          el.addEventListener('loadeddata', readyHandler, { once: true });
          el.addEventListener('playing', readyHandler, { once: true });
        }
        this.webcamVideo = v;
        // keep sized on resize
        this.scale.on('resize', () => {
          if (!this.webcamVideo) return;
          this.webcamVideo.setPosition(0, 0);
          try { this.webcamVideo.setDisplaySize(this.scale.width, this.scale.height); } catch {}
        });
      } else {
        try {
          const elExist = this.webcamVideo.video;
          if (elExist && (!elExist.srcObject || elExist.srcObject !== this.webcamStream)) {
            elExist.srcObject = this.webcamStream;
          }
          const p = elExist?.play(); if (p && p.catch) p.catch(() => {});
        } catch {}
      }
      // Ready when element has data and dimensions
      const el2 = this.webcamVideo?.video;
      const ready = !!el2 && (el2.readyState || 0) >= 2 && el2.videoWidth > 0;
      this.webcamVideo.setVisible(ready);
      if (ready) {
        try { this.webcamVideo.setDisplaySize(this.scale.width, this.scale.height); } catch {}
      }
      return ready;
    } catch (e) {
      console.warn('Phaser webcam video unavailable:', e);
      return false;
    }
  }

  refreshViewMetrics() {
    try {
      const canvas = this.game?.canvas;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      this._viewRect.left = rect.left;
      this._viewRect.top = rect.top;
      this._viewRect.width = rect.width;
      this._viewRect.height = rect.height;
      const sx = rect.width / this.scale.gameSize.width;
      const sy = rect.height / this.scale.gameSize.height;
      this._viewRect.sx = sx;
      this._viewRect.sy = sy;

      // Keep chorus background video aligned if present
      if (this.domVideoBG) {
        this.domVideoBG.style.width = `${rect.width}px`;
        this.domVideoBG.style.height = `${rect.height}px`;
        this.domVideoBG.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
      }
    } catch {}
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

    // Particles for lyric shimmer
    this._lyricPM = this.add.particles('dot');
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

      // Enable webcam as background during chorus (keep bubble visible)
      this.enterChorusBackground();
    } else {
      if (this._chorusPulseTween) { this._chorusPulseTween.stop(); this._chorusPulseTween = null; }
      [...allTop, ...allBot].forEach(p => p && p.clearTint() && (p.scaleX = 1) && (p.scaleY = 1));

      // Restore normal background and finalize snapshots
      this.exitChorusBackground();
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
