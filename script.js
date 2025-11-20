import { supabase } from './supabase.js';

const USER_PASSCODES = {
  Yassine: 'iloven',
  Nihal: 'ilovey'
};

const MOOD_STICKERS = [
  { emoji: '💗', label: 'So in love with you' },
  { emoji: '🫶', label: 'Missing you right now' },
  { emoji: '💛', label: 'Soft + grateful' },
  { emoji: '💙', label: 'Need extra cuddles' },
  { emoji: '💋', label: 'Ready for kisses' },
  { emoji: '🔥', label: 'Ridiculously horny' },
  { emoji: '💖', label: 'Playful sparkles' }
];
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
const LONG_PRESS_DURATION = 600;
const AUTH_KEY = 'loveboard-user';
const DEFAULT_NOTE_IMG = './assets/default-note.svg';
const NOTIFICATION_ICON = './assets/heart.svg';
const notificationsSupported = 'Notification' in window;
const storedSurprise = localStorage.getItem('loveboard-surprise');
const initialSurprise = storedSurprise === null ? true : storedSurprise === 'true';
if (storedSurprise === null) {
  localStorage.setItem('loveboard-surprise', 'true');
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
  longPressTimer: null,
  started: false,
  reactions: {},
  userReactions: {},
  comments: {},
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
  commentUpdatedAtSupported: true
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
  logoutBtn: document.getElementById('logout-btn'),
  currentAvatar: document.getElementById('current-user-avatar'),
  toast: document.getElementById('toast'),
  optionButtons: document.querySelectorAll('.option-btn'),
  optionSections: document.querySelectorAll('.option-section')
};

const template = document.getElementById('postcard-template');

init();

function init() {
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
  ui.surpriseToggle.addEventListener('change', handleSurpriseToggle);
  ui.logoutBtn.addEventListener('click', handleLogout);
  ui.optionButtons.forEach((btn) => btn.addEventListener('click', () => toggleOption(btn)));
  updateOptionVisibility();
  updateAuthButton();
  updateSendButtonState();
  setButtonState(ui.createBtn, false);
  restoreSession();
  setupLongPressHearts();
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
  await Promise.all([loadReactions(), loadComments()]);
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
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('moods')
    .select('*')
    .eq('date', today);
  if (error) {
    console.error('moods load', error);
    showToast(`Couldn't load moods: ${error.message}`, 'error');
    return;
  }
  (data || []).forEach((entry) => setMood(entry.user, entry.emoji));
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
  const columnsWithUpdate = 'id,postcard_id,user,comment,created_at,updated_at';
  let columns = columnsWithUpdate;
  let data;
  let error;
  ({ data, error } = await supabase
    .from('postcard_comments')
    .select(columns)
    .order('created_at', { ascending: true }));
  if (error && isUpdatedAtMissing(error)) {
    state.commentUpdatedAtSupported = false;
    columns = 'id,postcard_id,user,comment,created_at';
    ({ data, error } = await supabase
      .from('postcard_comments')
      .select(columns)
      .order('created_at', { ascending: true }));
  } else {
    state.commentUpdatedAtSupported = true;
  }
  if (error) {
    console.error('comments load', error);
    return;
  }
  state.comments = {};
  (data || []).forEach(applyCommentRow);
}

function setMood(user, emoji) {
  const btn = document.querySelector(`.mood-btn[data-user="${user}"]`);
  if (!btn) return;
  const mood = getMoodMeta(emoji);
  btn.dataset.mood = emoji;
  btn.innerHTML = `${emoji} <span>${mood ? mood.label : ''}</span>`;
}

function openMoodPicker(anchorBtn) {
  if (!state.user) return;
  if (anchorBtn.dataset.user !== state.user) return;
  closeMoodMenus();
  const menu = document.createElement('div');
  menu.className = 'mood-menu';
  MOOD_STICKERS.forEach(({ emoji, label }) => {
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
  const { error } = await supabase.from('moods').upsert(
    {
      user: state.user,
      date: today,
      emoji
    },
    { onConflict: 'user,date' }
  );
  if (error) {
    console.error('mood save', error);
    showToast(`Couldn't save mood: ${error.message}`, 'error');
    return;
  }
  setMood(state.user, emoji);
  const target = getOtherUser();
  if (target) {
    const mood = getMoodMeta(emoji);
    triggerRemoteNotification(target, `${state.user} shared a mood`, mood ? mood.label : 'Thinking of you.');
  }
}

function handleSurpriseToggle() {
  state.surprise = ui.surpriseToggle.checked;
  localStorage.setItem('loveboard-surprise', state.surprise);
  renderBoard();
}

function getMoodMeta(emoji) {
  return MOOD_STICKERS.find((m) => m.emoji === emoji);
}

function notifyMood(moodRow) {
  if (moodRow.user === state.user) return;
  const mood = getMoodMeta(moodRow.emoji);
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
  localStorage.removeItem(AUTH_KEY);
  state.started = false;
  state.user = null;
  updateAvatar();
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

function setupLongPressHearts() {
  const zone = document.body;
  zone.addEventListener('pointerdown', () => {
    if (!state.user) return;
    state.longPressTimer = setTimeout(sendHeart, LONG_PRESS_DURATION);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((evt) =>
    zone.addEventListener(evt, cancelHeartTimer)
  );
}

function cancelHeartTimer() {
  clearTimeout(state.longPressTimer);
  state.longPressTimer = null;
}

async function sendHeart() {
  cancelHeartTimer();
  if (!state.user) return;
  const { error } = await supabase.from('hearts').insert({
    user: state.user,
    event_type: 'heart'
  });
  if (error) {
    console.error('heart send', error);
    showToast('Heart failed to send.', 'error');
  } else {
    spawnHeart('💗');
    const target = getOtherUser();
    if (target) {
      triggerRemoteNotification(target, `${state.user} sent hearts`, 'Long-press anywhere to float some back.');
    }
  }
}

function spawnHeart(emoji) {
  const el = document.createElement('span');
  el.className = 'heart-float';
  el.textContent = emoji;
  el.style.left = `${Math.random() * 100}%`;
  el.style.top = `${50 + Math.random() * 40}%`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1600);
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
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'postcards' }, (payload) => {
      removePostcard(payload.old.id);
      renderBoard();
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'moods' }, (payload) => {
      setMood(payload.new.user, payload.new.emoji);
      notifyMood(payload.new);
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'moods' }, (payload) => {
      setMood(payload.new.user, payload.new.emoji);
      notifyMood(payload.new);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hearts' }, (payload) => {
      const emojis = ['💗', '💖', '💞', '💕'];
      spawnHeart(emojis[Math.floor(Math.random() * emojis.length)]);
      if (payload.new.user !== state.user) {
        notifyUser(`${payload.new.user} sent hearts`, 'Long-press anywhere to send love back.');
      }
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'postcard_reactions' }, (payload) => {
      applyReactionRow(payload.new);
      updateReactionUI(payload.new.postcard_id);
      if (payload.new.user !== state.user) {
        notifyUser('New postcard reaction', `${payload.new.user} reacted ${payload.new.reaction}`);
      }
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'postcard_reactions' }, (payload) => {
      removeReactionRow(payload.old);
      updateReactionUI(payload.old.postcard_id);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'postcard_comments' }, (payload) => {
      applyCommentRow(payload.new);
      updateCommentUI(payload.new.postcard_id);
      if (payload.new.user !== state.user) {
        const raw = payload.new.comment || '';
        const snippet = raw.length > 60 ? `${raw.slice(0, 57)}…` : raw;
        notifyUser('New postcard comment', `${payload.new.user}: ${snippet}`);
      }
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
  delete state.comments[id];
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

function removeCommentRow(row) {
  const postcardId = row?.postcard_id;
  const commentId = row?.id;
  if (!postcardId || !commentId) return;
  if (!state.comments[postcardId]) return;
  state.comments[postcardId] = state.comments[postcardId].filter((entry) => entry.id !== commentId);
  if (!state.comments[postcardId].length) {
    delete state.comments[postcardId];
  }
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
      const text = document.createElement('p');
      text.className = 'comment-text';
      text.textContent = entry.comment || '';
      row.append(text);
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
        row.append(actions);
      }
    }
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
    const rect = picker.getBoundingClientRect();
    if (rect.bottom > window.innerHeight - 12) {
      picker.style.top = '-60px';
    } else {
      picker.style.top = '40px';
    }
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
  const { error } = await supabase.from('postcard_reactions').insert({
    postcard_id: postcardId,
    reaction,
    user: state.user
  });
  if (error) {
    console.error('reaction save', error);
    showToast('Reaction failed to send.', 'error');
  } else {
    applyReactionRow({ postcard_id: postcardId, reaction, user: state.user });
    updateReactionUI(postcardId);
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
}

function updateReactionUI(postcardId) {
  const card = document.querySelector(`[data-id="${postcardId}"]`);
  if (!card) return;
  card.querySelectorAll('.reaction-counts').forEach((container) =>
    renderReactionCounts(postcardId, container)
  );
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
  if (!('serviceWorker' in navigator) || !notificationsSupported) return;
  if (!state.swRegistration) {
    try {
      state.swRegistration = await navigator.serviceWorker.register('/sw.js');
    } catch (err) {
      console.error('service worker registration failed', err);
      return;
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
  if (state.notificationsAllowed) {
    await ensurePushSubscription();
  }
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
  await cleanupPostcardChildren(id);
  const { error } = await supabase.from('postcards').delete().eq('id', id);
  if (error) {
    console.error('delete postcard', error);
    showToast('Delete failed. Try again.', 'error');
    return;
  }
  removePostcard(id);
  renderBoard();
  showToast('Postcard deleted');
}

async function cleanupPostcardChildren(id) {
  await Promise.all([
    deleteChildRows('postcard_comments', id),
    deleteChildRows('postcard_reactions', id)
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
    day: 'numeric'
  }).format(new Date(value));
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
