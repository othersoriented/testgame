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
    case 'tiktok':
      return `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="${fill}" d="M15 2h4.1a5.9 5.9 0 0 0 .1 1.3c.3 1.9 1.8 3.4 3.6 3.7V11a8.9 8.9 0 0 1-4-.9v7a5.6 5.6 0 1 1-5.6-5.6h.8V2Zm-1.4 11.9a2.9 2.9 0 1 0 0 5.8 2.9 2.9 0 0 0 2.9-2.9v-7.5a6.9 6.9 0 0 1-2.9-.9v5.5h-.8Z"/></svg>`;
    case 'share':
      return `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="${fill}" d="M18 16a3 3 0 0 1-2.82-4H9.82a3 3 0 1 1 0-2h5.36a3 3 0 1 1 2.82 4Zm0-10a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm-12 3a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm12 6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"/></svg>`;
    default:
      return '';
  }
}

function createCard({ id, label, href, icon, color }) {
  const a = document.createElement('a');
  a.className = 'landing-card';
  a.href = href;
  a.target = href?.startsWith('/') ? '_self' : '_blank';
  a.rel = 'noopener noreferrer';
  a.dataset.cardId = id || '';
  a.innerHTML = `
    <span class="landing-card-icon" style="color:${color || 'inherit'}">${iconSVG(icon)}</span>
    <span class="landing-card-label">${label}</span>
    <span class="landing-card-arrow" aria-hidden="true">&rarr;</span>
  `;
  a.addEventListener('click', () => emitAnalytics('card_click', { card_id: id, label, url: href }));
  return a;
}

function applyThemeFlags(flags) {
  const root = document.documentElement;
  (flags || []).forEach(f => root.classList.add('flag-' + f));
}

const sampleControllers = new Set();

function ensureBackgroundVideo(videoCfg) {
  const body = document.body;
  if (!body) return;
  let videoEl = document.querySelector('.landing-bg-video');
  let overlayEl = document.querySelector('.landing-bg-overlay');
  if (videoCfg?.src) {
    if (!videoEl) {
      videoEl = document.createElement('video');
      videoEl.className = 'landing-bg-video';
      videoEl.autoplay = true;
      videoEl.muted = true;
      videoEl.loop = true;
      videoEl.playsInline = true;
      body.prepend(videoEl);
    }
    if (videoEl.src !== videoCfg.src) videoEl.src = videoCfg.src;
    if (!overlayEl) {
      overlayEl = document.createElement('div');
      overlayEl.className = 'landing-bg-overlay';
      body.prepend(overlayEl);
    }
  } else {
    if (videoEl) videoEl.remove();
    if (overlayEl) overlayEl.remove();
  }
}

function hexToRgba(hex, alpha) {
  if (!hex) return '';
  const normalized = String(hex).replace('#', '');
  if (![3, 6].includes(normalized.length)) return '';
  const pairs = normalized.length === 3
    ? normalized.split('').map(ch => ch + ch)
    : normalized.match(/.{2}/g);
  if (!pairs) return '';
  const rgb = pairs.map(part => parseInt(part, 16));
  if (rgb.some(num => Number.isNaN(num))) return '';
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

function createHero(hero) {
  if (!hero) return null;
  const section = document.createElement('section');
  section.className = 'landing-hero';

  const avatar = document.createElement('img');
  avatar.className = 'landing-hero-avatar';
  avatar.src = hero.avatar || '/logo.png';
  avatar.alt = hero.title || hero.name || 'logo';
  section.appendChild(avatar);

  if (hero.kicker) {
    const kicker = document.createElement('div');
    kicker.className = 'landing-hero-kicker';
    kicker.textContent = hero.kicker;
    section.appendChild(kicker);
  }

  const title = document.createElement('h1');
  title.className = 'landing-hero-title';
  title.textContent = hero.title || hero.name || '';
  section.appendChild(title);

  if (hero.subtitle) {
    const subtitle = document.createElement('p');
    subtitle.className = 'landing-hero-subtitle';
    subtitle.textContent = hero.subtitle;
    section.appendChild(subtitle);
  }

  if (hero.tagline) {
    const tagline = document.createElement('p');
    tagline.className = 'landing-hero-tagline';
    tagline.textContent = hero.tagline;
    section.appendChild(tagline);
  }

  return section;
}



function formatDateLabel(dateish) {
  if (!dateish) return null;
  try {
    const d = new Date(dateish);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return null;
  }
}

function createBandSection(band, shareUrl) {
  if (!band) return null;
  const section = document.createElement('section');
  section.className = 'landing-band';
  if (band.id) section.dataset.bandId = band.id;

  const accent = band.accent || '#39FF14';
  const accentSoft = hexToRgba(accent, 0.18) || 'rgba(57,255,20,0.18)';
  section.style.setProperty('--band-accent', accent);
  section.style.setProperty('--band-accent-soft', accentSoft);

  const top = document.createElement('div');
  top.className = 'landing-band-top';

  const logo = document.createElement('div');
  logo.className = 'landing-band-logo';
  if (band.logo) {
    const img = document.createElement('img');
    img.src = band.logo;
    img.alt = `${band.name || band.id || 'band'} logo`;
    logo.appendChild(img);
  } else {
    logo.dataset.empty = 'true';
    const initials = (band.name || band.id || '?')
      .split(/\s+/)
      .filter(Boolean)
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    logo.textContent = initials || 'B';
  }
  top.appendChild(logo);

  const info = document.createElement('div');
  info.className = 'landing-band-info';
  if (band.tagline) {
    const tag = document.createElement('p');
    tag.className = 'landing-band-tag';
    tag.textContent = band.tagline;
    info.appendChild(tag);
  }
  const name = document.createElement('h2');
  name.className = 'landing-band-name';
  name.textContent = band.name || '';
  info.appendChild(name);
  if (band.description) {
    const desc = document.createElement('p');
    desc.className = 'landing-band-description';
    desc.textContent = band.description;
    info.appendChild(desc);
  }
  top.appendChild(info);

  const shareBtn = document.createElement('button');
  shareBtn.type = 'button';
  shareBtn.className = 'landing-share-btn';
  shareBtn.innerHTML = `
    <span class="landing-share-icon">${iconSVG('share')}</span>
    <span>Share</span>
  `;
  shareBtn.addEventListener('click', async () => {
    const payload = {
      title: band.name || 'Christian AI Music',
      text: (band.description || 'Check out these Christian AI music projects!'),
      url: shareUrl || window.location.href
    };
    if (navigator.share) {
      try {
        await navigator.share(payload);
        emitAnalytics('band_share', { band_id: band.id, method: 'navigator.share' });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(payload.url);
      shareBtn.dataset.copied = 'true';
      emitAnalytics('band_share', { band_id: band.id, method: 'clipboard' });
      setTimeout(() => { delete shareBtn.dataset.copied; }, 1500);
    } catch {
      window.open(payload.url, '_blank');
      emitAnalytics('band_share', { band_id: band.id, method: 'window.open' });
    }
  });
  top.appendChild(shareBtn);

  section.appendChild(top);

  const content = document.createElement('div');
  content.className = 'landing-band-content';

  const links = Array.isArray(band.links) ? band.links.filter(Boolean) : [];
  if (links.length) {
    const list = document.createElement('div');
    list.className = 'landing-band-links';
    links.forEach(link => {
      const a = document.createElement('a');
      a.className = 'landing-link';
      a.href = link.href;
      a.target = link.href?.startsWith('/') ? '_self' : '_blank';
      a.rel = 'noopener noreferrer';
      a.dataset.bandId = band.id || '';
      a.dataset.linkId = link.id || '';
      a.innerHTML = `
        <span class="landing-link-icon" style="color:${link.color || accent}">${iconSVG(link.icon)}</span>
        <span class="landing-link-label">${link.label || ''}</span>
      `;
      a.addEventListener('click', () => emitAnalytics('band_stream_click', { band_id: band.id, stream_id: link.id, label: link.label, url: link.href }));
      list.appendChild(a);
    });
    content.appendChild(list);
  }

  const release = band.latestRelease || band.release || null;
  const sample = band.sample || null;
  if ((release && (release.title || release.image || release.subtitle || release.href)) || (sample && sample.src)) {
    const card = document.createElement('div');
    card.className = 'landing-band-release';

    const art = document.createElement('div');
    art.className = 'landing-band-release-art';
    if (release?.image) {
      art.style.backgroundImage = `url('${release.image}')`;
    } else {
      art.textContent = 'ART';
    }
    card.appendChild(art);

    const info = document.createElement('div');
    info.className = 'landing-band-release-info';
    const eyebrow = document.createElement('span');
    eyebrow.className = 'landing-band-release-eyebrow';
    eyebrow.textContent = release?.eyebrow || 'Latest Release';
    info.appendChild(eyebrow);
    const title = document.createElement('h3');
    title.className = 'landing-band-release-title';
    title.textContent = release?.title || sample?.title || 'New music on the way';
    info.appendChild(title);
    if (release?.subtitle) {
      const sub = document.createElement('p');
      sub.className = 'landing-band-release-subtitle';
      sub.textContent = release.subtitle;
      info.appendChild(sub);
    }
    const releaseDateLabel = formatDateLabel(release?.releaseDate || band.releaseDate);
    if (releaseDateLabel) {
      const date = document.createElement('span');
      date.className = 'landing-band-release-date';
      date.textContent = `Released ${releaseDateLabel}`;
      info.appendChild(date);
    }
    card.appendChild(info);

    if (sample?.src) {
      const control = document.createElement('button');
      control.type = 'button';
      control.className = 'landing-band-release-control';
      control.dataset.state = 'paused';
      control.style.setProperty('--progress', '0deg');
      const icon = document.createElement('span');
      icon.className = 'landing-band-release-icon';
      icon.textContent = '▶';
      control.appendChild(icon);
      control.setAttribute('aria-label', `Play sample ${sample.title || release?.title || 'preview'}`);
      card.appendChild(control);

      const audio = document.createElement('audio');
      audio.className = 'landing-band-release-audio';
      audio.preload = 'metadata';
      audio.src = sample.src;
      audio.dataset.bandId = band.id || '';
      card.appendChild(audio);

      const controller = { audio, button: control };
      sampleControllers.add(controller);

      const updateProgress = () => {
        const pct = audio.duration ? Math.min(Math.max(audio.currentTime / audio.duration, 0), 1) : 0;
        control.style.setProperty('--progress', `${pct * 360}deg`);
      };
      const updateState = () => {
        const playing = !audio.paused && !audio.ended;
        control.dataset.state = playing ? 'playing' : 'paused';
        icon.textContent = playing ? '❚❚' : '▶';
        control.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} sample ${sample.title || release?.title || 'preview'}`);
      };
      controller.updateProgress = updateProgress;
      controller.updateState = updateState;

      control.addEventListener('click', () => {
        if (audio.paused) {
          sampleControllers.forEach(ctrl => {
            if (ctrl !== controller && !ctrl.audio.paused) {
              ctrl.audio.pause();
            }
          });
          audio.play().catch(() => {});
        } else {
          audio.pause();
        }
      });

      audio.addEventListener('play', () => {
        sampleControllers.forEach(ctrl => {
          if (ctrl !== controller && !ctrl.audio.paused) {
            ctrl.audio.pause();
          }
        });
        emitAnalytics('band_sample_play', { band_id: band.id, sample_title: sample.title, url: sample.src });
        updateState();
      });
      audio.addEventListener('pause', updateState);
      audio.addEventListener('loadedmetadata', updateProgress);
      audio.addEventListener('timeupdate', updateProgress);
      audio.addEventListener('ended', () => {
        audio.pause();
        audio.currentTime = 0;
        updateProgress();
      });

      updateState();
      updateProgress();
    }

    content.appendChild(card);
  }

  if (content.childElementCount) {
    section.appendChild(content);
  }

  const extras = Array.isArray(band.extras) ? band.extras.filter(Boolean) : [];
  if (extras.length) {
    const wrap = document.createElement('div');
    wrap.className = 'landing-band-connect';
    const label = document.createElement('span');
    label.className = 'landing-band-connect-label';
    label.textContent = 'Connect';
    wrap.appendChild(label);

    const list = document.createElement('div');
    list.className = 'landing-band-extras';
    extras.forEach(extra => {
      const a = document.createElement('a');
      a.className = 'landing-connect-btn';
      a.href = extra.href;
      a.target = extra.href?.startsWith('/') ? '_self' : '_blank';
      a.rel = 'noopener noreferrer';
      a.dataset.bandId = band.id || '';
      a.dataset.linkId = extra.id || '';
      a.innerHTML = `
        <span class="landing-connect-icon" style="color:${extra.color || accent}">${iconSVG(extra.icon)}</span>
        <span>${extra.label || ''}</span>
      `;
      a.addEventListener('click', () => emitAnalytics('band_extra_click', { band_id: band.id, action_id: extra.id, label: extra.label, url: extra.href }));
      list.appendChild(a);
    });
    wrap.appendChild(list);
    section.appendChild(wrap);
  }

  return section;
}

function createActionsSection(cards, titleText) {
  if (!cards || !cards.length) return null;
  const section = document.createElement('section');
  section.className = 'landing-actions-wrap';

  if (titleText !== '') {
    const heading = document.createElement('h2');
    heading.className = 'landing-section-title';
    heading.textContent = titleText || 'Arcade + Extras';
    section.appendChild(heading);
  }

  const grid = document.createElement('div');
  grid.className = 'landing-actions';
  cards.forEach(card => grid.appendChild(createCard(card)));
  section.appendChild(grid);

  return section;
}

function mountLanding(cfg) {
  const app = document.getElementById('app');
  if (!app) return;

  ensureBackgroundVideo(cfg.backgroundVideo);
  app.innerHTML = '';
  sampleControllers.clear();

  const heroSource = cfg.hero || (cfg.brand ? {
    avatar: cfg.brand.avatar,
    title: cfg.brand.name,
    subtitle: cfg.hero?.subtitle,
    tagline: cfg.brand.tagline,
    kicker: cfg.hero?.kicker || cfg.brand.kicker
  } : null);

  if (heroSource && (heroSource.title || heroSource.subtitle || heroSource.tagline)) {
    const hero = createHero(heroSource);
    if (hero) app.appendChild(hero);
  }

  const bands = Array.isArray(cfg.bands) ? cfg.bands.filter(Boolean) : [];
  const bandWrap = document.createElement('section');
  bandWrap.className = 'landing-bands';

  const shareUrl = cfg.shareUrl || 'https://christianaiband.com';
  bands.forEach(band => {
    const bandSection = createBandSection(band, shareUrl);
    if (bandSection) bandWrap.appendChild(bandSection);
  });

  if (bandWrap.childElementCount) {
    app.appendChild(bandWrap);
  }

  const flags = new Set(cfg.flags || []);
  const features = new Set(cfg.featured || []);
  const cards = (cfg.cards || []).filter(card => {
    if (!card) return false;
    if (!card.enabled && card.enabled !== undefined) return false;
    if (Array.isArray(card.showIf) && card.showIf.length) {
      return card.showIf.some(fl => flags.has(fl));
    }
    return true;
  }).sort((a, b) => Number(features.has(b.id)) - Number(features.has(a.id)));

  const actions = createActionsSection(cards, cfg.cardsTitle || cfg.cardsHeading);
  if (actions) app.appendChild(actions);

  if (window.anime) {
    const tl = window.anime.timeline({ easing: 'easeOutQuad' });
    tl.add({ targets: '.landing-hero', opacity: [0, 1], translateY: [-12, 0], duration: 420 });
    tl.add({ targets: '.landing-band', opacity: [0, 1], translateY: [16, 0], delay: window.anime.stagger(120), duration: 380 }, '-=200');
    tl.add({ targets: '.landing-card', opacity: [0, 1], translateY: [12, 0], delay: window.anime.stagger(60), duration: 320 }, '-=200');
  } else {
    document.querySelectorAll('.landing-hero, .landing-band, .landing-card').forEach(el => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
  }
}

async function boot() {
  // Default config if content/landing.json is missing
  const fallback = {
    hero: {
      kicker: "Christian AI Music Collective",
      title: "Lost Boy Found + The Great Reunion",
      subtitle: "Two original AI-assisted worship projects releasing new songs weekly.",
      avatar: "/logo.png",
      tagline: "Trying to redeem AI by spinning up more edifying Christian music | 150+ songs | New every week!"
    },
    flags: [],
    backgroundVideo: {
      src: "/assets/video/background.mp4"
    },
    bands: [
      {
        id: 'lost-boy-found',
        name: 'Lost Boy Found',
        tagline: 'Christian AI Pop-Punk / Rock',
        description: 'Neon-drenched, high-energy praise anthems pointing kids (and the kid-at-heart) back to Jesus.',
        accent: '#39FF14',
        logo: "/assets/bands/lbf/logo.png",
        latestRelease: {
          title: 'Hymns Vol. 8',
          subtitle: 'Hit play to catch the freshest drop.',
          image: "/assets/bands/lbf/releases/hymns-viii-remixes.png",
          releaseDate: '2025-09-12'
        },
        sample: {
          title: 'Sample: Hymns VIII Remix',
          src: '/assets/audio/lbf-sample.mp3'
        },
        releaseDate: '2025-09-12',
        links: [
          { id: 'spotify', icon: 'spotify', label: 'Spotify', href: 'https://open.spotify.com/artist/5blMhZSDPm29S3kPXQceQc', color: '#1DB954' },
          { id: 'apple', icon: 'apple', label: 'Apple Music', href: 'https://music.apple.com/us/artist/lost-boy-found/1763501707', color: '#0F0F0F' },
          { id: 'ytm', icon: 'youtubemusic', label: 'YouTube Music', href: 'https://music.youtube.com/channel/UCKB4Jk2McXRfAgTrSZs2ljg', color: '#FF0000' },
          { id: 'amazon', icon: 'amazon', label: 'Amazon Music', href: 'https://music.amazon.com/artists/B0DDJPM36D/lost-boy-found', color: '#00A8E1' },
          { id: 'pandora', icon: 'pandora', label: 'Pandora', href: 'https://pandora.app.link/R4jc6mU0jNb', color: '#1F7CF0' },
          { id: 'youtube', icon: 'youtube', label: 'YouTube', href: 'https://www.youtube.com/channel/UCbDWdjXC8S-F02_FlAdTJgw', color: '#FF0000' }
        ],
        extras: [
          { id: 'instagram', icon: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/christianaiband/', color: '#E1306C' },
          { id: 'tiktok', icon: 'tiktok', label: 'TikTok', href: 'https://www.tiktok.com/@christianaiband', color: '#000000' }
        ]
      },
      {
        id: 'the-great-reunion',
        name: 'The Great Reunion',
        tagline: 'Christian AI Indie-Folk / Indie Rock',
        description: 'Warm, reflective folk textures crafted with AI tools to soundtrack the coming kingdom.',
        accent: '#6AD7E5',
        logo: "/assets/bands/tgr/logo.png",
        latestRelease: {
          title: 'New songs on deck',
          subtitle: 'Folky meditations for the hopeful heart.',
          image: "/assets/bands/tgr/releases/christmas-vol1.png",
          releaseDate: '2025-12-10'
        },
        sample: {
          title: 'Sample: Christmas Vol. 1',
          src: '/assets/audio/tgr-sample.mp3'
        },
        releaseDate: '2025-12-10',
        links: [
          { id: 'spotify', icon: 'spotify', label: 'Spotify', href: 'https://open.spotify.com/artist/4AFA0ADp9dugRrRY3RjbIJ', color: '#1DB954' },
          { id: 'apple', icon: 'apple', label: 'Apple Music', href: 'https://music.apple.com/us/artist/the-great-reunion/1846862216', color: '#0F0F0F' },
          { id: 'ytm', icon: 'youtubemusic', label: 'YouTube Music', href: 'https://music.youtube.com/channel/UCF750lcrGvPrwLF2rELwrhw', color: '#FF0000' },
          { id: 'amazon', icon: 'amazon', label: 'Amazon Music', href: 'https://music.amazon.com/artists/B0FWTZYP96/the-great-reunion', color: '#00A8E1' },
          { id: 'pandora', icon: 'pandora', label: 'Pandora', href: 'https://www.pandora.com/artist/the-great-reunion/ARpwqxg9bwwjpJ9', color: '#1F7CF0' },
          { id: 'youtube', icon: 'youtube', label: 'YouTube', href: 'https://www.youtube.com/@thegreatreunion', color: '#FF0000' }
        ],
        extras: [
          { id: 'instagram', icon: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/thegreatreunionmusic/', color: '#E1306C' },
          { id: 'tiktok', icon: 'tiktok', label: 'TikTok', href: 'https://www.tiktok.com/@thegreatreunionmusic', color: '#000000' }
        ]
      }
    ],
    shareUrl: 'https://christianaiband.com',
    cardsTitle: 'Arcade + Extras',
    featured: ['game'],
    cards: [
      { id: 'game', icon: 'game', label: 'Play Flappy Praise', href: '/game.html', color: '#39FF14' },
      { id: 'ninja', icon: 'game', label: 'Play Praise Ninja', href: '/ninja/', color: '#00E5FF' },
      { id: 'merch', icon: 'merch', label: 'Official Merch', href: 'https://othersoriented.creator-spring.com/', color: '#39FF14' }
    ]
  };

  const cfg = await fetchJSON('/content/landing.json') || fallback;
  applyThemeFlags(cfg.flags || []);
  mountLanding(cfg);

  // Non-breaking auth panel: only shows if env + Amplify are available
  try {
    const auth = await import('./auth/client.js');
    const initRes = await auth.init();
    if (initRes?.enabled) {
      const app = document.getElementById('app');
      const bar = document.createElement('div');
      bar.className = 'landing-auth';
      async function renderAuth() {
        bar.innerHTML = '';
        const me = await auth.currentUser();
        if (!me) {
          const g = document.createElement('button'); g.className = 'landing-auth-btn'; g.textContent = 'Sign in with Google'; g.onclick = auth.signInWithGoogle;
          const f = document.createElement('button'); f.className = 'landing-auth-btn'; f.textContent = 'Sign in with Facebook'; f.onclick = auth.signInWithFacebook;
          bar.appendChild(g); bar.appendChild(f);
        } else {
          const img = document.createElement('img'); img.src = me.picture || '/logo.png'; img.alt = ''; img.style.width = '28px'; img.style.height='28px'; img.style.borderRadius='50%';
          const name = document.createElement('span'); name.textContent = me.name; name.style.alignSelf='center'; name.style.fontWeight='600';
          const out = document.createElement('button'); out.className = 'landing-auth-btn'; out.textContent = 'Sign out'; out.onclick = auth.signOut;
          bar.appendChild(img); bar.appendChild(name); bar.appendChild(out);
        }
      }
      app.prepend(bar);
      renderAuth();
      // Re-render on visibility change (returns from Hosted UI)
      document.addEventListener('visibilitychange', () => { if (!document.hidden) renderAuth(); });
    }
  } catch {}

}

document.addEventListener('DOMContentLoaded', boot);






