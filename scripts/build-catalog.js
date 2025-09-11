#!/usr/bin/env node
// Build a content catalog from content/albums/*/* folders.
// Each song folder can contain: track audio (mp3/wav/ogg/m4a), lyrics.json, optional meta.json, optional art.(jpg|png)
// Output: content/catalog.json with albums and songs, plus preserves content/index.json current pointer if present.

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, 'content');
const ALBUMS_DIR = path.join(CONTENT_DIR, 'albums');
const INDEX_PATH = path.join(CONTENT_DIR, 'index.json');
const CATALOG_PATH = path.join(CONTENT_DIR, 'catalog.json');

function safeReadJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch { return null; }
}

function findFirstFile(dir, exts) {
  if (!fs.existsSync(dir)) return null;
  const entries = fs.readdirSync(dir);
  for (const name of entries) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isFile()) {
      const ext = path.extname(name).toLowerCase();
      if (exts.includes(ext)) return name;
    }
  }
  return null;
}

function build() {
  const albums = {};
  const songs = {};
  if (!fs.existsSync(ALBUMS_DIR)) {
    // No albums dir; still emit empty catalog to avoid 404s
    fs.mkdirSync(ALBUMS_DIR, { recursive: true });
  }

  const albumSlugs = fs.readdirSync(ALBUMS_DIR).filter(d => fs.statSync(path.join(ALBUMS_DIR, d)).isDirectory());
  for (const albumSlug of albumSlugs) {
    const albumPath = path.join(ALBUMS_DIR, albumSlug);
    const albumMeta = safeReadJSON(path.join(albumPath, 'album.json')) || {};
    // Album cover: prefer albumMeta.cover, else first image file
    let cover = null;
    if (albumMeta.cover && typeof albumMeta.cover === 'string') {
      if (/^https?:\/\//i.test(albumMeta.cover) || albumMeta.cover.startsWith('/')) {
        cover = albumMeta.cover;
      } else if (fs.existsSync(path.join(albumPath, albumMeta.cover))) {
        cover = `/content/albums/${albumSlug}/${albumMeta.cover}`;
      }
    }
    if (!cover) {
      const c = findFirstFile(albumPath, ['.jpg', '.png', '.webp']);
      cover = c ? `/content/albums/${albumSlug}/${c}` : null;
    }
    const songSlugs = fs.readdirSync(albumPath).filter(d => fs.statSync(path.join(albumPath, d)).isDirectory());
    const songIds = [];
    for (const songSlug of songSlugs) {
      const songPath = path.join(albumPath, songSlug);
      const meta = safeReadJSON(path.join(songPath, 'meta.json')) || {};
      // Prefer a file literally named lyrics.json; else pick the first JSON that is not meta.json
      let lyricsName = null;
      if (fs.existsSync(path.join(songPath, 'lyrics.json'))) {
        lyricsName = 'lyrics.json';
      } else {
        const all = fs.readdirSync(songPath).filter(n => n.toLowerCase().endsWith('.json') && n.toLowerCase() !== 'meta.json');
        lyricsName = all.length ? all[0] : null;
      }
      let audioName = findFirstFile(songPath, ['.mp3', '.wav', '.ogg', '.m4a', '.webm']);
      // If lyrics.json has meta.audioName, prefer that
      const lyricsJson = lyricsName ? safeReadJSON(path.join(songPath, lyricsName)) : null;
      if (meta.audio && typeof meta.audio === 'string') {
        // Allow absolute/remote URLs via meta.audio
        audioName = meta.audio;
      } else if (lyricsJson && lyricsJson.meta && lyricsJson.meta.audioName && fs.existsSync(path.join(songPath, lyricsJson.meta.audioName))) {
        audioName = lyricsJson.meta.audioName;
      }
      if (!lyricsName || !audioName) continue; // require both
      const artName = findFirstFile(songPath, ['.jpg', '.png', '.webp']);
      const vidName = findFirstFile(songPath, ['.mp4', '.webm', '.ogv']);
      const id = `${albumSlug}/${songSlug}`;
      songIds.push(id);
      const audioUrl = (/^https?:\/\//i.test(audioName) || audioName.startsWith('/'))
        ? audioName
        : `/content/albums/${albumSlug}/${songSlug}/${audioName}`;
      songs[id] = {
        id,
        album: albumSlug,
        slug: songSlug,
        title: meta.title || (lyricsJson?.meta?.title) || songSlug,
        audio: audioUrl,
        lyricsUrl: `/content/albums/${albumSlug}/${songSlug}/${lyricsName}`,
        art: artName ? `/content/albums/${albumSlug}/${songSlug}/${artName}` : null,
        bgImage: artName ? `/content/albums/${albumSlug}/${songSlug}/${artName}` : null,
        bgVideo: vidName ? `/content/albums/${albumSlug}/${songSlug}/${vidName}` : (meta.bgVideo || null),
        bpm: meta.bpm || null,
        offsetMs: meta.offsetMs || 0,
        verseRef: meta.verseRef || null
      };
    }
    albums[albumSlug] = {
      slug: albumSlug,
      title: albumMeta.title || albumSlug,
      cover,
      songs: songIds
    };
  }

  const manifest = safeReadJSON(INDEX_PATH) || {};
  const current = manifest.current && songs[manifest.current] ? manifest.current : (Object.keys(songs)[0] || null);
  const out = {
    version: 1,
    updatedAt: new Date().toISOString(),
    current,
    albums,
    songs
  };
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(out, null, 2));
  console.log(`[catalog] wrote ${CATALOG_PATH} with ${Object.keys(songs).length} songs in ${Object.keys(albums).length} albums`);
}

try { build(); } catch (e) { console.error('[catalog] build failed:', e.message); process.exit(0); }
