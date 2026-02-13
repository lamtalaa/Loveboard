import { supabase } from './supabase.js';
import { setWwanUser, applyRemoteCity, setWwanDefaults } from './wwan.js';


const DEFAULT_MOOD_PRESETS = {
  user_a: [
    { emoji: '🛡️', label: 'Protective' },
    { emoji: '😈', label: 'Teasing' },
    { emoji: '🌙', label: 'Calm' }
  ],
  user_b: [
    { emoji: '🌸', label: 'Soft' },
    { emoji: '🤍', label: 'Obedient' },
    { emoji: '🎀', label: 'Loyal' },
    { emoji: '🕊️', label: 'Gentle' },
    { emoji: '🫧', label: 'Quiet' },
    { emoji: '🧸', label: 'Cuddly' },
    { emoji: '🫦', label: 'Seductive' }
  ]
};
const FALLBACK_MOODS = [{ emoji: '💗', label: 'So in love with you' }];
const REACTIONS = [
  { emoji: '💋', label: 'Kiss' },
  { emoji: '✨', label: 'Sparkles' },
  { emoji: '💗', label: 'Heartburst' },
  { emoji: '❤️', label: 'Red heart' },
  { emoji: '🔥', label: 'Spicy' },
  { emoji: '🌙', label: 'Dreaming of you' },
  { emoji: '🌸', label: 'Blooming love' }
];
const ORBIT_SPARKS = [
  'Your voice feels like home.',
  'I feel you even across oceans.',
  'Every call is a kiss.',
  'I keep you in my pocket.',
  'You are my favorite time zone.',
  'Closer with every heartbeat.'
];
const BUCKET = 'loveboard-assets';
const MOOD_TIMES_KEY = 'loveboard-moodTimes';
const DEFAULT_NOTE_IMG = './assets/default-note.svg';
const DEFAULT_POSTCARD_BATCH = 3;
const STORY_MIN_CHAPTERS = 3;
const STORY_MAX_CHAPTERS = 10;
const STORY_STEP_COUNT = 4;
const STORY_RITUAL_STARS = 18;
const STORY_WAIT_TEXTS = [
  'Every second is a step closer to the life you are building.',
  'Hold this moment. It is turning into a chapter.',
  'Your story is arriving, one heartbeat at a time.',
  'A future scene is forming just for you two.',
  'The distance is dissolving into words.'
];
const STORY_WAIT_DURATION = 14000;
const DEFAULT_APP_CONFIG = {
  users: {
    a: { id: 'user_a', display: 'You' },
    b: { id: 'user_b', display: 'Partner' }
  },
  coupleLabel: 'You ❤️ Partner',
  storyByline: 'A love story',
  moodPresets: DEFAULT_MOOD_PRESETS,
  wwanDefaults: {
    personA: {
      name: 'You',
      city: 'City A',
      country: 'Country A',
      countryCode: 'US',
      timeZone: 'America/New_York'
    },
    personB: {
      name: 'Partner',
      city: 'City B',
      country: 'Country B',
      countryCode: 'MA',
      timeZone: 'Africa/Casablanca'
    }
  }
};
function readStoredJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const value = JSON.parse(raw);
    return value && typeof value === 'object' ? value : fallback;
  } catch {
    return fallback;
  }
}

function persistMoodTimes() {
  localStorage.setItem(MOOD_TIMES_KEY, JSON.stringify(state.moodTimes));
}

const state = {
  user: null,
  userDisplay: null,
  appConfig: { ...DEFAULT_APP_CONFIG },
  appConfigLoaded: false,
  moodPresets: { ...DEFAULT_APP_CONFIG.moodPresets },
  userIds: {
    a: DEFAULT_APP_CONFIG.users.a.id,
    b: DEFAULT_APP_CONFIG.users.b.id
  },
  postcards: [],
  doodleDirty: false,
  doodleCtx: null,
  recording: {
    recorder: null,
    chunks: [],
    timer: null
  },
  audioBlob: null,
  started: false,
  reactions: {},
  userReactions: {},
  comments: {},
  commentReactions: {},
  commentUserReactions: {},
  postcardLimit: DEFAULT_POSTCARD_BATCH,
  moodTimes: readStoredJSON(MOOD_TIMES_KEY, {}),
  activeOptions: new Set(['message']),
  moodMenuListener: null,
  openReactionPicker: null,
  realtimeChannel: null,
  commentChannel: null,
  commentChannelReady: false,
  pendingCommentBroadcasts: [],
  editingComment: null,
  commentUpdatedAtSupported: true,
  moodUpdatedAtSupported: true,
  ldAppOpen: false,
  ldAppKeyListener: null,
  constellationOpen: false,
  constellationKeyListener: null,
  constellationResizeListener: null,
  constellationActiveId: null,
  valentineOpen: false,
  valentineKeyListener: null,
  chronicleOpen: false,
  chronicleKeyListener: null,
  storyMenuListener: null,
  storyMenuKeyListener: null,
  orbitProgress: 0,
  orbitHolding: false,
  orbitFrame: null,
  orbitSparkTimer: null,
  orbitReached: false,
  orbitResizeListener: null,
  storyMirrorOpen: false,
  storyMirrorKeyListener: null,
  storyMirrorBusy: false,
  storyStep: 1,
  storyChapters: [],
  storyImages: [],
  storyImagesComplete: false,
  storySaved: false,
  storyDefaults: {
    profileY: '',
    profileN: ''
  },
  chronicles: [],
  chronicleLoading: false,
  chroniclePlaceholderCount: 4,
  activeChronicle: null,
  ritualProgress: 0,
  ritualFrame: null,
  ritualTimer: null,
  ritualPromptIndex: 0,
  ritualStart: 0,
  ritualFinishStart: 0,
  ritualFinishDuration: 1800,
  ritualSpeed: 0.35,
  ritualDrift: 0.02
};

const ui = {
  app: document.querySelector('.app'),
  authGate: document.getElementById('auth-gate'),
  authForm: document.getElementById('auth-form'),
  authError: document.getElementById('auth-error'),
  emailInput: document.getElementById('email-input'),
  passwordInput: document.getElementById('password-input'),
  authSubmit: document.getElementById('auth-submit'),
  board: document.getElementById('board'),
  modal: document.getElementById('postcard-modal'),
  logoutModal: document.getElementById('logout-modal'),
  logoutConfirm: document.getElementById('logout-confirm'),
  logoutCancel: document.getElementById('logout-cancel'),
  postcardForm: document.getElementById('postcard-form'),
  createBtn: document.getElementById('create-btn'),
  closeModal: document.getElementById('close-modal'),
  messageInput: document.getElementById('message-input'),
  photoInput: document.getElementById('photo-input'),
  doodleCanvas: document.getElementById('doodle-canvas'),
  clearDoodle: document.getElementById('clear-doodle'),
  recordAudio: document.getElementById('record-audio'),
  audioPreview: document.getElementById('audio-preview'),
  audioStatus: document.getElementById('audio-status'),
  recordTimer: document.getElementById('record-timer'),
  sendBtn: document.getElementById('send-btn'),
  sendHint: document.getElementById('send-hint'),
  moodButtons: document.querySelectorAll('.mood-btn'),
  logoutButtons: document.querySelectorAll('.logout-btn'),
  currentAvatar: document.getElementById('current-user-avatar'),
  toast: document.getElementById('toast'),
  optionButtons: document.querySelectorAll('.option-btn'),
  optionSections: document.querySelectorAll('.option-section'),
  ldAppView: document.getElementById('ldapp-view'),
  loveboardView: document.getElementById('loveboard-view'),
  constellationView: document.getElementById('constellation-view'),
  constellationSky: document.getElementById('constellation-sky'),
  constellationCanvas: document.getElementById('constellation-canvas'),
  constellationStars: document.getElementById('constellation-stars'),
  constellationDetail: document.getElementById('constellation-detail'),
  constellationClose: document.getElementById('constellation-close'),
  constellationMeta: document.getElementById('constellation-meta'),
  constellationMessage: document.getElementById('constellation-message'),
  constellationMedia: document.getElementById('constellation-media'),
  constellationHint: document.getElementById('constellation-hint'),
  valentineView: document.getElementById('valentine-view'),
  chronicleView: document.getElementById('chronicle-view'),
  valentineCountdown: document.getElementById('valentine-countdown'),
  orbitStage: document.getElementById('orbit-stage'),
  orbitLine: document.getElementById('orbit-line'),
  orbitLinePath: document.getElementById('orbit-line-path'),
  orbitSparkField: document.getElementById('orbit-spark-field'),
  orbitOrbA: document.getElementById('orbit-orb-a'),
  orbitOrbB: document.getElementById('orbit-orb-b'),
  orbitLocA: document.getElementById('orbit-loc-a'),
  orbitLocB: document.getElementById('orbit-loc-b'),
  orbitMerge: document.getElementById('orbit-merge'),
  orbitStatus: document.getElementById('orbit-status'),
  orbitHoldBtn: document.getElementById('orbit-hold-btn'),
  orbitSendBtn: document.getElementById('orbit-send-btn'),
  orbitReveal: document.getElementById('orbit-reveal'),
  orbitMessage: document.getElementById('orbit-message'),
  viewSwitchButtons: document.querySelectorAll('.view-switch'),
  storyMenus: document.querySelectorAll('.story-menu'),
  storyMenuToggles: document.querySelectorAll('.story-menu-toggle'),
  storyMenuOptions: document.querySelectorAll('.story-menu-option'),
  storyMirrorView: document.getElementById('storymirror-view'),
  storyHeroTitle: document.querySelector('.storymirror-hero h1'),
  storyHeroSubtitle: document.querySelector('.storymirror-subtitle'),
  storyHeroEyebrow: document.querySelector('.storymirror-hero .storymirror-eyebrow'),
  storyStepChips: document.querySelectorAll('.storymirror-step-chip'),
  storyStepPanels: document.querySelectorAll('.storymirror-step-panel'),
  storyStepBack: document.getElementById('story-step-back'),
  storyStepNext: document.getElementById('story-step-next'),
  storyStepIndicator: document.getElementById('story-step-indicator'),
  storySuggestions: document.querySelectorAll('.storymirror-suggestions'),
  storyFragmentsY: document.getElementById('story-fragments-y'),
  storyFragmentsN: document.getElementById('story-fragments-n'),
  storyProfileY: document.getElementById('story-profile-y'),
  storyProfileN: document.getElementById('story-profile-n'),
  storyLens: document.getElementById('story-lens'),
  storyLensLabel: document.getElementById('story-lens-label'),
  storyFantasy: document.getElementById('story-fantasy'),
  storyFantasyLabel: document.getElementById('story-fantasy-label'),
  storyIntimacyInputs: document.querySelectorAll('input[name="story-intimacy"]'),
  storyPerspectiveInputs: document.querySelectorAll('input[name="story-perspective"]'),
  storyGenerate: document.getElementById('story-generate'),
  storyStatus: document.getElementById('story-status'),
  storyChapterHint: document.getElementById('story-chapter-hint'),
  storyExtra: document.getElementById('story-extra'),
  storyOutput: document.getElementById('story-output'),
  storyEmpty: document.getElementById('story-empty'),
  storyChapters: document.getElementById('story-chapters'),
  storyFooter: document.getElementById('story-footer'),
  storyNewBtn: document.getElementById('story-new-btn'),
  storySaveBtn: document.getElementById('story-save-btn'),
  storyRitual: document.getElementById('story-ritual'),
  storyRitualFill: document.getElementById('story-ritual-fill'),
  storyRitualText: document.getElementById('story-ritual-text'),
  storyRitualHint: document.getElementById('story-ritual-hint'),
  chronicleGrid: document.getElementById('chronicle-grid'),
  chronicleEmpty: document.getElementById('chronicle-empty'),
  chronicleModal: document.getElementById('chronicle-modal'),
  chronicleClose: document.getElementById('chronicle-close'),
  chronicleModalTitle: document.getElementById('chronicle-modal-title'),
  chronicleModalBody: document.getElementById('chronicle-modal-body'),
  chronicleDelete: document.getElementById('chronicle-delete'),
  chronicleDeleteModal: document.getElementById('chronicle-delete-modal'),
  chronicleDeleteCancel: document.getElementById('chronicle-delete-cancel'),
  chronicleDeleteConfirm: document.getElementById('chronicle-delete-confirm'),
};

const template = document.getElementById('postcard-template');

init().catch((error) => console.error('init error', error));

async function init() {
  ui.authForm.addEventListener('submit', handleAuth);
  ui.createBtn.addEventListener('click', () => openModal());
  ui.closeModal.addEventListener('click', () => ui.modal.close());
  if (ui.currentAvatar) {
    ui.currentAvatar.addEventListener('click', () => {
      const name = state.userDisplay || state.user || 'Unknown';
      showToast(`Signed in as ${name}`, 'info', ui.currentAvatar);
    });
  }
  if (ui.logoutModal) {
    ui.logoutModal.addEventListener('cancel', (evt) => {
      evt.preventDefault();
      closeLogoutModal();
    });
  }
  if (ui.logoutCancel) {
    ui.logoutCancel.addEventListener('click', closeLogoutModal);
  }
  if (ui.logoutConfirm) {
    ui.logoutConfirm.addEventListener('click', confirmLogout);
  }
  if (ui.chronicleClose) {
    ui.chronicleClose.addEventListener('click', closeChronicleModal);
  }
  if (ui.chronicleModal) {
    ui.chronicleModal.addEventListener('cancel', (evt) => {
      evt.preventDefault();
      closeChronicleModal();
    });
  }
  if (ui.chronicleDelete) {
    ui.chronicleDelete.addEventListener('click', openChronicleDeleteModal);
  }
  if (ui.chronicleDeleteCancel) {
    ui.chronicleDeleteCancel.addEventListener('click', closeChronicleDeleteModal);
  }
  if (ui.chronicleDeleteConfirm) {
    ui.chronicleDeleteConfirm.addEventListener('click', confirmChronicleDelete);
  }
  ui.postcardForm.addEventListener('submit', handlePostcardSubmit);
  ui.clearDoodle.addEventListener('click', clearDoodle);
  ui.emailInput.addEventListener('input', updateAuthButton);
  ui.passwordInput.addEventListener('input', updateAuthButton);
  ui.messageInput.addEventListener('input', updateSendButtonState);
  ui.photoInput.addEventListener('change', updateSendButtonState);
  setupDoodleCanvas();
  setupAudioRecorder();
  setupValentine();
  setupStoryMirror();
  ui.moodButtons.forEach((btn) =>
    btn.addEventListener('click', () => openMoodPicker(btn))
  );
  if (ui.viewSwitchButtons) {
    ui.viewSwitchButtons.forEach((btn) => {
      if (btn.classList.contains('story-menu-toggle')) return;
      btn.addEventListener('click', () => handleViewSwitch(btn.dataset.view));
    });
  }
  setupStoryMenus();
  if (ui.constellationClose) {
    ui.constellationClose.addEventListener('click', closeConstellationDetail);
  }
  ui.logoutButtons.forEach((btn) => btn.addEventListener('click', handleLogout));
  ui.optionButtons.forEach((btn) => btn.addEventListener('click', () => toggleOption(btn)));
  updateOptionVisibility();
  updateAuthButton();
  updateSendButtonState();
  setButtonState(ui.createBtn, false);
  updateViewSwitchers('loveboard');
  await loadAppConfig();
  applyAppConfig();
  restoreSession();
  supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) {
      showAuthGate();
      return;
    }
    applySessionUser(session);
  });
}

function setupValentine() {
  if (!ui.valentineView) return;
  updateOrbitLocations();
  if (ui.orbitHoldBtn) {
    const start = () => startOrbitHold();
    const stop = () => stopOrbitHold();
    ui.orbitHoldBtn.addEventListener('pointerdown', start);
    ui.orbitHoldBtn.addEventListener('pointerup', stop);
    ui.orbitHoldBtn.addEventListener('pointerleave', stop);
    ui.orbitHoldBtn.addEventListener('pointercancel', stop);
    document.addEventListener('pointerup', stop);
  }
  if (ui.orbitSendBtn) {
    ui.orbitSendBtn.addEventListener('click', sendOrbitPostcard);
  }
  updateValentineCountdown();
  resetOrbitState();
  requestAnimationFrame(updateOrbitUI);
}

function setupStoryMirror() {
  if (!ui.storyMirrorView) return;
  setupStoryStepper();
  setupStorySuggestions();
  loadStoryDefaults();
  if (ui.storyLens) {
    ui.storyLens.addEventListener('input', () => {
      updateStoryLensLabel();
      updateChapterEstimate();
    });
    updateStoryLensLabel();
  }
  if (ui.storyFantasy) {
    ui.storyFantasy.addEventListener('input', () => {
      updateStoryFantasyLabel();
      updateChapterEstimate();
    });
    updateStoryFantasyLabel();
  }
  if (ui.storyFragmentsY) {
    ui.storyFragmentsY.addEventListener('input', updateChapterEstimate);
  }
  if (ui.storyFragmentsN) {
    ui.storyFragmentsN.addEventListener('input', updateChapterEstimate);
  }
  if (ui.storyGenerate) {
    ui.storyGenerate.addEventListener('click', () => runStoryGeneration());
  }
  if (ui.storyNewBtn) {
    ui.storyNewBtn.addEventListener('click', resetStoryFlow);
  }
  if (ui.storySaveBtn) {
    ui.storySaveBtn.addEventListener('click', saveStoryChronicle);
  }
  updateChapterEstimate();
  cacheStoryHeroDefaults();
}

async function loadAppConfig() {
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'loveboard_private')
    .maybeSingle();
  if (error) {
    console.warn('app config load', error);
    return;
  }
  if (!data?.value || typeof data.value !== 'object') return;
  state.appConfig = normalizeAppConfig(data.value);
  state.userIds = {
    a: state.appConfig.users.a.id,
    b: state.appConfig.users.b.id
  };
  state.moodPresets = buildMoodPresets(state.appConfig);
  state.appConfigLoaded = true;
}

function normalizeAppConfig(value) {
  const config = JSON.parse(JSON.stringify(DEFAULT_APP_CONFIG));
  if (value?.users?.a?.id) config.users.a.id = String(value.users.a.id);
  if (value?.users?.b?.id) config.users.b.id = String(value.users.b.id);
  if (value?.users?.a?.display) config.users.a.display = String(value.users.a.display);
  if (value?.users?.b?.display) config.users.b.display = String(value.users.b.display);
  if (value?.couple_label) config.coupleLabel = String(value.couple_label);
  if (value?.story_byline) config.storyByline = String(value.story_byline);
  if (value?.wwan_defaults?.personA) {
    config.wwanDefaults.personA = { ...config.wwanDefaults.personA, ...value.wwan_defaults.personA };
  }
  if (value?.wwan_defaults?.personB) {
    config.wwanDefaults.personB = { ...config.wwanDefaults.personB, ...value.wwan_defaults.personB };
  }
  if (value?.mood_presets) {
    config.moodPresets = value.mood_presets;
  }
  return config;
}

function buildMoodPresets(config) {
  const moodSource = config.moodPresets || DEFAULT_MOOD_PRESETS;
  const presets = {};
  const aKey = config.users.a.id;
  const bKey = config.users.b.id;
  presets[aKey] = Array.isArray(moodSource[aKey])
    ? moodSource[aKey]
    : Array.isArray(moodSource.a)
      ? moodSource.a
      : DEFAULT_MOOD_PRESETS.user_a;
  presets[bKey] = Array.isArray(moodSource[bKey])
    ? moodSource[bKey]
    : Array.isArray(moodSource.b)
      ? moodSource.b
      : DEFAULT_MOOD_PRESETS.user_b;
  return presets;
}

function applyAppConfig() {
  const { users, coupleLabel, storyByline, wwanDefaults } = state.appConfig;
  const displayA = users.a.display || users.a.id;
  const displayB = users.b.display || users.b.id;
  const couple = coupleLabel || `${displayA} ❤️ ${displayB}`;

  document.querySelectorAll('[data-couple-tagline]').forEach((el) => {
    el.textContent = couple;
  });
  document.querySelectorAll('[data-story-byline]').forEach((el) => {
    el.textContent = storyByline || `A ${displayA} + ${displayB} Story`;
  });

  document.querySelectorAll('[data-user-label="a"]').forEach((el) => {
    el.textContent = displayA;
  });
  document.querySelectorAll('[data-user-label="b"]').forEach((el) => {
    el.textContent = displayB;
  });

  document.querySelectorAll('[data-user-slot="a"]').forEach((el) => {
    el.dataset.user = users.a.id;
  });
  document.querySelectorAll('[data-user-slot="b"]').forEach((el) => {
    el.dataset.user = users.b.id;
  });

  const moodA = (state.moodPresets[users.a.id] || FALLBACK_MOODS)[0];
  const moodB = (state.moodPresets[users.b.id] || FALLBACK_MOODS)[0];
  if (moodA) {
    document.querySelectorAll('.mood-btn[data-user-slot="a"]').forEach((btn) => {
      btn.dataset.mood = moodA.emoji;
      btn.innerHTML = `${moodA.emoji} <span>${moodA.label}</span>`;
    });
  }
  if (moodB) {
    document.querySelectorAll('.mood-btn[data-user-slot="b"]').forEach((btn) => {
      btn.dataset.mood = moodB.emoji;
      btn.innerHTML = `${moodB.emoji} <span>${moodB.label}</span>`;
    });
  }

  document.querySelectorAll('[data-wwan-title]').forEach((el) => {
    el.textContent = `${couple} — Where We Are Now`;
  });
  document.querySelectorAll('[data-wwan-name="a"]').forEach((el) => {
    el.textContent = displayA;
  });
  document.querySelectorAll('[data-wwan-name="b"]').forEach((el) => {
    el.textContent = displayB;
  });
  document.querySelectorAll('[data-wwan-label="a"]').forEach((el) => {
    el.textContent = `${displayA}'s Time`;
  });
  document.querySelectorAll('[data-wwan-label="b"]').forEach((el) => {
    el.textContent = `${displayB}'s Time`;
  });
  document.querySelectorAll('[data-wwan-doing-title="a"]').forEach((el) => {
    el.textContent = `What ${displayA}'s Probably Doing`;
  });
  document.querySelectorAll('[data-wwan-doing-title="b"]').forEach((el) => {
    el.textContent = `What ${displayB}'s Probably Doing`;
  });
  document.querySelectorAll('[data-wwan-city-label="a"]').forEach((el) => {
    const input = el.querySelector('input');
    el.childNodes[0].textContent = `${displayA}'s City`;
    if (input) input.placeholder = `${displayA}'s city`;
  });
  document.querySelectorAll('[data-wwan-city-label="b"]').forEach((el) => {
    const input = el.querySelector('input');
    el.childNodes[0].textContent = `${displayB}'s City`;
    if (input) input.placeholder = `${displayB}'s city`;
  });

  document.querySelectorAll('[data-story-label="a"]').forEach((el) => {
    el.textContent = `${displayA}’s moments`;
  });
  document.querySelectorAll('[data-story-label="b"]').forEach((el) => {
    el.textContent = `${displayB}’s moments`;
  });
  document.querySelectorAll('[data-story-profile-label="a"]').forEach((el) => {
    el.textContent = `${displayA} profile`;
  });
  document.querySelectorAll('[data-story-profile-label="b"]').forEach((el) => {
    el.textContent = `${displayB} profile`;
  });
  document.querySelectorAll('[data-story-profile-placeholder="a"]').forEach((el) => {
    if ('placeholder' in el) el.placeholder = `Describe ${displayA}...`;
  });
  document.querySelectorAll('[data-story-profile-placeholder="b"]').forEach((el) => {
    if ('placeholder' in el) el.placeholder = `Describe ${displayB}...`;
  });

  document.querySelectorAll('input[name="story-perspective"]').forEach((input) => {
    const label = input.parentElement;
    if (!label || label.tagName !== 'LABEL') return;
    if (input.value === 'a') {
      label.lastChild.textContent = ` ${displayA}`;
    } else if (input.value === 'b') {
      label.lastChild.textContent = ` ${displayB}`;
    }
  });

  if (typeof setWwanDefaults === 'function') {
    setWwanDefaults({
      personA: {
        ...wwanDefaults.personA,
        id: users.a.id,
        name: displayA
      },
      personB: {
        ...wwanDefaults.personB,
        id: users.b.id,
        name: displayB
      }
    });
  }
}

function getDisplayName(userId) {
  if (userId === state.userIds.a) return state.appConfig.users.a.display || userId;
  if (userId === state.userIds.b) return state.appConfig.users.b.display || userId;
  return userId;
}

async function loadStoryDefaults() {
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'storymirror_defaults')
    .maybeSingle();
  if (error) {
    console.error('story defaults load', error);
    return;
  }
  const value = data?.value || {};
  if (typeof value.profile_y === 'string') {
    state.storyDefaults.profileY = value.profile_y;
  }
  if (typeof value.profile_n === 'string') {
    state.storyDefaults.profileN = value.profile_n;
  }
}

function updateOrbitLocations() {
  const locA = document.getElementById('wwan-city-a')?.textContent;
  const locB = document.getElementById('wwan-city-b')?.textContent;
  if (ui.orbitLocA && locA) ui.orbitLocA.textContent = locA;
  if (ui.orbitLocB && locB) ui.orbitLocB.textContent = locB;
}

function setupStoryStepper() {
  if (ui.storyStepChips) {
    ui.storyStepChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const step = Number(chip.dataset.step || 1);
        setStoryStep(step);
      });
    });
  }
  if (ui.storyStepBack) {
    ui.storyStepBack.addEventListener('click', () => setStoryStep(state.storyStep - 1));
  }
  if (ui.storyStepNext) {
    ui.storyStepNext.addEventListener('click', () => setStoryStep(state.storyStep + 1));
  }
  setStoryStep(state.storyStep);
}

function setStoryStep(step) {
  const next = Math.min(Math.max(step, 1), STORY_STEP_COUNT);
  state.storyStep = next;
  if (ui.storyStepPanels) {
    ui.storyStepPanels.forEach((panel) => {
      const panelStep = Number(panel.dataset.step || 1);
      panel.classList.toggle('active', panelStep === next);
    });
  }
  if (ui.storyStepChips) {
    ui.storyStepChips.forEach((chip) => {
      const chipStep = Number(chip.dataset.step || 1);
      chip.classList.toggle('active', chipStep === next);
    });
  }
  if (ui.storyStepIndicator) {
    ui.storyStepIndicator.textContent = `Step ${next} of ${STORY_STEP_COUNT}`;
  }
  if (ui.storyStepBack) {
    ui.storyStepBack.disabled = next <= 1;
  }
  if (ui.storyStepNext) {
    ui.storyStepNext.disabled = next >= STORY_STEP_COUNT;
  }
}

function setupStorySuggestions() {
  if (!ui.storySuggestions) return;
  ui.storySuggestions.forEach((container) => {
    container.querySelectorAll('.storymirror-suggestion').forEach((btn) => {
      btn.addEventListener('click', () => applyStorySuggestion(container, btn.dataset.text || ''));
    });
  });
}

function applyStorySuggestion(container, text) {
  if (!text) return;
  const targetId = container.dataset.target;
  const secondaryId = container.dataset.targetSecondary;
  const targets = [targetId, secondaryId].filter(Boolean);
  targets.forEach((id) => {
    const el = document.getElementById(id);
    if (!el || el.tagName !== 'TEXTAREA') return;
    const current = el.value.trim();
    el.value = current ? `${current}\n${text}` : text;
  });
  updateChapterEstimate();
}

function updateStoryLensLabel() {
  if (!ui.storyLens || !ui.storyLensLabel) return;
  const value = Number(ui.storyLens.value || 0);
  let label = 'Soft & romantic';
  if (value >= 70) label = 'Raw & honest';
  else if (value >= 40) label = 'Balanced & sincere';
  ui.storyLensLabel.textContent = label;
}

function getStoryLensProfile() {
  if (!ui.storyLens) return 'soft & romantic';
  const value = Number(ui.storyLens.value || 0);
  if (value >= 70) return 'raw, honest, and emotionally direct';
  if (value >= 40) return 'balanced, sincere, and grounded';
  return 'soft, romantic, and tender';
}

function updateStoryFantasyLabel() {
  if (!ui.storyFantasy || !ui.storyFantasyLabel) return;
  const value = Number(ui.storyFantasy.value || 0);
  let label = 'Grounded';
  if (value >= 70) label = 'Dreamlike';
  else if (value >= 40) label = 'Balanced';
  ui.storyFantasyLabel.textContent = label;
}

function cacheStoryHeroDefaults() {
  if (ui.storyHeroTitle && !ui.storyHeroTitle.dataset.defaultText) {
    ui.storyHeroTitle.dataset.defaultText = ui.storyHeroTitle.textContent || '';
  }
  if (ui.storyHeroSubtitle && !ui.storyHeroSubtitle.dataset.defaultText) {
    ui.storyHeroSubtitle.dataset.defaultText = ui.storyHeroSubtitle.textContent || '';
  }
  if (ui.storyHeroEyebrow && !ui.storyHeroEyebrow.dataset.defaultText) {
    ui.storyHeroEyebrow.dataset.defaultText = ui.storyHeroEyebrow.textContent || '';
  }
}

function setStoryHeroTitle(title) {
  if (!ui.storyHeroTitle) return;
  ui.storyHeroTitle.textContent = title;
  if (ui.storyHeroEyebrow) {
    ui.storyHeroEyebrow.hidden = true;
  }
  if (ui.storyHeroSubtitle) {
    ui.storyHeroSubtitle.hidden = true;
  }
}

function resetStoryHero() {
  if (ui.storyHeroEyebrow?.dataset.defaultText) {
    ui.storyHeroEyebrow.textContent = ui.storyHeroEyebrow.dataset.defaultText;
    ui.storyHeroEyebrow.hidden = false;
  }
  if (ui.storyHeroTitle?.dataset.defaultText) {
    ui.storyHeroTitle.textContent = ui.storyHeroTitle.dataset.defaultText;
  }
  if (ui.storyHeroSubtitle?.dataset.defaultText) {
    ui.storyHeroSubtitle.textContent = ui.storyHeroSubtitle.dataset.defaultText;
    ui.storyHeroSubtitle.hidden = false;
  }
}

function resetStoryFlow() {
  if (ui.storyMirrorView) {
    ui.storyMirrorView.classList.remove('storymirror-generated');
  }
  if (ui.storyFooter) {
    ui.storyFooter.hidden = true;
  }
  state.storyChapters = [];
  state.storyImages = [];
  state.storyImagesComplete = false;
  state.storySaved = false;
  state.activeChronicle = null;
  renderStoryChapters();
  resetStoryHero();
  setStoryStep(1);
  updateStorySaveButton();
  if (ui.storyOutput) {
    ui.storyOutput.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function updateStorySaveButton() {
  if (!ui.storySaveBtn) return;
  if (!state.storyChapters.length) {
    ui.storySaveBtn.disabled = true;
    return;
  }
  if (state.storySaved) {
    ui.storySaveBtn.disabled = true;
    ui.storySaveBtn.textContent = 'Saved';
    return;
  }
  if (!state.storyImagesComplete) {
    ui.storySaveBtn.disabled = true;
    ui.storySaveBtn.textContent = 'Finishing images…';
    return;
  }
  ui.storySaveBtn.disabled = false;
  ui.storySaveBtn.textContent = 'Save & Share';
}

async function saveStoryChronicle() {
  if (!state.storyChapters.length || !state.storyImagesComplete || state.storySaved) return;
  if (ui.storySaveBtn) {
    ui.storySaveBtn.disabled = true;
    ui.storySaveBtn.textContent = 'Saving…';
  }
  const payload = {
    title: ui.storyHeroTitle?.textContent || 'Our Future, Soon',
    inputs: {
      fragments_y: ui.storyFragmentsY?.value || '',
      fragments_n: ui.storyFragmentsN?.value || '',
      profile_y: ui.storyProfileY?.value || state.storyDefaults.profileY || '',
      profile_n: ui.storyProfileN?.value || state.storyDefaults.profileN || '',
      lens: getStoryLensProfile(),
      fantasy: getStoryFantasyProfile(),
      intimacy: getStoryIntimacy(),
      perspective: getStoryPerspective(),
      moment: ''
    },
    chapters: state.storyChapters,
    images: state.storyImages,
    user: state.user || 'Unknown'
  };
  const { data, error } = await supabase
    .from('story_chronicles')
    .insert(payload)
    .select('*')
    .single();
  if (error) {
    console.error('chronicle save', error);
    showToast(`Couldn't save story: ${error.message}`, 'error');
    updateStorySaveButton();
    return;
  }
  state.chronicles = [data, ...state.chronicles];
  renderChronicles();
  showToast('Saved to Chronicle.', 'success');
  state.storySaved = true;
  updateStorySaveButton();
}

function getStoryFantasyProfile() {
  if (!ui.storyFantasy) return 'balanced with cinematic, dreamy touches';
  const value = Number(ui.storyFantasy.value || 0);
  if (value >= 70) return 'dreamlike, mythic, and cinematic';
  if (value >= 40) return 'balanced: realistic with soft cinematic wonder';
  return 'grounded, realistic, and intimate';
}

function getStoryIntimacy() {
  const selected = [...(ui.storyIntimacyInputs || [])].find((input) => input.checked);
  return selected ? selected.value : 'tender';
}

function getStoryPerspective() {
  const selected = [...(ui.storyPerspectiveInputs || [])].find((input) => input.checked);
  return selected ? selected.value : 'us';
}

function updateChapterEstimate() {
  const count = computeChapterEstimate();
  if (ui.storyChapterHint) {
    ui.storyChapterHint.textContent = `Estimated chapters: ${count}`;
  }
}

function computeChapterEstimate() {
  const yText = ui.storyFragmentsY?.value || '';
  const nText = ui.storyFragmentsN?.value || '';
  const fragments = parseFragments(yText).length + parseFragments(nText).length;
  const chars = yText.length + nText.length;
  let count = STORY_MIN_CHAPTERS;
  if (chars > 1800 || fragments >= 14) count = 10;
  else if (chars > 1200 || fragments >= 10) count = 8;
  else if (chars > 700 || fragments >= 7) count = 6;
  else if (chars > 350 || fragments >= 5) count = 4;
  return Math.min(Math.max(count, STORY_MIN_CHAPTERS), STORY_MAX_CHAPTERS);
}

function parseFragments(text) {
  if (!text) return [];
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);
}

async function runStoryGeneration() {
  if (state.storyMirrorBusy) return;
  const yFragments = parseFragments(ui.storyFragmentsY?.value || '');
  const nFragments = parseFragments(ui.storyFragmentsN?.value || '');
  if (!yFragments.length && !nFragments.length) {
    setStoryStatus('Add at least one future fragment to begin.', 'error');
    return;
  }
  state.storyImages = [];
  state.storyChapters = [];
  state.storyImagesComplete = false;
  if (ui.storyMirrorView) {
    ui.storyMirrorView.classList.remove('storymirror-generated');
  }
  resetStoryHero();
  state.storyMirrorBusy = true;
  setStoryStatus('Weaving the story...', 'info');
  setStoryButtonsDisabled(true);
  openStoryRitual();
  try {
    const responseData = await requestStoryText({
      yFragments,
      nFragments,
      chapterCount: computeChapterEstimate(),
      profileY: ui.storyProfileY?.value || state.storyDefaults.profileY || '',
      profileN: ui.storyProfileN?.value || state.storyDefaults.profileN || '',
      extraDetails: ui.storyExtra?.value || '',
      fantasy: getStoryFantasyProfile(),
      lens: getStoryLensProfile(),
      intimacy: getStoryIntimacy(),
      perspective: getStoryPerspective()
    });
    if (!responseData || !responseData.chapters?.length) {
      throw new Error('No chapters returned.');
    }
    state.storyChapters = responseData.chapters;
    state.storyImages = new Array(responseData.chapters.length).fill('');
    renderStoryChapters();
    const storyTitle =
      responseData.story_title || responseData.title || responseData.chapters?.[0]?.title || 'Our Future, Soon';
    setStoryHeroTitle(storyTitle);
    if (ui.storyMirrorView) {
      ui.storyMirrorView.classList.add('storymirror-generated');
    }
    if (ui.storyFooter) {
      ui.storyFooter.hidden = false;
    }
    updateStorySaveButton();
    // Let the loading bar finish before dismissing.
    state.ritualFinishStart = Date.now();
    setTimeout(() => closeStoryRitual(), state.ritualFinishDuration);
    await generateChapterImages(responseData.chapters);
    state.storyImagesComplete = true;
    updateStorySaveButton();
    setStoryStatus('Story ready.', 'success');
  } catch (error) {
    console.error('story mirror', error);
    setStoryStatus(error.message || 'Something went wrong.', 'error');
    closeStoryRitual();
  } finally {
    state.storyMirrorBusy = false;
    setStoryButtonsDisabled(false);
  }
}

function setStoryButtonsDisabled(disabled) {
  if (ui.storyGenerate) ui.storyGenerate.disabled = disabled;
  if (ui.storyGenerateMoment) ui.storyGenerateMoment.disabled = disabled;
  if (ui.storyStepNext) ui.storyStepNext.disabled = disabled || state.storyStep >= STORY_STEP_COUNT;
  if (ui.storyStepBack) ui.storyStepBack.disabled = disabled || state.storyStep <= 1;
}

function setStoryStatus(message, tone) {
  if (!ui.storyStatus) return;
  ui.storyStatus.textContent = message;
  ui.storyStatus.dataset.tone = tone || 'info';
}

async function requestStoryText({
  yFragments,
  nFragments,
  chapterCount,
  profileY,
  profileN,
  fantasy,
  lens,
  intimacy,
  perspective,
  extraDetails
}) {
  const { data, error } = await supabase.functions.invoke('story-mirror', {
    body: {
      action: 'text',
      chapterCount,
      yFragments,
      nFragments,
      profileY,
      profileN,
      fantasy,
      lens,
      intimacy,
      perspective,
      extraDetails
    }
  });
  if (error) {
    throw new Error(error.message || 'Story request failed.');
  }
  return data;
}

function renderStoryChapters() {
  if (!ui.storyChapters || !ui.storyEmpty) return;
  const source = state.storyChapters;
  if (!source || source.length === 0) {
    ui.storyEmpty.hidden = false;
    ui.storyEmpty.setAttribute('aria-hidden', 'false');
    ui.storyChapters.innerHTML = '';
    return;
  }
  ui.storyEmpty.hidden = true;
  ui.storyEmpty.setAttribute('aria-hidden', 'true');
  ui.storyChapters.innerHTML = '';
  source.forEach((chapter, idx) => {
    const card = document.createElement('article');
    card.className = 'storymirror-chapter';
    const title = document.createElement('h3');
    title.textContent = chapter.title || `Chapter ${idx + 1}`;
    const text = document.createElement('p');
    text.textContent = chapter.text || '';
    const imageWrap = document.createElement('div');
    imageWrap.className = 'storymirror-image';
    const img = document.createElement('img');
    img.alt = chapter.caption || `Chapter ${idx + 1} visual`;
    img.dataset.index = String(idx);
    img.loading = 'lazy';
    if (state.storyImages[idx]) {
      img.src = state.storyImages[idx];
    } else {
      imageWrap.classList.add('is-loading');
      img.src =
        'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22225%22%3E%3Crect width=%22300%22 height=%22225%22 fill=%22%23f5e4ef%22/%3E%3C/svg%3E';
    }
    const caption = document.createElement('p');
    caption.className = 'storymirror-caption';
    caption.textContent = chapter.caption || '';
    imageWrap.appendChild(img);
    card.append(title, text, imageWrap, caption);
    ui.storyChapters.appendChild(card);
  });
}

async function generateChapterImages(chapters) {
  if (!ui.storyChapters) return;
  for (let i = 0; i < chapters.length; i += 1) {
    const chapter = chapters[i];
    if (!chapter?.image_prompt) continue;
    setStoryStatus(`Rendering image ${i + 1} of ${chapters.length}...`, 'info');
    const imgData = await requestStoryImage(chapter.image_prompt);
    const imgEl = ui.storyChapters.querySelector(`img[data-index="${i}"]`);
    if (imgEl && imgData) {
      state.storyImages[i] = imgData;
      imgEl.src = imgData;
      imgEl.closest('.storymirror-image')?.classList.remove('is-loading');
    }
  }
}

async function requestStoryImage(prompt) {
  const { data, error } = await supabase.functions.invoke('story-mirror', {
    body: {
      action: 'image',
      prompt
    }
  });
  if (error) {
    throw new Error(error.message || 'Image request failed.');
  }
  return data?.image || '';
}


function openStoryRitual() {
  if (!ui.storyRitual) return;
  ui.storyRitual.hidden = false;
  ui.storyRitual.setAttribute('aria-hidden', 'false');
  ui.storyRitual.classList.remove('is-leaving');
  ui.storyRitual.classList.add('is-visible');
  state.ritualProgress = 0;
  state.ritualStart = Date.now();
  state.ritualFinishStart = 0;
  state.ritualSpeed = 0.22 + Math.random() * 0.28;
  state.ritualDrift = 0.015 + Math.random() * 0.02;
  updateStoryRitualUI();
  startStoryWaitLoop();
}

function closeStoryRitual() {
  if (!ui.storyRitual) return;
  ui.storyRitual.classList.remove('is-visible');
  ui.storyRitual.classList.add('is-leaving');
  window.setTimeout(() => {
    ui.storyRitual.hidden = true;
    ui.storyRitual.setAttribute('aria-hidden', 'true');
    ui.storyRitual.classList.remove('is-leaving');
  }, 520);
  if (state.ritualFrame) {
    cancelAnimationFrame(state.ritualFrame);
    state.ritualFrame = null;
  }
  if (state.ritualTimer) {
    clearInterval(state.ritualTimer);
    state.ritualTimer = null;
  }
}

function startStoryWaitLoop() {
  state.ritualPromptIndex = 0;
  updateStoryWaitText();
  if (state.ritualTimer) clearInterval(state.ritualTimer);
  const step = () => {
    if (ui.storyRitual?.hidden) return;
    updateStoryRitualUI();
    state.ritualFrame = window.requestAnimationFrame(step);
  };
  if (state.ritualFrame) cancelAnimationFrame(state.ritualFrame);
  state.ritualFrame = window.requestAnimationFrame(step);
}

function updateStoryWaitText() {
  if (!ui.storyRitualText) return;
  const elapsed = Math.max(0, Date.now() - state.ritualStart);
  const index = Math.floor(elapsed / 6000) % STORY_WAIT_TEXTS.length;
  if (index !== state.ritualPromptIndex) {
    state.ritualPromptIndex = index;
    ui.storyRitualText.textContent = STORY_WAIT_TEXTS[index];
  }
}

function updateStoryRitualUI() {
  const elapsed = Math.max(0, Date.now() - state.ritualStart);
  const base = Math.min(0.9, elapsed / STORY_WAIT_DURATION);
  const wobble = (Math.sin(elapsed / 900) + 1) * 0.02;
  const jitter = (Math.sin(elapsed / 350) + 1) * 0.008;
  const randomDrift = (Math.sin(elapsed / 1400 + state.ritualSpeed) + 1) * state.ritualDrift;
  const cap = 0.92 + (Math.sin(elapsed / 1200) + 1) * 0.015;
  let progress = Math.min(cap, base + 0.02 + wobble + jitter + randomDrift);
  if (state.ritualFinishStart) {
    const t = Math.min(1, (Date.now() - state.ritualFinishStart) / state.ritualFinishDuration);
    const eased = 1 - Math.pow(1 - t, 2);
    progress = 0.88 + 0.12 * eased;
  }
  state.ritualProgress = Math.min(0.99, progress);
  if (ui.storyRitualFill) {
    ui.storyRitualFill.style.width = `${Math.round(state.ritualProgress * 100)}%`;
  }
  if (ui.storyRitualHint) {
    ui.storyRitualHint.textContent =
      state.ritualProgress >= 0.9 ? 'The first chapter is landing…' : 'The story is arriving…';
  }
  updateStoryWaitText();
}

function startOrbitHold() {
  if (state.orbitHolding) return;
  state.orbitHolding = true;
  if (ui.orbitHoldBtn) ui.orbitHoldBtn.classList.add('is-active');
  if (!state.orbitFrame) {
    state.orbitFrame = window.requestAnimationFrame(stepOrbit);
  }
  if (!state.orbitSparkTimer) {
    state.orbitSparkTimer = window.setInterval(spawnOrbitSpark, 1300);
  }
}

function stopOrbitHold() {
  if (!state.orbitHolding) return;
  state.orbitHolding = false;
  if (ui.orbitHoldBtn) ui.orbitHoldBtn.classList.remove('is-active');
  if (state.orbitSparkTimer) {
    clearInterval(state.orbitSparkTimer);
    state.orbitSparkTimer = null;
  }
  if (!state.orbitFrame) {
    state.orbitFrame = window.requestAnimationFrame(stepOrbit);
  }
}

function stepOrbit() {
  const target = state.orbitHolding ? 1 : 0;
  const speed = state.orbitHolding ? 0.018 : 0.012;
  state.orbitProgress = moveToward(state.orbitProgress, target, speed);
  updateOrbitUI();
  if (Math.abs(state.orbitProgress - target) > 0.001) {
    state.orbitFrame = window.requestAnimationFrame(stepOrbit);
  } else {
    state.orbitFrame = null;
  }
}

function moveToward(value, target, delta) {
  if (value < target) return Math.min(target, value + delta);
  if (value > target) return Math.max(target, value - delta);
  return value;
}

function updateOrbitUI() {
  if (ui.orbitStage) {
    ui.orbitStage.style.setProperty('--orbit-progress', state.orbitProgress.toFixed(3));
    const width = ui.orbitStage.clientWidth || 0;
    if (width < 10) {
      requestAnimationFrame(updateOrbitUI);
      return;
    }
    const center = width / 2;
    const maxDistance = Math.min(260, width * 0.7);
    const minDistance = 70;
    const distance = maxDistance - (maxDistance - minDistance) * state.orbitProgress;
    const leftX = center - distance / 2;
    const rightX = center + distance / 2;
    if (ui.orbitOrbA) ui.orbitOrbA.style.left = `${leftX}px`;
    if (ui.orbitOrbB) ui.orbitOrbB.style.left = `${rightX}px`;
    if (ui.orbitLocA) ui.orbitLocA.style.left = `${leftX}px`;
    if (ui.orbitLocB) ui.orbitLocB.style.left = `${rightX}px`;
    if (ui.orbitLine) {
      ui.orbitLine.style.left = `${leftX}px`;
      ui.orbitLine.style.width = `${distance}px`;
    }
  }
  if (ui.orbitStatus) {
    ui.orbitStatus.textContent =
      state.orbitProgress >= 0.98 ? 'Stay here a moment.' : 'Hold the button to pull closer.';
  }
  if (state.orbitProgress >= 0.98 && !state.orbitReached) {
    revealOrbit();
  }
  if (ui.orbitMerge) {
    if (state.orbitProgress >= 0.98) {
      ui.orbitMerge.classList.add('active');
      ui.orbitMerge.setAttribute('aria-hidden', 'false');
      if (ui.orbitOrbA) ui.orbitOrbA.classList.add('hidden');
      if (ui.orbitOrbB) ui.orbitOrbB.classList.add('hidden');
      if (ui.orbitLocA) ui.orbitLocA.classList.add('hidden');
      if (ui.orbitLocB) ui.orbitLocB.classList.add('hidden');
    } else {
      ui.orbitMerge.classList.remove('active');
      ui.orbitMerge.setAttribute('aria-hidden', 'true');
      if (ui.orbitOrbA) ui.orbitOrbA.classList.remove('hidden');
      if (ui.orbitOrbB) ui.orbitOrbB.classList.remove('hidden');
      if (ui.orbitLocA) ui.orbitLocA.classList.remove('hidden');
      if (ui.orbitLocB) ui.orbitLocB.classList.remove('hidden');
    }
  }
}

function resetOrbitState() {
  state.orbitHolding = false;
  state.orbitProgress = 0;
  state.orbitReached = false;
  if (state.orbitFrame) {
    cancelAnimationFrame(state.orbitFrame);
    state.orbitFrame = null;
  }
  if (state.orbitSparkTimer) {
    clearInterval(state.orbitSparkTimer);
    state.orbitSparkTimer = null;
  }
  if (ui.orbitHoldBtn) ui.orbitHoldBtn.classList.remove('is-active');
  if (ui.orbitReveal) {
    ui.orbitReveal.hidden = true;
    ui.orbitReveal.setAttribute('aria-hidden', 'true');
  }
  if (ui.orbitMerge) {
    ui.orbitMerge.classList.remove('active');
    ui.orbitMerge.setAttribute('aria-hidden', 'true');
  }
  if (ui.orbitLocA) ui.orbitLocA.classList.remove('hidden');
  if (ui.orbitLocB) ui.orbitLocB.classList.remove('hidden');
  if (ui.orbitSendBtn) ui.orbitSendBtn.disabled = true;
  if (ui.orbitSparkField) ui.orbitSparkField.innerHTML = '';
  updateOrbitUI();
}

function revealOrbit() {
  state.orbitReached = true;
  if (ui.orbitReveal) {
    ui.orbitReveal.hidden = false;
    ui.orbitReveal.setAttribute('aria-hidden', 'false');
  }
  const message = buildOrbitMessage();
  if (ui.orbitMessage) ui.orbitMessage.textContent = message;
  if (ui.orbitSendBtn) ui.orbitSendBtn.disabled = false;
}

function buildOrbitMessage() {
  const signature = state.user || 'Your love';
  return `Across every mile, I still end up right here with you. — ${signature}`;
}

function sendOrbitPostcard() {
  const message = ui.orbitMessage?.textContent?.trim();
  if (!message) return;
  openModal(message);
}

function spawnOrbitSpark() {
  if (!ui.orbitSparkField) return;
  const spark = document.createElement('span');
  spark.className = 'orbit-spark';
  const message = ORBIT_SPARKS[Math.floor(Math.random() * ORBIT_SPARKS.length)];
  const x = Math.random() * 70 + 15;
  spark.textContent = message;
  spark.style.left = `${x}%`;
  ui.orbitSparkField.appendChild(spark);
  setTimeout(() => spark.remove(), 3200);
}

function updateValentineCountdown() {
  if (!ui.valentineCountdown) return;
  const now = new Date();
  const year = now.getFullYear();
  let target = new Date(year, 1, 14);
  if (now > target) {
    target = new Date(year + 1, 1, 14);
  }
  const msPerDay = 1000 * 60 * 60 * 24;
  const diff = Math.ceil((target - now) / msPerDay);
  ui.valentineCountdown.textContent = diff <= 0 ? '0' : String(diff);
}

function showAuthGate() {
  state.user = null;
  state.userDisplay = null;
  state.started = false;
  ui.authGate.style.display = 'flex';
  ui.app.setAttribute('aria-hidden', 'true');
  setButtonState(ui.createBtn, false);
  updateAvatar();
}

async function applySessionUser(session) {
  if (!session?.user) return;
  const name = resolveUserName(session.user);
  if (!name) {
    ui.authError.textContent =
      'Account not configured. Ask the Loveboard owner to set your name in Supabase Auth metadata.';
    await supabase.auth.signOut();
    return;
  }
  state.user = name;
  state.userDisplay = getDisplayName(name);
  ui.authGate.style.display = 'none';
  ui.app.setAttribute('aria-hidden', 'false');
  enableCreateButton();
  updateAvatar();
  setWwanUser(state.user);
  resetOrbitState();
  if (!state.appConfigLoaded) {
    await loadAppConfig();
    applyAppConfig();
    const isAllowed = state.user === state.userIds.a || state.user === state.userIds.b;
    if (!isAllowed) {
      ui.authError.textContent =
        'Account not configured. Ask the Loveboard owner to set your name in Supabase Auth metadata.';
      await supabase.auth.signOut();
      return;
    }
    state.userDisplay = getDisplayName(state.user);
    updateAvatar();
    setWwanUser(state.user);
  }
  startApp();
}

function resolveUserName(user) {
  const meta = user.user_metadata || {};
  const candidate = meta.loveboard_name || meta.display_name || '';
  if (state.appConfigLoaded) {
    if (candidate === state.userIds.a || candidate === state.userIds.b) return candidate;
    return null;
  }
  if (candidate) return candidate;
  return null;
}

async function handleAuth(event) {
  event.preventDefault();
  ui.authError.textContent = '';
  const email = ui.emailInput?.value.trim();
  const password = ui.passwordInput?.value || '';
  if (!email || !password) {
    ui.authError.textContent = 'Enter email and password.';
    return;
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    ui.authError.textContent = error.message || 'Login failed.';
    return;
  }
  await applySessionUser(data.session);
}

async function startApp() {
  if (state.started) return;
  state.started = true;
  await Promise.all([loadPostcards(), loadMoods(), loadChronicles()]);
  subscribeRealtime();
  subscribeCommentBroadcast();
}

async function restoreSession() {
  const { data } = await supabase.auth.getSession();
  if (!data?.session) return;
  await applySessionUser(data.session);
}

async function loadPostcards() {
  const { data, error } = await supabase
    .from('postcards')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('postcards load', error);
    showToast(`Couldn't load postcards: ${error.message}`, 'error');
    return;
  }
  state.postcards = data || [];
  state.postcardLimit = Math.min(
    Math.max(state.postcardLimit || DEFAULT_POSTCARD_BATCH, DEFAULT_POSTCARD_BATCH),
    state.postcards.length || DEFAULT_POSTCARD_BATCH
  );
  await Promise.all([loadReactions(), loadComments(), loadCommentReactions()]);
  renderBoard();
  if (state.constellationOpen) {
    renderConstellation();
  }
  updateViewSwitchers(
    state.constellationOpen
      ? 'constellation'
      : state.ldAppOpen
        ? 'ldapp'
        : state.storyMirrorOpen
          ? 'storymirror'
          : state.chronicleOpen
            ? 'chronicle'
            : state.valentineOpen
              ? 'valentine'
              : 'loveboard'
  );
}

async function loadChronicles() {
  state.chronicleLoading = true;
  renderChronicles();
  const { data, error } = await supabase
    .from('story_chronicles')
    .select('*')
    .order('created_at', { ascending: false });
  state.chronicleLoading = false;
  if (error) {
    console.error('chronicles load', error);
    renderChronicles();
    return;
  }
  state.chronicles = data || [];
  renderChronicles();
}

function renderChronicles() {
  if (!ui.chronicleGrid || !ui.chronicleEmpty) return;
  ui.chronicleGrid.innerHTML = '';
  if (state.chronicleLoading) {
    ui.chronicleEmpty.hidden = true;
    const count = Math.max(1, state.chroniclePlaceholderCount || 4);
    for (let i = 0; i < count; i += 1) {
      const card = document.createElement('article');
      card.className = 'chronicle-card chronicle-placeholder';
      const cover = document.createElement('div');
      cover.className = 'chronicle-cover chronicle-skeleton';
      const title = document.createElement('div');
      title.className = 'chronicle-skeleton-line chronicle-skeleton-title chronicle-skeleton';
      const meta = document.createElement('div');
      meta.className = 'chronicle-skeleton-line chronicle-skeleton-meta chronicle-skeleton';
      card.append(cover, title, meta);
      ui.chronicleGrid.appendChild(card);
    }
    return;
  }
  if (!state.chronicles.length) {
    ui.chronicleEmpty.hidden = false;
    return;
  }
  ui.chronicleEmpty.hidden = true;
  state.chronicles.forEach((story) => {
    const card = document.createElement('article');
    card.className = 'chronicle-card';
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'chronicle-card-delete';
    deleteBtn.textContent = 'Delete';
    deleteBtn.setAttribute('aria-label', `Delete ${story.title || 'story'}`);
    deleteBtn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      state.activeChronicle = story;
      openChronicleDeleteModal();
    });
    const cover = document.createElement('div');
    cover.className = 'chronicle-cover';
    const img = document.createElement('img');
    img.alt = story.title || 'Story cover';
    if (story.images?.[0]) {
      img.src = story.images[0];
    }
    cover.appendChild(img);
    const title = document.createElement('h3');
    title.textContent = story.title || 'Untitled';
    const meta = document.createElement('p');
    meta.className = 'chronicle-meta';
    meta.textContent = `${story.user || ''} · ${formatDate(story.created_at)}`;
    card.append(deleteBtn, cover, title, meta);
    card.addEventListener('click', () => openChronicleStory(story));
    ui.chronicleGrid.appendChild(card);
  });
}

function openChronicleStory(story) {
  if (!story) return;
  state.activeChronicle = story;
  showStoryMirror();
  state.storyChapters = Array.isArray(story.chapters) ? story.chapters : [];
  state.storyImages = Array.isArray(story.images) ? story.images : [];
  state.storyImagesComplete = true;
  state.storySaved = true;
  if (ui.storyMirrorView) {
    ui.storyMirrorView.classList.add('storymirror-generated');
  }
  if (ui.storyFooter) {
    ui.storyFooter.hidden = false;
  }
  setStoryHeroTitle(story.title || 'Our Future, Soon');
  renderStoryChapters();
  updateStorySaveButton();
}

function openChronicleModal(story) {
  if (!ui.chronicleModal) return;
  state.activeChronicle = story;
  renderChronicleModal();
  ui.chronicleModal.showModal();
}

function closeChronicleModal() {
  if (!ui.chronicleModal) return;
  ui.chronicleModal.close();
  state.activeChronicle = null;
}

function openChronicleDeleteModal() {
  if (!state.activeChronicle) return;
  if (!ui.chronicleDeleteModal) return;
  ui.chronicleDeleteModal.showModal();
}

function closeChronicleDeleteModal(clearActive = true) {
  if (!ui.chronicleDeleteModal) return;
  ui.chronicleDeleteModal.close();
  if (!clearActive) return;
  if (!ui.chronicleModal?.open && !state.storyMirrorOpen) {
    state.activeChronicle = null;
  }
}

function confirmChronicleDelete() {
  closeChronicleDeleteModal(false);
  deleteActiveChronicle();
}

function renderChronicleModal() {
  if (!state.activeChronicle || !ui.chronicleModalTitle || !ui.chronicleModalBody) return;
  const story = state.activeChronicle;
  ui.chronicleModalTitle.textContent = story.title || 'Story';
  ui.chronicleModalBody.innerHTML = '';
  (story.chapters || []).forEach((chapter, idx) => {
    const card = document.createElement('article');
    card.className = 'chronicle-chapter';
    const title = document.createElement('h3');
    title.textContent = chapter.title || `Chapter ${idx + 1}`;
    if (story.images?.[idx]) {
      const imgWrap = document.createElement('div');
      imgWrap.className = 'chronicle-image';
      const img = document.createElement('img');
      img.src = story.images[idx];
      img.alt = chapter.caption || `Chapter ${idx + 1} visual`;
      imgWrap.appendChild(img);
      card.appendChild(imgWrap);
    }
    const text = document.createElement('p');
    text.textContent = chapter.text || '';
    const caption = document.createElement('p');
    caption.className = 'chronicle-caption';
    caption.textContent = chapter.caption || '';
    card.append(title, text, caption);
    ui.chronicleModalBody.appendChild(card);
  });
}

async function deleteActiveChronicle() {
  const story = state.activeChronicle;
  if (!story) return;
  const wasStoryMirrorOpen = state.storyMirrorOpen;
  const { error } = await supabase.from('story_chronicles').delete().eq('id', story.id);
  if (error) {
    showToast(`Couldn't delete story: ${error.message}`, 'error');
    return;
  }
  state.chronicles = state.chronicles.filter((item) => item.id !== story.id);
  renderChronicles();
  closeChronicleModal();
  state.activeChronicle = null;
  if (wasStoryMirrorOpen) {
    resetStoryFlow();
    showChronicle();
  }
}

function renderBoard(options = {}) {
  const { revealFromIndex } = options;
  ui.board.innerHTML = '';
  state.openReactionPicker = null;
  if (!state.postcards.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Your Loveboard is waiting for the first postcard ✨';
    ui.board.appendChild(empty);
    return;
  }
  const visible = state.postcards.slice(0, state.postcardLimit || DEFAULT_POSTCARD_BATCH);
  visible.forEach((card, index) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.id = card.id;
    if (card.user === state.user) {
      node.classList.add('own');
    }
    if (Number.isInteger(revealFromIndex) && index >= revealFromIndex) {
      node.classList.add('new-card');
      node.style.animationDelay = `${Math.min(index - revealFromIndex, 6) * 40}ms`;
    }
    node.style.setProperty('--tilt', getTilt(card.id));
    node.querySelectorAll('.meta').forEach((metaEl) => {
      metaEl.textContent = `${getDisplayName(card.user)} · ${formatDate(card.created_at)}`;
    });
    node.querySelector('.note').textContent = card.message || 'No message, just vibes.';

    const visual = node.querySelector('.visual');
    const defaultVisual = node.querySelector('.default-visual');
    const audioPanel = node.querySelector('.audio-only');
    const audioPlayer = node.querySelector('.audio-player');
    const deleteBtn = node.querySelector('.delete-card');
    const reactionCounts = node.querySelectorAll('.reaction-counts');
    const reactButtons = node.querySelectorAll('.react-btn');
    const reactionPickers = node.querySelectorAll('.reaction-picker');
  const commentLists = node.querySelectorAll('.comment-list');
  const commentForms = node.querySelectorAll('.comment-form');

    visual.hidden = true;
    defaultVisual.hidden = true;
    audioPanel.hidden = true;
    node.classList.remove('audio-mode');

    const isVisual = card.type === 'image' || card.type === 'doodle';
    const isAudio = card.type === 'audio';

    let needsMeasure = true;
    if (isAudio) {
      node.classList.add('audio-mode');
      audioPanel.hidden = false;
      if (card.asset_url) {
        audioPlayer.src = card.asset_url;
        audioPlayer.load();
      }
      const viz = document.createElement('div');
      viz.className = 'audio-visual';
      viz.innerHTML = '<span></span><span></span><span></span><span></span><span></span>';
      audioPanel.insertBefore(viz, audioPanel.firstChild);
      audioPlayer.addEventListener('play', () => viz.classList.add('playing'));
      ['pause', 'ended'].forEach((evt) => audioPlayer.addEventListener(evt, () => viz.classList.remove('playing')));
      needsMeasure = false;
      requestAnimationFrame(() => measureCardHeight(node));
    } else if (isVisual && card.asset_url) {
      visual.hidden = false;
      visual.src = card.asset_url;
      visual.alt = `${card.type} from ${getDisplayName(card.user)}`;
      const triggerMeasure = () => requestAnimationFrame(() => measureCardHeight(node));
      if (visual.complete) {
        triggerMeasure();
      } else {
        visual.addEventListener('load', triggerMeasure, { once: true });
      }
      needsMeasure = false;
    } else {
      defaultVisual.hidden = false;
      defaultVisual.src = DEFAULT_NOTE_IMG;
    }

    if (!isAudio) {
      node.addEventListener('click', () => {
        node.classList.toggle('flipped');
        node.classList.add('revealed');
      });
    }

    if (card.user === state.user && deleteBtn) {
      deleteBtn.hidden = false;
      deleteBtn.addEventListener('click', (evt) => {
        evt.stopPropagation();
        confirmDelete(card.id);
      });
    } else if (deleteBtn) {
      deleteBtn.hidden = true;
    }

    reactionCounts.forEach((container) => renderReactionCounts(card.id, container));
    reactionPickers.forEach((picker) => setupReactionPicker(picker, card.id));
    reactButtons.forEach((btn, idx) => {
      const picker = reactionPickers[idx];
      btn.addEventListener('click', (evt) => {
        evt.stopPropagation();
        toggleReactionPicker(btn.closest('.reaction-area'), picker);
      });
    });
    commentLists.forEach((container) => {
      setupCommentList(container);
      renderComments(card.id, container);
    });
    commentForms.forEach((form) => setupCommentForm(form, card.id));

    ui.board.appendChild(node);
    if (needsMeasure) {
      scheduleCardMeasurement(node);
    }
  });

  const remaining = state.postcards.length - visible.length;
  if (remaining > 0) {
    const loadMore = document.createElement('button');
    loadMore.type = 'button';
    loadMore.className = 'load-more';
    const label = document.createElement('span');
    label.textContent = 'Load more postcards';
    const count = document.createElement('span');
    count.className = 'load-more-count';
    count.textContent = `${remaining}`;
    loadMore.append(label, count);
    loadMore.addEventListener('click', handleLoadMore);
    ui.board.appendChild(loadMore);
  }
}

function handleLoadMore() {
  const current = state.postcardLimit || DEFAULT_POSTCARD_BATCH;
  const nextLimit = Math.min(state.postcards.length, current + DEFAULT_POSTCARD_BATCH);
  if (nextLimit === current) return;
  const scrollTop = window.scrollY;
  state.postcardLimit = nextLimit;
  renderBoard({ revealFromIndex: current });
  requestAnimationFrame(() => {
    window.scrollTo({ top: scrollTop, behavior: 'auto' });
  });
}

async function loadMoods() {
  Object.keys(state.moodPresets || {}).forEach(updateMoodTimestamp);
  const users = Object.keys(state.moodPresets || {});
  const results = await Promise.all(
    users.map((user) =>
      supabase.from('moods').select('*').eq('user', user).order('date', { ascending: false }).limit(1)
    )
  );
  const data = results.flatMap((result) => result.data || []);
  const error = results.find((result) => result.error)?.error;
  if (error) {
    console.error('moods load', error);
    showToast(`Couldn't load moods: ${error.message}`, 'error');
    return;
  }
  (data || []).forEach((entry) => {
    const changedAt = entry.updated_at || entry.created_at || entry.date;
    setMood(entry.user, entry.emoji, changedAt);
  });
}

async function loadReactions() {
  const { data, error } = await supabase
    .from('postcard_reactions')
    .select('postcard_id,reaction,user');
  if (error) {
    console.error('reactions load', error);
    return;
  }
  state.reactions = {};
  state.userReactions = {};
  (data || []).forEach(applyReactionRow);
}

async function loadComments() {
  let data;
  let error;
  ({ data, error } = await fetchComments(buildCommentColumns()));
  if (error && state.commentUpdatedAtSupported && isUpdatedAtMissing(error)) {
    state.commentUpdatedAtSupported = false;
    ({ data, error } = await fetchComments(buildCommentColumns()));
  }
  if (error) {
    console.error('comments load', error);
    return;
  }
  state.comments = {};
  (data || []).forEach(applyCommentRow);
}

function buildCommentColumns() {
  const parts = ['id', 'postcard_id', 'user', 'comment', 'created_at'];
  if (state.commentUpdatedAtSupported) {
    parts.push('updated_at');
  }
  return parts.join(',');
}

function fetchComments(columns) {
  return supabase
    .from('postcard_comments')
    .select(columns)
    .order('created_at', { ascending: true });
}

async function loadCommentReactions() {
  const { data, error } = await supabase
    .from('comment_reactions')
    .select('comment_id,postcard_id,reaction,user');
  if (error) {
    console.error('comment reactions load', error);
    return;
  }
  state.commentReactions = {};
  state.commentUserReactions = {};
  (data || []).forEach(applyCommentReactionRow);
}

function setMood(user, emoji, changedAt) {
  const btn = document.querySelector(`.mood-btn[data-user="${user}"]`);
  if (!btn) return;
  const mood = getMoodMeta(emoji, user);
  btn.dataset.mood = emoji;
  btn.innerHTML = `${emoji} <span>${mood ? mood.label : ''}</span>`;
  if (changedAt) {
    state.moodTimes[user] = changedAt;
    persistMoodTimes();
  }
  updateMoodTimestamp(user);
}

function updateMoodTimestamp(user) {
  const timeEl = document.querySelector(`.mood-updated[data-user="${user}"]`);
  if (!timeEl) return;
  const timestamp = state.moodTimes[user];
  if (timestamp) {
    timeEl.textContent = formatMoodTimestamp(timestamp);
  } else {
    timeEl.textContent = '—';
  }
}

function openMoodPicker(anchorBtn) {
  if (!state.user) return;
  if (anchorBtn.dataset.user !== state.user) return;
  closeMoodMenus();
  const menu = document.createElement('div');
  menu.className = 'mood-menu';
  const options = getMoodOptions(state.user);
  options.forEach(({ emoji, label }) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.innerHTML = `${emoji}<small>${label}</small>`;
    option.addEventListener('click', async () => {
      await saveMood(emoji);
      closeMoodMenus();
    });
    menu.appendChild(option);
  });
  anchorBtn.parentElement.appendChild(menu);
  attachMoodClickAway();
  positionMoodMenu(menu);
}

function closeMoodMenus() {
  document.querySelectorAll('.mood-menu').forEach((menu) => menu.remove());
  detachMoodClickAway();
}

function openStoryMenu(menu) {
  if (!menu) return;
  menu.classList.add('is-open');
  const toggle = menu.querySelector('.story-menu-toggle');
  if (toggle) toggle.setAttribute('aria-expanded', 'true');
}

function closeStoryMenus(exceptMenu) {
  document.querySelectorAll('.story-menu').forEach((menu) => {
    if (exceptMenu && menu === exceptMenu) return;
    menu.classList.remove('is-open');
    const toggle = menu.querySelector('.story-menu-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  });
}

function setupStoryMenus() {
  if (!ui.storyMenus?.length) return;
  ui.storyMenuToggles.forEach((toggle) => {
    toggle.addEventListener('click', (evt) => {
      evt.stopPropagation();
      const menu = toggle.closest('.story-menu');
      if (!menu) return;
      const isOpen = menu.classList.contains('is-open');
      closeStoryMenus(menu);
      if (!isOpen) openStoryMenu(menu);
    });
  });
  ui.storyMenuOptions.forEach((option) => {
    option.addEventListener('click', () => {
      const targetView = option.dataset.view;
      closeStoryMenus();
      handleViewSwitch(targetView);
    });
  });
  if (!state.storyMenuListener) {
    state.storyMenuListener = (evt) => {
      if (evt.target.closest('.story-menu')) return;
      closeStoryMenus();
    };
    document.addEventListener('click', state.storyMenuListener);
  }
  if (!state.storyMenuKeyListener) {
    state.storyMenuKeyListener = (evt) => {
      if (evt.key === 'Escape') {
        closeStoryMenus();
      }
    };
    document.addEventListener('keydown', state.storyMenuKeyListener, true);
  }
}

async function saveMood(emoji) {
  const today = new Date().toISOString().slice(0, 10);
  const changedAt = new Date().toISOString();
  const payload = {
    user: state.user,
    date: today,
    emoji
  };
  if (state.moodUpdatedAtSupported) {
    payload.updated_at = changedAt;
  }
  let error;
  ({ error } = await supabase.from('moods').upsert(payload, { onConflict: 'user,date' }));
  if (error && state.moodUpdatedAtSupported && isUpdatedAtMissing(error)) {
    state.moodUpdatedAtSupported = false;
    ({ error } = await supabase.from('moods').upsert(
      {
        user: state.user,
        date: today,
        emoji
      },
      { onConflict: 'user,date' }
    ));
  }
  if (error) {
    console.error('mood save', error);
    showToast(`Couldn't save mood: ${error.message}`, 'error');
    return;
  }
  setMood(state.user, emoji, changedAt);
}

function handleViewSwitch(view) {
  closeStoryMenus();
  if (!view) return;
  if (view === 'loveboard') {
    showLoveboard();
  } else if (view === 'ldapp') {
    showLdApp();
  } else if (view === 'storymirror') {
    showStoryMirror();
  } else if (view === 'chronicle') {
    showChronicle();
  } else if (view === 'constellation') {
    showConstellation();
  } else if (view === 'valentine') {
    showValentine();
  }
}

function getActiveView() {
  if (state.storyMirrorOpen) return ui.storyMirrorView;
  if (state.chronicleOpen) return ui.chronicleView;
  if (state.constellationOpen) return ui.constellationView;
  if (state.ldAppOpen) return ui.ldAppView;
  if (state.valentineOpen) return ui.valentineView;
  return ui.loveboardView;
}

function showLoveboard() {
  if (!ui.loveboardView) return;
  const current = getActiveView();
  if (current === ui.loveboardView) return;
  const focusTarget = ui.viewSwitchButtons?.[0];
  switchView(ui.loveboardView, current, () => focusTarget?.focus());
  state.ldAppOpen = false;
  state.constellationOpen = false;
  state.valentineOpen = false;
  state.storyMirrorOpen = false;
  state.chronicleOpen = false;
  cleanupLdAppListeners();
  cleanupConstellationListeners();
  cleanupValentineListeners();
  cleanupStoryMirrorListeners();
  cleanupChronicleListeners();
  updateViewSwitchers('loveboard');
}

function showLdApp() {
  if (!ui.ldAppView) return;
  const current = getActiveView();
  if (current === ui.ldAppView) return;
  switchView(ui.ldAppView, current);
  state.ldAppOpen = true;
  state.constellationOpen = false;
  state.valentineOpen = false;
  state.storyMirrorOpen = false;
  state.chronicleOpen = false;
  cleanupConstellationListeners();
  cleanupValentineListeners();
  cleanupStoryMirrorListeners();
  cleanupChronicleListeners();
  updateViewSwitchers('ldapp');
  attachLdAppListeners();
}

function showStoryMirror() {
  if (!ui.storyMirrorView) return;
  const current = getActiveView();
  if (current === ui.storyMirrorView) return;
  switchView(ui.storyMirrorView, current);
  state.storyMirrorOpen = true;
  state.ldAppOpen = false;
  state.constellationOpen = false;
  state.valentineOpen = false;
  state.chronicleOpen = false;
  updateViewSwitchers('storymirror');
  setStoryStep(1);
  cleanupLdAppListeners();
  cleanupConstellationListeners();
  cleanupValentineListeners();
  cleanupChronicleListeners();
  attachStoryMirrorListeners();
}

function showChronicle() {
  if (!ui.chronicleView) return;
  const current = getActiveView();
  if (current === ui.chronicleView) return;
  switchView(ui.chronicleView, current);
  state.chronicleOpen = true;
  state.storyMirrorOpen = false;
  state.ldAppOpen = false;
  state.constellationOpen = false;
  state.valentineOpen = false;
  updateViewSwitchers('chronicle');
  cleanupLdAppListeners();
  cleanupConstellationListeners();
  cleanupValentineListeners();
  cleanupStoryMirrorListeners();
  attachChronicleListeners();
}

function showConstellation() {
  if (!ui.constellationView) return;
  const current = getActiveView();
  if (current === ui.constellationView) return;
  switchView(ui.constellationView, current);
  state.constellationOpen = true;
  state.ldAppOpen = false;
  state.valentineOpen = false;
  state.storyMirrorOpen = false;
  state.chronicleOpen = false;
  renderConstellation();
  setupConstellationResize();
  updateViewSwitchers('constellation');
  attachConstellationListeners();
  cleanupLdAppListeners();
  cleanupValentineListeners();
  cleanupStoryMirrorListeners();
  cleanupChronicleListeners();
}

function showValentine() {
  if (!ui.valentineView) return;
  const current = getActiveView();
  if (current === ui.valentineView) return;
  switchView(ui.valentineView, current);
  state.valentineOpen = true;
  state.ldAppOpen = false;
  state.constellationOpen = false;
  state.storyMirrorOpen = false;
  state.chronicleOpen = false;
  updateViewSwitchers('valentine');
  cleanupLdAppListeners();
  cleanupConstellationListeners();
  cleanupStoryMirrorListeners();
  cleanupChronicleListeners();
  attachValentineListeners();
  requestAnimationFrame(updateOrbitUI);
  setTimeout(updateOrbitUI, 360);
}

function attachLdAppListeners() {
  if (!state.ldAppKeyListener) {
    state.ldAppKeyListener = (evt) => {
      if (evt.key === 'Escape') {
        showLoveboard();
      }
    };
    document.addEventListener('keydown', state.ldAppKeyListener, true);
  }
}

function cleanupLdAppListeners() {
  if (state.ldAppKeyListener) {
    document.removeEventListener('keydown', state.ldAppKeyListener, true);
    state.ldAppKeyListener = null;
  }
}

function attachStoryMirrorListeners() {
  if (!state.storyMirrorKeyListener) {
    state.storyMirrorKeyListener = (evt) => {
      if (evt.key === 'Escape') {
        showLoveboard();
      }
    };
    document.addEventListener('keydown', state.storyMirrorKeyListener, true);
  }
}

function cleanupStoryMirrorListeners() {
  if (state.storyMirrorKeyListener) {
    document.removeEventListener('keydown', state.storyMirrorKeyListener, true);
    state.storyMirrorKeyListener = null;
  }
}

function attachChronicleListeners() {
  if (!state.chronicleKeyListener) {
    state.chronicleKeyListener = (evt) => {
      if (evt.key === 'Escape') {
        if (ui.chronicleModal?.open) {
          closeChronicleModal();
        } else {
          showLoveboard();
        }
      }
    };
    document.addEventListener('keydown', state.chronicleKeyListener, true);
  }
}

function cleanupChronicleListeners() {
  if (state.chronicleKeyListener) {
    document.removeEventListener('keydown', state.chronicleKeyListener, true);
    state.chronicleKeyListener = null;
  }
}

function attachConstellationListeners() {
  if (!state.constellationKeyListener) {
    state.constellationKeyListener = (evt) => {
      if (evt.key === 'Escape') {
        if (!ui.constellationDetail?.hidden) {
          closeConstellationDetail();
        } else {
          showLoveboard();
        }
      }
    };
    document.addEventListener('keydown', state.constellationKeyListener, true);
  }
}

function cleanupConstellationListeners() {
  if (state.constellationKeyListener) {
    document.removeEventListener('keydown', state.constellationKeyListener, true);
    state.constellationKeyListener = null;
  }
}

function attachValentineListeners() {
  if (!state.valentineKeyListener) {
    state.valentineKeyListener = (evt) => {
      if (evt.key === 'Escape') {
        showLoveboard();
      }
    };
    document.addEventListener('keydown', state.valentineKeyListener, true);
  }
  if (!state.orbitResizeListener) {
    state.orbitResizeListener = () => requestAnimationFrame(updateOrbitUI);
    window.addEventListener('resize', state.orbitResizeListener, { passive: true });
  }
}

function cleanupValentineListeners() {
  if (state.valentineKeyListener) {
    document.removeEventListener('keydown', state.valentineKeyListener, true);
    state.valentineKeyListener = null;
  }
  if (state.orbitResizeListener) {
    window.removeEventListener('resize', state.orbitResizeListener);
    state.orbitResizeListener = null;
  }
}

function updateViewSwitchers(view) {
  if (!ui.viewSwitchButtons) return;
  ui.viewSwitchButtons.forEach((btn) => {
    const isStories = btn.dataset.view === 'stories';
    const isActive = isStories ? view === 'storymirror' || view === 'chronicle' : btn.dataset.view === view;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-current', isActive ? 'page' : 'false');
  });
}

function setupConstellationResize() {
  if (state.constellationResizeListener) return;
  state.constellationResizeListener = () => {
    if (!state.constellationOpen) return;
    requestAnimationFrame(renderConstellation);
  };
  window.addEventListener('resize', state.constellationResizeListener, { passive: true });
}

function renderConstellation() {
  if (!ui.constellationSky || !ui.constellationCanvas || !ui.constellationStars) return;
  ui.constellationStars.innerHTML = '';
  const cards = [...state.postcards].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  if (!cards.length) {
    if (ui.constellationHint) {
      ui.constellationHint.textContent = 'No postcards yet. Your sky is waiting.';
    }
    clearConstellationCanvas();
    return;
  }
  if (ui.constellationHint) {
    ui.constellationHint.textContent = 'Tap a star to reveal the memory.';
  }
  const { width, height } = ui.constellationSky.getBoundingClientRect();
  const layout = buildConstellationLayout(cards, width, height);
  drawConstellationScene(layout, width, height);
  layout.points.forEach((point) => {
    const star = document.createElement('button');
    star.type = 'button';
    star.className = `constellation-star ${point.userClass}`;
    star.style.left = `${point.x}px`;
    star.style.top = `${point.y}px`;
    star.style.setProperty('--star-size', `${point.size}px`);
    star.style.setProperty('--float-delay', point.floatDelay);
    star.style.setProperty('--float-duration', point.floatDuration);
    star.dataset.id = point.id;
    star.dataset.label = point.label;
    star.setAttribute('aria-label', point.label);
    star.addEventListener('click', () => openConstellationDetail(point.card));
    ui.constellationStars.appendChild(star);
  });
}

function buildConstellationLayout(cards, width, height) {
  const centerX = width / 2;
  const centerY = height * 0.52;
  const isCompact = width < 520;
  const pad = 28;
  const verticalSpan = height * (isCompact ? 0.86 : 0.78);
  const letterWidth = width * (isCompact ? 0.3 : 0.36);
  const gap = width * (isCompact ? 0.08 : 0.1);
  const startY = centerY + verticalSpan / 2;
  const leftCenter = centerX - (letterWidth / 2 + gap / 2);
  const rightCenter = centerX + (letterWidth / 2 + gap / 2);
  const topY = startY - verticalSpan;
  const midY = startY - verticalSpan * 0.5;
  const bottomY = startY;
  const yLeft = [
    { x: leftCenter - letterWidth / 2, y: topY },
    { x: leftCenter, y: midY },
    { x: leftCenter + letterWidth / 2, y: topY },
    { x: leftCenter, y: midY },
    { x: leftCenter, y: bottomY }
  ];
  const nRight = [
    { x: rightCenter - letterWidth / 2, y: bottomY },
    { x: rightCenter - letterWidth / 2, y: topY },
    { x: rightCenter + letterWidth / 2, y: bottomY },
    { x: rightCenter + letterWidth / 2, y: topY }
  ];
  const yPath = buildStrokePath(yLeft);
  const nPath = buildStrokePath(nRight);
  const yBridge = yLeft[2];
  const nBridge = nRight[0];
  const points = cards.map((card, index) => {
    const seed = hashString(card.id || card.created_at || `${index}`);
    const rng = mulberry32(seed);
    const progress = cards.length > 1 ? index / (cards.length - 1) : 0.5;
    const wobbleX = (rng() - 0.5) * (isCompact ? 6 : 9);
    const wobbleY = (rng() - 0.5) * (isCompact ? 8 : 12);
    let x;
    let y;
    if (progress < 0.48) {
      const local = progress / 0.48;
      ({ x, y } = sampleStroke(yPath, local));
    } else if (progress < 0.52) {
      const local = (progress - 0.48) / 0.04;
      x = yBridge.x + (nBridge.x - yBridge.x) * local;
      y = yBridge.y + (nBridge.y - yBridge.y) * local;
    } else {
      const local = (progress - 0.52) / 0.48;
      ({ x, y } = sampleStroke(nPath, local));
    }
    x += wobbleX;
    y += wobbleY;
    x = Math.max(pad, Math.min(width - pad, x));
    y = Math.max(pad, Math.min(height - pad, y));
    const minSize = isCompact ? 10 : 7;
    const size = minSize + rng() * (isCompact ? 8 : 7);
    const userClass = card.user === state.userIds.a ? 'user-a' : 'user-b';
    return {
      id: card.id,
      x,
      y,
      size,
      card,
      userClass,
      order: index,
      label: `${getDisplayName(card.user)} · ${formatDate(card.created_at)}`,
      floatDelay: `${rng() * 2.4}s`,
      floatDuration: `${3.8 + rng() * 2.8}s`
    };
  });
  return { points, centerX, centerY };
}

function buildStrokePath(nodes) {
  const segments = [];
  let total = 0;
  for (let i = 0; i < nodes.length - 1; i += 1) {
    const a = nodes[i];
    const b = nodes[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    segments.push({ a, b, len });
    total += len;
  }
  return { segments, total: Math.max(total, 1) };
}

function sampleStroke(path, t) {
  let distance = t * path.total;
  for (let i = 0; i < path.segments.length; i += 1) {
    const seg = path.segments[i];
    if (distance <= seg.len || i === path.segments.length - 1) {
      const ratio = seg.len === 0 ? 0 : distance / seg.len;
      return {
        x: seg.a.x + (seg.b.x - seg.a.x) * ratio,
        y: seg.a.y + (seg.b.y - seg.a.y) * ratio
      };
    }
    distance -= seg.len;
  }
  return { x: path.segments[0].a.x, y: path.segments[0].a.y };
}

function drawConstellationScene(layout, width, height) {
  if (!ui.constellationCanvas) return;
  const canvas = ui.constellationCanvas;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(width * dpr));
  canvas.height = Math.max(1, Math.floor(height * dpr));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);
  if (!layout.points.length) return;
  const glow = ctx.createRadialGradient(layout.centerX, layout.centerY, 0, layout.centerX, layout.centerY, 200);
  glow.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
  glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(layout.centerX, layout.centerY, 200, 0, Math.PI * 2);
  ctx.fill();
  const points = layout.points;
  if (points.length < 2) return;
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const offset = ((i % 2 === 0 ? 1 : -1) * 0.08) * len;
    const ctrlX = midX - (dy / len) * offset;
    const ctrlY = midY + (dx / len) * offset;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(ctrlX, ctrlY, end.x, end.y);
    ctx.stroke();
  }
}

function clearConstellationCanvas() {
  if (!ui.constellationCanvas) return;
  const canvas = ui.constellationCanvas;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function openConstellationDetail(card) {
  if (!ui.constellationDetail || !ui.constellationMeta || !ui.constellationMessage) return;
  state.constellationActiveId = card.id;
  ui.constellationMeta.textContent = `${getDisplayName(card.user)} · ${formatDate(card.created_at)}`;
  ui.constellationMessage.textContent = card.message || 'No message, just vibes.';
  if (ui.constellationMedia) {
    ui.constellationMedia.innerHTML = '';
    if ((card.type === 'image' || card.type === 'doodle') && card.asset_url) {
      const img = document.createElement('img');
      img.src = card.asset_url;
      img.alt = `${card.type} from ${getDisplayName(card.user)}`;
      ui.constellationMedia.appendChild(img);
    } else if (card.type === 'audio' && card.asset_url) {
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src = card.asset_url;
      ui.constellationMedia.appendChild(audio);
    }
  }
  ui.constellationDetail.hidden = false;
  ui.constellationDetail.setAttribute('aria-hidden', 'false');
}

function closeConstellationDetail() {
  if (!ui.constellationDetail) return;
  ui.constellationDetail.hidden = true;
  ui.constellationDetail.setAttribute('aria-hidden', 'true');
  state.constellationActiveId = null;
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function switchView(showEl, hideEl, onComplete) {
  const clean = (el) => el && el.classList.remove('view-enter', 'view-exit');
  clean(showEl);
  clean(hideEl);

  const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  const fallbackFocus = ui.viewSwitchButtons?.[0] || document.body;
  const nextFocus =
    (showEl && showEl.querySelector(focusableSelector)) || fallbackFocus;

  const active = document.activeElement;
  const shouldMoveFocus = hideEl && active && hideEl.contains(active);
  if (shouldMoveFocus && nextFocus) {
    nextFocus.focus({ preventScroll: true });
  }

  if (hideEl) {
    hideEl.classList.add('view-exit');
    hideEl.setAttribute('aria-hidden', 'true');
    const handleHideEnd = () => {
      hideEl.hidden = true;
      hideEl.classList.remove('view-exit');
      hideEl.removeEventListener('animationend', handleHideEnd);
    };
    hideEl.addEventListener('animationend', handleHideEnd);
  }

  if (showEl) {
    showEl.hidden = false;
    showEl.setAttribute('aria-hidden', 'false');
    showEl.classList.add('view-enter');
    const handleShowEnd = () => {
      showEl.classList.remove('view-enter');
      showEl.removeEventListener('animationend', handleShowEnd);
      if (typeof onComplete === 'function') onComplete();
    };
    showEl.addEventListener('animationend', handleShowEnd);
  }
}

function getMoodMeta(emoji, user) {
  return getMoodOptions(user).find((m) => m.emoji === emoji) || FALLBACK_MOODS.find((m) => m.emoji === emoji);
}

function getMoodOptions(user) {
  return state.moodPresets[user] || FALLBACK_MOODS;
}

function updateAvatar() {
  if (!ui.currentAvatar) return;
  const name = state.userDisplay || state.user || '';
  ui.currentAvatar.textContent = name ? name[0] : '?';
}

function handleLogout() {
  if (!ui.logoutModal) {
    confirmLogout();
    return;
  }
  ui.logoutModal.classList.remove('closing');
  ui.logoutModal.showModal();
}

function confirmLogout() {
  closeLogoutModal(performLogout);
}

function closeLogoutModal(onClosed) {
  if (!ui.logoutModal || !ui.logoutModal.open) {
    if (typeof onClosed === 'function') onClosed();
    return;
  }
  ui.logoutModal.close();
  ui.logoutModal.classList.remove('closing');
  if (typeof onClosed === 'function') onClosed();
}

function performLogout() {
  supabase.auth.signOut();
}

function setupDoodleCanvas() {
  const canvas = ui.doodleCanvas;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#46323c';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  state.doodleCtx = ctx;
  let drawing = false;
  const getPos = (evt) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((evt.touches ? evt.touches[0].clientX : evt.clientX) - rect.left);
    const y = ((evt.touches ? evt.touches[0].clientY : evt.clientY) - rect.top);
    return { x: (x * canvas.width) / rect.width, y: (y * canvas.height) / rect.height };
  };
  const start = (evt) => {
    drawing = true;
    state.doodleDirty = true;
    ctx.beginPath();
    const pos = getPos(evt);
    ctx.moveTo(pos.x, pos.y);
    evt.preventDefault();
    updateSendButtonState();
  };
  const draw = (evt) => {
    if (!drawing) return;
    const pos = getPos(evt);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    evt.preventDefault();
  };
  const end = () => {
    drawing = false;
  };
  canvas.addEventListener('pointerdown', start);
  canvas.addEventListener('pointermove', draw);
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointerleave', end);
  canvas.addEventListener('pointercancel', end);
}

function clearDoodle() {
  const ctx = state.doodleCtx;
  if (!ctx) return;
  ctx.clearRect(0, 0, ui.doodleCanvas.width, ui.doodleCanvas.height);
  state.doodleDirty = false;
  updateSendButtonState();
}

function setupAudioRecorder() {
  if (!navigator.mediaDevices) {
    ui.recordAudio.disabled = true;
    return;
  }
  ui.recordAudio.addEventListener('click', toggleRecording);
}

async function toggleRecording() {
  const { recorder } = state.recording;
  if (recorder && recorder.state === 'recording') {
    recorder.stop();
    ui.recordAudio.textContent = 'Start';
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const mimeType = getSupportedMime();
    const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    state.recording.recorder = mediaRecorder;
    state.recording.chunks = [];
    state.audioBlob = null;
    updateSendButtonState();
    mediaRecorder.start();
    ui.recordAudio.textContent = 'Stop';
    ui.recordAudio.classList.add('recording');
    setAudioStatus('Recording...');
    startTimer(15);
    const stopTimer = setTimeout(() => {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    }, 15000);
    mediaRecorder.ondataavailable = (evt) => {
      if (evt.data.size > 0) state.recording.chunks.push(evt.data);
    };
    mediaRecorder.onstop = () => {
      clearTimeout(stopTimer);
      const blob = new Blob(state.recording.chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
      state.audioBlob = blob;
      updateSendButtonState();
      ui.audioPreview.src = URL.createObjectURL(blob);
      ui.audioPreview.dataset.ready = 'true';
      ui.recordAudio.textContent = 'Start';
      ui.recordAudio.classList.remove('recording');
      setAudioStatus('Recording saved');
      stopTimerDisplay();
      stream.getTracks().forEach((track) => track.stop());
      state.recording.recorder = null;
    };
    mediaRecorder.onerror = (evt) => {
      console.error('MediaRecorder error', evt.error || evt);
      showToast('Recording failed. Please try again.', 'error');
      ui.recordAudio.textContent = 'Start';
      ui.recordAudio.classList.remove('recording');
      setAudioStatus('');
      stopTimerDisplay();
      stream.getTracks().forEach((track) => track.stop());
    };
  } catch (err) {
    console.error('recording failed', err);
    ui.recordAudio.disabled = true;
    showToast('Audio recording not supported here.', 'error');
    ui.recordAudio.classList.remove('recording');
    setAudioStatus('');
    stopTimerDisplay();
  }
}

function getSupportedMime() {
  if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
  const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  return preferred.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

async function handlePostcardSubmit(event) {
  event.preventDefault();
  if (!state.user) return;
  let message = state.activeOptions.has('message') ? ui.messageInput.value.trim() : '';
  const photo = state.activeOptions.has('photo') ? ui.photoInput.files[0] : null;
  const doodleBlob = state.activeOptions.has('doodle') && state.doodleDirty
    ? await canvasToBlob(ui.doodleCanvas)
    : null;
  const audioBlob = state.activeOptions.has('audio') ? state.audioBlob : null;
  let type = 'text';
  let assetUrl = null;
  setSendingState(true);

  try {
    if (photo) {
      assetUrl = await uploadAsset(photo, 'photos');
      type = 'image';
    } else if (doodleBlob) {
      assetUrl = await uploadAsset(doodleBlob, 'doodles', 'png');
      type = 'doodle';
    } else if (audioBlob) {
      assetUrl = await uploadAsset(audioBlob, 'audio', 'webm');
      type = 'audio';
      message = '';
    }
  } catch (err) {
    console.error('upload failed', err);
    showToast('Upload failed. Please try again.', 'error');
    setSendingState(false);
    return;
  }

  if (!message && !assetUrl) {
    alert('Add a short note or attach something lovely.');
    setSendingState(false);
    return;
  }

  if ((type === 'image' || type === 'doodle') && !message) {
    showToast('Add a sweet note to go with your visual.', 'error');
    setSendingState(false);
    return;
  }

  const { data, error } = await supabase
    .from('postcards')
    .insert({
      user: state.user,
      type,
      message,
      asset_url: assetUrl
    })
    .select()
    .single();
  if (error) {
    console.error('postcard save', error);
    showToast(`Couldn't save postcard: ${error.message}`, 'error');
    setSendingState(false);
    return;
  }
  if (data) {
    upsertPostcard(data);
    renderBoard();
    gentlePulse(`[data-id="${data.id}"]`);
    await broadcastCommentEvent('postcard:new', { postcard: data, sender: state.user });
  }
  ui.modal.close();
  ui.postcardForm.reset();
  clearDoodle();
  ui.audioPreview.removeAttribute('src');
  ui.audioPreview.removeAttribute('data-ready');
  state.audioBlob = null;
  setAudioStatus('');
  stopTimerDisplay();
  setSendingState(false);
  resetOptionPicker();
}

async function uploadAsset(fileOrBlob, folder, extension) {
  const ext = extension || (fileOrBlob.name ? fileOrBlob.name.split('.').pop() : 'bin');
  const path = `${folder}/${state.user}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, fileOrBlob, {
    cacheControl: '3600',
    upsert: false
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

function subscribeRealtime() {
  if (state.realtimeChannel) return;
  const channel = supabase.channel('loveboard-channel');
  state.realtimeChannel = channel;
  channel
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'postcards' }, (payload) => {
      upsertPostcard(payload.new);
      renderBoard();
      gentlePulse(`[data-id="${payload.new.id}"]`);
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'postcards' }, (payload) => {
      removePostcard(payload.old.id);
      renderBoard();
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'moods' }, (payload) => {
      const changedAt = payload.new.updated_at || payload.new.created_at || new Date().toISOString();
      setMood(payload.new.user, payload.new.emoji, changedAt);
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'moods' }, (payload) => {
      const changedAt = payload.new.updated_at || payload.new.created_at || new Date().toISOString();
      setMood(payload.new.user, payload.new.emoji, changedAt);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'postcard_reactions' }, (payload) => {
      applyReactionRow(payload.new);
      updateReactionUI(payload.new.postcard_id);
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'postcard_reactions' }, (payload) => {
      removeReactionRow(payload.old);
      updateReactionUI(payload.old.postcard_id);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comment_reactions' }, (payload) => {
      applyCommentReactionRow(payload.new);
      updateCommentUI(payload.new.postcard_id);
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comment_reactions' }, (payload) => {
      removeCommentReactionRow(payload.old);
      updateCommentUI(payload.old.postcard_id);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wwan_cities' }, (payload) => {
      applyRemoteCity(payload.new);
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'wwan_cities' }, (payload) => {
      applyRemoteCity(payload.new);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'postcard_comments' }, (payload) => {
      applyCommentRow(payload.new);
      updateCommentUI(payload.new.postcard_id);
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'postcard_comments' }, (payload) => {
      applyCommentRow(payload.new);
      updateCommentUI(payload.new.postcard_id);
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'postcard_comments' }, (payload) => {
      removeCommentRow(payload.old);
      updateCommentUI(payload.old.postcard_id);
    })
    .subscribe();
}

function subscribeCommentBroadcast() {
  if (state.commentChannel) return;
  const channel = supabase.channel('loveboard-comments', {
    config: { broadcast: { ack: true } }
  });
  state.commentChannel = channel;
  state.commentChannelReady = false;
  channel
    .on('broadcast', { event: 'comment:new' }, ({ payload }) => {
      if (!payload) return;
      applyCommentRow(payload);
      updateCommentUI(payload.postcard_id);
    })
    .on('broadcast', { event: 'comment:update' }, ({ payload }) => {
      if (!payload) return;
      applyCommentRow(payload);
      updateCommentUI(payload.postcard_id);
    })
    .on('broadcast', { event: 'comment:delete' }, ({ payload }) => {
      if (!payload) return;
      removeCommentRow(payload);
      updateCommentUI(payload.postcard_id);
    })
    .on('broadcast', { event: 'reaction:add' }, ({ payload }) => {
      if (!payload?.row || payload?.sender === state.user) return;
      applyReactionRow(payload.row);
      updateReactionUI(payload.row.postcard_id);
    })
    .on('broadcast', { event: 'reaction:remove' }, ({ payload }) => {
      if (!payload?.row || payload?.sender === state.user) return;
      removeReactionRow(payload.row);
      updateReactionUI(payload.row.postcard_id);
    })
    .on('broadcast', { event: 'commentReaction:add' }, ({ payload }) => {
      if (!payload?.row || payload?.sender === state.user) return;
      applyCommentReactionRow(payload.row);
      updateCommentUI(payload.row.postcard_id);
    })
    .on('broadcast', { event: 'commentReaction:remove' }, ({ payload }) => {
      if (!payload?.row || payload?.sender === state.user) return;
      removeCommentReactionRow(payload.row);
      updateCommentUI(payload.row.postcard_id);
    })
    .on('broadcast', { event: 'postcard:new' }, ({ payload }) => {
      if (!payload?.postcard || payload?.sender === state.user) return;
      upsertPostcard(payload.postcard);
      renderBoard();
      gentlePulse(`[data-id="${payload.postcard.id}"]`);
    })
    .on('broadcast', { event: 'postcard:delete' }, ({ payload }) => {
      if (!payload?.postcard_id) return;
      removePostcard(payload.postcard_id);
      renderBoard();
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        state.commentChannelReady = true;
        flushPendingCommentBroadcasts();
      }
    });
}

async function broadcastCommentEvent(event, payload) {
  if (!state.commentChannel || !payload) return;
  if (!state.commentChannelReady) {
    state.pendingCommentBroadcasts.push({ event, payload });
    return;
  }
  try {
    await state.commentChannel.send({ type: 'broadcast', event, payload });
  } catch (err) {
    console.error('comment broadcast', err);
  }
}

function flushPendingCommentBroadcasts() {
  if (!state.commentChannelReady || !state.pendingCommentBroadcasts.length) return;
  const queue = [...state.pendingCommentBroadcasts];
  state.pendingCommentBroadcasts = [];
  queue.forEach(({ event, payload }) => broadcastCommentEvent(event, payload));
}

function isUpdatedAtMissing(error) {
  if (!error) return false;
  return (
    error.message?.toLowerCase().includes('updated_at') ||
    String(error.hint || '').toLowerCase().includes('updated_at') ||
    error.code === '42703'
  );
}

function isMissingTableError(error) {
  if (!error) return false;
  return error.code === '42P01' || error.message?.toLowerCase().includes('does not exist');
}

function isMissingFunctionError(error) {
  if (!error) return false;
  const message = String(error.message || '').toLowerCase();
  return message.includes('function delete-postcard') || message.includes('not found');
}

function gentlePulse(selector) {
  const card = document.querySelector(selector);
  if (!card) return;
  card.animate(
    [
      { transform: 'scale(1)', boxShadow: '0 12px 26px rgba(70, 50, 60, 0.15)' },
      { transform: 'scale(1.03)', boxShadow: '0 20px 30px rgba(245, 181, 197, 0.5)' },
      { transform: 'scale(1)', boxShadow: '0 12px 26px rgba(70, 50, 60, 0.15)' }
    ],
    { duration: 600 }
  );
}

function upsertPostcard(card) {
  const existingIndex = state.postcards.findIndex((item) => item.id === card.id);
  if (existingIndex >= 0) {
    state.postcards[existingIndex] = card;
  } else {
    state.postcards = [card, ...state.postcards];
  }
}

function removePostcard(id) {
  state.postcards = state.postcards.filter((card) => card.id !== id);
  delete state.reactions[id];
  const removedComments = state.comments[id] || [];
  delete state.comments[id];
  removedComments.forEach((entry) => {
    if (!entry?.id) return;
    delete state.commentReactions[entry.id];
    delete state.commentUserReactions[entry.id];
  });
}

function getTilt(id = '') {
  const tilts = [-3, -1.5, 0, 1.5, 3];
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash + id.charCodeAt(i) * 7) % 97;
  }
  return `${tilts[hash % tilts.length]}deg`;
}

function applyReactionRow(row) {
  const postcardId = row?.postcard_id;
  const reaction = row?.reaction;
  const user = row?.user;
  if (!postcardId || !reaction) return;
  if (!state.reactions[postcardId]) {
    state.reactions[postcardId] = {};
  }
  if (user) {
    Object.entries(state.reactions[postcardId]).forEach(([emoji, bucket]) => {
      if (!bucket) return;
      if (emoji === reaction) return;
      if (bucket.users.includes(user)) {
        bucket.users = bucket.users.filter((name) => name !== user);
        bucket.count = Math.max(0, bucket.count - 1);
        if (!bucket.count) {
          delete state.reactions[postcardId][emoji];
        }
      }
    });
  }
  if (!state.reactions[postcardId][reaction]) {
    state.reactions[postcardId][reaction] = { count: 0, users: [] };
  }
  const bucket = state.reactions[postcardId][reaction];
  if (user && !bucket.users.includes(user)) {
    bucket.users.push(user);
    bucket.count += 1;
  } else if (!user) {
    bucket.count += 1;
  }
  if (user === state.user) {
    state.userReactions[postcardId] = reaction;
  }
}

function applyCommentReactionRow(row) {
  const commentId = row?.comment_id;
  const reaction = row?.reaction;
  const user = row?.user;
  if (!commentId || !reaction) return;
  if (!state.commentReactions[commentId]) {
    state.commentReactions[commentId] = {};
  }
  if (user) {
    Object.entries(state.commentReactions[commentId]).forEach(([emoji, bucket]) => {
      if (!bucket || emoji === reaction) return;
      if (bucket.users.includes(user)) {
        bucket.users = bucket.users.filter((name) => name !== user);
        bucket.count = Math.max(0, bucket.count - 1);
        if (!bucket.count) {
          delete state.commentReactions[commentId][emoji];
        }
      }
    });
  }
  if (!state.commentReactions[commentId][reaction]) {
    state.commentReactions[commentId][reaction] = { count: 0, users: [] };
  }
  const bucket = state.commentReactions[commentId][reaction];
  if (user && !bucket.users.includes(user)) {
    bucket.users.push(user);
    bucket.count += 1;
  } else if (!user) {
    bucket.count += 1;
  }
  if (user === state.user) {
    state.commentUserReactions[commentId] = reaction;
  }
}

function applyCommentRow(row) {
  const postcardId = row?.postcard_id;
  if (!postcardId || !row?.id) return;
  if (!row.updated_at) {
    row.updated_at = row.created_at;
  }
  if (!state.comments[postcardId]) {
    state.comments[postcardId] = [];
  }
  const entries = state.comments[postcardId];
  const index = entries.findIndex((item) => item.id === row.id);
  if (index >= 0) {
    entries[index] = row;
  } else {
    entries.push(row);
  }
  entries.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

function describePostcard(card) {
  if (card.type === 'audio') return 'They left a little voice note for you.';
  if (card.type === 'image') return card.message || 'They added a new photo.';
  if (card.type === 'doodle') return card.message || 'They drew a doodle just for you.';
  return card.message || 'Open Loveboard to read it.';
}

function removeReactionRow(row) {
  const postcardId = row?.postcard_id;
  const reaction = row?.reaction;
  const user = row?.user;
  const bucket = state.reactions[postcardId]?.[reaction];
  if (!bucket) return;
  bucket.count = Math.max(0, bucket.count - 1);
  if (user) {
    bucket.users = bucket.users.filter((name) => name !== user);
  }
  if (bucket.count === 0 || bucket.users.length === 0) {
    delete state.reactions[postcardId][reaction];
  }
  if (state.reactions[postcardId] && !Object.keys(state.reactions[postcardId]).length) {
    delete state.reactions[postcardId];
  }
  if (user === state.user) {
    delete state.userReactions[postcardId];
  }
}

function removeCommentReactionRow(row) {
  const commentId = row?.comment_id;
  const reaction = row?.reaction;
  const user = row?.user;
  if (!commentId || !reaction) return;
  const bucket = state.commentReactions[commentId]?.[reaction];
  if (!bucket) return;
  bucket.count = Math.max(0, bucket.count - 1);
  if (user) {
    bucket.users = bucket.users.filter((name) => name !== user);
  }
  if (!bucket.count || bucket.users.length === 0) {
    delete state.commentReactions[commentId][reaction];
  }
  if (state.commentReactions[commentId] && !Object.keys(state.commentReactions[commentId]).length) {
    delete state.commentReactions[commentId];
  }
  if (user === state.user) {
    delete state.commentUserReactions[commentId];
  }
}

function removeCommentRow(row) {
  const postcardId = row?.postcard_id;
  const commentId = row?.id;
  if (!postcardId || !commentId) return;
  if (!state.comments[postcardId]) return;
  state.comments[postcardId] = state.comments[postcardId].filter((entry) => entry.id !== commentId);
  if (!state.comments[postcardId].length) {
    delete state.comments[postcardId];
  }
  delete state.commentReactions[commentId];
  delete state.commentUserReactions[commentId];
  if (state.editingComment && state.editingComment.commentId === commentId) {
    state.editingComment = null;
  }
}

function scheduleCardMeasurement(node) {
  requestAnimationFrame(() => measureCardHeight(node));
}

function measureCardHeight(node) {
  if (!node) return;
  if (node.classList.contains('audio-mode')) {
    const audioPanel = node.querySelector('.audio-only');
    if (!audioPanel) return;
    const height = Math.max(audioPanel.getBoundingClientRect().height, 180);
    node.style.setProperty('--card-height', `${height}px`);
    return;
  }
  const front = node.querySelector('.postcard-front');
  const back = node.querySelector('.postcard-back');
  if (!front || !back) return;
  node.classList.add('measuring');
  const frontHeight = front.getBoundingClientRect().height;
  const backHeight = back.getBoundingClientRect().height;
  node.classList.remove('measuring');
  const target = Math.max(frontHeight, backHeight, 220);
  node.style.setProperty('--card-height', `${target}px`);
}

function renderReactionCounts(postcardId, container) {
  if (!container) return;
  const counts = state.reactions[postcardId] || {};
  const entries = Object.entries(counts).filter(([, data]) => data.count > 0);
  container.innerHTML = '';
  entries.forEach(([emoji, data]) => {
    const pill = document.createElement('span');
    pill.className = 'reaction-pill';
    if (state.userReactions[postcardId] === emoji) {
      pill.classList.add('mine');
    }
    pill.textContent = emoji;
    if (data.users.length) {
      const names = document.createElement('span');
      names.className = 'reaction-names';
      names.textContent = data.users
        .map((name) => (name ? name[0].toUpperCase() : ''))
        .join('');
      pill.appendChild(names);
    }
    container.appendChild(pill);
  });
}

function renderCommentReactionCounts(commentId, container) {
  if (!container) return;
  const counts = state.commentReactions[commentId] || {};
  const entries = Object.entries(counts).filter(([, data]) => data.count > 0);
  container.innerHTML = '';
  if (!entries.length) {
    container.dataset.empty = 'true';
    return;
  }
  container.dataset.empty = 'false';
  entries.forEach(([emoji, data]) => {
    const pill = document.createElement('span');
    pill.className = 'comment-reaction-pill';
    if (state.commentUserReactions[commentId] === emoji) {
      pill.classList.add('mine');
    }
    const icon = document.createElement('span');
    icon.textContent = emoji;
    const names = document.createElement('span');
    names.className = 'comment-reaction-names';
    names.textContent = data.users
      .map((name) => (name ? name[0].toUpperCase() : ''))
      .filter(Boolean)
      .join('');
    pill.append(icon, names);
    container.appendChild(pill);
  });
}

function renderComments(postcardId, container) {
  if (!container) return;
  const wasNearBottom =
    container.scrollHeight - container.scrollTop - container.clientHeight < 20;
  const userScrolledUp = container.dataset.userScroll === 'true';
  const shouldStickBottom = !userScrolledUp || wasNearBottom || !container.childElementCount;
  const comments = state.comments[postcardId] || [];
  container.innerHTML = '';
  if (!comments.length) {
    const empty = document.createElement('p');
    empty.className = 'comment-empty';
    empty.textContent = 'No comments yet. Be the first to reply!';
    container.appendChild(empty);
    return;
  }
  const editing = state.editingComment;
  comments.forEach((entry) => {
    const row = document.createElement('div');
    row.className = 'comment';
    row.dataset.commentId = entry.id;
    if (entry.user === state.user) {
      row.classList.add('mine');
    }
    const isEditing = editing && editing.commentId === entry.id && editing.postcardId === postcardId;
    if (isEditing) {
      row.classList.add('editing');
    }
    const meta = document.createElement('div');
    meta.className = 'comment-meta';
    const author = document.createElement('span');
    author.className = 'comment-author';
    author.textContent = entry.user;
    const time = document.createElement('span');
    time.className = 'comment-time';
    time.textContent = formatCommentTime(entry.created_at);
    meta.append(author, time);
    const createdTime = entry.created_at ? new Date(entry.created_at).getTime() : null;
    const updatedTime = entry.updated_at ? new Date(entry.updated_at).getTime() : null;
    const showEdited =
      state.commentUpdatedAtSupported &&
      typeof createdTime === 'number' &&
      typeof updatedTime === 'number' &&
      updatedTime - createdTime > 2000;
    if (showEdited) {
      const edited = document.createElement('span');
      edited.className = 'comment-edited';
      edited.textContent = 'Edited';
      meta.append(edited);
    }
    row.append(meta);
    if (isEditing) {
      const form = document.createElement('form');
      form.className = 'comment-edit-form';
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 280;
      input.value = editing?.draft ?? entry.comment ?? '';
      input.placeholder = 'Edit comment';
      input.addEventListener('input', () => updateEditingDraft(input.value));
      const actions = document.createElement('div');
      actions.className = 'comment-edit-actions';
      const saveBtn = document.createElement('button');
      saveBtn.type = 'submit';
      saveBtn.textContent = 'Save';
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', (evt) => {
        evt.stopPropagation();
        cancelCommentEdit();
      });
      actions.append(saveBtn, cancelBtn);
      form.append(input, actions);
      const stop = (evt) => evt.stopPropagation();
      form.addEventListener('click', stop);
      input.addEventListener('click', stop);
      form.addEventListener('submit', async (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        await handleCommentEditSubmit(postcardId, entry.id, input);
      });
      row.append(form);
    } else {
      const body = document.createElement('div');
      body.className = 'comment-body';
      const text = document.createElement('p');
      text.className = 'comment-text';
      text.textContent = entry.comment || '';
      body.append(text);
      if (entry.user === state.user) {
        const actions = document.createElement('div');
        actions.className = 'comment-actions';
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', (evt) => {
          evt.stopPropagation();
          startCommentEdit(postcardId, entry);
        });
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', (evt) => {
          evt.stopPropagation();
          confirmDeleteComment(postcardId, entry.id);
        });
        actions.append(editBtn, deleteBtn);
        body.append(actions);
      }
      row.append(body);
    }
    const reactionArea = document.createElement('div');
    reactionArea.className = 'reaction-area comment-reaction-area';
    const reactionCounts = document.createElement('div');
    reactionCounts.className = 'comment-reaction-counts';
    renderCommentReactionCounts(entry.id, reactionCounts);
    const picker = document.createElement('div');
    picker.className = 'comment-reaction-picker';
    setupCommentReactionPicker(picker, postcardId, entry.id);
    const reactBtn = document.createElement('button');
    reactBtn.type = 'button';
    reactBtn.className = 'react-btn';
    reactBtn.textContent = 'React';
    reactBtn.disabled = !state.user;
    reactBtn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      toggleReactionPicker(reactionArea, picker);
    });
    reactionArea.addEventListener('click', (evt) => evt.stopPropagation());
    reactionArea.append(reactionCounts, reactBtn, picker);
    row.append(reactionArea);
    container.appendChild(row);
  });
  if (shouldStickBottom) {
    container.scrollTop = container.scrollHeight;
    container.dataset.userScroll = 'false';
  }
}

function setupCommentForm(form, postcardId) {
  if (!form) return;
  const input = form.querySelector('input[name="comment"]');
  const stop = (evt) => evt.stopPropagation();
  form.addEventListener('click', stop);
  if (input) {
    input.addEventListener('click', stop);
  }
  form.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    evt.stopPropagation();
    await handleCommentSubmit(postcardId, input, form);
  });
}

function setupCommentList(container) {
  if (!container || container.dataset.scrollBound) return;
  container.dataset.scrollBound = 'true';
  container.dataset.userScroll = 'false';
  container.addEventListener('scroll', () => {
    const nearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 20;
    container.dataset.userScroll = nearBottom ? 'false' : 'true';
  });
}

function setupReactionPicker(picker, postcardId) {
  if (!picker) return;
  picker.innerHTML = '';
  REACTIONS.forEach(({ emoji, label }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.reaction = emoji;
    btn.title = label;
    btn.textContent = emoji;
    if (state.userReactions[postcardId] === emoji) {
      btn.classList.add('active');
    }
    btn.addEventListener('click', async (evt) => {
      evt.stopPropagation();
      await handleReactionSelection(postcardId, emoji);
      closeReactionPicker();
    });
    picker.appendChild(btn);
  });
}

function setupCommentReactionPicker(picker, postcardId, commentId) {
  if (!picker) return;
  picker.innerHTML = '';
  REACTIONS.forEach(({ emoji, label }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.reaction = emoji;
    btn.title = label;
    btn.textContent = emoji;
    if (state.commentUserReactions[commentId] === emoji) {
      btn.classList.add('active');
    }
    btn.addEventListener('click', async (evt) => {
      evt.stopPropagation();
      await handleCommentReactionSelection(postcardId, commentId, emoji);
      closeReactionPicker();
    });
    picker.appendChild(btn);
  });
}

function toggleReactionPicker(area, picker) {
  if (!picker || !area) return;
  if (state.openReactionPicker && state.openReactionPicker !== picker) {
    state.openReactionPicker.closest('.reaction-area').classList.remove('active');
  }
  const willOpen = !area.classList.contains('active');
  area.classList.toggle('active', willOpen);
  picker.style.pointerEvents = willOpen ? 'auto' : 'none';
  state.openReactionPicker = willOpen ? picker : null;
  if (willOpen) {
    document.addEventListener('click', closeReactionPicker, { once: true });
  }
}

function closeReactionPicker() {
  if (state.openReactionPicker) {
    const area = state.openReactionPicker.closest('.reaction-area');
    if (area) area.classList.remove('active');
    state.openReactionPicker.style.pointerEvents = 'none';
    state.openReactionPicker = null;
  }
}

async function handleReactionSelection(postcardId, reaction) {
  const current = state.userReactions[postcardId];
  if (current === reaction) {
    await removeReaction(postcardId, reaction);
  } else {
    if (current) {
      await removeReaction(postcardId, current);
    }
    await addReaction(postcardId, reaction);
  }
}

async function addReaction(postcardId, reaction) {
  if (!state.user || !postcardId) return;
  const row = {
    postcard_id: postcardId,
    reaction,
    user: state.user
  };
  const { error } = await supabase.from('postcard_reactions').insert(row);
  if (error) {
    console.error('reaction save', error);
    showToast('Reaction failed to send.', 'error');
  } else {
    applyReactionRow(row);
    updateReactionUI(postcardId);
    await broadcastCommentEvent('reaction:add', { row, sender: state.user });
  }
}

async function removeReaction(postcardId, reaction) {
  if (!state.user || !postcardId || !reaction) return;
  const { error } = await supabase
    .from('postcard_reactions')
    .delete()
    .match({ postcard_id: postcardId, user: state.user, reaction });
  if (error) {
    console.error('reaction delete', error);
    return;
  }
  removeReactionRow({ postcard_id: postcardId, reaction, user: state.user });
  updateReactionUI(postcardId);
  await broadcastCommentEvent('reaction:remove', {
    row: { postcard_id: postcardId, reaction, user: state.user },
    sender: state.user
  });
}

function updateReactionUI(postcardId) {
  const card = document.querySelector(`[data-id="${postcardId}"]`);
  if (!card) return;
  card.querySelectorAll('.reaction-counts').forEach((container) =>
    renderReactionCounts(postcardId, container)
  );
}

async function handleCommentReactionSelection(postcardId, commentId, reaction) {
  if (!state.user || !postcardId || !commentId || !reaction) return;
  const current = state.commentUserReactions[commentId];
  if (current === reaction) {
    await removeCommentReaction(postcardId, commentId, reaction);
  } else {
    if (current) {
      await removeCommentReaction(postcardId, commentId, current);
    }
    await addCommentReaction(postcardId, commentId, reaction);
  }
}

async function addCommentReaction(postcardId, commentId, reaction) {
  if (!state.user || !postcardId || !commentId) return;
  const row = {
    postcard_id: postcardId,
    comment_id: commentId,
    reaction,
    user: state.user
  };
  const { error } = await supabase.from('comment_reactions').insert(row);
  if (error) {
    console.error('comment reaction save', error);
    showToast('Reaction failed to send.', 'error');
    return;
  }
  applyCommentReactionRow(row);
  updateCommentUI(postcardId);
  await broadcastCommentEvent('commentReaction:add', { row, sender: state.user });
}

async function removeCommentReaction(postcardId, commentId, reaction) {
  if (!state.user || !postcardId || !commentId || !reaction) return;
  const { error } = await supabase
    .from('comment_reactions')
    .delete()
    .match({ postcard_id: postcardId, comment_id: commentId, user: state.user, reaction });
  if (error) {
    console.error('comment reaction delete', error);
    return;
  }
  removeCommentReactionRow({ postcard_id: postcardId, comment_id: commentId, reaction, user: state.user });
  updateCommentUI(postcardId);
  await broadcastCommentEvent('commentReaction:remove', {
    row: { postcard_id: postcardId, comment_id: commentId, reaction, user: state.user },
    sender: state.user
  });
}

async function handleCommentSubmit(postcardId, input, form) {
  if (!state.user || !postcardId || !input) return;
  const text = input.value.trim();
  if (!text) return;
  const button = form?.querySelector('button[type="submit"]');
  const originalLabel = button ? button.textContent : '';
  if (button) {
    button.disabled = true;
    button.textContent = 'Sending…';
  }
  const payload = { postcard_id: postcardId, user: state.user, comment: text };
  if (state.commentUpdatedAtSupported) {
    payload.updated_at = new Date().toISOString();
  }
  try {
    let { data, error } = await supabase
      .from('postcard_comments')
      .insert(payload)
      .select()
      .single();
    if (error && state.commentUpdatedAtSupported && isUpdatedAtMissing(error)) {
      state.commentUpdatedAtSupported = false;
      delete payload.updated_at;
      ({ data, error } = await supabase
        .from('postcard_comments')
        .insert(payload)
        .select()
        .single());
    }
    if (error) {
      throw error;
    }
    if (data) {
      applyCommentRow(data);
      updateCommentUI(postcardId);
      await broadcastCommentEvent('comment:new', data);
    }
    input.value = '';
  } catch (err) {
    console.error('comment save', err);
    showToast('Could not send comment. Try again?', 'error');
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalLabel || 'Send';
    }
  }
}

function updateCommentUI(postcardId) {
  const card = document.querySelector(`[data-id="${postcardId}"]`);
  if (!card) return;
  card.querySelectorAll('.comment-list').forEach((container) =>
    renderComments(postcardId, container)
  );
}

function startCommentEdit(postcardId, entry) {
  if (!entry?.id) return;
  state.editingComment = {
    postcardId,
    commentId: entry.id,
    draft: entry.comment || ''
  };
  updateCommentUI(postcardId);
  requestAnimationFrame(() => {
    const card = document.querySelector(`[data-id="${postcardId}"]`);
    const input = card?.querySelector('.comment-edit-form input');
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  });
}

function updateEditingDraft(value) {
  if (!state.editingComment) return;
  state.editingComment.draft = value;
}

function cancelCommentEdit() {
  if (!state.editingComment) return;
  const { postcardId } = state.editingComment;
  state.editingComment = null;
  updateCommentUI(postcardId);
}

async function handleCommentEditSubmit(postcardId, commentId, input) {
  if (!state.user || !postcardId || !commentId || !input) return;
  const text = input.value.trim();
  if (!text) return;
  const form = input.closest('form');
  const saveBtn = form?.querySelector('button[type="submit"]');
  const cancelBtn = form?.querySelector('button[type="button"]');
  if (saveBtn) saveBtn.disabled = true;
  if (cancelBtn) cancelBtn.disabled = true;
  const payload = { comment: text };
  if (state.commentUpdatedAtSupported) {
    payload.updated_at = new Date().toISOString();
  }
  try {
    let { data, error } = await supabase
      .from('postcard_comments')
      .update(payload)
      .eq('id', commentId)
      .select()
      .single();
    if (error && state.commentUpdatedAtSupported && isUpdatedAtMissing(error)) {
      state.commentUpdatedAtSupported = false;
      delete payload.updated_at;
      ({ data, error } = await supabase
        .from('postcard_comments')
        .update(payload)
        .eq('id', commentId)
        .select()
        .single());
    }
    if (error) {
      throw error;
    }
    applyCommentRow(data);
    state.editingComment = null;
    updateCommentUI(postcardId);
    await broadcastCommentEvent('comment:update', data);
  } catch (err) {
    console.error('comment edit', err);
    showToast('Edit failed. Try again?', 'error');
  } finally {
    if (saveBtn) saveBtn.disabled = false;
    if (cancelBtn) cancelBtn.disabled = false;
  }
}

async function confirmDeleteComment(postcardId, commentId) {
  if (!state.user || !postcardId || !commentId) return;
  const ok = window.confirm('Delete this comment?');
  if (!ok) return;
  try {
    const { data, error } = await supabase
      .from('postcard_comments')
      .delete()
      .eq('id', commentId)
      .select()
      .single();
    if (error) {
      throw error;
    }
    removeCommentRow({ postcard_id: postcardId, id: commentId });
    updateCommentUI(postcardId);
    await broadcastCommentEvent('comment:delete', { postcard_id: postcardId, id: commentId });
  } catch (err) {
    console.error('comment delete', err);
    showToast('Failed to delete comment.', 'error');
    return;
  }
  if (state.editingComment && state.editingComment.commentId === commentId) {
    state.editingComment = null;
  }
}

function showToast(message, mode = 'info', anchorEl = null) {
  if (!ui.toast) return;
  ui.toast.textContent = message;
  ui.toast.dataset.mode = mode;
  ui.toast.classList.toggle('toast-anchored', Boolean(anchorEl));
  if (anchorEl) {
    const rect = anchorEl.getBoundingClientRect();
    const padding = 12;
    const toastRect = ui.toast.getBoundingClientRect();
    let left = rect.right + 10;
    let top = rect.top + rect.height / 2 - toastRect.height / 2;
    if (left + toastRect.width > window.innerWidth - padding) {
      left = rect.left - toastRect.width - 10;
    }
    left = Math.max(padding, Math.min(window.innerWidth - toastRect.width - padding, left));
    top = Math.max(padding, Math.min(window.innerHeight - toastRect.height - padding, top));
    ui.toast.style.left = `${left}px`;
    ui.toast.style.top = `${top}px`;
    ui.toast.style.bottom = 'auto';
    ui.toast.style.transform = 'translate(0, 0)';
  } else {
    ui.toast.style.left = '';
    ui.toast.style.top = '';
    ui.toast.style.bottom = '';
    ui.toast.style.transform = '';
  }
  ui.toast.classList.add('show');
  clearTimeout(ui.toast._timer);
  ui.toast._timer = setTimeout(() => {
    ui.toast.classList.remove('show');
  }, 2600);
}

function setAudioStatus(text) {
  if (!ui.audioStatus) return;
  ui.audioStatus.textContent = text;
}

async function confirmDelete(id) {
  if (!id) return;
  const ok = window.confirm('Delete this postcard? This cannot be undone.');
  if (!ok) return;
  const deleted = await deletePostcard(id);
  if (!deleted) {
    showToast('Delete failed. Try again.', 'error');
    return;
  }
  removePostcard(id);
  renderBoard();
  await broadcastCommentEvent('postcard:delete', { postcard_id: id });
  showToast('Postcard deleted');
}

async function deletePostcard(id) {
  const viaFunction = await deletePostcardViaFunction(id);
  if (viaFunction) return true;
  return deletePostcardDirect(id);
}

async function deletePostcardViaFunction(id) {
  try {
    const { data, error } = await supabase.functions.invoke('delete-postcard', {
      body: { postcardId: id }
    });
    if (error) {
      if (isMissingFunctionError(error)) {
        return false;
      }
      throw error;
    }
    return data?.success ?? true;
  } catch (err) {
    console.error('delete postcard function', err);
    return false;
  }
}

async function deletePostcardDirect(id) {
  try {
    await cleanupPostcardChildren(id);
    const { error } = await supabase.from('postcards').delete().eq('id', id);
    if (error) {
      throw error;
    }
    return true;
  } catch (err) {
    console.error('delete postcard direct', err);
    return false;
  }
}

async function cleanupPostcardChildren(id) {
  await Promise.all([
    deleteChildRows('postcard_comments', id),
    deleteChildRows('postcard_reactions', id),
    deleteChildRows('comment_reactions', id)
  ]);
}

async function deleteChildRows(table, postcardId) {
  try {
    const { error } = await supabase.from(table).delete().eq('postcard_id', postcardId);
    if (error && !isMissingTableError(error)) {
      throw error;
    }
  } catch (err) {
    if (!isMissingTableError(err)) {
      console.error(`${table} cleanup`, err);
    }
  }
}

function attachMoodClickAway() {
  if (state.moodMenuListener) return;
  state.moodMenuListener = (evt) => {
    if (!evt.target.closest('.mood')) {
      closeMoodMenus();
    }
  };
  document.addEventListener('click', state.moodMenuListener, true);
  document.addEventListener('touchstart', state.moodMenuListener, true);
}

function detachMoodClickAway() {
  if (!state.moodMenuListener) return;
  document.removeEventListener('click', state.moodMenuListener, true);
  document.removeEventListener('touchstart', state.moodMenuListener, true);
  state.moodMenuListener = null;
}

function positionMoodMenu(menu) {
  requestAnimationFrame(() => {
    const rect = menu.getBoundingClientRect();
    const padding = 12;
    let shift = 0;
    if (rect.right > window.innerWidth - padding) {
      shift = window.innerWidth - padding - rect.right;
    } else if (rect.left < padding) {
      shift = padding - rect.left;
    }
    if (shift !== 0) {
      menu.style.transform = `translateX(${shift}px)`;
    }
  });
}

function updateAuthButton() {
  if (!ui.authSubmit) return;
  const ready = Boolean(ui.emailInput?.value.trim() && ui.passwordInput?.value);
  setButtonState(ui.authSubmit, ready);
}

function updateSendButtonState() {
  setButtonState(ui.sendBtn, isPostcardReady());
}

function isPostcardReady() {
  const messageReady = state.activeOptions.has('message') && ui.messageInput.value.trim().length > 0;
  const photoReady = state.activeOptions.has('photo') && ui.photoInput.files.length > 0;
  const doodleReady = state.activeOptions.has('doodle') && state.doodleDirty;
  const audioReady = state.activeOptions.has('audio') && Boolean(state.audioBlob);
  return messageReady || photoReady || doodleReady || audioReady;
}

function setButtonState(button, ready) {
  if (!button) return;
  button.disabled = !ready;
  button.classList.toggle('ready', ready);
}

function enableCreateButton() {
  setButtonState(ui.createBtn, true);
}

function setLoading(button, loading) {
  if (!button) return;
  button.classList.toggle('loading', loading);
  button.disabled = loading;
}

function setSendingState(loading) {
  setLoading(ui.sendBtn, loading);
  if (ui.sendHint) {
    ui.sendHint.textContent = loading ? 'Sending your love…' : '';
  }
}

function startTimer(seconds) {
  let remaining = seconds;
  updateTimerLabel(remaining);
  clearInterval(state.recording.timer);
  state.recording.timer = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      updateTimerLabel(0);
      stopTimerDisplay();
      return;
    }
    updateTimerLabel(remaining);
  }, 1000);
}

function stopTimerDisplay() {
  clearInterval(state.recording.timer);
  updateTimerLabel(15);
}

function updateTimerLabel(value) {
  if (!ui.recordTimer) return;
  const seconds = Math.max(0, value);
  const label = `0:${seconds.toString().padStart(2, '0')}`;
  ui.recordTimer.textContent = label;
}

function toggleOption(btn) {
  const option = btn.dataset.option;
  if (!option) return;
  if (option === 'audio') {
    if (state.activeOptions.has('audio')) {
      state.activeOptions.delete('audio');
      clearOption('audio');
    } else {
      state.activeOptions = new Set(['audio']);
    }
  } else {
    state.activeOptions.delete('audio');
    if (state.activeOptions.has(option)) {
      state.activeOptions.delete(option);
      clearOption(option);
    } else {
      state.activeOptions.add(option);
    }
  }
  if (!state.activeOptions.size) {
    state.activeOptions.add('message');
  }
  updateOptionVisibility();
  updateSendButtonState();
}

function updateOptionVisibility() {
  ui.optionSections.forEach((section) => {
    const option = section.dataset.option;
    if (!option) return;
    section.classList.toggle('active', state.activeOptions.has(option));
  });
  ui.optionButtons.forEach((btn) => {
    const option = btn.dataset.option;
    btn.classList.toggle('active', state.activeOptions.has(option));
  });
}

function clearOption(option) {
  switch (option) {
    case 'message':
      ui.messageInput.value = '';
      break;
    case 'photo':
      ui.photoInput.value = '';
      break;
    case 'doodle':
      clearDoodle();
      break;
    case 'audio':
      state.audioBlob = null;
      ui.audioPreview.removeAttribute('src');
      ui.audioPreview.removeAttribute('data-ready');
      setAudioStatus('');
      stopTimerDisplay();
      break;
    default:
      break;
  }
  updateSendButtonState();
}

function resetOptionPicker() {
  state.activeOptions = new Set(['message']);
  clearOption('photo');
  clearOption('doodle');
  clearOption('audio');
  updateOptionVisibility();
  updateSendButtonState();
}

function openModal(message) {
  resetOptionPicker();
  if (message && ui.messageInput) {
    ui.messageInput.value = message.slice(0, 150);
  }
  updateSendButtonState();
  ui.modal.showModal();
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}

function formatMoodTimestamp(value) {
  if (!value) return '—';
  const raw = String(value);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '—';
  const hasTime = raw.includes('T') || raw.includes(':');
  if (!hasTime) {
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date);
  }
  return formatDate(date);
}

function formatCommentTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}
