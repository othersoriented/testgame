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

function sanitizeEventKey(value) {
  if (value == null) return '';
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function toBandAcronym(source) {
  if (!source) return '';
  const cleaned = String(source)
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim();
  if (!cleaned) return '';
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    return tokens.map(token => token[0]).join('').toLowerCase();
  }
  return tokens[0].slice(0, 3).toLowerCase();
}

function getBandAnalyticsCode(band) {
  if (!band) return '';
  const explicit =
    band.analyticsCode ||
    band.analyticsId ||
    band.analytics?.code ||
    band.analytics?.id ||
    band.code;
  if (explicit) return sanitizeEventKey(explicit);
  const fromId = band.id || band.slug;
  if (fromId) {
    const acronym = toBandAcronym(fromId);
    if (acronym) return sanitizeEventKey(acronym);
  }
  const fromName = band.name;
  if (fromName) {
    const acronym = toBandAcronym(fromName);
    if (acronym) return sanitizeEventKey(acronym);
  }
  return sanitizeEventKey(fromId || fromName || '');
}

function inferBandCodeFromEventId(value) {
  if (!value) return '';
  const sanitized = sanitizeEventKey(value);
  if (!sanitized) return '';
  if (sanitized.includes('tgr')) return 'tgr';
  if (sanitized.includes('lbf')) return 'lbf';
  if (sanitized.includes('spr')) return 'spr';
  if (sanitized.includes('sprinkld')) return 'spr';
  return '';
}

function emitBandAnalytics(baseEventName, band, suffixParts, detail) {
  const normalizedBase = sanitizeEventKey(baseEventName) || 'band_event';
  const bandId = band?.id || null;
  const bandName = band?.name || null;
  const bandCode = getBandAnalyticsCode(band);
  const basePayload = {
    ...(bandId != null ? { band_id: bandId } : {}),
    ...(bandName ? { band_name: bandName } : {}),
    ...(bandCode ? { band_code: bandCode } : {}),
    ...(detail || {})
  };
  emitAnalytics(normalizedBase, basePayload);
  emitRecommendedBandAnalytics(normalizedBase, band, basePayload);

  const parts = Array.isArray(suffixParts) ? suffixParts : (suffixParts ? [suffixParts] : []);
  const flatParts = parts.flatMap(part => Array.isArray(part) ? part : [part]);
  const specificParts = [
    sanitizeEventKey(normalizedBase),
    sanitizeEventKey(bandCode) || sanitizeEventKey(bandId) || sanitizeEventKey(bandName),
    ...flatParts.map(sanitizeEventKey)
  ].filter(Boolean);
  const specificEvent = specificParts.join('_');
  if (specificEvent && specificEvent !== normalizedBase) {
    emitAnalytics(specificEvent, { ...basePayload, event_name_specific: specificEvent });
  }
}

function emitRecommendedBandAnalytics(baseEventName, band, payload) {
  const bandName = payload?.band_name || band?.name || '';
  const bandId = payload?.band_id || band?.id || '';
  const bandCode = payload?.band_code || getBandAnalyticsCode(band);
  const common = {
    band_id: bandId || undefined,
    band_name: bandName || undefined,
    band_code: bandCode || undefined
  };

  if (baseEventName === 'band_stream_click') {
    const streamId = payload?.stream_id || payload?.action_id;
    const label = payload?.label || payload?.stream_label;
    const url = payload?.url;
    const itemId = streamId || url || label || (bandCode ? `${bandCode}_stream` : '');
    const item = {
      item_category: 'Band',
      item_category2: 'Stream'
    };
    if (itemId) item.item_id = itemId;
    if (label) item.item_name = label;
    if (bandName) item.item_brand = bandName;
    if (bandCode && itemId) item.item_variant = `${bandCode}_${sanitizeEventKey(itemId)}`;
    const selectPayload = {
      ...common,
      content_type: 'band_stream',
      link_url: url || undefined
    };
    if (itemId) selectPayload.item_id = itemId;
    const items = Object.keys(item).length > 0 ? [item] : [];
    if (items.length) selectPayload.items = items;
    emitAnalytics('select_content', selectPayload);
    return;
  }

  if (baseEventName === 'band_extra_click') {
    const actionId = payload?.action_id || payload?.stream_id;
    const label = payload?.label || payload?.action_label;
    const url = payload?.url;
    const itemId = actionId || label || url || (bandCode ? `${bandCode}_connect` : '');
    const item = {
      item_category: 'Band',
      item_category2: 'Connect'
    };
    if (itemId) item.item_id = itemId;
    if (label) item.item_name = label;
    if (bandName) item.item_brand = bandName;
    if (bandCode && itemId) item.item_variant = `${bandCode}_${sanitizeEventKey(itemId)}`;
    const selectPayload = {
      ...common,
      content_type: 'band_connect',
      link_url: url || undefined
    };
    if (itemId) selectPayload.item_id = itemId;
    const items = Object.keys(item).length > 0 ? [item] : [];
    if (items.length) selectPayload.items = items;
    emitAnalytics('select_content', selectPayload);
    return;
  }

  if (baseEventName === 'band_share') {
    const shareMethod = payload?.share_method || payload?.method;
    const link = payload?.share_url || payload?.url;
    const sharePayload = {
      ...common,
      content_type: 'band',
      method: shareMethod || undefined,
      link_url: link || undefined
    };
    if (bandCode) sharePayload.item_id = `${bandCode}_share`;
    if (bandName) sharePayload.item_name = bandName;
    emitAnalytics('share', sharePayload);
    return;
  }

  if (baseEventName === 'band_sample_play') {
    const title = payload?.sample_title || payload?.label || 'sample';
    const mediaPayload = {
      ...common,
      content_type: 'band_sample',
      item_name: title || undefined,
      item_id: (bandCode && title) ? `${bandCode}_${sanitizeEventKey(title)}` : undefined,
      media_url: payload?.url || undefined
    };
    emitAnalytics('play', mediaPayload);
  }
}

function ensureMetaTag(attrs) {
  if (!attrs || !attrs.name && !attrs.property) return null;
  const selector = attrs.name ? `meta[name="${attrs.name}"]` : `meta[property="${attrs.property}"]`;
  let tag = document.head.querySelector(selector);
  if (!tag) {
    tag = document.createElement('meta');
    if (attrs.name) tag.name = attrs.name;
    if (attrs.property) tag.setAttribute('property', attrs.property);
    document.head.appendChild(tag);
  }
  return tag;
}

function updateHeadMetadata(cfg) {
  if (typeof document === 'undefined') return;
  const hero = cfg?.hero || {};
  const seo = cfg?.seo || {};
  const title = seo.title || hero.title || 'Christian AI Music';
  const description = seo.description || hero.subtitle || hero.tagline || 'Discover new Christian AI music projects.';
  const url = seo.url || cfg?.shareUrl || window.location.href;
  if (title) document.title = title;
  if (description) {
    const metaDescription = ensureMetaTag({ name: 'description' });
    if (metaDescription) metaDescription.setAttribute('content', description);
  }
  if (title) {
    const ogTitle = ensureMetaTag({ property: 'og:title' });
    if (ogTitle) ogTitle.setAttribute('content', title);
  }
  if (description) {
    const ogDescription = ensureMetaTag({ property: 'og:description' });
    if (ogDescription) ogDescription.setAttribute('content', description);
  }
  if (url) {
    const ogUrl = ensureMetaTag({ property: 'og:url' });
    if (ogUrl) ogUrl.setAttribute('content', url);
  }
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
      return `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="${fill}" d="M13.4 2 4 14h5.5L8.6 22 20 8h-5.5L13.4 2Z"/></svg>`;
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
  a.addEventListener('click', () => {
    const payload = { card_id: id, label, url: href };
    emitAnalytics('card_click', payload);
    const specificEvent = ['card_click', sanitizeEventKey(id || label)].filter(Boolean).join('_');
    if (specificEvent && specificEvent !== 'card_click') {
      emitAnalytics(specificEvent, { ...payload, event_name_specific: specificEvent });
    }
  });
  return a;
}

function createHeroButton(config, variant = 'primary') {
  if (!config?.label || !config?.href) return null;
  const btn = document.createElement('a');
  btn.className = `landing-hero-btn landing-hero-btn--${variant}`;
  btn.href = config.href;
  btn.target = config.href.startsWith('/') ? '_self' : '_blank';
  btn.rel = 'noopener noreferrer';

  const content = document.createElement('span');
  if (config.icon) {
    const icon = document.createElement('span');
    icon.innerHTML = iconSVG(config.icon);
    content.appendChild(icon);
  }
  const label = document.createElement('span');
  label.textContent = config.label;
  content.appendChild(label);
  btn.appendChild(content);

  btn.addEventListener('click', () => {
    const ctaId = config.id || config.analyticsId || sanitizeEventKey(config.label);
    const inferredBandSource = config.band || (config.analyticsBand ? { id: config.analyticsBand } : null);
    const heroBandCodeRaw = config.bandCode || config.analyticsBandCode || (inferredBandSource ? getBandAnalyticsCode(inferredBandSource) : '') || inferBandCodeFromEventId(ctaId);
    const heroBandCode = heroBandCodeRaw ? sanitizeEventKey(heroBandCodeRaw) : '';
    const payload = {
      cta_id: ctaId,
      label: config.label,
      url: config.href,
      variant
    };
    if (heroBandCode) payload.band_code = heroBandCode;
    emitAnalytics('hero_cta_click', payload);
    emitAnalytics('select_content', {
      content_type: 'hero_cta',
      item_id: ctaId,
      item_name: config.label,
      link_url: config.href,
      band_code: heroBandCode || undefined
    });
  });

  return btn;
}

function applyThemeFlags(flags) {
  const root = document.documentElement;
  if (!root) return;
  Array.from(root.classList).forEach(cls => {
    if (cls.startsWith('flag-')) root.classList.remove(cls);
  });
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

  const avatarSources = Array.isArray(hero.avatars) ? hero.avatars.filter(Boolean) : [];
  if (avatarSources.length > 1) {
    const avatarGroup = document.createElement('div');
    avatarGroup.className = 'landing-hero-avatars';
    avatarGroup.style.display = 'flex';
    avatarGroup.style.alignItems = 'center';
    avatarGroup.style.justifyContent = 'center';
    avatarGroup.style.gap = '12px';
    avatarSources.forEach((src, idx) => {
      const avatar = document.createElement('img');
      avatar.className = 'landing-hero-avatar';
      avatar.src = src;
      avatar.alt = `${hero.title || hero.name || 'logo'} ${idx + 1}`;
      avatarGroup.appendChild(avatar);
    });
    section.appendChild(avatarGroup);
  } else {
    const avatar = document.createElement('img');
    avatar.className = 'landing-hero-avatar';
    avatar.src = avatarSources[0] || hero.avatar || '/logo.png';
    avatar.alt = hero.title || hero.name || 'logo';
    section.appendChild(avatar);
  }

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

  if (Array.isArray(hero.highlights) && hero.highlights.length) {
    const highlights = document.createElement('div');
    highlights.className = 'landing-hero-highlights';
    hero.highlights.slice(0, 3).forEach(item => {
      if (!item) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'landing-hero-highlight';
      const value = document.createElement('span');
      value.className = 'landing-hero-highlight-value';
      value.textContent = item.value || '';
      const label = document.createElement('span');
      label.className = 'landing-hero-highlight-label';
      label.textContent = item.label || '';
      if (item.value) wrapper.appendChild(value);
      if (item.label) wrapper.appendChild(label);
      if (wrapper.childElementCount) highlights.appendChild(wrapper);
    });
    if (highlights.childElementCount) section.appendChild(highlights);
  }

  const heroActions = [];
  if (hero.cta) heroActions.push({ cfg: hero.cta, variant: 'primary' });
  if (hero.secondaryCta) heroActions.push({ cfg: hero.secondaryCta, variant: 'secondary' });
  if (Array.isArray(hero.extraCtas)) {
    hero.extraCtas.forEach((cta, idx) => {
      heroActions.push({ cfg: cta, variant: cta?.variant || (idx === 0 ? 'secondary' : 'link') });
    });
  }
  if (heroActions.length) {
    const actionsWrap = document.createElement('div');
    actionsWrap.className = 'landing-hero-actions';
    heroActions.forEach(action => {
      const btn = createHeroButton(action.cfg, action.variant || 'secondary');
      if (btn) actionsWrap.appendChild(btn);
    });
    if (actionsWrap.childElementCount) section.appendChild(actionsWrap);
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

function createBandSocialProof(band) {
  const items = Array.isArray(band?.socialProof) ? band.socialProof.filter(Boolean) : [];
  if (!items.length) return null;
  const wrap = document.createElement('div');
  wrap.className = 'landing-band-social';
  const title = document.createElement('span');
  title.className = 'landing-band-social-title';
  const sparkle = document.createElement('span');
  sparkle.setAttribute('aria-hidden', 'true');
  sparkle.textContent = '*';
  const label = document.createElement('span');
  label.textContent = band.socialProofTitle || 'Community love';
  title.appendChild(sparkle);
  title.appendChild(label);
  wrap.appendChild(title);

  const list = document.createElement('div');
  list.className = 'landing-band-social-items';
  items.slice(0, 3).forEach(item => {
    const itemWrap = document.createElement('div');
    itemWrap.className = 'landing-band-social-item';
    const quoteWrap = document.createElement('blockquote');
    quoteWrap.className = 'landing-band-social-quote';
    quoteWrap.textContent = item.quote || '';
    itemWrap.appendChild(quoteWrap);
    if (item.source) {
      const source = document.createElement('cite');
      source.className = 'landing-band-social-source';
      source.textContent = item.source;
      itemWrap.appendChild(source);
    }
    if (itemWrap.childElementCount) list.appendChild(itemWrap);
  });
  if (!list.childElementCount) return null;
  wrap.appendChild(list);
  return wrap;
}

function createAlbumCarousel(band, accent, accentSoft) {
  const albums = Array.isArray(band.albums) ? band.albums.filter(Boolean) : [];
  if (!albums.length) return null;

  const wrap = document.createElement('div');
  wrap.className = 'landing-band-albums';
  wrap.style.marginTop = '16px';

  const title = document.createElement('div');
  title.className = 'landing-band-albums-title';
  title.textContent = 'Albums';
  title.style.fontWeight = '700';
  title.style.marginBottom = '8px';
  wrap.appendChild(title);

  const list = document.createElement('div');
  list.className = 'landing-band-albums-list';
  list.style.display = 'flex';
  list.style.gap = '12px';
  list.style.overflowX = 'auto';
  list.style.scrollSnapType = 'x mandatory';
  list.style.paddingBottom = '4px';

  const sortedAlbums = [...albums].sort((a, b) => {
    const da = a?.releaseDate ? new Date(a.releaseDate).getTime() : 0;
    const db = b?.releaseDate ? new Date(b.releaseDate).getTime() : 0;
    return db - da;
  });

  sortedAlbums.forEach((album, idx) => {
    const card = document.createElement('a');
    card.className = 'landing-album';
    card.href = album.href || '#';
    card.target = album.href?.startsWith('/') ? '_self' : '_blank';
    card.rel = 'noopener noreferrer';
    card.dataset.bandId = band.id || '';
    card.dataset.albumIdx = String(idx);
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.width = '180px';
    card.style.minWidth = '170px';
    card.style.minHeight = '260px';
    card.style.scrollSnapAlign = 'start';
    card.style.background = 'rgba(255,255,255,0.7)';
    card.style.border = `1px solid ${accentSoft || 'rgba(0,0,0,0.08)'}`;
    card.style.borderRadius = '14px';
    card.style.padding = '10px';
    card.style.boxSizing = 'border-box';
    card.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)';
    card.style.textDecoration = 'none';
    card.style.color = 'inherit';
    card.style.transition = 'transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease';
    card.addEventListener('mouseenter', () => { card.style.transform = 'translateY(-3px)'; card.style.boxShadow = '0 10px 24px rgba(0,0,0,0.12)'; card.style.borderColor = accent || '#111'; });
    card.addEventListener('mouseleave', () => { card.style.transform = 'none'; card.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)'; card.style.borderColor = accentSoft || 'rgba(0,0,0,0.08)'; });

    if (album.image) {
      const img = document.createElement('div');
      img.className = 'landing-album-art';
      img.style.width = '100%';
      img.style.aspectRatio = '1 / 1';
      img.style.borderRadius = '10px';
      img.style.backgroundSize = 'cover';
      img.style.backgroundPosition = 'center';
      img.style.backgroundImage = `url('${album.image}')`;
      img.style.marginBottom = '8px';
      card.appendChild(img);
    }

    const meta = document.createElement('div');
    meta.className = 'landing-album-meta';
    meta.style.display = 'flex';
    meta.style.flexDirection = 'column';
    meta.style.flexGrow = '1';
    meta.style.gap = '4px';

    const name = document.createElement('div');
    name.className = 'landing-album-title';
    name.textContent = album.title || 'Album';
    name.style.fontWeight = '700';
    name.style.fontSize = '14px';
    name.style.display = '-webkit-box';
    name.style.webkitLineClamp = '2';
    name.style.webkitBoxOrient = 'vertical';
    name.style.overflow = 'hidden';
    meta.appendChild(name);

    const details = document.createElement('div');
    details.className = 'landing-album-details';
    details.style.fontSize = '12px';
    details.style.color = '#444';
    const parts = [];
    if (album.tracks) parts.push(`${album.tracks} songs`);
    const releaseLabel = formatDateLabel(album.releaseDate);
    if (releaseLabel) parts.push(`Released ${releaseLabel}`);
    details.textContent = parts.join(' • ');
    meta.appendChild(details);

    const cta = document.createElement('span');
    cta.className = 'landing-album-cta';
    cta.textContent = album.ctaLabel || 'Listen on Spotify';
    cta.style.display = 'inline-flex';
    cta.style.alignItems = 'center';
    cta.style.justifyContent = 'center';
    cta.style.padding = '8px 12px';
    cta.style.marginTop = 'auto';
    cta.style.borderRadius = '999px';
    cta.style.border = `1px solid ${accent || '#111'}`;
    cta.style.background = accent || '#111';
    cta.style.color = '#fff';
    cta.style.fontSize = '12px';
    cta.style.fontWeight = '700';
    cta.style.boxShadow = '0 2px 8px rgba(0,0,0,0.16)';
    cta.style.textAlign = 'center';
    cta.style.width = '100%';
    cta.style.boxSizing = 'border-box';
    meta.appendChild(cta);

    card.appendChild(meta);

    card.addEventListener('click', () => emitBandAnalytics('band_stream_click', band, [album.title, 'album'], {
      stream_id: sanitizeEventKey(album.title || `album_${idx}`),
      label: album.title,
      stream_label: album.title,
      url: album.href
    }));

    list.appendChild(card);
  });

  wrap.appendChild(list);
  return wrap;
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
  const isNew = band.badge || band.isNew;
  if (isNew) {
    const badge = document.createElement('span');
    badge.className = 'landing-band-badge';
    badge.textContent = band.badge || 'New';
    badge.style.display = 'inline-flex';
    badge.style.alignItems = 'center';
    badge.style.gap = '6px';
    badge.style.padding = '4px 10px';
    badge.style.borderRadius = '999px';
    badge.style.fontSize = '12px';
    badge.style.fontWeight = '700';
    badge.style.backgroundColor = accentSoft;
    badge.style.color = accent;
    badge.style.border = `1px solid ${accent}`;
    badge.dataset.state = 'new';
    info.appendChild(badge);
  }
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
        emitBandAnalytics('band_share', band, 'navigator', {
          method: 'navigator.share',
          share_method: 'navigator.share',
          share_url: payload.url
        });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(payload.url);
      shareBtn.dataset.copied = 'true';
      emitBandAnalytics('band_share', band, 'clipboard', {
        method: 'clipboard',
        share_method: 'clipboard',
        share_url: payload.url
      });
      setTimeout(() => { delete shareBtn.dataset.copied; }, 1500);
    } catch {
      window.open(payload.url, '_blank');
      emitBandAnalytics('band_share', band, 'window_open', {
        method: 'window.open',
        share_method: 'window.open',
        share_url: payload.url
      });
    }
  });
  top.appendChild(shareBtn);

  section.appendChild(top);

  const bandSocial = createBandSocialProof(band);
  if (bandSocial) section.appendChild(bandSocial);

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
    a.addEventListener('click', () => emitBandAnalytics('band_stream_click', band, [link.id, link.label], {
      stream_id: link.id,
      label: link.label,
      stream_label: link.label,
      url: link.href
    }));
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
    eyebrow.textContent = release?.eyebrow || 'Featured Release';
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
        emitBandAnalytics('band_sample_play', band, [sample?.title || 'sample'], {
          sample_title: sample.title,
          url: sample.src
        });
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

  const albums = createAlbumCarousel(band, accent, accentSoft);
  if (albums) content.appendChild(albums);

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
    a.addEventListener('click', () => emitBandAnalytics('band_extra_click', band, [extra.id, extra.label], {
      action_id: extra.id,
      label: extra.label,
      action_label: extra.label,
      url: extra.href
    }));
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

const MAILCHIMP_CLASSIC_EMBED = `
<div id="mc_embed_shell">
  <link href="//cdn-images.mailchimp.com/embedcode/classic-061523.css" rel="stylesheet" type="text/css">
  <style type="text/css">
    #mc_embed_signup{background:#fff; false;clear:left; font:14px Helvetica,Arial,sans-serif; width: 600px;}
  </style>
  <div id="mc_embed_signup">
    <form action="https://othersoriented.us4.list-manage.com/subscribe/post?u=8430d870f739578cd7ecdd61f&amp;id=2daa907931&amp;f_id=00b576eaf0" method="post" id="mc-embedded-subscribe-form" name="mc-embedded-subscribe-form" class="validate" target="_blank">
      <div id="mc_embed_signup_scroll">
        <h2>Subscribe</h2>
        <div class="indicates-required"><span class="asterisk">*</span> indicates required</div>
        <div class="mc-field-group"><label for="mce-EMAIL">Email Address <span class="asterisk">*</span></label><input type="email" name="EMAIL" class="required email" id="mce-EMAIL" required value></div>
        <div class="mc-field-group"><label for="mce-FNAME">First Name </label><input type="text" name="FNAME" class=" text" id="mce-FNAME" value></div>
        <div class="mc-address-group">
          <div class="mc-field-group"><label for="mce-ADDRESS-addr1">Address </label><input type="text" maxlength="70" name="ADDRESS[addr1]" id="mce-ADDRESS-addr1" class value></div>
          <div class="mc-field-group"><label for="mce-ADDRESS-addr2">Address Line 2</label><input type="text" maxlength="70" name="ADDRESS[addr2]" id="mce-ADDRESS-addr2" value></div>
          <div class="mc-address-fields-group">
            <div class="mc-field-group"><label for="mce-ADDRESS-city">City</label><input type="text" maxlength="40" name="ADDRESS[city]" id="mce-ADDRESS-city" class value></div>
            <div class="mc-field-group"><label for="mce-ADDRESS-state">State/Province/Region</label><input type="text" maxlength="20" name="ADDRESS[state]" id="mce-ADDRESS-state" class value></div>
            <div class="mc-field-group"><label for="mce-ADDRESS-zip">Postal / Zip Code</label><input type="text" maxlength="10" name="ADDRESS[zip]" id="mce-ADDRESS-zip" class value></div>
          </div>
          <div class="mc-field-group"><label for="mce-ADDRESS-country">Country</label><select name="ADDRESS[country]" id="mce-ADDRESS-country" class><option value="Albania">Albania</option><option value="Algeria">Algeria</option><option value="Andorra">Andorra</option><option value="Angola">Angola</option><option value="Argentina">Argentina</option><option value="Armenia">Armenia</option><option value="Australia">Australia</option><option value="Austria">Austria</option><option value="Azerbaijan">Azerbaijan</option><option value="Bahamas">Bahamas</option><option value="Bahrain">Bahrain</option><option value="Bangladesh">Bangladesh</option><option value="Barbados">Barbados</option><option value="Belarus">Belarus</option><option value="Belgium">Belgium</option><option value="Belize">Belize</option><option value="Benin">Benin</option><option value="Bermuda">Bermuda</option><option value="Bhutan">Bhutan</option><option value="Bolivia">Bolivia</option><option value="Bosnia and Herzegovina">Bosnia and Herzegovina</option><option value="Botswana">Botswana</option><option value="Brazil">Brazil</option><option value="Bulgaria">Bulgaria</option><option value="Burkina Faso">Burkina Faso</option><option value="Burundi">Burundi</option><option value="Cambodia">Cambodia</option><option value="Cameroon">Cameroon</option><option value="Canada">Canada</option><option value="Cape Verde">Cape Verde</option><option value="Cayman Islands">Cayman Islands</option><option value="Central African Republic">Central African Republic</option><option value="Chad">Chad</option><option value="Chile">Chile</option><option value="China">China</option><option value="Colombia">Colombia</option><option value="Congo">Congo</option><option value="Croatia">Croatia</option><option value="Cyprus">Cyprus</option><option value="Czech Republic">Czech Republic</option><option value="Denmark">Denmark</option><option value="Djibouti">Djibouti</option><option value="Ecuador">Ecuador</option><option value="Egypt">Egypt</option><option value="El Salvador">El Salvador</option><option value="Equatorial Guinea">Equatorial Guinea</option><option value="Eritrea">Eritrea</option><option value="Estonia">Estonia</option><option value="Ethiopia">Ethiopia</option><option value="Fiji">Fiji</option><option value="Finland">Finland</option><option value="France">France</option><option value="Gabon">Gabon</option><option value="Gambia">Gambia</option><option value="Georgia">Georgia</option><option value="Germany">Germany</option><option value="Ghana">Ghana</option><option value="Greece">Greece</option><option value="Guam">Guam</option><option value="Guinea">Guinea</option><option value="Guinea-Bissau">Guinea-Bissau</option><option value="Guyana">Guyana</option><option value="Honduras">Honduras</option><option value="Hong Kong">Hong Kong</option><option value="Hungary">Hungary</option><option value="Iceland">Iceland</option><option value="India">India</option><option value="Indonesia">Indonesia</option><option value="Ireland">Ireland</option><option value="Israel">Israel</option><option value="Italy">Italy</option><option value="Japan">Japan</option><option value="Jordan">Jordan</option><option value="Kazakhstan">Kazakhstan</option><option value="Kenya">Kenya</option><option value="Kuwait">Kuwait</option><option value="Kyrgyzstan">Kyrgyzstan</option><option value="Lao People's Democratic Republic">Lao People's Democratic Republic</option><option value="Latvia">Latvia</option><option value="Lebanon">Lebanon</option><option value="Lesotho">Lesotho</option><option value="Liberia">Liberia</option><option value="Liechtenstein">Liechtenstein</option><option value="Lithuania">Lithuania</option><option value="Luxembourg">Luxembourg</option><option value="Macedonia">Macedonia</option><option value="Madagascar">Madagascar</option><option value="Malawi">Malawi</option><option value="Malaysia">Malaysia</option><option value="Maldives">Maldives</option><option value="Mali">Mali</option><option value="Malta">Malta</option><option value="Mauritania">Mauritania</option><option value="Mexico">Mexico</option><option value="Moldova">Moldova</option><option value="Monaco">Monaco</option><option value="Mongolia">Mongolia</option><option value="Morocco">Morocco</option><option value="Mozambique">Mozambique</option><option value="Namibia">Namibia</option><option value="Nepal">Nepal</option><option value="Netherlands">Netherlands</option><option value="Netherlands Antilles">Netherlands Antilles</option><option value="New Zealand">New Zealand</option><option value="Nicaragua">Nicaragua</option><option value="Niger">Niger</option><option value="Nigeria">Nigeria</option><option value="Norway">Norway</option><option value="Oman">Oman</option><option value="Pakistan">Pakistan</option><option value="Panama">Panama</option><option value="Paraguay">Paraguay</option><option value="Peru">Peru</option><option value="Philippines">Philippines</option><option value="Poland">Poland</option><option value="Portugal">Portugal</option><option value="Qatar">Qatar</option><option value="Reunion">Reunion</option><option value="Romania">Romania</option><option value="Russia">Russia</option><option value="Rwanda">Rwanda</option><option value="Samoa (Independent)">Samoa (Independent)</option><option value="Saudi Arabia">Saudi Arabia</option><option value="Senegal">Senegal</option><option value="Seychelles">Seychelles</option><option value="Sierra Leone">Sierra Leone</option><option value="Singapore">Singapore</option><option value="Slovakia">Slovakia</option><option value="Slovenia">Slovenia</option><option value="Somalia">Somalia</option><option value="South Africa">South Africa</option><option value="South Korea">South Korea</option><option value="Spain">Spain</option><option value="Sri Lanka">Sri Lanka</option><option value="Suriname">Suriname</option><option value="Swaziland">Swaziland</option><option value="Sweden">Sweden</option><option value="Switzerland">Switzerland</option><option value="Taiwan">Taiwan</option><option value="Tanzania">Tanzania</option><option value="Thailand">Thailand</option><option value="Togo">Togo</option><option value="Tunisia">Tunisia</option><option value="Turkiye">Turkiye</option><option value="Turkmenistan">Turkmenistan</option><option value="Uganda">Uganda</option><option value="Ukraine">Ukraine</option><option value="United Arab Emirates">United Arab Emirates</option><option value="Uruguay">Uruguay</option><option value="USA" selected>USA</option><option value="Uzbekistan">Uzbekistan</option><option value="Vatican City State (Holy See)">Vatican City State (Holy See)</option><option value="Venezuela">Venezuela</option><option value="Vietnam">Vietnam</option><option value="Virgin Islands (British)">Virgin Islands (British)</option><option value="Yemen">Yemen</option><option value="Zambia">Zambia</option><option value="Zimbabwe">Zimbabwe</option><option value="Antigua And Barbuda">Antigua And Barbuda</option><option value="Anguilla">Anguilla</option><option value="American Samoa">American Samoa</option><option value="Aruba">Aruba</option><option value="Brunei Darussalam">Brunei Darussalam</option><option value="Bouvet Island">Bouvet Island</option><option value="Cook Islands">Cook Islands</option><option value="Christmas Island">Christmas Island</option><option value="Dominican Republic">Dominican Republic</option><option value="Western Sahara">Western Sahara</option><option value="Falkland Islands">Falkland Islands</option><option value="Faroe Islands">Faroe Islands</option><option value="Grenada">Grenada</option><option value="French Guiana">French Guiana</option><option value="Gibraltar">Gibraltar</option><option value="Greenland">Greenland</option><option value="Guadeloupe">Guadeloupe</option><option value="Guatemala">Guatemala</option><option value="Haiti">Haiti</option><option value="Jamaica">Jamaica</option><option value="Kiribati">Kiribati</option><option value="Comoros">Comoros</option><option value="Saint Kitts and Nevis">Saint Kitts and Nevis</option><option value="Saint Lucia">Saint Lucia</option><option value="Marshall Islands">Marshall Islands</option><option value="Macau">Macau</option><option value="Martinique">Martinique</option><option value="Mauritius">Mauritius</option><option value="New Caledonia">New Caledonia</option><option value="Norfolk Island">Norfolk Island</option><option value="Nauru">Nauru</option><option value="Niue">Niue</option><option value="Papua New Guinea">Papua New Guinea</option><option value="Pitcairn">Pitcairn</option><option value="Palau">Palau</option><option value="Solomon Islands">Solomon Islands</option><option value="Svalbard and Jan Mayen Islands">Svalbard and Jan Mayen Islands</option><option value="San Marino">San Marino</option><option value="Tonga">Tonga</option><option value="Timor-Leste">Timor-Leste</option><option value="Trinidad and Tobago">Trinidad and Tobago</option><option value="Tuvalu">Tuvalu</option><option value="Saint Vincent and the Grenadines">Saint Vincent and the Grenadines</option><option value="Virgin Islands (U.S.)">Virgin Islands (U.S.)</option><option value="Vanuatu">Vanuatu</option><option value="Mayotte">Mayotte</option><option value="Myanmar">Myanmar</option><option value="Sao Tome and Principe">Sao Tome and Principe</option><option value="South Georgia and the South Sandwich Islands">South Georgia and the South Sandwich Islands</option><option value="Tajikistan">Tajikistan</option><option value="United Kingdom">United Kingdom</option><option value="Costa Rica">Costa Rica</option><option value="Guernsey">Guernsey</option><option value="North Korea">North Korea</option><option value="Afghanistan">Afghanistan</option><option value="Cote D'Ivoire">Cote D'Ivoire</option><option value="Cuba">Cuba</option><option value="French Polynesia">French Polynesia</option><option value="Iran">Iran</option><option value="Iraq">Iraq</option><option value="Libya">Libya</option><option value="Palestine">Palestine</option><option value="Syria">Syria</option><option value="Aaland Islands">Aaland Islands</option><option value="Turks & Caicos Islands">Turks & Caicos Islands</option><option value="Jersey  (Channel Islands)">Jersey  (Channel Islands)</option><option value="Dominica">Dominica</option><option value="Montenegro">Montenegro</option><option value="Sudan">Sudan</option><option value="Montserrat">Montserrat</option><option value="Curacao">Curacao</option><option value="Sint Maarten">Sint Maarten</option><option value="South Sudan">South Sudan</option><option value="Republic of Kosovo">Republic of Kosovo</option><option value="Congo, Democratic Republic of the">Congo, Democratic Republic of the</option><option value="Isle of Man">Isle of Man</option><option value="Saint Martin">Saint Martin</option><option value="Bonaire, Saint Eustatius and Saba">Bonaire, Saint Eustatius and Saba</option><option value="Serbia">Serbia</option></select></div>
        </div>
        <div class="mc-field-group"><label for="mce-PHONE">Phone Number </label><input type="text" name="PHONE" class="REQ_CSS" id="mce-PHONE" value></div>
        <div id="mce-responses" class="clear">
          <div class="response" id="mce-error-response" style="display: none;"></div>
          <div class="response" id="mce-success-response" style="display: none;"></div>
        </div>
        <div aria-hidden="true" style="position: absolute; left: -5000px;"><input type="text" name="b_8430d870f739578cd7ecdd61f_2daa907931" tabindex=-1 value></div>
        <div class="clear"><input type="submit" name="subscribe" id="mc-embedded-subscribe" class="button" value="Subscribe"></div>
      </div>
    </form>
  </div>
</div>
<script type="text/javascript" src="//s3.amazonaws.com/downloads.mailchimp.com/js/mc-validate.js"></script>
<script type="text/javascript">(function($) {window.fnames = new Array(); window.ftypes = new Array();fnames[0]='EMAIL';ftypes[0]='email';fnames[1]='FNAME';ftypes[1]='text';fnames[3]='ADDRESS';ftypes[3]='address';fnames[4]='PHONE';ftypes[4]='phone';fnames[2]='LNAME';ftypes[2]='text';fnames[5]='BIRTHDAY';ftypes[5]='birthday';fnames[6]='COMPANY';ftypes[6]='text';}(jQuery));var $mcj = jQuery.noConflict(true);</script>
`;
function createSubscribeSection(subscribeCfg) {
  const cfg = subscribeCfg || {};
  if (cfg.enabled === false) return null;
  const embedHtml = cfg.embedHtml || (cfg.embedTemplate === 'mailchimp-classic' ? MAILCHIMP_CLASSIC_EMBED : '');

  const section = document.createElement('section');
  section.className = 'landing-subscribe';
  section.style.textAlign = 'center';

  const titleText = cfg.title || 'Get new drops first';
  const descText = cfg.description || cfg.copy || 'Join the email list for updates on fresh releases.';
  const disclaimerText = cfg.disclaimer || 'We send 1–2 thoughtful emails a month. Unsubscribe anytime.';

  const title = document.createElement('h2');
  title.textContent = titleText;
  section.appendChild(title);

  if (descText) {
    const copy = document.createElement('p');
    copy.textContent = descText;
    section.appendChild(copy);
  }

  if (embedHtml) {
    const embedWrap = document.createElement('div');
    embedWrap.className = 'landing-subscribe-embed';
    embedWrap.innerHTML = embedHtml;
    embedWrap.style.width = '100%';
    embedWrap.style.maxWidth = '720px';
    embedWrap.style.margin = '20px auto';
    embedWrap.style.padding = '18px';
    embedWrap.style.background = '#ffffff';
    embedWrap.style.borderRadius = '18px';
    embedWrap.style.boxShadow = '0 14px 40px rgba(0,0,0,0.08)';
    embedWrap.style.boxSizing = 'border-box';
    embedWrap.style.overflow = 'hidden';
    section.appendChild(embedWrap);

    const embedContainer = embedWrap.querySelector('#mc_embed_signup');
    if (embedContainer) {
      embedContainer.style.maxWidth = '100%';
      embedContainer.style.margin = '0 auto';
    }

    const embedForm = embedWrap.querySelector('form');
    if (embedForm) {
      embedForm.addEventListener('submit', () => {
        emitAnalytics('subscribe_submit', {
          form_id: cfg.formId || 'mailchimp_collective',
          location: cfg.analyticsLocation || 'landing_midpage'
        });
      });
    }

    if (disclaimerText) {
      const disclaimer = document.createElement('p');
      disclaimer.className = 'landing-subscribe-disclaimer';
      disclaimer.textContent = disclaimerText;
      section.appendChild(disclaimer);
    }

    return section;
  }

  const formAction = cfg.formAction || 'https://othersoriented.us4.list-manage.com/subscribe/post?u=8430d870f739578cd7ecdd61f&id=2daa907931&f_id=00b576eaf0';
  if (!formAction) return null;

  const form = document.createElement('form');
  form.className = 'landing-subscribe-form';
  form.action = formAction;
  form.method = 'post';
  form.target = '_blank';
  form.setAttribute('novalidate', 'novalidate');

  const field = document.createElement('div');
  field.className = 'landing-subscribe-field';
  const label = document.createElement('label');
  label.setAttribute('for', 'mc-email');
  label.textContent = cfg.emailLabel || 'Email address';
  const input = document.createElement('input');
  input.type = 'email';
  input.name = cfg.emailField || 'EMAIL';
  input.id = 'mc-email';
  input.placeholder = cfg.emailPlaceholder || 'you@example.com';
  input.required = true;
  field.appendChild(label);
  field.appendChild(input);
  form.appendChild(field);

  const hiddenFields = Array.isArray(cfg.hiddenFields) ? cfg.hiddenFields : [
    { name: 'f_id', value: '00b576eaf0' }
  ];
  hiddenFields.forEach(hidden => {
    if (!hidden?.name) return;
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.name = hidden.name;
    if (hidden.value != null) hiddenInput.value = hidden.value;
    form.appendChild(hiddenInput);
  });

  const honeyWrap = document.createElement('div');
  honeyWrap.style.position = 'absolute';
  honeyWrap.style.left = '-5000px';
  honeyWrap.setAttribute('aria-hidden', 'true');
  const honey = document.createElement('input');
  honey.type = 'text';
  honey.name = cfg.honeypotName || 'b_8430d870f739578cd7ecdd61f_2daa907931';
  honey.tabIndex = -1;
  honey.value = '';
  honeyWrap.appendChild(honey);
  form.appendChild(honeyWrap);

  const button = document.createElement('button');
  button.type = 'submit';
  button.textContent = cfg.ctaLabel || 'Subscribe';
  form.appendChild(button);

  form.addEventListener('submit', () => {
    emitAnalytics('subscribe_submit', {
      form_id: cfg.formId || 'mailchimp_collective',
      location: cfg.analyticsLocation || 'landing_midpage'
    });
  });

  section.appendChild(form);

  if (cfg.disclaimer) {
    const disclaimer = document.createElement('p');
    disclaimer.className = 'landing-subscribe-disclaimer';
    disclaimer.innerHTML = cfg.disclaimer;
    section.appendChild(disclaimer);
  }

  return section;
}

function mountLanding(cfg) {
  const app = document.getElementById('app');
  if (!app) return;

  updateHeadMetadata(cfg);
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

  const subscribeSection = createSubscribeSection(cfg.subscribe);

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

  if (subscribeSection) app.appendChild(subscribeSection);

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
      title: "The Great Reunion + Lost Boy Found + SPRINKLD",
      subtitle: "Three original AI-assisted worship projects releasing new songs weekly.",
      avatar: "/assets/bands/tgr/logo.png",
      avatars: ["/assets/bands/tgr/logo.png", "/assets/bands/lbf/logo.png", "/assets/bands/sprinkld/logo.png"],
      tagline: "Trying to redeem AI by spinning up more edifying Christian music | 200+ songs | New every week!",
      cta: {
        id: 'hero_stream_tgr',
        label: 'Stream The Great Reunion',
        href: 'https://open.spotify.com/artist/4AFA0ADp9dugRrRY3RjbIJ',
        icon: 'spotify'
      },
      secondaryCta: {
        id: 'hero_stream_lbf',
        label: 'Stream Lost Boy Found',
        href: 'https://open.spotify.com/artist/5blMhZSDPm29S3kPXQceQc',
        icon: 'spotify'
      },
      extraCtas: [
        {
          id: 'hero_stream_sprinkld',
          label: 'Stream SPRINKLD',
          href: 'https://open.spotify.com/artist/3gshwRvglY4DfiFqppuY0X',
          icon: 'spotify',
          variant: 'secondary'
        }
      ],
      highlights: [
        { value: '200+', label: 'Edifying AI-crafted songs' },
        { value: '3', label: 'Active projects' },
        { value: 'Monthly', label: 'New releases' }
      ]
    },
    flags: [],
    backgroundVideo: {
      src: "/assets/video/background.mp4"
    },
    bands: [
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
        socialProofTitle: 'Stories from the community',
        socialProof: [
          { quote: '"Gentle folk hymns that feel like a fireside prayer meeting."', source: 'KLove small group leader' },
          { quote: '"Perfect for quiet time playlists and reflective moments."', source: 'Shepherds & Saints Blog' }
        ],
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
      },
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
        socialProofTitle: 'What listeners say',
        socialProof: [
          { quote: '"Sounds like Blink-182 found Jesus all over again."', source: 'Youth Pastor Dan' },
          { quote: '"My kids have this on loop during family devos."', source: 'Aubrey, homeschool mom' }
        ],
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
        id: 'sprinkld',
        name: 'SPRINKLD',
        tagline: 'Christian AI EDM / Future Bass',
        description: 'High-energy Christian EDM with future bass drops and Scripture-centered hooks.',
        accent: '#FF5FB7',
        logo: "/assets/bands/sprinkld/logo.png",
        badge: 'New',
        latestRelease: {
          title: "'Tis My Happiness Below",
          subtitle: 'New EP out now.',
          image: "/assets/bands/sprinkld/releases/tis-my-happiness-below.png",
          releaseDate: '2025-11-15'
        },
        sample: {
          title: "Sample: 'Tis My Happiness Below",
          src: '/assets/audio/sprinkld-sample.mp3'
        },
        releaseDate: '2025-11-15',
        socialProofTitle: 'Stories from the community',
        socialProof: [
          { quote: '"This is perfect for working out."', source: 'Julia D.' },
          { quote: '"It helps drive one core truth with super fun energy."', source: 'Jonathan D.' }
        ],
        links: [
          { id: 'spotify', icon: 'spotify', label: 'Spotify', href: 'https://open.spotify.com/artist/3gshwRvglY4DfiFqppuY0X', color: '#1DB954' },
          { id: 'apple', icon: 'apple', label: 'Apple Music (coming soon)', href: '#', color: '#0F0F0F' },
          { id: 'amazon', icon: 'amazon', label: 'Amazon Music', href: 'https://music.amazon.com/artists/B0G2K2XXGL/sprinkld', color: '#00A8E1' },
          { id: 'pandora', icon: 'pandora', label: 'Pandora', href: 'https://www.pandora.com/artist/sprinkld/ARgXpppVwXlrqZ6', color: '#1F7CF0' },
          { id: 'ytm', icon: 'youtubemusic', label: 'YouTube Music', href: 'https://music.youtube.com/channel/UCzCEi0pehN9xS73DNgl-JHg', color: '#FF0000' },
          { id: 'youtube', icon: 'youtube', label: 'YouTube', href: 'https://www.youtube.com/channel/UCqLBHMbLHh1djqo06Xn5ZBQ', color: '#FF0000' }
        ],
        extras: [
          { id: 'instagram', icon: 'instagram', label: 'Instagram (coming soon)', href: '#', color: '#E1306C' },
          { id: 'tiktok', icon: 'tiktok', label: 'TikTok', href: 'https://www.tiktok.com/@sprinkldmusic', color: '#000000' }
        ]
      }
    ],
  subscribe: {
    enabled: true,
    embedTemplate: 'mailchimp-classic',
    analyticsLocation: 'midpage'
  },
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
