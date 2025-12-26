import { supabase } from './supabase.js';
import { setWwanUser, applyRemoteCity } from './wwan.js';

const USER_PASSCODES = {
  Yassine: 'iloven',
  Nihal: 'ilovey'
};

const MOOD_PRESETS = {
  Yassine: [
    { emoji: '🛡️', label: 'Your guard, in control' },
    { emoji: '😎', label: 'Calm and commanding' },
    { emoji: '🔥', label: 'On you, all heat' },
    { emoji: '🌹', label: 'Dominant, gentle touch' },
    { emoji: '🃏', label: 'Playful but boss' },
    { emoji: '💪', label: 'Strong arms ready' },
    { emoji: '✨', label: 'Here to make you smile' },
    { emoji: '🎧', label: 'Chill, come close' }
  ],
  Nihal: [
    { emoji: '🌸', label: 'Soft and obedient' },
    { emoji: '💃', label: 'Dancing for you' },
    { emoji: '🤍', label: 'Ready to please' },
    { emoji: '💗', label: 'Sweet and yours' },
    { emoji: '😈', label: 'Flirty and yielding' },
    { emoji: '🫦', label: 'Quiet, kiss me' },
    { emoji: '🌙', label: 'Dreamy and compliant' },
    { emoji: '🧸', label: 'Cuddle and follow' }
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
const BUCKET = 'loveboard-assets';
const AUTH_KEY = 'loveboard-user';
const MOOD_TIMES_KEY = 'loveboard-moodTimes';
const DEFAULT_NOTE_IMG = './assets/default-note.svg';
const NOTIFICATION_ICON = './assets/heart.svg';
const notificationsSupported = 'Notification' in window;
const storedSurprise = localStorage.getItem('loveboard-surprise');
const initialSurprise = storedSurprise === null ? true : storedSurprise === 'true';
if (storedSurprise === null) {
  localStorage.setItem('loveboard-surprise', 'true');
}

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
  postcards: [],
  surprise: initialSurprise,
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
  moodTimes: readStoredJSON(MOOD_TIMES_KEY, {}),
  activeOptions: new Set(['message']),
  moodMenuListener: null,
  notificationsAllowed: notificationsSupported && Notification.permission === 'granted',
  swRegistration: null,
  pushSubscription: null,
  openReactionPicker: null,
  realtimeChannel: null,
  commentChannel: null,
  commentChannelReady: false,
  pendingCommentBroadcasts: [],
  editingComment: null,
  commentUpdatedAtSupported: true,
  moodUpdatedAtSupported: true,
  menuOpen: false,
  menuClickListener: null,
  menuKeyListener: null,
  ldAppOpen: false,
  ldAppKeyListener: null,
  activityFeed: [],
  unreadActivityCount: 0,
  notificationsPanelOpen: false
};

const ui = {
  app: document.querySelector('.app'),
  authGate: document.getElementById('auth-gate'),
  authForm: document.getElementById('auth-form'),
  authError: document.getElementById('auth-error'),
  userSelect: document.getElementById('user-select'),
  passInput: document.getElementById('passcode-input'),
  authSubmit: document.getElementById('auth-submit'),
  board: document.getElementById('board'),
  modal: document.getElementById('postcard-modal'),
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
  surpriseToggle: document.getElementById('surprise-toggle'),
  menuToggle: document.getElementById('menu-toggle'),
  menuPanel: document.getElementById('menu-panel'),
  notificationBtn: document.getElementById('menu-notifications'),
  notificationCount: document.getElementById('notification-count'),
  notificationPanel: document.getElementById('notification-panel'),
  notificationItems: document.getElementById('notification-items'),
  notificationEmpty: document.getElementById('notification-empty'),
  notificationEnable: document.getElementById('notification-enable'),
  logoutBtn: document.getElementById('logout-btn'),
  currentAvatar: document.getElementById('current-user-avatar'),
  toast: document.getElementById('toast'),
  optionButtons: document.querySelectorAll('.option-btn'),
  optionSections: document.querySelectorAll('.option-section'),
  ldAppToggle: document.getElementById('ldapp-toggle'),
  ldAppBack: document.getElementById('ldapp-back'),
  ldAppView: document.getElementById('ldapp-view'),
  loveboardView: document.getElementById('loveboard-view')
};

const template = document.getElementById('postcard-template');

init();

function init() {
  if (ui.menuPanel) {
    ui.menuPanel.hidden = true;
  }
  if (ui.notificationPanel) {
    ui.notificationPanel.hidden = true;
  }
  ui.surpriseToggle.checked = state.surprise;
  ui.authForm.addEventListener('submit', handleAuth);
  ui.createBtn.addEventListener('click', openModal);
  ui.closeModal.addEventListener('click', () => ui.modal.close());
  ui.postcardForm.addEventListener('submit', handlePostcardSubmit);
  ui.clearDoodle.addEventListener('click', clearDoodle);
  ui.userSelect.addEventListener('change', updateAuthButton);
  ui.passInput.addEventListener('input', updateAuthButton);
  ui.messageInput.addEventListener('input', updateSendButtonState);
  ui.photoInput.addEventListener('change', updateSendButtonState);
  setupDoodleCanvas();
  setupAudioRecorder();
  ui.moodButtons.forEach((btn) =>
    btn.addEventListener('click', () => openMoodPicker(btn))
  );
  if (ui.menuToggle) {
    ui.menuToggle.addEventListener('click', toggleMenuPanel);
  }
  if (ui.notificationBtn) {
    ui.notificationBtn.addEventListener('click', handleNotificationMenuClick);
  }
  if (ui.notificationItems) {
    ui.notificationItems.addEventListener('click', handleNotificationItemClick);
  }
  if (ui.notificationEnable) {
    ui.notificationEnable.addEventListener('click', handleNotificationEnableClick);
  }
  if (ui.ldAppToggle) {
    ui.ldAppToggle.addEventListener('click', openLdApp);
  }
  if (ui.ldAppBack) {
    ui.ldAppBack.addEventListener('click', closeLdApp);
  }
  ui.surpriseToggle.addEventListener('change', handleSurpriseToggle);
  ui.logoutBtn.addEventListener('click', handleLogout);
  ui.optionButtons.forEach((btn) => btn.addEventListener('click', () => toggleOption(btn)));
  updateNotificationUI();
  updateOptionVisibility();
  updateAuthButton();
  updateSendButtonState();
  setButtonState(ui.createBtn, false);
  restoreSession();
}

function handleAuth(event) {
  event.preventDefault();
  const user = document.getElementById('user-select').value;
  const pass = document.getElementById('passcode-input').value;
  if (!USER_PASSCODES[user]) {
    ui.authError.textContent = 'Pick who you are first.';
    return;
  }
  if (pass !== USER_PASSCODES[user]) {
    ui.authError.textContent = 'Passphrase mismatch.';
    return;
  }
  state.user = user;
  localStorage.setItem(AUTH_KEY, user);
  ui.authGate.style.display = 'none';
  ui.app.setAttribute('aria-hidden', 'false');
  enableCreateButton();
  updateAvatar();
  setWwanUser(state.user);
  startApp();
  initNotifications();
}

async function startApp() {
  if (state.started) return;
  state.started = true;
  await Promise.all([loadPostcards(), loadMoods()]);
  subscribeRealtime();
  subscribeCommentBroadcast();
}

function restoreSession() {
  const savedUser = localStorage.getItem(AUTH_KEY);
  if (!savedUser) return;
  state.user = savedUser;
  ui.authGate.style.display = 'none';
  ui.app.setAttribute('aria-hidden', 'false');
  enableCreateButton();
  updateAvatar();
  setWwanUser(state.user);
  startApp();
  initNotifications();
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
  await Promise.all([loadReactions(), loadComments(), loadCommentReactions()]);
  renderBoard();
}

function renderBoard() {
  ui.board.innerHTML = '';
  state.openReactionPicker = null;
  if (!state.postcards.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Your Loveboard is waiting for the first postcard ✨';
    ui.board.appendChild(empty);
    return;
  }
  state.postcards.forEach((card) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.id = card.id;
    if (card.user === state.user) {
      node.classList.add('own');
    }
    node.style.setProperty('--tilt', getTilt(card.id));
    node.querySelectorAll('.meta').forEach((metaEl) => {
      metaEl.textContent = `${card.user} · ${formatDate(card.created_at)}`;
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
      needsMeasure = false;
      requestAnimationFrame(() => measureCardHeight(node));
    } else if (isVisual && card.asset_url) {
      visual.hidden = false;
      visual.src = card.asset_url;
      visual.alt = `${card.type} from ${card.user}`;
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

    if (state.surprise) {
      node.classList.add('surprise');
    } else {
      node.classList.remove('surprise');
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
}

async function loadMoods() {
  Object.keys(MOOD_PRESETS).forEach(updateMoodTimestamp);
  const users = Object.keys(MOOD_PRESETS);
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
  const target = getOtherUser();
  if (target) {
    const mood = getMoodMeta(emoji, state.user);
    triggerRemoteNotification(target, `${state.user} shared a mood`, mood ? mood.label : 'Thinking of you.');
  }
}

function handleSurpriseToggle() {
  state.surprise = ui.surpriseToggle.checked;
  localStorage.setItem('loveboard-surprise', state.surprise);
  renderBoard();
}

function toggleMenuPanel(evt) {
  if (evt) {
    evt.stopPropagation();
  }
  if (state.menuOpen) {
    closeMenuPanel();
  } else {
    openMenuPanel();
  }
}

function openMenuPanel() {
  if (!ui.menuPanel) return;
  ui.menuPanel.hidden = false;
  state.menuOpen = true;
  if (ui.menuToggle) {
    ui.menuToggle.setAttribute('aria-expanded', 'true');
  }
  attachMenuListeners();
}

function closeMenuPanel() {
  if (!ui.menuPanel) return;
  ui.menuPanel.hidden = true;
  state.menuOpen = false;
  if (ui.menuToggle) {
    ui.menuToggle.setAttribute('aria-expanded', 'false');
  }
  if (ui.notificationPanel) {
    ui.notificationPanel.hidden = true;
  }
  state.notificationsPanelOpen = false;
  detachMenuListeners();
}

function attachMenuListeners() {
  if (!state.menuClickListener) {
    state.menuClickListener = (evt) => {
      if (!ui.menuPanel?.contains(evt.target) && evt.target !== ui.menuToggle) {
        closeMenuPanel();
      }
    };
    document.addEventListener('click', state.menuClickListener, false);
    document.addEventListener('touchstart', state.menuClickListener, false);
  }
  if (!state.menuKeyListener) {
    state.menuKeyListener = (evt) => {
      if (evt.key === 'Escape') {
        closeMenuPanel();
      }
    };
    document.addEventListener('keydown', state.menuKeyListener, true);
  }
}

function detachMenuListeners() {
  if (state.menuClickListener) {
    document.removeEventListener('click', state.menuClickListener, false);
    document.removeEventListener('touchstart', state.menuClickListener, false);
    state.menuClickListener = null;
  }
  if (state.menuKeyListener) {
    document.removeEventListener('keydown', state.menuKeyListener, true);
    state.menuKeyListener = null;
  }
}

function openLdApp() {
  if (!ui.ldAppView || !ui.loveboardView) return;
  closeMenuPanel();
  switchView(ui.ldAppView, ui.loveboardView);
  state.ldAppOpen = true;
  if (!state.ldAppKeyListener) {
    state.ldAppKeyListener = (evt) => {
      if (evt.key === 'Escape') {
        closeLdApp();
      }
    };
    document.addEventListener('keydown', state.ldAppKeyListener, true);
  }
}

function closeLdApp() {
  if (!ui.ldAppView || !ui.loveboardView) return;
  switchView(ui.loveboardView, ui.ldAppView, () => ui.menuToggle?.focus());
  state.ldAppOpen = false;
  if (state.ldAppKeyListener) {
    document.removeEventListener('keydown', state.ldAppKeyListener, true);
    state.ldAppKeyListener = null;
  }
}

function switchView(showEl, hideEl, onComplete) {
  const clean = (el) => el && el.classList.remove('view-enter', 'view-exit');
  clean(showEl);
  clean(hideEl);

  const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  const nextFocus =
    (showEl && showEl.querySelector(focusableSelector)) ||
    (showEl === ui.loveboardView ? ui.ldAppToggle : ui.menuToggle) ||
    document.body;

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

function renderNotificationList() {
  if (!ui.notificationItems || !ui.notificationPanel) return;
  ui.notificationItems.innerHTML = '';
  if (!state.activityFeed.length) {
    if (ui.notificationEmpty) {
      ui.notificationEmpty.hidden = false;
    }
    return;
  }
  if (ui.notificationEmpty) {
    ui.notificationEmpty.hidden = true;
  }
  state.activityFeed.forEach((entry) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'notification-item';
    if (!entry.read) {
      btn.classList.add('unread');
    }
    btn.dataset.activityId = entry.id;
    const title = document.createElement('p');
    title.className = 'notification-item-title';
    title.textContent = entry.title;
    const body = document.createElement('p');
    body.className = 'notification-item-body';
    body.textContent = entry.body || '';
    const time = document.createElement('span');
    time.className = 'notification-item-time';
    time.textContent = formatCommentTime(entry.timestamp);
    btn.append(title);
    if (entry.body) {
      btn.append(body);
    }
    btn.append(time);
    ui.notificationItems.appendChild(btn);
  });
}

function markNotificationsRead() {
  let changed = false;
  state.activityFeed.forEach((entry) => {
    if (!entry.read) {
      entry.read = true;
      changed = true;
    }
  });
  if (changed) {
    updateNotificationUI();
  }
}

function logActivity({ type, title, body, target }) {
  if (!title) return;
  const normalizedBody = body || '';
  const latest = state.activityFeed[0];
  if (
    latest &&
    latest.type === type &&
    latest.target === target &&
    latest.body === normalizedBody &&
    Date.now() - new Date(latest.timestamp).getTime() < 1500
  ) {
    return;
  }
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title,
    body: normalizedBody,
    target,
    timestamp: new Date().toISOString(),
    read: state.notificationsPanelOpen
  };
  state.activityFeed = [entry, ...state.activityFeed].slice(0, 40);
  updateNotificationUI();
}

function getActivityActor(user) {
  if (!user) return 'Someone';
  return user === state.user ? 'You' : user;
}

function focusNotification(activityId) {
  if (!activityId) return;
  const entry = state.activityFeed.find((item) => item.id === activityId);
  if (!entry) return;
  entry.read = true;
  updateNotificationUI();
  closeMenuPanel();
  focusActivityTarget(entry);
}

function focusActivityTarget(entry) {
  if (!entry?.target) return;
  const parts = entry.target.split(':');
  const type = parts[0];
  let element = null;
  if (type === 'postcard') {
    element = findPostcardElement(parts[1]);
  } else if (type === 'comment') {
    element = findCommentElement(parts[1], parts[2]);
  } else if (type === 'mood') {
    element = document.querySelector(`.mood-btn[data-user="${parts[1]}"]`);
  }
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    highlightElement(element);
  } else {
    showToast('Cannot find that update on the board.', 'error');
  }
}

function findPostcardElement(postcardId) {
  if (!postcardId) return null;
  return document.querySelector(`[data-id="${postcardId}"]`);
}

function findCommentElement(postcardId, commentId) {
  if (!postcardId || !commentId) return null;
  const card = findPostcardElement(postcardId);
  if (!card) return null;
  return card.querySelector(`[data-comment-id="${commentId}"]`) || card;
}

function highlightElement(element) {
  if (!element || !element.animate) return;
  element.animate(
    [
      { transform: 'scale(1)', boxShadow: '0 0 0 rgba(245, 181, 197, 0)' },
      { transform: 'scale(1.02)', boxShadow: '0 0 0 6px rgba(245, 181, 197, 0.4)' },
      { transform: 'scale(1)', boxShadow: '0 0 0 rgba(245, 181, 197, 0)' }
    ],
    { duration: 800 }
  );
}

function handleNotificationMenuClick(evt) {
  evt?.stopPropagation();
  if (!ui.notificationPanel) return;
  const willOpen = ui.notificationPanel.hidden;
  ui.notificationPanel.hidden = !willOpen;
  state.notificationsPanelOpen = willOpen;
  if (willOpen) {
    markNotificationsRead();
    renderNotificationList();
  }
}

function handleNotificationItemClick(evt) {
  const item = evt.target.closest('.notification-item');
  if (!item) return;
  evt.stopPropagation();
  const activityId = item.dataset.activityId;
  focusNotification(activityId);
}

async function handleNotificationEnableClick(evt) {
  evt?.stopPropagation();
  const allowed = await initNotifications();
  updateNotificationUI();
  if (allowed) {
    showToast('Push alerts enabled ✨');
  }
}

function updateNotificationUI() {
  const unread = state.activityFeed.filter((entry) => !entry.read).length;
  state.unreadActivityCount = unread;
  if (ui.notificationCount) {
    if (unread > 0) {
      ui.notificationCount.textContent = unread > 9 ? '9+' : String(unread);
      ui.notificationCount.hidden = false;
    } else {
      ui.notificationCount.hidden = true;
    }
  }
  updateNotificationControls();
  if (state.notificationsPanelOpen) {
    renderNotificationList();
  }
}

function updateNotificationControls() {
  if (!ui.notificationEnable) return;
  if (!notificationsSupported) {
    ui.notificationEnable.textContent = 'Push not supported';
    ui.notificationEnable.disabled = true;
    return;
  }
  if (Notification.permission === 'denied') {
    ui.notificationEnable.textContent = 'Push blocked in browser';
    ui.notificationEnable.disabled = true;
    return;
  }
  if (Notification.permission === 'granted' || state.notificationsAllowed) {
    ui.notificationEnable.textContent = 'Push alerts on';
    ui.notificationEnable.disabled = true;
    return;
  }
  ui.notificationEnable.textContent = 'Enable push alerts';
  ui.notificationEnable.disabled = false;
}

function getMoodMeta(emoji, user) {
  return getMoodOptions(user).find((m) => m.emoji === emoji) || FALLBACK_MOODS.find((m) => m.emoji === emoji);
}

function getMoodOptions(user) {
  return MOOD_PRESETS[user] || FALLBACK_MOODS;
}

function notifyMood(moodRow) {
  if (moodRow.user === state.user) return;
  const mood = getMoodMeta(moodRow.emoji, moodRow.user);
  const label = mood ? mood.label : 'a new feeling';
  notifyUser(`${moodRow.user} shared a mood`, label);
}

function getOtherUser() {
  if (state.user === 'Yassine') return 'Nihal';
  if (state.user === 'Nihal') return 'Yassine';
  return null;
}

function updateAvatar() {
  if (!ui.currentAvatar) return;
  ui.currentAvatar.textContent = state.user ? state.user[0] : '?';
}

function handleLogout() {
  closeMenuPanel();
  localStorage.removeItem(AUTH_KEY);
  state.started = false;
  state.user = null;
  updateAvatar();
  setWwanUser(null);
  location.reload();
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
    const target = getOtherUser();
    if (target) {
      triggerRemoteNotification(target, `New postcard from ${state.user}`, describePostcard(data));
    }
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
      if (payload.new.user !== state.user) {
        notifyUser(`New postcard from ${payload.new.user}`, describePostcard(payload.new));
      }
      logActivity({
        type: 'postcard:new',
        title: `${getActivityActor(payload.new.user)} posted a postcard`,
        body: describePostcard(payload.new),
        target: `postcard:${payload.new.id}`
      });
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'postcards' }, (payload) => {
      removePostcard(payload.old.id);
      renderBoard();
      logActivity({
        type: 'postcard:delete',
        title: `${getActivityActor(payload.old?.user)} deleted a postcard`,
        body: '',
        target: `postcard:${payload.old.id}`
      });
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'moods' }, (payload) => {
      const changedAt = payload.new.updated_at || payload.new.created_at || new Date().toISOString();
      setMood(payload.new.user, payload.new.emoji, changedAt);
      notifyMood(payload.new);
      logActivity({
        type: 'mood',
        title: `${getActivityActor(payload.new.user)} set their mood`,
        body: getMoodMeta(payload.new.emoji, payload.new.user)?.label || payload.new.emoji,
        target: `mood:${payload.new.user}`
      });
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'moods' }, (payload) => {
      const changedAt = payload.new.updated_at || payload.new.created_at || new Date().toISOString();
      setMood(payload.new.user, payload.new.emoji, changedAt);
      notifyMood(payload.new);
      logActivity({
        type: 'mood',
        title: `${getActivityActor(payload.new.user)} updated their mood`,
        body: getMoodMeta(payload.new.emoji, payload.new.user)?.label || payload.new.emoji,
        target: `mood:${payload.new.user}`
      });
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'postcard_reactions' }, (payload) => {
      applyReactionRow(payload.new);
      updateReactionUI(payload.new.postcard_id);
      if (payload.new.user !== state.user) {
        notifyUser('New postcard reaction', `${payload.new.user} reacted ${payload.new.reaction}`);
      }
      logActivity({
        type: 'reaction:add',
        title: `${getActivityActor(payload.new.user)} reacted ${payload.new.reaction}`,
        body: '',
        target: `postcard:${payload.new.postcard_id}`
      });
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'postcard_reactions' }, (payload) => {
      removeReactionRow(payload.old);
      updateReactionUI(payload.old.postcard_id);
      logActivity({
        type: 'reaction:remove',
        title: `${getActivityActor(payload.old?.user)} removed a reaction`,
        body: '',
        target: `postcard:${payload.old.postcard_id}`
      });
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comment_reactions' }, (payload) => {
      applyCommentReactionRow(payload.new);
      updateCommentUI(payload.new.postcard_id);
      logActivity({
        type: 'commentReaction:add',
        title: `${getActivityActor(payload.new.user)} reacted ${payload.new.reaction} to a comment`,
        body: '',
        target: `comment:${payload.new.postcard_id}:${payload.new.comment_id}`
      });
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comment_reactions' }, (payload) => {
      removeCommentReactionRow(payload.old);
      updateCommentUI(payload.old.postcard_id);
      logActivity({
        type: 'commentReaction:remove',
        title: `${getActivityActor(payload.old?.user)} removed a comment reaction`,
        body: '',
        target: `comment:${payload.old.postcard_id}:${payload.old.comment_id}`
      });
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
      if (payload.new.user !== state.user) {
        const raw = payload.new.comment || '';
        const snippet = raw.length > 60 ? `${raw.slice(0, 57)}…` : raw;
        notifyUser('New postcard comment', `${payload.new.user}: ${snippet}`);
      }
      logActivity({
        type: 'comment:new',
        title: `${getActivityActor(payload.new.user)} commented`,
        body: payload.new.comment || '',
        target: `comment:${payload.new.postcard_id}:${payload.new.id}`
      });
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'postcard_comments' }, (payload) => {
      applyCommentRow(payload.new);
      updateCommentUI(payload.new.postcard_id);
      logActivity({
        type: 'comment:update',
        title: `${getActivityActor(payload.new.user)} edited a comment`,
        body: payload.new.comment || '',
        target: `comment:${payload.new.postcard_id}:${payload.new.id}`
      });
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'postcard_comments' }, (payload) => {
      removeCommentRow(payload.old);
      updateCommentUI(payload.old.postcard_id);
      logActivity({
        type: 'comment:delete',
        title: `${getActivityActor(payload.old?.user)} deleted a comment`,
        body: '',
        target: `comment:${payload.old.postcard_id}:${payload.old.id}`
      });
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
      logActivity({
        type: 'comment:new',
        title: `${getActivityActor(payload.user)} commented`,
        body: payload.comment || '',
        target: `comment:${payload.postcard_id}:${payload.id}`
      });
    })
    .on('broadcast', { event: 'comment:update' }, ({ payload }) => {
      if (!payload) return;
      applyCommentRow(payload);
      updateCommentUI(payload.postcard_id);
      logActivity({
        type: 'comment:update',
        title: `${getActivityActor(payload.user)} edited a comment`,
        body: payload.comment || '',
        target: `comment:${payload.postcard_id}:${payload.id}`
      });
    })
    .on('broadcast', { event: 'comment:delete' }, ({ payload }) => {
      if (!payload) return;
      removeCommentRow(payload);
      updateCommentUI(payload.postcard_id);
      logActivity({
        type: 'comment:delete',
        title: `${getActivityActor(payload.user)} deleted a comment`,
        body: '',
        target: `comment:${payload.postcard_id}:${payload.id}`
      });
    })
    .on('broadcast', { event: 'reaction:add' }, ({ payload }) => {
      if (!payload?.row || payload?.sender === state.user) return;
      applyReactionRow(payload.row);
      updateReactionUI(payload.row.postcard_id);
      logActivity({
        type: 'reaction:add',
        title: `${getActivityActor(payload.row.user)} reacted ${payload.row.reaction}`,
        body: '',
        target: `postcard:${payload.row.postcard_id}`
      });
    })
    .on('broadcast', { event: 'reaction:remove' }, ({ payload }) => {
      if (!payload?.row || payload?.sender === state.user) return;
      removeReactionRow(payload.row);
      updateReactionUI(payload.row.postcard_id);
      logActivity({
        type: 'reaction:remove',
        title: `${getActivityActor(payload.row.user)} removed a reaction`,
        body: '',
        target: `postcard:${payload.row.postcard_id}`
      });
    })
    .on('broadcast', { event: 'commentReaction:add' }, ({ payload }) => {
      if (!payload?.row || payload?.sender === state.user) return;
      applyCommentReactionRow(payload.row);
      updateCommentUI(payload.row.postcard_id);
      logActivity({
        type: 'commentReaction:add',
        title: `${getActivityActor(payload.row.user)} reacted ${payload.row.reaction} to a comment`,
        body: '',
        target: `comment:${payload.row.postcard_id}:${payload.row.comment_id}`
      });
    })
    .on('broadcast', { event: 'commentReaction:remove' }, ({ payload }) => {
      if (!payload?.row || payload?.sender === state.user) return;
      removeCommentReactionRow(payload.row);
      updateCommentUI(payload.row.postcard_id);
      logActivity({
        type: 'commentReaction:remove',
        title: `${getActivityActor(payload.row.user)} removed a comment reaction`,
        body: '',
        target: `comment:${payload.row.postcard_id}:${payload.row.comment_id}`
      });
    })
    .on('broadcast', { event: 'postcard:new' }, ({ payload }) => {
      if (!payload?.postcard || payload?.sender === state.user) return;
      upsertPostcard(payload.postcard);
      renderBoard();
      gentlePulse(`[data-id="${payload.postcard.id}"]`);
      logActivity({
        type: 'postcard:new',
        title: `${getActivityActor(payload.postcard.user)} posted a postcard`,
        body: describePostcard(payload.postcard),
        target: `postcard:${payload.postcard.id}`
      });
    })
    .on('broadcast', { event: 'postcard:delete' }, ({ payload }) => {
      if (!payload?.postcard_id) return;
      removePostcard(payload.postcard_id);
      renderBoard();
      logActivity({
        type: 'postcard:delete',
        title: 'A postcard was deleted',
        body: '',
        target: `postcard:${payload.postcard_id}`
      });
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
    const target = getOtherUser();
    if (target) {
      triggerRemoteNotification(target, `${state.user} reacted`, `Reaction: ${reaction}`);
    }
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
    const target = getOtherUser();
    if (target) {
      const preview = text.length > 60 ? `${text.slice(0, 57)}…` : text;
      triggerRemoteNotification(target, `${state.user} replied`, preview);
    }
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

async function initNotifications() {
  if (!('serviceWorker' in navigator) || !notificationsSupported) {
    return false;
  }
  if (!state.swRegistration) {
    try {
      state.swRegistration = await navigator.serviceWorker.register('/sw.js');
    } catch (err) {
      console.error('service worker registration failed', err);
      updateNotificationUI();
      return false;
    }
  }
  if (Notification.permission === 'default') {
    try {
      const permission = await Notification.requestPermission();
      state.notificationsAllowed = permission === 'granted';
    } catch (err) {
      console.error('notification permission', err);
      state.notificationsAllowed = false;
    }
  } else {
    state.notificationsAllowed = Notification.permission === 'granted';
  }
  updateNotificationUI();
  if (!state.notificationsAllowed) {
    return false;
  }
  await ensurePushSubscription();
  return true;
}

async function notifyUser(title, body) {
  if (!state.notificationsAllowed) return;
  try {
    const registration =
      state.swRegistration || (await navigator.serviceWorker.getRegistration());
    if (registration) {
      await registration.showNotification(title, {
        body,
        icon: NOTIFICATION_ICON,
        badge: NOTIFICATION_ICON
      });
    } else if (notificationsSupported && Notification.permission === 'granted') {
      new Notification(title, { body, icon: NOTIFICATION_ICON });
    }
  } catch (err) {
    console.error('notify error', err);
  }
}

async function ensurePushSubscription() {
  if (!state.notificationsAllowed || !state.swRegistration) return;
  const existing = await state.swRegistration.pushManager.getSubscription();
  if (existing) {
    state.pushSubscription = existing;
    await saveSubscription(existing);
    return;
  }
  const vapidKey = window.__VAPID_PUBLIC_KEY__;
  if (!vapidKey) return;
  try {
    const subscription = await state.swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey)
    });
    state.pushSubscription = subscription;
    await saveSubscription(subscription);
  } catch (err) {
    console.error('push subscribe failed', err);
  }
}

async function saveSubscription(subscription) {
  if (!state.user) return;
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user: state.user,
      endpoint: subscription.endpoint,
      subscription
    },
    { onConflict: 'endpoint' }
  );
  if (error) {
    console.error('subscription save', error);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function triggerRemoteNotification(targetUser, title, body) {
  if (!targetUser) return;
  try {
    await supabase.functions.invoke('notify-push', {
      body: { targetUser, title, body }
    });
  } catch (err) {
    console.error('remote notify', err);
  }
}

function showToast(message, mode = 'info') {
  if (!ui.toast) return;
  ui.toast.textContent = message;
  ui.toast.dataset.mode = mode;
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
  const ready = Boolean(ui.userSelect.value && ui.passInput.value.trim());
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

function openModal() {
  resetOptionPicker();
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
