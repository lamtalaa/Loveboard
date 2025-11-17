import { supabase } from './supabase.js';

const USER_PASSCODES = {
  Yassine: 'loven',
  Nihal: 'lovey'
};

const MOOD_STICKERS = ['💗', '💛', '🫶', '💙', '💖'];
const BUCKET = 'loveboard-assets';
const LONG_PRESS_DURATION = 600;

const state = {
  user: null,
  postcards: [],
  surprise: localStorage.getItem('loveboard-surprise') === 'true',
  doodleDirty: false,
  doodleCtx: null,
  recording: {
    recorder: null,
    chunks: []
  },
  audioBlob: null,
  longPressTimer: null
};

const ui = {
  app: document.querySelector('.app'),
  authGate: document.getElementById('auth-gate'),
  authForm: document.getElementById('auth-form'),
  authError: document.getElementById('auth-error'),
  board: document.getElementById('board'),
  timeline: document.getElementById('timeline'),
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
  moodButtons: document.querySelectorAll('.mood-btn'),
  surpriseToggle: document.getElementById('surprise-toggle')
};

const template = document.getElementById('postcard-template');

init();

function init() {
  ui.surpriseToggle.checked = state.surprise;
  ui.authForm.addEventListener('submit', handleAuth);
  ui.createBtn.addEventListener('click', () => ui.modal.showModal());
  ui.closeModal.addEventListener('click', () => ui.modal.close());
  ui.postcardForm.addEventListener('submit', handlePostcardSubmit);
  ui.clearDoodle.addEventListener('click', clearDoodle);
  setupDoodleCanvas();
  setupAudioRecorder();
  ui.moodButtons.forEach((btn) =>
    btn.addEventListener('click', () => openMoodPicker(btn))
  );
  ui.surpriseToggle.addEventListener('change', handleSurpriseToggle);
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
  ui.authGate.style.display = 'none';
  ui.app.setAttribute('aria-hidden', 'false');
  startApp();
}

async function startApp() {
  await Promise.all([loadPostcards(), loadMoods()]);
  subscribeRealtime();
}

async function loadPostcards() {
  const { data, error } = await supabase
    .from('postcards')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('postcards load', error);
    return;
  }
  state.postcards = data || [];
  renderBoard();
  renderTimeline();
}

function renderBoard() {
  ui.board.innerHTML = '';
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
    node.querySelector('.note').textContent = card.message || 'No message, just vibes.';
    node.querySelector('.meta').textContent = `${card.user} · ${formatDate(card.created_at)}`;

    const img = node.querySelector('img');
    const audioChip = node.querySelector('.audio-chip');

    img.hidden = true;
    audioChip.hidden = true;

    if (card.asset_url) {
      if (card.type === 'image' || card.type === 'doodle') {
        img.hidden = false;
        img.src = card.asset_url;
        img.alt = `${card.type} from ${card.user}`;
      } else if (card.type === 'audio') {
        audioChip.hidden = false;
        audioChip.onclick = () => playAudio(card.asset_url);
      }
    }

    if (state.surprise) {
      node.classList.add('surprise');
    } else {
      node.classList.remove('surprise');
    }

    node.addEventListener('click', () => {
      node.classList.toggle('flipped');
      node.classList.add('revealed');
    });

    ui.board.appendChild(node);
  });
}

function renderTimeline() {
  ui.timeline.innerHTML = '';
  if (!state.postcards.length) {
    ui.timeline.innerHTML = '<p class="empty-state">Memories will appear here.</p>';
    return;
  }
  const sorted = [...state.postcards].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );
  sorted.forEach((card) => {
    const row = document.createElement('div');
    row.className = 'timeline-item';
    row.innerHTML = `
      <span class="timeline-marker"></span>
      <div class="timeline-card">
        <strong>${formatDate(card.created_at)}</strong>
        <p>${card.message || `${card.user} sent a ${card.type}.`}</p>
      </div>
    `;
    ui.timeline.appendChild(row);
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
    return;
  }
  (data || []).forEach((entry) => setMood(entry.user, entry.emoji));
}

function setMood(user, emoji) {
  const btn = document.querySelector(`.mood-btn[data-user="${user}"]`);
  if (btn) {
    btn.textContent = emoji;
  }
}

function openMoodPicker(anchorBtn) {
  if (!state.user) return;
  if (anchorBtn.dataset.user !== state.user) return;
  closeMoodMenus();
  const menu = document.createElement('div');
  menu.className = 'mood-menu';
  MOOD_STICKERS.forEach((emoji) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.textContent = emoji;
    option.addEventListener('click', async () => {
      await saveMood(emoji);
      closeMoodMenus();
    });
    menu.appendChild(option);
  });
  anchorBtn.parentElement.appendChild(menu);
  document.addEventListener('click', handleMoodClickAway, { once: true });
}

function handleMoodClickAway(evt) {
  if (!evt.target.closest('.mood')) {
    closeMoodMenus();
  }
}

function closeMoodMenus() {
  document.querySelectorAll('.mood-menu').forEach((menu) => menu.remove());
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
    return;
  }
  setMood(state.user, emoji);
}

function handleSurpriseToggle() {
  state.surprise = ui.surpriseToggle.checked;
  localStorage.setItem('loveboard-surprise', state.surprise);
  renderBoard();
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
    const mediaRecorder = new MediaRecorder(stream);
    state.recording.recorder = mediaRecorder;
    state.recording.chunks = [];
    state.audioBlob = null;
    mediaRecorder.start();
    ui.recordAudio.textContent = 'Stop';
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
      const blob = new Blob(state.recording.chunks, { type: 'audio/webm' });
      state.audioBlob = blob;
      ui.audioPreview.src = URL.createObjectURL(blob);
      ui.audioPreview.dataset.ready = 'true';
      ui.recordAudio.textContent = 'Start';
      stream.getTracks().forEach((track) => track.stop());
      state.recording.recorder = null;
    };
  } catch (err) {
    console.error('recording failed', err);
    ui.recordAudio.disabled = true;
  }
}

async function handlePostcardSubmit(event) {
  event.preventDefault();
  if (!state.user) return;
  const message = ui.messageInput.value.trim();
  const photo = ui.photoInput.files[0];
  const doodleBlob = state.doodleDirty ? await canvasToBlob(ui.doodleCanvas) : null;
  const audioBlob = state.audioBlob;
  let type = 'text';
  let assetUrl = null;

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
    }
  } catch (err) {
    console.error('upload failed', err);
    return;
  }

  if (!message && !assetUrl) {
    alert('Add a short note or attach something lovely.');
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
    return;
  }
  if (data) {
    state.postcards = [data, ...state.postcards];
    renderBoard();
    renderTimeline();
    gentlePulse(`[data-id="${data.id}"]`);
  }
  ui.modal.close();
  ui.postcardForm.reset();
  clearDoodle();
  ui.audioPreview.removeAttribute('src');
  ui.audioPreview.removeAttribute('data-ready');
  state.audioBlob = null;
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

function playAudio(url) {
  const audio = new Audio(url);
  audio.play().catch((err) => console.error(err));
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
  } else {
    spawnHeart('💗');
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
  const channel = supabase.channel('loveboard-channel');
  channel
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'postcards' }, (payload) => {
      state.postcards = [payload.new, ...state.postcards];
      renderBoard();
      renderTimeline();
      gentlePulse(`[data-id="${payload.new.id}"]`);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'moods' }, (payload) => {
      setMood(payload.new.user, payload.new.emoji);
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'moods' }, (payload) => {
      setMood(payload.new.user, payload.new.emoji);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hearts' }, (payload) => {
      const emojis = ['💗', '💖', '💞', '💕'];
      spawnHeart(emojis[Math.floor(Math.random() * emojis.length)]);
    })
    .subscribe();
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

function formatDate(value) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric'
  }).format(new Date(value));
}
