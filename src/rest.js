import './rest.css';
import { story } from './rest/story-copy';

document.documentElement.classList.add('has-js');

const STORAGE_KEY = 'edifai-reduce-motion';
const beatsRoot = document.getElementById('beats');
const toggleBtn = document.getElementById('reduce-motion-toggle');
const progressEl = document.querySelector('.progress');
const stageVideo = document.querySelector('.stage-video');

let lenisInstance = null;
let lenisRafId = null;
let scrollCleanup = null;
let revealObserver = null;
let progressFallbackActive = false;

function log(event, data) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('edifai-telemetry', { detail: { event, ...(data || {}) } }));
  if (typeof window.gtag === 'function') {
    window.gtag('event', event, data || {});
  }
}

function createEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

function createCta(label, href, variant, data, options) {
  const a = document.createElement('a');
  a.className = `cta ${variant}`;
  a.href = href;
  a.textContent = label;
  if (options && options.ariaLabel) {
    a.setAttribute('aria-label', options.ariaLabel);
  }
  if (options && options.target) {
    a.target = options.target;
    if (!options.rel && options.target === '_blank') {
      a.rel = 'noopener noreferrer';
    }
  }
  if (options && options.rel) {
    a.rel = options.rel;
  }
  if (data) {
    Object.entries(data).forEach(([key, value]) => {
      a.dataset[key] = value;
    });
  }
  return a;
}

function buildLinesBlock(lines) {
  if (!lines || !lines.length) return null;
  const wrap = createEl('div', 'beat-lines');
  lines.forEach((line) => {
    wrap.appendChild(createEl('p', null, line));
  });
  return wrap;
}

function buildScriptureBlock(scripture) {
  if (!scripture) return null;
  const wrap = createEl('div', 'scripture-block');
  if (scripture.ref) {
    wrap.appendChild(createEl('div', 'scripture-ref', scripture.ref));
  }
  const text = createEl('div', 'scripture-text');
  const lines = Array.isArray(scripture.lines) ? scripture.lines : [];
  lines.forEach((line) => {
    text.appendChild(createEl('p', null, line));
  });
  wrap.appendChild(text);
  return wrap;
}

function appendScriptureBlocks(parent, scriptures) {
  if (!parent || !scriptures) return;
  const list = Array.isArray(scriptures) ? scriptures : [scriptures];
  list.forEach((scripture) => {
    const block = buildScriptureBlock(scripture);
    if (block) parent.appendChild(block);
  });
}

function buildToolLinks(tools) {
  if (!tools || !tools.length) return null;
  const wrap = createEl('div', 'tool-links');
  tools.forEach((tool) => {
    const link = document.createElement('a');
    link.className = 'tool-link';
    link.href = tool.href;
    link.textContent = tool.label;
    if (tool.target) {
      link.target = tool.target;
      link.rel = 'noopener noreferrer';
    }
    wrap.appendChild(link);
  });
  return wrap;
}

function buildHeroBeat() {
  const section = createEl('section', 'beat section-hero');
  section.id = 'hero';
  const inner = createEl('div', 'beat-inner');
  const title = createEl('h1', 'beat-title', story.hero.title);
  const sub = createEl('p', 'beat-sub', story.hero.sub);
  const actions = createEl('div', 'beat-actions');
  const findRest = createCta('Find Rest Now', '#respond', 'cta-primary', { cta: 'find_rest_now' });
  const questions = createCta('I Have Questions', '#faq', 'cta-secondary', { cta: 'questions' });
  const talk = createCta('Talk to Someone', '#safety', 'cta-secondary', { cta: 'talk_to_someone' });
  actions.append(findRest, questions, talk);
  inner.append(title, sub, actions);
  appendScriptureBlocks(inner, story.hero.scripture);
  section.appendChild(inner);
  return section;
}

function buildWeightBeat() {
  const section = createEl('section', 'beat');
  section.id = 'weight';
  const inner = createEl('div', 'beat-inner');
  const title = createEl('h2', 'beat-title', story.weight.title);
  const lines = buildLinesBlock(story.weight.lines);
  if (lines) inner.appendChild(lines);
  appendScriptureBlocks(inner, story.weight.scriptures);
  section.appendChild(inner);
  return section;
}

function buildGospelBeat() {
  const section = createEl('section', 'beat');
  section.id = 'gospel';
  const inner = createEl('div', 'beat-inner');
  const title = createEl('h2', 'beat-title', story.gospel.title);
  const summary = createEl('p', 'beat-sub', story.gospel.summary);
  inner.append(title, summary);
  appendScriptureBlocks(inner, story.gospel.scriptures);
  section.appendChild(inner);
  return section;
}

function buildWhoJesusBeat() {
  const section = createEl('section', 'beat');
  section.id = 'who-jesus';
  const inner = createEl('div', 'beat-inner');
  const title = createEl('h2', 'beat-title', story.whoJesus.title);
  inner.appendChild(title);
  const lines = buildLinesBlock(story.whoJesus.lines);
  if (lines) inner.appendChild(lines);
  appendScriptureBlocks(inner, story.whoJesus.scriptures);
  section.appendChild(inner);
  return section;
}

function buildCrossBeat() {
  const section = createEl('section', 'beat');
  section.id = 'cross';
  const inner = createEl('div', 'beat-inner');
  const title = createEl('h2', 'beat-title', story.cross.title);
  inner.appendChild(title);
  const lines = buildLinesBlock(story.cross.lines);
  if (lines) inner.appendChild(lines);
  appendScriptureBlocks(inner, story.cross.scriptures);
  section.appendChild(inner);
  return section;
}

function buildFreeGiftBeat() {
  const section = createEl('section', 'beat');
  section.id = 'free-gift';
  const inner = createEl('div', 'beat-inner');
  const title = createEl('h2', 'beat-title', story.freeGift.title);
  inner.appendChild(title);
  const lines = buildLinesBlock(story.freeGift.lines);
  if (lines) inner.appendChild(lines);
  appendScriptureBlocks(inner, story.freeGift.scriptures);
  section.appendChild(inner);
  return section;
}

function buildRespondBeat() {
  const section = createEl('section', 'beat');
  section.id = 'respond';
  const inner = createEl('div', 'beat-inner');
  const title = createEl('h2', 'beat-title', story.respond.title);
  const sub = createEl('p', 'beat-sub', story.respond.sub);
  const steps = createEl('ol', 'step-list');
  story.respond.steps.forEach((step) => {
    steps.appendChild(createEl('li', null, step));
  });
  const prayerTitle = createEl('div', 'prayer-title', story.respond.prayerTitle);
  const prayer = createEl('p', 'prayer', story.respond.prayer);
  const actions = createEl('div', 'beat-actions');
  const prayed = createCta('I Just Prayed This', '/onboarding?from=rest', 'cta-warm', { transition: 'true' });
  const learn = createCta(
    'Not Ready (Learn More)',
    story.credits.href,
    'cta-secondary',
    { cta: 'learn_more' },
    { target: '_blank', rel: 'noopener noreferrer' }
  );
  actions.append(prayed, learn);
  inner.append(title, sub, steps, prayerTitle, prayer);
  appendScriptureBlocks(inner, story.respond.scriptures);
  inner.appendChild(actions);
  section.appendChild(inner);
  return section;
}

function buildWhatChangesBeat() {
  const section = createEl('section', 'beat');
  section.id = 'what-changes';
  const inner = createEl('div', 'beat-inner');
  const title = createEl('h2', 'beat-title', story.whatChanges.title);
  inner.appendChild(title);
  const lines = buildLinesBlock(story.whatChanges.lines);
  if (lines) inner.appendChild(lines);
  appendScriptureBlocks(inner, story.whatChanges.scripture);
  section.appendChild(inner);
  return section;
}

function buildFirstStepsBeat() {
  const section = createEl('section', 'beat');
  section.id = 'first-steps';
  const inner = createEl('div', 'beat-inner');
  const title = createEl('h2', 'beat-title', story.firstSteps.title);
  const list = createEl('ul', 'step-list');
  list.id = 'mark-plan';
  story.firstSteps.days.forEach((step) => {
    list.appendChild(createEl('li', null, step));
  });
  inner.append(title, list);
  if (story.firstSteps.toolsTitle) {
    inner.appendChild(createEl('h3', 'beat-subtitle', story.firstSteps.toolsTitle));
  }
  const tools = buildToolLinks(story.firstSteps.tools);
  if (tools) inner.appendChild(tools);
  if (story.firstSteps.memoryCard) {
    const memory = createEl('div', 'memory-card');
    memory.id = 'memory-card';
    memory.appendChild(createEl('div', 'memory-title', story.firstSteps.memoryCard.title));
    const memoryLines = createEl('div', 'memory-text');
    story.firstSteps.memoryCard.lines.forEach((line) => {
      memoryLines.appendChild(createEl('p', null, line));
    });
    memory.appendChild(memoryLines);
    inner.appendChild(memory);
  }
  section.appendChild(inner);
  return section;
}

function buildFaqBeat() {
  const section = createEl('section', 'beat');
  section.id = 'faq';
  const inner = createEl('div', 'beat-inner');
  const title = createEl('h2', 'beat-title', story.faq.title);
  const list = createEl('dl', 'faq-list');
  story.faq.items.forEach((item) => {
    const dt = createEl('dt', null, item.q);
    const dd = createEl('dd', null, '');
    const answer = createEl('p', 'faq-answer', item.a);
    dd.appendChild(answer);
    if (item.ref) {
      dd.appendChild(createEl('div', 'faq-ref', item.ref));
    }
    list.append(dt, dd);
  });
  inner.append(title, list);
  section.appendChild(inner);
  return section;
}

function buildSafetyBeat() {
  const section = createEl('section', 'beat');
  section.id = 'safety';
  const inner = createEl('div', 'beat-inner');
  const title = createEl('h2', 'beat-title', story.safety.title);
  inner.appendChild(title);
  const lines = buildLinesBlock(story.safety.lines);
  if (lines) inner.appendChild(lines);
  const actions = createEl('div', 'beat-actions');
  const mentor = createCta('Message a Mentor', '/onboarding?from=rest&intent=mentor', 'cta-secondary', { cta: 'mentor' });
  const church = createCta('Find a Church', '#first-steps', 'cta-secondary', { cta: 'find_church' });
  actions.append(mentor, church);
  inner.appendChild(actions);
  if (story.safety.crisis && story.safety.crisis.text) {
    const crisis = createEl('p', 'safety-crisis', '');
    if (story.safety.crisis.phone) {
      const parts = story.safety.crisis.text.split(story.safety.crisis.phone);
      crisis.appendChild(document.createTextNode(parts[0]));
      const phoneLink = document.createElement('a');
      phoneLink.href = `tel:${story.safety.crisis.phone}`;
      phoneLink.textContent = story.safety.crisis.phone;
      phoneLink.className = 'safety-phone';
      crisis.appendChild(phoneLink);
      crisis.appendChild(document.createTextNode(parts.slice(1).join(story.safety.crisis.phone)));
    } else {
      crisis.textContent = story.safety.crisis.text;
    }
    inner.appendChild(crisis);
  }
  if (story.footer) {
    const footer = createEl('div', 'rest-footer');
    footer.appendChild(createEl('div', 'rest-footer-ref', story.footer.ref));
    const footerText = createEl('div', 'rest-footer-text');
    story.footer.lines.forEach((line) => {
      footerText.appendChild(createEl('p', null, line));
    });
    footer.appendChild(footerText);
    inner.appendChild(footer);
  }
  if (story.credits) {
    const credit = createEl('p', 'rest-credit', '');
    const link = document.createElement('a');
    link.href = story.credits.href;
    link.textContent = story.credits.label;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    credit.appendChild(link);
    inner.appendChild(credit);
  }
  section.appendChild(inner);
  return section;
}

function buildBeats() {
  if (!beatsRoot) return;
  beatsRoot.append(
    buildHeroBeat(),
    buildWeightBeat(),
    buildGospelBeat(),
    buildWhoJesusBeat(),
    buildCrossBeat(),
    buildFreeGiftBeat(),
    buildRespondBeat(),
    buildWhatChangesBeat(),
    buildFirstStepsBeat(),
    buildFaqBeat(),
    buildSafetyBeat()
  );
}

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getStoredMotionPreference() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored == null) return null;
    return stored === 'true';
  } catch {
    return null;
  }
}

function setReducedMotion(enabled) {
  document.documentElement.classList.toggle('reduce-motion', enabled);
  if (toggleBtn) {
    toggleBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    toggleBtn.dataset.active = enabled ? 'true' : 'false';
    toggleBtn.textContent = enabled ? 'Motion Reduced' : 'Reduce Motion';
  }
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {}
  if (stageVideo) {
    if (enabled) {
      stageVideo.pause();
    } else {
      stageVideo.play().catch(() => {});
    }
  }
  if (enabled) {
    teardownMotion();
  } else {
    initMotion();
  }
  setupProgressFallback();
  setupRevealObserver();
}

function initMotionPreference() {
  const stored = getStoredMotionPreference();
  const shouldReduce = stored == null ? prefersReducedMotion() : stored;
  setReducedMotion(shouldReduce);
}

function setupReduceMotionToggle() {
  if (!toggleBtn) return;
  toggleBtn.addEventListener('click', () => {
    const next = !document.documentElement.classList.contains('reduce-motion');
    setReducedMotion(next);
  });
}

async function initLenis() {
  if (lenisInstance) return;
  const mod = await import('@studio-freight/lenis');
  const Lenis = mod.default || mod;
  lenisInstance = new Lenis({
    smoothWheel: true,
    lerp: 0.08,
    wheelMultiplier: 1.05,
  });
  const raf = (time) => {
    if (!lenisInstance) return;
    lenisInstance.raf(time);
    lenisRafId = requestAnimationFrame(raf);
  };
  lenisRafId = requestAnimationFrame(raf);
}

function destroyLenis() {
  if (lenisInstance) {
    lenisInstance.destroy();
    lenisInstance = null;
  }
  if (lenisRafId) {
    cancelAnimationFrame(lenisRafId);
    lenisRafId = null;
  }
}

async function initScrollEffects() {
  const gsapModule = await import('gsap');
  const stModule = await import('gsap/ScrollTrigger');
  const gsap = gsapModule.gsap || gsapModule.default || gsapModule;
  const ScrollTrigger = stModule.ScrollTrigger || stModule.default || stModule;
  if (!gsap || !ScrollTrigger) return () => {};
  gsap.registerPlugin(ScrollTrigger);

  const stagePin = ScrollTrigger.create({
    trigger: '.story',
    start: 'top top',
    end: 'bottom bottom',
    pin: '.stage',
    pinSpacing: false,
  });

  const heroTl = gsap.timeline({
    scrollTrigger: {
      trigger: '.section-hero',
      start: 'top 70%',
      end: 'bottom 40%',
      scrub: true,
    },
  });
  heroTl.fromTo('.section-hero .beat-title', { opacity: 0.7, scale: 0.98 }, { opacity: 1, scale: 1, ease: 'none' }, 0);
  heroTl.fromTo('.section-hero .beat-sub', { opacity: 0.6, y: 12 }, { opacity: 1, y: 0, ease: 'none' }, 0);

  return () => {
    heroTl.kill();
    stagePin.kill();
    ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
  };
}

async function initMotion() {
  if (document.documentElement.classList.contains('reduce-motion')) return;
  try {
    await initLenis();
  } catch {}
  try {
    scrollCleanup = await initScrollEffects();
  } catch {}
}

function teardownMotion() {
  destroyLenis();
  if (scrollCleanup) {
    scrollCleanup();
    scrollCleanup = null;
  }
}

function supportsScrollTimeline() {
  return typeof CSS !== 'undefined' && CSS.supports && CSS.supports('animation-timeline: scroll()');
}

function updateProgress() {
  if (!progressEl) return;
  const doc = document.documentElement;
  const max = doc.scrollHeight - window.innerHeight;
  const pct = max > 0 ? Math.min(Math.max(doc.scrollTop / max, 0), 1) : 0;
  progressEl.style.transform = `scaleX(${pct})`;
}

function setupProgressFallback() {
  const shouldFallback = !supportsScrollTimeline() || document.documentElement.classList.contains('reduce-motion');
  if (shouldFallback && !progressFallbackActive) {
    progressFallbackActive = true;
    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress);
    updateProgress();
  } else if (!shouldFallback && progressFallbackActive) {
    progressFallbackActive = false;
    window.removeEventListener('scroll', updateProgress);
    window.removeEventListener('resize', updateProgress);
    if (progressEl) progressEl.style.transform = '';
  }
}

function setupRevealObserver() {
  const items = document.querySelectorAll('.beat-inner');
  if (!items.length) return;
  if (document.documentElement.classList.contains('reduce-motion')) {
    items.forEach((item) => item.classList.add('is-visible'));
    if (revealObserver) revealObserver.disconnect();
    revealObserver = null;
    return;
  }
  if (!('IntersectionObserver' in window)) {
    items.forEach((item) => item.classList.add('is-visible'));
    return;
  }
  if (revealObserver) revealObserver.disconnect();
  revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.45 }
  );
  items.forEach((item, idx) => {
    item.style.transitionDelay = `${Math.min(idx * 80, 240)}ms`;
    revealObserver.observe(item);
  });
}

function setupViewTransitions() {
  document.querySelectorAll('[data-transition="true"]').forEach((el) => {
    el.addEventListener('click', (event) => {
      event.preventDefault();
      const href = el.getAttribute('href');
      if (!href) return;
      log('prayer_confirmed');
      if (document.startViewTransition) {
        document.startViewTransition(() => {
          window.location.assign(href);
        });
      } else {
        window.location.assign(href);
      }
    });
  });
}

function setupAnalytics() {
  const handlers = [
    {
      selector: '[data-cta="find_rest_now"]',
      handler: () => {
        log('hero_cta_click', { cta: 'find_rest_now' });
        log('prayer_intent');
      },
    },
    {
      selector: '[data-cta="questions"]',
      handler: () => log('mentor_request'),
    },
    {
      selector: '[data-cta="talk_to_someone"]',
      handler: () => log('mentor_request'),
    },
    {
      selector: '[data-cta="learn_more"]',
      handler: () => log('hero_cta_click', { cta: 'learn_more' }),
    },
    {
      selector: '[data-cta="mentor"]',
      handler: () => log('mentor_request'),
    },
  ];

  handlers.forEach(({ selector, handler }) => {
    const el = document.querySelector(selector);
    if (el) {
      el.addEventListener('click', handler);
    }
  });
}

function init() {
  buildBeats();
  initMotionPreference();
  setupReduceMotionToggle();
  setupProgressFallback();
  setupRevealObserver();
  setupViewTransitions();
  setupAnalytics();
}

init();
