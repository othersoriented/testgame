// Landing page builder for dynamic Linktree-style cards

async function fetchJSON(url) {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error('fetch failed');
    return await r.json();
  } catch (_) {
    return null;
  }
}

function emitAnalytics(kind, detail) {
  try {
    // GA4 if present
    if (window.gtag) {
      window.gtag('event', kind, detail || {});
    }
  } catch {}
}

function iconSVG(name) {
  // minimal inline SVGs for key platforms
  const fill = 'currentColor';
  switch (name) {
    case 'instagram':
      return `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="${fill}" d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm5 3.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Zm0 2a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm5.75-.25a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z"/></svg>`;
    case 'spotify':
      return `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="${fill}" d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2Zm4.427 14.76a.87.87 0 0 1-1.2.29c-3.287-2.007-7.43-2.46-12.176-1.346a.875.875 0 0 1-.412-1.7c5.183-1.257 9.766-.741 13.397 1.45.403.246.53.77.29 1.204Zm1.68-3.06a1 1 0 0 1-1.374.334c-3.761-2.297-9.49-2.964-13.933-1.626A1 1 0 1 1 2.3 10.8c4.95-1.485 11.278-.74 15.553 1.89a1 1 0 0 1 .254 1.01Zm.15-3.36a1.12 1.12 0 0 1-1.538.374c-4.304-2.62-10.854-2.86-14.73-1.595a1.124 1.124 0 1 1-.676-2.151c4.45-1.397 11.712-1.115 16.57 1.79.53.32.7 1.01.37 1.58Z"/></svg>`;
    case 'apple':
      return `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="${fill}" d="M16.365 12.1c.012 2.56 2.243 3.41 2.27 3.424-.02.07-.356 1.21-1.175 2.4-.71 1.04-1.45 2.07-2.61 2.09-1.14.02-1.5-.67-2.8-.67-1.31 0-1.7.64-2.78.69-1.12.04-1.97-1.12-2.69-2.15-1.47-2.15-2.59-6.07-1.08-8.69.75-1.3 2.09-2.12 3.55-2.14 1.11-.02 2.15.74 2.8.74.65 0 1.93-.91 3.26-.78.55.02 2.09.22 3.08 1.65-.08.05-1.83 1.07-1.84 3.35Zm-2-6.56c.59-.71.98-1.7.88-2.69-.85.03-1.88.57-2.49 1.28-.55.63-1.03 1.65-.9 2.62.95.08 1.93-.5 2.51-1.21Z"/></svg>`;
    case 'youtubemusic':
      return `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="${fill}" d="M12 2a10 10 0 1 0 .002 20.002A10 10 0 0 0 12 2Zm-3 6.5 7 3.5-7 3.5V8.5Z"/></svg>`;
    case 'amazon':
      return `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden><path fill="${fill}" d="M3 19s4 2 9 2 9-2 9-2c.6-.3.6-1.1 0-1.4 0 0-4 1.4-9 1.4S3 17.6 3 17.6c-.6.3-.6 1.1 0 1.4ZM7 7h2v8H7V7Zm4 0h2v8h-2V7Zm4 0h2v8h-2V7Z"/></svg>`;
    case 'pandora':
      return `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden><path fill="${fill}" d="M6 3h8a7 7 0 0 1 0 14H9v4H6V3Zm3 11h5a4 4 0 0 0 0-8H9v8Z"/></svg>`;
    case 'youtube':
      return `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden><path fill="${fill}" d="M23 12s0-3.6-.46-5.3c-.25-.95-.99-1.7-1.93-1.93C18.9 4.2 12 4.2 12 4.2s-6.9 0-8.6.56c-.94.23-1.68.98-1.93 1.93C1 8.4 1 12 1 12s0 3.6.46 5.3c.25.95.99 1.7 1.93 1.93 1.7.56 8.6.56 8.6.56s6.9 0 8.6-.56c.94-.23 1.68-.98 1.93-1.93.46-1.7.46-5.3.46-5.3ZM10 15.5v-7l6 3.5-6 3.5Z"/></svg>`;
    case 'game':
      return `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden><path fill="${fill}" d="M6 6h12a4 4 0 0 1 4 4v6a2 2 0 0 1-2 2h-3l-2-2H9l-2 2H4a2 2 0 0 1-2-2v-6a4 4 0 0 1 4-4Zm0 3v2h2v2h2v-2h2V9h-2V7H8v2H6Zm10 1a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm2-1a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"/></svg>`;
    case 'merch':
      return `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden><path fill="${fill}" d="M4 4h16l-2 16H6L4 4Zm3 2 1 12h8l1-12H7Z"/></svg>`;
    default:
      return '';
  }
}

function createCard({ id, label, href, icon, color }) {
  const a = document.createElement('a');
  a.className = 'lbf-card';
  a.href = href;
  a.target = href?.startsWith('/') ? '_self' : '_blank';
  a.rel = 'noopener noreferrer';
  a.dataset.cardId = id || '';
  a.innerHTML = `
    <span class="lbf-ico" style="color:${color || 'inherit'}">${iconSVG(icon)}</span>
    <span class="lbf-label">${label}</span>
    <span class="lbf-arrow" aria-hidden>›</span>
  `;
  a.addEventListener('click', () => emitAnalytics('card_click', { card_id: id, label, url: href }));
  return a;
}

function applyThemeFlags(flags) {
  const root = document.documentElement;
  (flags || []).forEach(f => root.classList.add('flag-' + f));
}

function mountLanding(cfg) {
  const app = document.getElementById('app');
  if (!app) return;

  // Header
  const header = document.createElement('header');
  header.className = 'lbf-header';
  header.innerHTML = `
    <img class="lbf-avatar" src="${(cfg.brand && cfg.brand.avatar) || '/logo.png'}" alt="logo" />
    <h1 class="lbf-title">${(cfg.brand && cfg.brand.name) || 'lost boy found - Christian AI'}</h1>
    <p class="lbf-tag">${(cfg.brand && cfg.brand.tagline) || ''}</p>
  `;
  app.appendChild(header);

  // Featured banner (optional)
  if (cfg.feature && cfg.feature.href) {
    const f = cfg.feature;
    const feat = document.createElement('a');
    feat.className = 'lbf-feature';
    feat.href = f.href;
    feat.target = f.href.startsWith('/') ? '_self' : '_blank';
    feat.rel = 'noopener noreferrer';
    feat.innerHTML = `
      <div class="lbf-feature-media" style="background-image:url('${f.image || '/assets/background.png'}')"></div>
      <div class="lbf-feature-meta">
        <div class="lbf-eyebrow">${f.eyebrow || 'New'}</div>
        <div class="lbf-feature-title">${f.title || ''}</div>
        <div class="lbf-cta">${f.cta || 'Check it out'}</div>
      </div>
    `;
    feat.addEventListener('click', () => emitAnalytics('feature_click', { href: f.href, title: f.title }));
    app.appendChild(feat);
  }

  // Cards (featured first if specified)
  const list = document.createElement('section');
  list.className = 'lbf-list';
  const features = new Set(cfg.featured || []);
  const flags = new Set(cfg.flags || []);
  const cards = (cfg.cards || []).filter(c => {
    if (!c) return false;
    if (!c.enabled && c.enabled !== undefined) return false;
    if (Array.isArray(c.showIf) && c.showIf.length) {
      return c.showIf.some(fl => flags.has(fl));
    }
    return true;
  }).sort((a, b) => Number(features.has(b.id)) - Number(features.has(a.id)));

  cards.forEach(c => list.appendChild(createCard(c)));
  app.appendChild(list);

  // Animate
  if (window.anime) {
    window.anime.timeline({ easing: 'easeOutQuad' })
      .add({ targets: '.lbf-header', opacity: [0,1], translateY: [-8,0], duration: 400 })
      .add({ targets: '.lbf-feature', opacity: [0,1], translateY: [-8,0], duration: 450 }, '-=150')
      .add({ targets: '.lbf-card', opacity: [0,1], translateY: [8,0], delay: window.anime.stagger(50), duration: 350 }, '-=200');
  }
}

async function boot() {
  // Default config if content/landing.json is missing
  const fallback = {
    brand: {
      name: 'lost boy found - Christian AI',
      tagline: 'Trying to redeem AI by spinning up more edifying Christian music | 1500+ Songs',
      avatar: '/logo.png'
    },
    flags: [],
    feature: {
      eyebrow: 'New',
      title: "Play this week's arcade song",
      image: '/assets/background.png',
      href: '/game.html',
      cta: 'Play now'
    },
    featured: ['game'],
    cards: [
      { id: 'game', icon: 'game', label: 'Play Flappy Praise', href: '/game.html', color: '#39FF14' },
      { id: 'ninja', icon: 'game', label: 'Play Lyric Ninja', href: '/ninja/', color: '#00E5FF' },
      { id: 'instagram', icon: 'instagram', label: 'Follow on Instagram', href: 'https://www.instagram.com/christianaiband/', color: '#E1306C' },
      { id: 'spotify', icon: 'spotify', label: 'Listen on Spotify', href: 'https://open.spotify.com/artist/5blMhZSDPm29S3kPXQceQc', color: '#1DB954' },
      { id: 'apple', icon: 'apple', label: 'Listen on Apple Music', href: 'https://music.apple.com/us/artist/lost-boy-found/1763501707', color: '#ffffff' },
      { id: 'ytm', icon: 'youtubemusic', label: 'Listen on YouTube Music', href: 'https://music.youtube.com/channel/UCKB4Jk2McXRfAgTrSZs2ljg', color: '#FF0000' },
      { id: 'amazon', icon: 'amazon', label: 'Listen on Amazon Music', href: 'https://music.amazon.com/artists/B0DDJPM36D/lost-boy-found', color: '#00A8E1' },
      { id: 'pandora', icon: 'pandora', label: 'Listen on Pandora', href: 'https://pandora.app.link/R4jc6mU0jNb', color: '#1F7CF0' },
      { id: 'youtube', icon: 'youtube', label: 'Visit our YouTube Channel', href: 'https://www.youtube.com/channel/UCbDWdjXC8S-F02_FlAdTJgw', color: '#FF0000' },
      { id: 'merch', icon: 'merch', label: 'Official Merch', href: 'https://othersoriented.creator-spring.com/', color: '#39FF14' }
    ]
  };

  const cfg = await fetchJSON('/content/landing.json') || fallback;
  applyThemeFlags(cfg.flags || []);
  mountLanding(cfg);
}

document.addEventListener('DOMContentLoaded', boot);
