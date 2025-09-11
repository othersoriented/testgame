import Phaser from 'phaser';
import Base from '../assets/sprites/base.png';
import Background from '../assets/sprites/background.png';
import Bird from '../assets/sprites/bird.png';
import Pipe from '../assets/sprites/pipe.png';
import Message from '../assets/sprites/message.png';
import GameOver from '../assets/sprites/gameover.png';
import Zero from '../assets/sprites/0.png';
import One from '../assets/sprites/1.png';
import Two from '../assets/sprites/2.png';
import Three from '../assets/sprites/3.png';
import Four from '../assets/sprites/4.png';
import Five from '../assets/sprites/5.png';
import Six from '../assets/sprites/6.png';
import Seven from '../assets/sprites/7.png';
import Eight from '../assets/sprites/8.png';
import Nine from '../assets/sprites/9.png';
import StartButton from '../assets/sprites/start.png';
import PointWav from '../assets/audio/point.wav';
import PointOgg from '../assets/audio/point.ogg';
import FlapWav from '../assets/audio/wing.wav';
import FlapOgg from '../assets/audio/wing.ogg';
import SwooshWav from '../assets/audio/swoosh.wav';
import SwooshOgg from '../assets/audio/swoosh.ogg';
import HitSoundWav from '../assets/audio/hit.wav';
import HitSoundOgg from '../assets/audio/hit.ogg';
import DieSoundWav from '../assets/audio/die.wav';
import DieSoundOgg from '../assets/audio/die.ogg';

// ✅ import timeline JSON and the MP3 so Webpack emits a real URL
import timelineData from '../assets/data/song-timeline.json';
import lyricsData from '../assets/data/lyrics.json';
import trackUrl from '../assets/audio/track.mp3';
import { loadTrack, getDuration } from '../audio.js';

import {
  PRELOAD_SCENE_KEY,
  GROUND,
  BACKGROUND,
  BIRD,
  PIPE,
  GAME_OVER_MESSAGE,
  READY_MESSAGE,
  GAME_SCENE_KEY,
  POINT_SOUND,
  FLAP_SOUND,
  SWOOSH_SOUND,
  HIT_SOUND,
  DIE_SOUND,
  START_BUTTON,
} from './shared.js';

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super(PRELOAD_SCENE_KEY);
  }

  preload() {
    const { width, height } = this.scale;
    const loadingText = this.add
      .text(width * 0.5, height * 0.5, 'Loading...', { fontSize: '25px' })
      .setOrigin(0.5);

    this.load.image(GROUND, Base);
    this.load.image(BACKGROUND, Background);
    this.load.image(PIPE, Pipe);
    this.load.image(READY_MESSAGE, Message);
    this.load.image(GAME_OVER_MESSAGE, GameOver);
    this.load.image(START_BUTTON, StartButton);
    this.load.spritesheet(BIRD, Bird, { frameWidth: 34, frameHeight: 24 });
    this.load.image('0', Zero);
    this.load.image('1', One);
    this.load.image('2', Two);
    this.load.image('3', Three);
    this.load.image('4', Four);
    this.load.image('5', Five);
    this.load.image('6', Six);
    this.load.image('7', Seven);
    this.load.image('8', Eight);
    this.load.image('9', Nine);
    this.load.audio(POINT_SOUND, [PointOgg, PointWav]);
    this.load.audio(FLAP_SOUND, [FlapOgg, FlapWav]);
    this.load.audio(SWOOSH_SOUND, [SwooshOgg, SwooshWav]);
    this.load.audio(HIT_SOUND, [HitSoundOgg, HitSoundWav]);
    this.load.audio(DIE_SOUND, [DieSoundOgg, DieSoundWav]);
    this.load.webfont(
      'Teko',
      'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Teko:wght@600;700&display=swap'
    );

    // Try to load shared content manifest (non-breaking fallback if missing)
    this.load.json('contentManifest', '/content/index.json');

    // Lyrics JSON is bundled via import (lyricsData) and added to cache in create();
    // Avoid runtime XHR to /assets/data/lyrics.json to prevent 404s in dev.

    this.load.on('progress', (progress) => {
      loadingText.setText(`Loading... ${Math.round(progress * 100)}%`);
    });
  }

  async create() {
    // ✅ Put the imported JSON into the Phaser cache with the *emitted* MP3 URL
    if (timelineData) {
      const tl = { ...timelineData, audio: trackUrl };
      await loadTrack(trackUrl);
      const audioDur = Math.round(getDuration()) || 0;
      if (!tl.duration) tl.duration = audioDur;
      this.cache.json.add('timeline', tl);
      // Debug (optional): console.log('Timeline audio URL:', tl.audio);
    }

    // Put lyrics JSON into cache if present via import
    if (lyricsData) {
      this.cache.json.add('lyrics', lyricsData);
    }

    // If a shared content manifest or catalog is present, override audio/lyrics accordingly
    try {
      const manifest = this.cache.json.get('contentManifest');
      const params = new URLSearchParams(window.location.search);
      let songKey = params.get('song') || manifest?.current || null;
      let song = songKey && manifest?.songs ? manifest.songs[songKey] : null;
      if (!song) {
        try {
          const res = await fetch('/content/catalog.json', { cache: 'no-store' });
          if (res.ok) {
            const catalog = await res.json();
            if (!songKey) songKey = catalog.current || null;
            song = songKey ? catalog.songs?.[songKey] : null;
          }
        } catch {}
      }
      if (song) {
        const tl = this.cache.json.get('timeline') || { ...timelineData };
        const audioUrl = song.audio || tl.audio || trackUrl;
        const title    = song.title || tl.title || '';
        tl.audio = audioUrl; tl.title = title;
        try { await loadTrack(audioUrl); } catch {}
        const audioDur = Math.round(getDuration()) || 0;
        if (!tl.duration) tl.duration = audioDur;
        if (this.cache.json.exists('timeline')) this.cache.json.remove('timeline');
        this.cache.json.add('timeline', tl);

        if (song.lyricsUrl) {
          const res = await fetch(song.lyricsUrl, { cache: 'no-store' });
          if (res.ok) {
            const json = await res.json();
            if (this.cache.json.exists('lyrics')) this.cache.json.remove('lyrics');
            this.cache.json.add('lyrics', json);
          }
        }

        // Optional: per-song background image override (for Flappy)
        const bgImg = song.bgImage || song.art || null;
        if (bgImg) {
          try {
            this.load.image('BG_OVERRIDE', bgImg);
            await new Promise((resolve) => {
              this.load.once(Phaser.Loader.Events.COMPLETE, resolve);
              this.load.start();
            });
            this.registry.set('bg_image_override', 'BG_OVERRIDE');
          } catch {}
        }
      }
    } catch {}

    // Minimal generated textures for collectibles
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.clear(); g.fillStyle(0xffff00, 1); g.fillCircle(8, 8, 8); g.generateTexture('coin', 16, 16);
    g.clear(); g.fillStyle(0x66ccff, 1); g.fillRect(0, 0, 16, 16); g.generateTexture('note', 16, 16);
    g.destroy();

    this.scene.start(GAME_SCENE_KEY);
  }
}
