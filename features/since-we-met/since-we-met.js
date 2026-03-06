const MODE_KEY = 'loveboard-since-we-met-mode-v1';
const FALLBACK_MODE = 'simple';
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const BUILD_TAG = '20260305h';
const MILESTONES = [100, 182, 365, 500, 730, 1000, 1500, 2000];

const MEMORY_LINES = [
  'You are cherished in all your softness and all your fire.',
  'The smallest moments with you still feel like a gift.',
  'Distance changes nothing about how deeply you are loved.',
  'Every call, every laugh, every silence still says: us.',
  'You are not just loved. You are treasured.'
];

export function createSinceWeMetFeature(options = {}) {
  const root = options.root instanceof HTMLElement ? options.root : null;
  if (!root) return createNoopApi();

  root.setAttribute('data-swm-build', BUILD_TAG);
  const metDate = parseMetDate(options.metDate) || new Date(2024, 7, 22);

  const state = {
    mode: getStoredMode(),
    partnerA: 'You',
    partnerB: 'Partner',
    coupleLabel: 'You ❤️ Partner',
    selectedMilestone: null,
    noteIndex: 0,
    minuteTimer: 0,
    midnightTimer: 0,
    prefersReducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    cardPointerMove: null,
    cardPointerLeave: null
  };

  root.innerHTML = `
    <article class="swm-shell" data-swm-shell>
      <div class="swm-glow swm-glow-a" aria-hidden="true"></div>
      <div class="swm-glow swm-glow-b" aria-hidden="true"></div>

      <section class="swm-card" data-swm-card>
        <header class="swm-head">
          <div class="swm-heading-copy">
            <p class="swm-kicker">Made for her</p>
            <h2 class="swm-title">Since We Met</h2>
          </div>
          <div class="swm-toggle" role="tablist" aria-label="Counter mode">
            <button type="button" class="swm-toggle-btn" data-swm-mode="simple" role="tab">Simple</button>
            <button type="button" class="swm-toggle-btn" data-swm-mode="detailed" role="tab">Detailed</button>
          </div>
        </header>

        <section class="swm-hero" aria-live="polite">
          <p class="swm-main-count" data-swm-days>0 days</p>
          <p class="swm-subline" data-swm-subline>since August 22, 2024</p>
        </section>

        <section class="swm-panel swm-panel-simple" data-swm-simple>
          <p class="swm-panel-label">Time held together</p>
          <div class="swm-live-grid" data-swm-live-grid></div>
        </section>

        <section class="swm-panel swm-panel-detailed" data-swm-detail hidden>
          <p class="swm-panel-label">Calendar breakdown</p>
          <div class="swm-stat-grid" data-swm-stat-grid></div>
        </section>

        <section class="swm-progress" aria-label="Milestone progress">
          <div class="swm-progress-head">
            <p class="swm-progress-label">Current milestone</p>
            <p class="swm-progress-value" data-swm-progress-value></p>
          </div>
          <div class="swm-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" data-swm-progress-track>
            <span class="swm-progress-fill" data-swm-progress-fill></span>
          </div>
          <p class="swm-progress-note" data-swm-progress-note></p>
        </section>

        <section class="swm-milestones" aria-label="Milestones">
          <div class="swm-milestones-head">
            <p class="swm-panel-label">Milestones</p>
            <p class="swm-milestones-hint">Tap to feel each chapter</p>
          </div>
          <div class="swm-milestone-rail" data-swm-milestones></div>
        </section>

        <section class="swm-memory" aria-label="Love note">
          <div class="swm-memory-head">
            <p class="swm-panel-label">Tonight's note</p>
            <button type="button" class="swm-shuffle" data-swm-shuffle>Refresh note</button>
          </div>
          <p class="swm-memory-note" data-swm-memory></p>
          <p class="swm-memory-meta" data-swm-memory-meta></p>
        </section>

        <p class="swm-footnote">Local time updates. Day count refreshes at midnight.</p>
      </section>
    </article>
  `;

  const ui = {
    shell: root.querySelector('[data-swm-shell]'),
    card: root.querySelector('[data-swm-card]'),
    modeButtons: Array.from(root.querySelectorAll('[data-swm-mode]')),
    days: root.querySelector('[data-swm-days]'),
    subline: root.querySelector('[data-swm-subline]'),
    simplePanel: root.querySelector('[data-swm-simple]'),
    detailPanel: root.querySelector('[data-swm-detail]'),
    liveGrid: root.querySelector('[data-swm-live-grid]'),
    statGrid: root.querySelector('[data-swm-stat-grid]'),
    progressTrack: root.querySelector('[data-swm-progress-track]'),
    progressFill: root.querySelector('[data-swm-progress-fill]'),
    progressValue: root.querySelector('[data-swm-progress-value]'),
    progressNote: root.querySelector('[data-swm-progress-note]'),
    milestones: root.querySelector('[data-swm-milestones]'),
    memory: root.querySelector('[data-swm-memory]'),
    memoryMeta: root.querySelector('[data-swm-memory-meta]'),
    shuffleBtn: root.querySelector('[data-swm-shuffle]')
  };

  ui.modeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const mode = button.dataset.swmMode === 'detailed' ? 'detailed' : 'simple';
      setMode(mode);
    });
  });

  if (ui.milestones) {
    ui.milestones.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-swm-target]');
      if (!(button instanceof HTMLButtonElement)) return;
      const target = Number(button.dataset.swmTarget);
      if (!Number.isFinite(target)) return;
      state.selectedMilestone = target;
      render();
    });
  }

  if (ui.shuffleBtn) {
    ui.shuffleBtn.addEventListener('click', () => {
      state.noteIndex = (state.noteIndex + 1) % MEMORY_LINES.length;
      renderMemory(getInclusiveDayCount(metDate, new Date()));
    });
  }

  setupPointerMotion();
  setMode(state.mode, { persist: false });
  render();
  scheduleSecondTick();
  scheduleMidnightTick();

  return {
    updateContext,
    destroy
  };

  function updateContext(payload = {}) {
    if (typeof payload.partnerA === 'string' && payload.partnerA.trim()) {
      state.partnerA = payload.partnerA.trim();
    }
    if (typeof payload.partnerB === 'string' && payload.partnerB.trim()) {
      state.partnerB = payload.partnerB.trim();
    }
    if (typeof payload.coupleLabel === 'string' && payload.coupleLabel.trim()) {
      state.coupleLabel = payload.coupleLabel.trim();
    }
    render();
  }

  function destroy() {
    if (state.minuteTimer) {
      window.clearTimeout(state.minuteTimer);
      state.minuteTimer = 0;
    }
    if (state.midnightTimer) {
      window.clearTimeout(state.midnightTimer);
      state.midnightTimer = 0;
    }
    if (ui.card && state.cardPointerMove) {
      ui.card.removeEventListener('pointermove', state.cardPointerMove);
    }
    if (ui.card && state.cardPointerLeave) {
      ui.card.removeEventListener('pointerleave', state.cardPointerLeave);
    }
  }

  function setMode(mode, options = {}) {
    state.mode = mode === 'detailed' ? 'detailed' : 'simple';
    if (options.persist !== false) {
      localStorage.setItem(MODE_KEY, state.mode);
    }
    syncModeUi();
    render();
  }

  function syncModeUi() {
    ui.modeButtons.forEach((button) => {
      const active = button.dataset.swmMode === state.mode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
      button.setAttribute('tabindex', active ? '0' : '-1');
    });
    // UX request: flip panel mapping
    // Simple -> calendar breakdown; Detailed -> live time breakdown
    if (ui.simplePanel) ui.simplePanel.hidden = state.mode !== 'detailed';
    if (ui.detailPanel) ui.detailPanel.hidden = state.mode !== 'simple';
  }

  function setupPointerMotion() {
    if (!ui.card || state.prefersReducedMotion || !window.matchMedia?.('(pointer:fine)').matches) return;

    state.cardPointerMove = (event) => {
      const rect = ui.card.getBoundingClientRect();
      const px = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      const py = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      ui.card.style.setProperty('--swm-tilt-x', `${(-py * 1.6).toFixed(2)}deg`);
      ui.card.style.setProperty('--swm-tilt-y', `${(px * 2.1).toFixed(2)}deg`);
    };

    state.cardPointerLeave = () => {
      ui.card.style.setProperty('--swm-tilt-x', '0deg');
      ui.card.style.setProperty('--swm-tilt-y', '0deg');
    };

    ui.card.addEventListener('pointermove', state.cardPointerMove);
    ui.card.addEventListener('pointerleave', state.cardPointerLeave);
  }

  function render() {
    const now = new Date();
    const dayCount = getInclusiveDayCount(metDate, now);
    const totalHours = Math.max(0, Math.floor((now.getTime() - metDate.getTime()) / (1000 * 60 * 60)));
    const totalMinutes = Math.max(0, Math.floor((now.getTime() - metDate.getTime()) / (1000 * 60)));
    const totalSeconds = Math.max(0, Math.floor((now.getTime() - metDate.getTime()) / 1000));
    const dateLabel = formatDateLabel(metDate);

    if (ui.days) {
      ui.days.textContent = `${dayCount.toLocaleString()} ${dayCount === 1 ? 'day' : 'days'}`;
    }
    if (ui.subline) {
      ui.subline.textContent = `since ${dateLabel} · ${state.coupleLabel}`;
    }

    renderSimplePanel(totalHours, totalMinutes, totalSeconds);
    renderDetailedPanel(now);
    renderMilestones(dayCount);
    renderProgress(dayCount);
    renderMemory(dayCount);
  }

  function renderSimplePanel(totalHours, totalMinutes, totalSeconds) {
    if (!ui.liveGrid) return;
    const tiles = [
      { label: 'Hours', value: totalHours.toLocaleString() },
      { label: 'Minutes', value: totalMinutes.toLocaleString() },
      { label: 'Seconds', value: totalSeconds.toLocaleString() }
    ];

    ui.liveGrid.innerHTML = tiles
      .map(
        (tile) => `
          <article class="swm-live-tile">
            <strong>${tile.value}</strong>
            <span>${tile.label}</span>
          </article>
        `
      )
      .join('');
  }

  function renderDetailedPanel(now) {
    if (!ui.statGrid) return;
    const parts = getCalendarDuration(metDate, now);
    ui.statGrid.innerHTML = `
      <article class="swm-stat"><strong>${parts.years}</strong><span>Years</span></article>
      <article class="swm-stat"><strong>${parts.months}</strong><span>Months</span></article>
      <article class="swm-stat"><strong>${parts.days}</strong><span>Days</span></article>
    `;
  }

  function renderMilestones(dayCount) {
    if (!ui.milestones) return;
    const nextTarget = MILESTONES.find((value) => value > dayCount) || MILESTONES[MILESTONES.length - 1];
    if (!state.selectedMilestone) {
      state.selectedMilestone = nextTarget;
    }

    const numberedCards = MILESTONES.map((target) => {
      const reached = dayCount >= target;
      const active = state.selectedMilestone === target;
      const date = formatDateLabel(getMilestoneDate(metDate, target));
      return `
        <button
          type="button"
          class="swm-milestone-card${reached ? ' is-reached' : ''}${active ? ' is-active' : ''}"
          data-swm-target="${target}"
          aria-pressed="${active ? 'true' : 'false'}"
        >
          <span class="swm-milestone-day">${target}</span>
          <span class="swm-milestone-unit">days</span>
          <span class="swm-milestone-date">${date}</span>
        </button>
      `;
    }).join('');

    const foreverCard = `
      <article class="swm-milestone-card is-forever" aria-label="Forever milestone">
        <span class="swm-milestone-day">∞</span>
        <span class="swm-milestone-unit">forever</span>
        <span class="swm-milestone-date">and then eternity</span>
      </article>
    `;

    ui.milestones.innerHTML = `${numberedCards}${foreverCard}`;
  }

  function renderProgress(dayCount) {
    const target = state.selectedMilestone || MILESTONES[0];
    const previous = getPreviousMilestone(target);
    const span = Math.max(1, target - previous);
    const step = Math.max(0, Math.min(span, dayCount - previous));
    const percent = Math.round((step / span) * 100);
    const remaining = Math.max(0, target - dayCount);
    const targetDate = formatDateLabel(getMilestoneDate(metDate, target));

    if (ui.progressFill) {
      ui.progressFill.style.width = `${percent}%`;
    }
    if (ui.progressTrack) {
      ui.progressTrack.setAttribute('aria-valuenow', String(percent));
      ui.progressTrack.setAttribute('aria-label', `${percent}% progress to ${target} days`);
    }
    if (ui.progressValue) {
      ui.progressValue.textContent = remaining === 0 ? `${target} reached` : `${remaining} days to ${target}`;
    }
    if (ui.progressNote) {
      ui.progressNote.textContent = remaining === 0 ? `Reached on ${targetDate}.` : `Expected around ${targetDate}.`;
    }
  }

  function renderMemory(dayCount) {
    if (!ui.memory || !ui.memoryMeta) return;
    const line = MEMORY_LINES[(dayCount + state.noteIndex) % MEMORY_LINES.length];

    const target = state.selectedMilestone || MILESTONES[0];
    const remaining = Math.max(0, target - dayCount);
    const meta =
      remaining === 0
        ? `You reached ${target} days together. Pick the next chapter and keep glowing.`
        : `${remaining} days left until ${target}. This is becoming something forever.`;

    ui.memory.textContent = line;
    ui.memoryMeta.textContent = meta;
  }

  function scheduleSecondTick() {
    if (state.minuteTimer) {
      window.clearTimeout(state.minuteTimer);
      state.minuteTimer = 0;
    }
    const now = new Date();
    const delay = Math.max(120, 1000 - now.getMilliseconds());
    state.minuteTimer = window.setTimeout(() => {
      render();
      scheduleSecondTick();
    }, delay);
  }

  function scheduleMidnightTick() {
    if (state.midnightTimer) {
      window.clearTimeout(state.midnightTimer);
      state.midnightTimer = 0;
    }
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 50);
    const delay = Math.max(1000, nextMidnight.getTime() - now.getTime());
    state.midnightTimer = window.setTimeout(() => {
      render();
      scheduleMidnightTick();
    }, delay);
  }
}

function createNoopApi() {
  return {
    updateContext: () => {},
    destroy: () => {}
  };
}

function parseMetDate(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, month, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getStoredMode() {
  const value = localStorage.getItem(MODE_KEY);
  return value === 'detailed' ? 'detailed' : FALLBACK_MODE;
}

function getInclusiveDayCount(startDate, now) {
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.floor((today.getTime() - start.getTime()) / MS_PER_DAY);
  return Math.max(1, diff + 1);
}

function getCalendarDuration(startDate, endDate) {
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  if (end < start) return { years: 0, months: 0, days: 0 };

  let years = end.getFullYear() - start.getFullYear();
  let anchor = addYears(start, years);
  if (anchor > end) {
    years -= 1;
    anchor = addYears(start, years);
  }

  let months = 0;
  while (true) {
    const probe = addMonths(anchor, months + 1);
    if (probe <= end) {
      months += 1;
    } else {
      break;
    }
  }

  const afterMonths = addMonths(anchor, months);
  const days = Math.max(0, Math.floor((end.getTime() - afterMonths.getTime()) / MS_PER_DAY));
  return { years, months, days };
}

function getPreviousMilestone(target) {
  const previous = MILESTONES.filter((value) => value < target);
  return previous.length ? previous[previous.length - 1] : 0;
}

function getMilestoneDate(startDate, milestoneDay) {
  return new Date(startDate.getTime() + Math.max(0, milestoneDay - 1) * MS_PER_DAY);
}

function addYears(date, years) {
  return new Date(date.getFullYear() + years, date.getMonth(), date.getDate());
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

function formatDateLabel(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}
