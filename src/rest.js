import { story } from './rest/story-copy';

document.documentElement.classList.add('has-js');

const STORAGE_KEY = 'edifai-reduce-motion';
const progressEl = document.querySelector('.progress');
const reduceToggle = document.getElementById('reduce-motion-toggle');
const heroVideo = document.querySelector('.rest-hero-video');
const mobileNavToggle = document.getElementById('mobile-nav-toggle');
const mobileNavMenu = document.querySelector('.mobile-nav_menu__vhaHB');
const mobileNavPill = document.querySelector('.mobile-nav_pill__nXFj5');

const state = {
  reduceMotion: false,
  lenis: null,
  lenisRaf: null,
};

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

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function renderScripture(container, scripture) {
  if (!container || !scripture) return;
  container.innerHTML = '';
  if (scripture.ref) {
    container.appendChild(createEl('div', 'rest-scripture-ref', scripture.ref));
  }
  const textWrap = createEl('div', 'rest-scripture-text');
  (scripture.lines || []).forEach((line) => {
    textWrap.appendChild(createEl('p', null, line));
  });
  container.appendChild(textWrap);
}

function renderScriptureList(container, scriptures) {
  if (!container || !scriptures) return;
  container.innerHTML = '';
  const list = Array.isArray(scriptures) ? scriptures : [scriptures];
  list.forEach((scripture) => {
    const block = createEl('div', 'rest-scripture');
    renderScripture(block, scripture);
    container.appendChild(block);
  });
}

function splitWords(container, text) {
  if (!container || !text) return;
  container.innerHTML = '';
  const lines = text.split('|');
  lines.forEach((line, lineIndex) => {
    const lineWrap = createEl('span', 'dga_text_line__Z7pRO');
    const words = line.trim().split(/\s+/).filter(Boolean);
    words.forEach((word, index) => {
      const outer = document.createElement('span');
      const inner = createEl('span', 'dga_line_dimmed__BUp_B', word);
      outer.appendChild(inner);
      lineWrap.appendChild(outer);
      if (index < words.length - 1) {
        lineWrap.appendChild(document.createTextNode(' '));
      }
    });
    container.appendChild(lineWrap);
    if (lineIndex < lines.length - 1) {
      container.appendChild(document.createElement('br'));
    }
  });
}

function splitChars(container, text) {
  if (!container || !text) return;
  container.innerHTML = '';
  const lines = text.split('|');
  lines.forEach((line) => {
    const lineWrap = createEl('div', 'dga_disintegrating_line__DqX41');
    const words = line.trim().split(/\s+/).filter(Boolean);
    words.forEach((word, wordIndex) => {
      const wordWrap = document.createElement('span');
      wordWrap.style.display = 'inline-flex';
      [...word].forEach((char) => {
        const charSpan = createEl('span', 'dga_disintegrating_char__Uawaf', char);
        wordWrap.appendChild(charSpan);
      });
      lineWrap.appendChild(wordWrap);
      if (wordIndex < words.length - 1) {
        lineWrap.appendChild(document.createTextNode(' '));
      }
    });
    container.appendChild(lineWrap);
  });
}

function renderHero() {
  setText('hero-title', story.hero.title);
  setText('hero-sub', story.hero.sub);
  renderScripture(document.getElementById('hero-scripture'), story.hero.scripture);
}

function renderSoh() {
  const sticky = document.getElementById('soh-sticky');
  const sentinels = document.getElementById('soh-sentinels');
  const scriptures = document.getElementById('soh-scriptures');
  if (!sticky || !sentinels) return;

  const lines = [story.weight.title, ...story.weight.lines];
  lines.forEach((line, index) => {
    const wrap = createEl('div', 'dga_soh_content_text__FzD8r rest-soh-item');
    wrap.dataset.index = String(index);
    const text = createEl('div', 'dga_text__nmeK_');
    const heading = createEl('h3', index === 0 ? 'dga_soh_title__16573' : null, line);
    text.appendChild(heading);
    wrap.appendChild(text);
    if (index === 0) wrap.classList.add('is-active');
    sticky.appendChild(wrap);

    const sentinel = createEl('div', 'dga_soh_content__Gla00 rest-soh-sentinel');
    sentinel.dataset.index = String(index);
    sentinels.appendChild(sentinel);
  });

  renderScriptureList(scriptures, story.weight.scriptures);

  const percentages = document.getElementById('soh-percentages');
  if (percentages) {
    const values = [100, 0, 100];
    const colors = ['var(--red2)', 'var(--red3)', 'var(--red4)'];
    values.forEach((value, index) => {
      const wrap = createEl('div', 'dga_percentage__fxOGZ rest-percentage');
      wrap.dataset.index = String(index);
      const bg = createEl('div', 'dga_percentage_background__NyYly');
      const fill = createEl('div', 'dga_bg_percentage__kb8j2');
      fill.style.backgroundColor = colors[index % colors.length];
      const valueWrap = createEl('span');
      valueWrap.appendChild(createEl('span', null, String(value)));
      valueWrap.appendChild(createEl('span', 'font-regular', '%'));
      bg.appendChild(fill);
      bg.appendChild(valueWrap);
      wrap.appendChild(bg);
      if (index === 0) wrap.classList.add('is-active');
      percentages.appendChild(wrap);
    });
  }
}

function renderLineInSand() {
  const brokenCaption = document.getElementById('broken-caption');
  if (brokenCaption) brokenCaption.textContent = 'The Gospel';
  splitWords(document.getElementById('broken-text'), story.gospel.summary);
  splitChars(document.getElementById('solvable-text'), story.solvable.title);
  splitWords(document.getElementById('solution-line'), story.solvable.line);
  renderScripture(document.getElementById('gospel-scripture'), story.gospel.scriptures[0]);
}

function renderPyramid() {
  setText('pyramid-kicker', 'Introducing');
  setText('pyramid-title', 'The Gospel');
  setText('pyramid-center', 'Jesus Gives Rest');

  const tooltipPositions = ['6%', '40%', '72%'];
  const tooltipWrap = document.getElementById('pyramid-tooltips');
  const iconWrap = document.getElementById('pyramid-icons');
  const contentWrap = document.getElementById('pyramid-content');
  if (!tooltipWrap || !iconWrap || !contentWrap) return;

  const iconMap = {
    cross: '/assets/rest/cross.svg',
    tomb: '/assets/rest/tomb.svg',
    gift: '/assets/rest/gift.svg',
  };

  const iconPositions = [
    { top: '22%', left: '42%', width: '12%', height: '12%' },
    { top: '44%', left: '26%', width: '12%', height: '12%' },
    { top: '64%', left: '52%', width: '12%', height: '12%' },
  ];

  const foodsInner = createEl('div', 'dga_foods_inner__8Km6e');
  iconWrap.appendChild(foodsInner);

  story.pyramid.forEach((item, index) => {
    const tooltip = createEl('div', 'dga_pyramid_tooltip__M0CoS rest-pyramid-tooltip');
    tooltip.style.top = tooltipPositions[index] || '10%';
    tooltip.dataset.index = String(index);
    tooltip.dataset.key = item.key;
    const tooltipContent = createEl('div', 'dga_pyramid_tooltip_content__aazCN');
    tooltipContent.appendChild(createEl('span', 'dga_pyramid_tooltip_title__Gllnx', item.title));
    tooltip.appendChild(tooltipContent);
    tooltipWrap.appendChild(tooltip);

    const icon = createEl('div', 'dga_food__suy27 rest-pyramid-icon');
    icon.dataset.index = String(index);
    icon.dataset.key = item.key;
    const pos = iconPositions[index] || { top: '30%', left: '40%', width: '12%', height: '12%' };
    icon.style.top = pos.top;
    icon.style.left = pos.left;
    icon.style.width = pos.width;
    icon.style.height = pos.height;
    const img = document.createElement('img');
    img.alt = item.title;
    img.src = iconMap[item.key];
    icon.appendChild(img);
    foodsInner.appendChild(icon);

    const content = createEl('div', 'dga_food_content__JdGdZ rest-pyramid-content');
    content.dataset.index = String(index);
    content.dataset.category = item.key;
    const container = createEl('div', 'dga_container__KeUzb');
    const contentInner = createEl('div', 'dga_content__dDbEa');
    contentInner.appendChild(createEl('h2', null, item.title));
    const body = createEl('p', null, item.body);
    contentInner.appendChild(body);
    contentInner.appendChild(createEl('p', 'rest-pyramid-scripture', item.scripture));
    container.appendChild(contentInner);
    content.appendChild(container);
    if (index === 0) content.classList.add('is-active');
    contentWrap.appendChild(content);
  });

  const sentinelWrap = createEl('div', 'rest-pyramid-sentinels');
  story.pyramid.forEach((item, index) => {
    const sentinel = createEl('div', 'rest-pyramid-sentinel');
    sentinel.dataset.index = String(index);
    sentinelWrap.appendChild(sentinel);
  });
  contentWrap.appendChild(sentinelWrap);
}

function renderRespond() {
  splitWords(document.getElementById('respond-line'), story.respond.sub);
  const respond = document.getElementById('respond-content');
  if (!respond) return;
  respond.innerHTML = '';

  respond.appendChild(createEl('h3', 'rest-respond-title', story.respond.title));
  respond.appendChild(createEl('p', 'rest-respond-sub', story.respond.sub));

  const steps = document.createElement('ol');
  steps.className = 'rest-respond-steps';
  story.respond.steps.forEach((step) => {
    steps.appendChild(createEl('li', null, step));
  });
  respond.appendChild(steps);

  respond.appendChild(createEl('div', 'rest-respond-prayer-title', story.respond.prayerTitle));
  respond.appendChild(createEl('p', 'rest-respond-prayer', story.respond.prayer));

  const scriptureWrap = createEl('div', 'rest-respond-scriptures');
  renderScriptureList(scriptureWrap, story.respond.scriptures);
  respond.appendChild(scriptureWrap);

  const actions = createEl('div', 'rest-respond-actions');
  const prayed = createEl('a', 'rest-cta rest-cta-primary', 'I Just Prayed This');
  prayed.href = '/onboarding?from=rest';
  prayed.dataset.cta = 'prayed_this';
  actions.appendChild(prayed);

  const notReady = createEl('a', 'rest-cta rest-cta-secondary', 'Not Ready (Learn More)');
  notReady.href = story.credits.href;
  notReady.target = '_blank';
  notReady.rel = 'noopener noreferrer';
  notReady.dataset.cta = 'not_ready';
  actions.appendChild(notReady);

  respond.appendChild(actions);
}

function renderFaq() {
  const faqList = document.getElementById('faq-list');
  if (!faqList) return;
  faqList.innerHTML = '';

  story.faq.items.forEach((item, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.open = 'false';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', `faq-answer-${index}`);

    const wrap = createEl('div', 'dga_faq_item__Z3Y2h');
    wrap.appendChild(createEl('h3', 'h5', item.q));

    const answer = createEl('p');
    answer.id = `faq-answer-${index}`;
    answer.setAttribute('role', 'region');
    answer.setAttribute('aria-hidden', 'true');
    const answerText = createEl('span');
    answerText.textContent = `${item.a} ${item.ref}`;
    answer.appendChild(answerText);
    wrap.appendChild(answer);

    const icon = createEl('div', 'dga_faq_icon__w3nvV');
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = `
      <div class="dga_icon_open__6_XiM">
        <svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor" style="position:relative;min-height:14px;min-width:14px;top:0">
          <path fill="currentColor" d="m6.721 9.242 3.24-3.24 1.018 1.02L6 12 1.021 7.021 2.04 6.002l3.24 3.24V0h1.442z" xmlns="http://www.w3.org/2000/svg"></path>
        </svg>
      </div>
      <div class="dga_icon_cross__Cl2HA">
        <svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor" style="position:relative;min-height:14px;min-width:14px;top:0">
          <path fill="currentColor" d="m7.03 6 3.342 3.342-1.03 1.03-3.341-3.343-3.343 3.343-1.03-1.03L4.973 6 1.629 2.657l1.029-1.029L6 4.971 9.343 1.63l1.029 1.029z" xmlns="http://www.w3.org/2000/svg"></path>
        </svg>
      </div>
    `;

    button.appendChild(wrap);
    button.appendChild(icon);
    faqList.appendChild(button);

    button.addEventListener('click', () => {
      const isOpen = button.dataset.open === 'true';
      button.dataset.open = String(!isOpen);
      button.setAttribute('aria-expanded', String(!isOpen));
      answer.setAttribute('aria-hidden', String(isOpen));
      button.classList.toggle('is-open', !isOpen);
    });
  });
}

function renderResources() {
  const summary = document.getElementById('resources-summary');
  if (summary) {
    summary.textContent = story.whatChanges.lines.join(' ');
  }

  const cards = document.getElementById('resource-cards');
  if (cards) {
    const resources = [
      { href: '#mark-plan', src: '/assets/rest/card-plan.svg', label: 'Reading plan' },
      { href: '#memory-card', src: '/assets/rest/card-memory.svg', label: 'Memory card' },
      { href: '#tools', src: '/assets/rest/card-playlist.svg', label: 'Playlists' },
    ];

    resources.forEach((resource, index) => {
      const link = document.createElement('a');
      link.href = resource.href;
      link.className = 'dga_doc__hDXIn rest-resource-card';
      link.style.zIndex = String(index);
      link.style.transform = `translateY(${600 + index * 100}px)`;
      const img = document.createElement('img');
      img.alt = resource.label;
      img.className = 'dga_doc_cover__DWPPS';
      img.src = resource.src;
      link.appendChild(img);
      cards.appendChild(link);
    });
  }

  const steps = document.getElementById('first-steps');
  if (steps) {
    const title = createEl('h3', 'rest-steps-title', story.firstSteps.title);
    const list = document.createElement('ol');
    list.className = 'rest-steps-list';
    story.firstSteps.days.forEach((day) => {
      list.appendChild(createEl('li', null, day));
    });

    const toolsTitle = createEl('div', 'rest-tools-title', story.firstSteps.toolsTitle);
    const tools = createEl('div', 'rest-tools');
    story.firstSteps.tools.forEach((tool, index) => {
      const link = document.createElement('a');
      link.className = 'dga_doc_link__aP1in rest-tool-link';
      link.href = tool.href;
      link.textContent = tool.label;
      if (index === 0) link.id = 'mark-plan';
      if (index === 1) link.id = 'memory-card';
      if (tool.target) {
        link.target = tool.target;
        link.rel = 'noopener noreferrer';
      }
      tools.appendChild(link);
    });
    tools.id = 'tools';

    const memory = createEl('div', 'rest-memory-card');
    memory.appendChild(createEl('div', 'rest-memory-title', story.firstSteps.memoryCard.title));
    story.firstSteps.memoryCard.lines.forEach((line) => {
      memory.appendChild(createEl('p', null, line));
    });

    steps.appendChild(title);
    steps.appendChild(list);
    steps.appendChild(toolsTitle);
    steps.appendChild(tools);
    steps.appendChild(memory);
  }
}

function renderFooter() {
  const verse = document.getElementById('footer-verse');
  if (verse) {
    verse.textContent = `${story.footer.ref} ${story.footer.lines.join(' ')}`;
  }

  const cards = document.getElementById('footer-cards');
  if (cards) {
    const items = [
      { src: '/assets/rest/cross.svg', label: 'The Cross' },
      { src: '/assets/rest/tomb.svg', label: 'The Empty Tomb' },
      { src: '/assets/rest/bible.svg', label: 'The Word' },
    ];
    items.forEach((item, index) => {
      const card = createEl('div', 'dga_card__W4f_X rest-footer-card');
      card.style.zIndex = String(index + 1);
      const img = document.createElement('img');
      img.alt = item.label;
      img.src = item.src;
      card.appendChild(img);
      cards.appendChild(card);
    });
  }
}

function setSohActive(index) {
  const items = Array.from(document.querySelectorAll('.rest-soh-item'));
  items.forEach((item) => {
    item.classList.toggle('is-active', Number(item.dataset.index) === index);
  });
  const percents = Array.from(document.querySelectorAll('.rest-percentage'));
  const percentIndex = index % (percents.length || 1);
  percents.forEach((item, idx) => {
    item.classList.toggle('is-active', idx === percentIndex);
  });
}

function initSohObserver() {
  const sentinels = Array.from(document.querySelectorAll('.rest-soh-sentinel'));
  if (!sentinels.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const index = Number(entry.target.dataset.index || 0);
        setSohActive(index);
      }
    });
  }, { threshold: 0.6 });

  sentinels.forEach((sentinel) => observer.observe(sentinel));
}

function setPyramidActive(index) {
  const contents = Array.from(document.querySelectorAll('.rest-pyramid-content'));
  contents.forEach((content) => {
    content.classList.toggle('is-active', Number(content.dataset.index) === index);
  });
  const tooltips = Array.from(document.querySelectorAll('.rest-pyramid-tooltip'));
  tooltips.forEach((tooltip) => {
    tooltip.classList.toggle('is-active', Number(tooltip.dataset.index) === index);
  });
  const icons = Array.from(document.querySelectorAll('.rest-pyramid-icon'));
  icons.forEach((icon) => {
    icon.classList.toggle('is-active', Number(icon.dataset.index) === index);
  });
}

function initPyramidObserver() {
  const sentinels = Array.from(document.querySelectorAll('.rest-pyramid-sentinel'));
  if (!sentinels.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const index = Number(entry.target.dataset.index || 0);
        setPyramidActive(index);
      }
    });
  }, { threshold: 0.6 });

  sentinels.forEach((sentinel) => observer.observe(sentinel));
}

function initPyramidClicks() {
  const targets = document.querySelectorAll('.rest-pyramid-tooltip, .rest-pyramid-icon');
  targets.forEach((target) => {
    target.addEventListener('click', () => {
      const index = Number(target.dataset.index || 0);
      setPyramidActive(index);
    });
  });
}

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (state.lenis) {
    state.lenis.scrollTo(el, { offset: -20 });
  } else {
    el.scrollIntoView({ behavior: state.reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }
}

function initNav() {
  const navButtons = document.querySelectorAll('[data-nav-target]');
  navButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.navTarget;
      if (target) {
        scrollToSection(target);
      }
      if (mobileNavMenu && !mobileNavMenu.hasAttribute('hidden')) {
        mobileNavMenu.setAttribute('hidden', '');
        mobileNavToggle?.setAttribute('aria-expanded', 'false');
        mobileNavPill?.classList.remove('mobile-nav_open__6130C');
      }
    });
  });

  const sections = ['intro', 'problem', 'solution', 'pyramid', 'respond', 'faqs'];
  const observers = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const id = entry.target.id;
      const active = document.querySelectorAll(`[data-nav-target="${id}"]`);
      document.querySelectorAll('.nav_dot_button__kZB4V').forEach((btn) => btn.classList.remove('is-active'));
      active.forEach((btn) => btn.classList.add('is-active'));
    });
  }, { threshold: 0.6 });

  sections.forEach((id) => {
    const section = document.getElementById(id);
    if (section) observers.observe(section);
  });

  if (mobileNavToggle && mobileNavMenu) {
    mobileNavToggle.addEventListener('click', () => {
      const isOpen = !mobileNavMenu.hasAttribute('hidden');
      if (isOpen) {
        mobileNavMenu.setAttribute('hidden', '');
      } else {
        mobileNavMenu.removeAttribute('hidden');
      }
      mobileNavToggle.setAttribute('aria-expanded', String(!isOpen));
      mobileNavPill?.classList.toggle('mobile-nav_open__6130C', !isOpen);
    });
  }
}

function initHeroVideo() {
  if (!heroVideo) return;
  heroVideo.addEventListener('click', () => {
    scrollToSection('respond');
  });
}

function initIntroOverlay() {
  const overlay = document.querySelector('.intro-animation_overlay___QI3A');
  if (!overlay) return;
  const delay = state.reduceMotion ? 200 : 1200;
  window.setTimeout(() => {
    overlay.classList.add('rest-intro-hide');
  }, delay);
}

function initProgressFallback() {
  if (!progressEl) return;
  const supportsTimeline = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('animation-timeline: scroll()');
  if (supportsTimeline) return;
  const update = () => {
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    const ratio = max > 0 ? doc.scrollTop / max : 0;
    progressEl.style.transform = `scaleX(${ratio})`;
  };
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
}

function setReduceMotion(value, persist) {
  state.reduceMotion = value;
  document.documentElement.classList.toggle('reduce-motion', value);
  if (reduceToggle) {
    reduceToggle.setAttribute('aria-pressed', String(value));
    reduceToggle.dataset.active = value ? 'true' : 'false';
  }
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
    } catch (err) {
      // ignore storage issues
    }
  }
  if (value) {
    destroyLenis();
  } else {
    initLenis();
  }
}

function initReduceMotion() {
  let stored = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    stored = null;
  }
  const prefers = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const initial = stored === null ? (prefers ? prefers.matches : false) : stored === '1';
  setReduceMotion(initial, false);

  if (reduceToggle) {
    reduceToggle.addEventListener('click', () => setReduceMotion(!state.reduceMotion, true));
  }

  if (prefers && stored === null) {
    prefers.addEventListener('change', (event) => setReduceMotion(event.matches, false));
  }
}

function destroyLenis() {
  if (!state.lenis) return;
  if (state.lenisRaf) {
    cancelAnimationFrame(state.lenisRaf);
    state.lenisRaf = null;
  }
  state.lenis.destroy();
  state.lenis = null;
}

async function initLenis() {
  if (state.reduceMotion || state.lenis) return;
  try {
    const mod = await import('@studio-freight/lenis');
    const Lenis = mod.default || mod;
    const lenis = new Lenis({
      smooth: true,
      lerp: 0.1,
      wheelMultiplier: 1.0,
    });
    state.lenis = lenis;
    const raf = (time) => {
      lenis.raf(time);
      state.lenisRaf = requestAnimationFrame(raf);
    };
    state.lenisRaf = requestAnimationFrame(raf);
  } catch (err) {
    // Lenis is optional; continue without smooth scrolling.
  }
}

function bindCtas() {
  const ctas = document.querySelectorAll('[data-cta]');
  ctas.forEach((cta) => {
    cta.addEventListener('click', (event) => {
      const key = cta.dataset.cta;
      if (key === 'find_rest_now') {
        log('hero_cta_click', { cta: 'find_rest_now' });
        log('prayer_intent');
      }
      if (key === 'questions') {
        log('hero_cta_click', { cta: 'questions' });
      }
      if (key === 'talk_to_someone') {
        log('mentor_request');
      }
      if (key === 'prayed_this') {
        event.preventDefault();
        log('prayer_confirmed');
        navigateWithTransition(cta.getAttribute('href'));
      }
      if (key === 'not_ready') {
        log('prayer_intent');
      }
    });
  });

  const mentorLinks = document.querySelectorAll('a[href*="intent=mentor"]');
  mentorLinks.forEach((link) => {
    link.addEventListener('click', () => log('mentor_request'));
  });
}

function navigateWithTransition(href) {
  if (!href) return;
  // @ts-ignore - experimental
  if (document.startViewTransition) {
    // @ts-ignore
    document.startViewTransition(() => {
      window.location.assign(href);
    });
  } else {
    window.location.assign(href);
  }
}

async function initAnimations() {
  if (state.reduceMotion) return;
  try {
    const gsapModule = await import('gsap');
    const scrollModule = await import('gsap/ScrollTrigger');
    const gsap = gsapModule.default || gsapModule;
    const ScrollTrigger = scrollModule.ScrollTrigger || scrollModule.default;
    gsap.registerPlugin(ScrollTrigger);

    gsap.utils.toArray('[data-animate="fade"]').forEach((el) => {
      gsap.fromTo(el, { opacity: 0, y: 40 }, {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 80%',
        },
      });
    });

    gsap.utils.toArray('[data-split="words"]').forEach((el) => {
      const words = el.querySelectorAll('.dga_line_dimmed__BUp_B');
      gsap.fromTo(words, { opacity: 0.3 }, {
        opacity: 1,
        stagger: 0.02,
        duration: 0.6,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
        },
      });
    });

    gsap.utils.toArray('[data-split="chars"]').forEach((el) => {
      const chars = el.querySelectorAll('.dga_disintegrating_char__Uawaf');
      gsap.fromTo(chars, { opacity: 0, y: 12 }, {
        opacity: 1,
        y: 0,
        duration: 0.8,
        stagger: 0.02,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 80%',
        },
      });
    });

    gsap.utils.toArray('.rest-pyramid-icon').forEach((el) => {
      gsap.fromTo(el, { opacity: 0, scale: 0.8 }, {
        opacity: 1,
        scale: 1,
        duration: 0.8,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '#pyramid',
          start: 'top 80%',
        },
      });
    });

    gsap.utils.toArray('.rest-resource-card').forEach((el, index) => {
      gsap.to(el, {
        y: 0,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '#resources',
          start: 'top 80%',
        },
        delay: index * 0.1,
      });
    });
  } catch (err) {
    // Animations are optional; continue without them.
  }
}

function initTelemetryAnchors() {
  const resourcesCta = document.getElementById('resources-cta');
  resourcesCta?.addEventListener('click', () => log('hero_cta_click', { cta: 'find_rest_now' }));
}

function init() {
  renderHero();
  renderSoh();
  renderLineInSand();
  renderPyramid();
  renderRespond();
  renderFaq();
  renderResources();
  renderFooter();
  initReduceMotion();
  initIntroOverlay();
  initNav();
  initHeroVideo();
  initProgressFallback();
  initSohObserver();
  initPyramidObserver();
  initPyramidClicks();
  bindCtas();
  initTelemetryAnchors();
  initLenis();
  initAnimations();
}

init();
