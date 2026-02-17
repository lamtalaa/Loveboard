const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;
const STORY_TITLE_MAX_CHARS = 64;
const STORY_RENDER_SNIPPET_CHARS = 180;
const STORY_RENDER_SNIPPET_LINES = 5;
const SCREEN_FADE_MS = 240;

const THEMES = {
  blush: {
    label: 'Blush Glow',
    background: ['#2a1222', '#5a2648', '#cc6f9a'],
    overlay: ['rgba(14, 8, 16, 0.6)', 'rgba(110, 36, 78, 0.32)', 'rgba(252, 219, 235, 0.16)'],
    accent: '#ffd9ea',
    chip: 'rgba(255, 235, 245, 0.16)'
  },
  dusk: {
    label: 'Dusk Film',
    background: ['#111a3f', '#2a3f74', '#f18a74'],
    overlay: ['rgba(7, 10, 20, 0.64)', 'rgba(23, 49, 89, 0.34)', 'rgba(255, 205, 172, 0.16)'],
    accent: '#ffe7dc',
    chip: 'rgba(255, 224, 205, 0.14)'
  },
  noir: {
    label: 'Noir Dream',
    background: ['#130d22', '#211543', '#44358f'],
    overlay: ['rgba(2, 4, 10, 0.72)', 'rgba(40, 24, 70, 0.38)', 'rgba(213, 185, 255, 0.12)'],
    accent: '#f3e8ff',
    chip: 'rgba(234, 214, 255, 0.12)'
  }
};

export function createInstagramStoryShare(options = {}) {
  const showToast = typeof options.showToast === 'function' ? options.showToast : () => {};
  const appName = typeof options.appName === 'string' && options.appName.trim() ? options.appName.trim() : 'Loveboard';

  const state = {
    story: null,
    authorName: '',
    createdLabel: '',
    sensitiveTerms: [],
    selectedSnippet: '',
    coverOptions: [],
    selectedCoverUrl: '',
    previewBlob: null,
    previewUrl: '',
    previewDirty: false,
    busy: false,
    previewTimer: 0,
    closeTimer: 0,
    open: false,
    returnFocusEl: null
  };

  const ui = createUi();
  bindEvents();
  window.addEventListener('keydown', handleWindowKeydown);

  return {
    open,
    destroy
  };

  function createUi() {
    const screen = document.createElement('section');
    screen.className = 'ig-story-screen';
    screen.hidden = true;
    screen.setAttribute('aria-hidden', 'true');
    screen.setAttribute('role', 'dialog');
    screen.setAttribute('aria-modal', 'true');
    screen.innerHTML = `
      <div class="ig-story-screen-shell">
        <div class="ig-story-layout">
          <section class="ig-story-preview-shell" aria-label="Story preview">
            <div class="ig-story-title-row">
              <button type="button" class="ig-story-close" aria-label="Back">←</button>
              <p class="ig-story-story-title" data-ig-story-title>Story</p>
            </div>
            <figure class="ig-story-preview">
              <img alt="Instagram story preview" data-ig-story-preview />
            </figure>
          </section>
          <section class="ig-story-controls">
            <fieldset class="ig-story-fieldset ig-story-image-fieldset" data-ig-story-image-picker hidden>
              <legend>Story image</legend>
              <div class="ig-story-image-options" data-ig-story-image-options></div>
            </fieldset>
            <fieldset class="ig-story-fieldset ig-story-pill-fieldset ig-story-theme-fieldset">
              <legend>Look</legend>
              <div class="ig-story-pill-options">
                ${Object.entries(THEMES)
                  .map(
                    ([key, value]) =>
                      `<label><input type="radio" name="ig-story-theme" value="${key}" ${
                        key === 'blush' ? 'checked' : ''
                      } /><span>${value.label}</span></label>`
                  )
                  .join('')}
              </div>
            </fieldset>
            <fieldset class="ig-story-fieldset ig-story-pill-fieldset ig-story-bg-fieldset">
              <legend>Background</legend>
              <div class="ig-story-pill-options">
                <label><input type="radio" name="ig-story-background" value="cover" /><span>Story cover</span></label>
                <label><input type="radio" name="ig-story-background" value="gradient" checked /><span>Gradient</span></label>
              </div>
            </fieldset>
            <div class="ig-story-toggles">
              <label class="ig-story-toggle">
                <input type="checkbox" id="ig-story-privacy" /> Hide names and locations
              </label>
              <label class="ig-story-toggle">
                <input type="checkbox" id="ig-story-watermark" checked /> Show "From ${escapeHtml(appName)}"
              </label>
            </div>
          </section>
        </div>
        <footer class="ig-story-footer">
          <p class="ig-story-status" data-ig-story-status aria-live="polite" hidden></p>
          <div class="ig-story-actions">
            <button type="button" class="primary ig-story-share-btn" data-action="share">
              <span class="ig-story-share-btn-icon" aria-hidden="true"></span>
              <span>Share to Instagram Story</span>
            </button>
          </div>
        </footer>
      </div>
    `;
    document.body.appendChild(screen);

    return {
      screen,
      closeBtn: screen.querySelector('.ig-story-close'),
      storyTitle: screen.querySelector('[data-ig-story-title]'),
      themeInputs: screen.querySelectorAll('input[name="ig-story-theme"]'),
      bgInputs: screen.querySelectorAll('input[name="ig-story-background"]'),
      imagePicker: screen.querySelector('[data-ig-story-image-picker]'),
      imageOptions: screen.querySelector('[data-ig-story-image-options]'),
      bgCover: screen.querySelector('input[name="ig-story-background"][value="cover"]'),
      bgGradient: screen.querySelector('input[name="ig-story-background"][value="gradient"]'),
      privacy: screen.querySelector('#ig-story-privacy'),
      watermark: screen.querySelector('#ig-story-watermark'),
      status: screen.querySelector('[data-ig-story-status]'),
      preview: screen.querySelector('[data-ig-story-preview]'),
      shareBtn: screen.querySelector('[data-action="share"]')
    };
  }

  function bindEvents() {
    if (ui.closeBtn) {
      ui.closeBtn.addEventListener('click', close);
    }
    [ui.privacy, ui.watermark].forEach((el) => {
      if (!el) return;
      el.addEventListener('input', schedulePreviewRender);
      el.addEventListener('change', schedulePreviewRender);
    });
    if (ui.themeInputs?.length) {
      ui.themeInputs.forEach((input) => {
        input.addEventListener('change', () => {
          if (!input.checked) return;
          schedulePreviewRender();
        });
      });
    }
    if (ui.bgInputs?.length) {
      ui.bgInputs.forEach((input) => {
        input.addEventListener('change', () => {
          if (!input.checked) return;
          schedulePreviewRender();
        });
      });
    }
    if (ui.imageOptions) {
      ui.imageOptions.addEventListener('click', handleImageOptionClick);
    }
    if (ui.shareBtn) {
      ui.shareBtn.addEventListener('click', () => {
        void handleShare();
      });
    }
  }

  function open(payload = {}) {
    const story = payload.story;
    if (!story || typeof story !== 'object') return;

    state.story = story;
    state.authorName = String(payload.authorName || '').trim();
    state.createdLabel = String(payload.createdLabel || '').trim();
    state.sensitiveTerms = normalizeSensitiveTerms(payload.sensitiveTerms || []);
    state.selectedSnippet = summarizeForStory(String(payload.selectedSnippet || ''), STORY_RENDER_SNIPPET_CHARS);
    state.coverOptions = getCoverOptions(story);
    state.selectedCoverUrl = state.coverOptions[0] || '';

    if (ui.storyTitle) {
      ui.storyTitle.textContent = story.title ? String(story.title) : 'Untitled story';
    }
    renderImageOptions();

    const hasCover = Boolean(state.selectedCoverUrl);
    if (ui.bgCover) {
      ui.bgCover.disabled = !hasCover;
      ui.bgCover.checked = hasCover;
    }
    if (ui.bgGradient) {
      ui.bgGradient.checked = !hasCover;
    }
    setRadioValue(ui.themeInputs, 'blush', 'blush');
    setRadioValue(ui.bgInputs, hasCover ? 'cover' : 'gradient', 'gradient');
    if (ui.privacy) {
      ui.privacy.checked = false;
    }
    if (ui.watermark) {
      ui.watermark.checked = true;
    }

    markPreviewDirty(false);
    setStatus('');
    if (ui.screen) {
      if (state.closeTimer) {
        window.clearTimeout(state.closeTimer);
        state.closeTimer = 0;
      }
      if (!state.open) {
        state.returnFocusEl = document.activeElement;
      }
      state.open = true;
      ui.screen.hidden = false;
      ui.screen.setAttribute('aria-hidden', 'false');
      document.body.classList.add('ig-story-screen-open');
      window.requestAnimationFrame(() => {
        if (state.open) {
          ui.screen.classList.add('is-open');
        }
      });
    }
    void generatePreview();
  }

  function renderImageOptions() {
    if (!ui.imagePicker || !ui.imageOptions) return;
    if (!state.coverOptions.length) {
      ui.imageOptions.innerHTML = '';
      ui.imagePicker.hidden = true;
      return;
    }
    const optionsHtml = state.coverOptions
      .map((url, index) => {
        const selected = url === state.selectedCoverUrl;
        return `
          <button
            type="button"
            class="ig-story-image-option${selected ? ' is-selected' : ''}"
            data-ig-image-option
            data-index="${index}"
            aria-label="Use story image ${index + 1}"
            aria-pressed="${selected ? 'true' : 'false'}"
          >
            <img src="${escapeHtml(url)}" alt="" loading="lazy" decoding="async" />
          </button>
        `;
      })
      .join('');
    ui.imageOptions.innerHTML = optionsHtml;
    ui.imagePicker.hidden = false;
  }

  function handleImageOptionClick(event) {
    const button = event.target.closest('[data-ig-image-option]');
    if (!button || !ui.imageOptions?.contains(button)) return;
    const index = Number(button.dataset.index);
    const nextUrl = Number.isInteger(index) ? state.coverOptions[index] || '' : '';
    if (!nextUrl || nextUrl === state.selectedCoverUrl) return;
    state.selectedCoverUrl = nextUrl;
    const optionButtons = ui.imageOptions.querySelectorAll('[data-ig-image-option]');
    optionButtons.forEach((node) => {
      const isSelected = node === button;
      node.classList.toggle('is-selected', isSelected);
      node.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });
    if (ui.bgCover && !ui.bgCover.disabled) {
      setRadioValue(ui.bgInputs, 'cover', 'gradient');
    }
    schedulePreviewRender();
  }

  function getSelectedRadioValue(inputs, fallback = '') {
    const list = Array.from(inputs || []);
    const selected = list.find((input) => input.checked && !input.disabled);
    return selected?.value || fallback;
  }

  function setRadioValue(inputs, value, fallback = '') {
    const list = Array.from(inputs || []);
    if (!list.length) return '';
    let selected = list.find((input) => input.value === value && !input.disabled);
    if (!selected && fallback) {
      selected = list.find((input) => input.value === fallback && !input.disabled);
    }
    if (!selected) {
      selected = list.find((input) => !input.disabled) || list[0];
    }
    list.forEach((input) => {
      input.checked = input === selected;
    });
    return selected?.value || '';
  }

  function close(options = {}) {
    const immediate = Boolean(options.immediate);
    if (state.previewTimer) {
      window.clearTimeout(state.previewTimer);
      state.previewTimer = 0;
    }
    if (state.closeTimer) {
      window.clearTimeout(state.closeTimer);
      state.closeTimer = 0;
    }
    if (!state.open || !ui.screen) return;
    const focusedElement = document.activeElement;
    if (focusedElement && ui.screen.contains(focusedElement) && typeof focusedElement.blur === 'function') {
      focusedElement.blur();
    }
    state.open = false;
    setBusy(false);
    ui.screen.classList.remove('is-open');
    ui.screen.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('ig-story-screen-open');
    if (immediate) {
      ui.screen.hidden = true;
    } else {
      state.closeTimer = window.setTimeout(() => {
        if (!state.open && ui.screen) {
          ui.screen.hidden = true;
        }
        state.closeTimer = 0;
      }, SCREEN_FADE_MS);
    }
    if (state.returnFocusEl && typeof state.returnFocusEl.focus === 'function') {
      try {
        state.returnFocusEl.focus({ preventScroll: true });
      } catch {
        // no-op
      }
    }
    state.returnFocusEl = null;
  }

  function destroy() {
    window.removeEventListener('keydown', handleWindowKeydown);
    if (state.previewTimer) {
      window.clearTimeout(state.previewTimer);
      state.previewTimer = 0;
    }
    if (state.closeTimer) {
      window.clearTimeout(state.closeTimer);
      state.closeTimer = 0;
    }
    close({ immediate: true });
    cleanupPreviewUrl();
    if (ui.screen?.parentNode) {
      ui.screen.parentNode.removeChild(ui.screen);
    }
  }

  function markPreviewDirty(showMessage = true) {
    state.previewDirty = true;
    if (showMessage) {
      setStatus('Updating preview...');
    }
  }

  function schedulePreviewRender() {
    markPreviewDirty(false);
    if (state.previewTimer) {
      window.clearTimeout(state.previewTimer);
    }
    state.previewTimer = window.setTimeout(() => {
      state.previewTimer = 0;
      void generatePreview();
    }, 180);
  }

  function setStatus(message, tone = 'info') {
    if (!ui.status) return;
    const text = String(message || '').trim();
    ui.status.textContent = text;
    ui.status.hidden = !text;
    if (text) {
      ui.status.dataset.tone = tone;
    } else {
      ui.status.removeAttribute('data-tone');
    }
  }

  function setBusy(nextBusy) {
    state.busy = Boolean(nextBusy);
    if (ui.shareBtn) ui.shareBtn.disabled = state.busy;
    if (ui.closeBtn) ui.closeBtn.disabled = state.busy;
    if (ui.screen) {
      ui.screen.classList.toggle('ig-story-busy', state.busy);
    }
  }

  function handleWindowKeydown(event) {
    if (!state.open) return;
    if (event.key !== 'Escape') return;
    event.preventDefault();
    close();
  }

  async function generatePreview() {
    if (!state.story) return null;
    if (state.busy) {
      schedulePreviewRender();
      return null;
    }
    setBusy(true);
    setStatus('Rendering preview...');

    try {
      const config = readConfig();
      const blob = await buildPreviewBlob(config);
      if (!blob) {
        throw new Error('Preview generation failed');
      }
      state.previewBlob = blob;
      state.previewDirty = false;
      updatePreviewImage(blob);
      setStatus('');
      return blob;
    } catch (error) {
      console.error('instagram story preview', error);
      setStatus('Could not render preview. Try another theme.', 'error');
      showToast('Could not render Instagram snippet.', 'error');
      return null;
    } finally {
      setBusy(false);
    }
  }

  function readConfig() {
    const story = state.story || {};
    const snippetSource = state.selectedSnippet || deriveSnippet(story);
    const snippetRaw = String(snippetSource || '').trim();
    const titleRaw = String(story.title || 'Our story').trim();
    const usePrivacy = Boolean(ui.privacy?.checked);
    const sensitiveTerms = state.sensitiveTerms;

    const snippet = clipText(
      usePrivacy ? maskSensitiveText(snippetRaw, sensitiveTerms) : snippetRaw,
      STORY_RENDER_SNIPPET_CHARS
    );
    const title = clipText(
      usePrivacy ? maskSensitiveText(titleRaw, sensitiveTerms) : titleRaw,
      STORY_TITLE_MAX_CHARS
    );
    const author = usePrivacy ? '' : state.authorName;
    const created = state.createdLabel;

    return {
      title: title || 'Our story',
      snippet: snippet || 'A chapter from our Loveboard chronicle.',
      author,
      created,
      theme: getSelectedRadioValue(ui.themeInputs, 'blush'),
      useCover: getSelectedRadioValue(ui.bgInputs, 'gradient') === 'cover',
      coverUrl: state.selectedCoverUrl || getCoverUrl(story),
      watermark: Boolean(ui.watermark?.checked)
    };
  }

  async function buildPreviewBlob(config) {
    const canvas = document.createElement('canvas');
    canvas.width = STORY_WIDTH;
    canvas.height = STORY_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const theme = THEMES[config.theme] || THEMES.blush;
    drawGradientBackground(ctx, theme.background);

    let usedCover = false;
    if (config.useCover && config.coverUrl) {
      try {
        const image = await loadImage(config.coverUrl);
        drawCoverImage(ctx, image);
        usedCover = true;
      } catch (error) {
        console.warn('instagram story cover image', error);
      }
    }

    drawOverlay(ctx, theme.overlay, usedCover ? 0.82 : 0.66);
    drawDecoration(ctx, theme.accent, theme.chip);
    drawTextBlock(ctx, config, theme.accent, theme.chip, usedCover);

    return canvasToBlob(canvas);
  }

  function drawGradientBackground(ctx, colors) {
    const gradient = ctx.createLinearGradient(0, 0, STORY_WIDTH, STORY_HEIGHT);
    const safe = Array.isArray(colors) && colors.length ? colors : ['#1b1324', '#5e365f'];
    const step = 1 / Math.max(1, safe.length - 1);
    safe.forEach((color, index) => {
      gradient.addColorStop(Math.min(1, index * step), color);
    });
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
  }

  function drawCoverImage(ctx, image) {
    const imageRatio = image.width / image.height;
    const frameRatio = STORY_WIDTH / STORY_HEIGHT;
    let drawWidth = STORY_WIDTH;
    let drawHeight = STORY_HEIGHT;
    if (imageRatio > frameRatio) {
      drawHeight = STORY_HEIGHT;
      drawWidth = drawHeight * imageRatio;
    } else {
      drawWidth = STORY_WIDTH;
      drawHeight = drawWidth / imageRatio;
    }
    const drawX = (STORY_WIDTH - drawWidth) / 2;
    const drawY = (STORY_HEIGHT - drawHeight) / 2;
    ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  }

  function drawOverlay(ctx, colors, strength = 1) {
    const overlay = ctx.createLinearGradient(0, 0, 0, STORY_HEIGHT);
    const safe = Array.isArray(colors) && colors.length ? colors : ['rgba(0,0,0,0.65)', 'rgba(0,0,0,0.45)'];
    const step = 1 / Math.max(1, safe.length - 1);
    safe.forEach((color, index) => {
      overlay.addColorStop(Math.min(1, index * step), color);
    });
    ctx.save();
    ctx.globalAlpha = Math.max(0.2, Math.min(1, strength));
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
    ctx.restore();
  }

  function drawDecoration(ctx, accent, chipColor) {
    ctx.save();

    const glowTop = ctx.createRadialGradient(STORY_WIDTH * 0.12, STORY_HEIGHT * 0.1, 20, STORY_WIDTH * 0.12, STORY_HEIGHT * 0.1, 280);
    glowTop.addColorStop(0, `${hexToRgba(accent, 0.42)}`);
    glowTop.addColorStop(1, `${hexToRgba(accent, 0)}`);
    ctx.fillStyle = glowTop;
    ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

    const glowBottom = ctx.createRadialGradient(
      STORY_WIDTH * 0.82,
      STORY_HEIGHT * 0.84,
      40,
      STORY_WIDTH * 0.82,
      STORY_HEIGHT * 0.84,
      360
    );
    glowBottom.addColorStop(0, `${hexToRgba(accent, 0.34)}`);
    glowBottom.addColorStop(1, `${hexToRgba(accent, 0)}`);
    ctx.fillStyle = glowBottom;
    ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

    ctx.fillStyle = chipColor || 'rgba(255,255,255,0.12)';
    roundRect(ctx, 84, 140, 292, 56, 28);
    ctx.fill();

    ctx.restore();
  }

  function drawTextBlock(ctx, config, accent, chipColor, usedCover) {
    const side = 84;
    const blockWidth = STORY_WIDTH - side * 2;
    const titleTop = 460;
    const panelPaddingX = 32;
    const panelPaddingTop = 48;
    const panelPaddingBottom = 46;
    const panelX = side - 14;
    const panelWidth = blockWidth + 28;

    ctx.save();

    ctx.fillStyle = accent;
    ctx.font = "700 24px 'Work Sans', sans-serif";
    ctx.fillText('LOVEBOARD', 124, 176);

    ctx.fillStyle = '#ffffff';
    ctx.font = "700 82px 'Cormorant Garamond', serif";
    const titleLines = wrapText(ctx, config.title || 'Our story', blockWidth, 2);
    let y = titleTop;
    titleLines.forEach((line) => {
      ctx.fillText(line, side, y);
      y += 88;
    });

    y += 36;
    ctx.font = "600 52px 'Cormorant Garamond', serif";
    const snippetLines = wrapText(
      ctx,
      config.snippet || '',
      blockWidth - panelPaddingX * 2,
      STORY_RENDER_SNIPPET_LINES
    );
    const snippetLineHeight = 58;
    const panelHeight = panelPaddingTop + snippetLines.length * snippetLineHeight + panelPaddingBottom + 42;

    ctx.fillStyle = usedCover ? 'rgba(9, 8, 16, 0.48)' : 'rgba(11, 10, 20, 0.44)';
    roundRect(ctx, panelX, y - 36, panelWidth, panelHeight, 34);
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = usedCover ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.15)';
    roundRect(ctx, panelX, y - 36, panelWidth, panelHeight, 34);
    ctx.stroke();

    ctx.fillStyle = hexToRgba(accent, 0.9);
    ctx.font = "700 94px 'Cormorant Garamond', serif";
    ctx.fillText('"', panelX + 22, y + 16);

    ctx.fillStyle = '#ffffff';
    ctx.font = "500 42px 'Work Sans', sans-serif";
    let snippetY = y + panelPaddingTop;
    snippetLines.forEach((line) => {
      ctx.fillText(line, panelX + panelPaddingX, snippetY);
      snippetY += snippetLineHeight;
    });

    const metaY = y - 36 + panelHeight - 38;
    ctx.font = "500 28px 'Work Sans', sans-serif";
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    const meta = [config.author, config.created].filter(Boolean).join('  -  ');
    if (meta) {
      ctx.fillText(meta, panelX + panelPaddingX, metaY);
    }

    if (config.watermark) {
      ctx.font = "600 36px 'Cormorant Garamond', serif";
      ctx.fillStyle = 'rgba(255,255,255,0.74)';
      const line = `From ${appName}`;
      const width = ctx.measureText(line).width;
      ctx.fillText(line, STORY_WIDTH - side - width, STORY_HEIGHT - 84);
    }

    ctx.restore();
  }

  async function handleShare() {
    const blob = await ensurePreview();
    if (!blob) return;

    const fileName = `${slugify(state.story?.title || 'loveboard-story') || 'loveboard-story'}-snippet.png`;
    const shareTitle = clipText(state.story?.title || 'Loveboard Story', 80);
    const shareText = 'Snippet made with Loveboard';

    try {
      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          files: [file]
        });
        showToast('Shared. Add it to your Instagram Story.', 'success');
        close();
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: shareTitle, text: shareText });
        downloadBlob(blob, fileName);
        showToast('Caption shared. Image downloaded for Instagram.', 'info');
        close();
        return;
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        setStatus('Share cancelled.');
        return;
      }
      console.warn('instagram story share', error);
    }

    downloadBlob(blob, fileName);
    showToast('Image downloaded. Upload it to your Instagram Story.', 'success');
    close();
  }

  async function ensurePreview() {
    if (!state.previewBlob || state.previewDirty) {
      return generatePreview();
    }
    return state.previewBlob;
  }

  function updatePreviewImage(blob) {
    if (!ui.preview) return;
    cleanupPreviewUrl();
    const nextUrl = URL.createObjectURL(blob);
    state.previewUrl = nextUrl;
    ui.preview.src = nextUrl;
  }

  function cleanupPreviewUrl() {
    if (!state.previewUrl) return;
    URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = '';
  }
}

function deriveSnippet(story) {
  const chapters = Array.isArray(story?.chapters) ? story.chapters : [];
  for (let i = 0; i < chapters.length; i += 1) {
    const chapter = chapters[i] || {};
    const text = String(chapter.text || '').trim();
    if (text) {
      return summarizeForStory(text, STORY_RENDER_SNIPPET_CHARS);
    }
    const caption = String(chapter.caption || '').trim();
    if (caption) {
      return summarizeForStory(caption, STORY_RENDER_SNIPPET_CHARS);
    }
  }
  return summarizeForStory(String(story?.title || 'A chapter from our story.'), STORY_RENDER_SNIPPET_CHARS);
}

function getCoverUrl(story) {
  if (!story || !Array.isArray(story.images)) return '';
  const first = story.images.find((value) => typeof value === 'string' && value.trim());
  return first ? first.trim() : '';
}

function getCoverOptions(story) {
  if (!story || !Array.isArray(story.images)) return [];
  const seen = new Set();
  const options = [];
  story.images.forEach((value) => {
    const url = typeof value === 'string' ? value.trim() : '';
    if (!url || seen.has(url)) return;
    seen.add(url);
    options.push(url);
  });
  return options;
}

function normalizeSensitiveTerms(list) {
  if (!Array.isArray(list)) return [];
  const set = new Set();
  list.forEach((item) => {
    const term = String(item || '').trim();
    if (term.length < 3) return;
    set.add(term);
  });
  return [...set];
}

function maskSensitiveText(text, terms) {
  let masked = String(text || '');
  terms.forEach((term) => {
    const escaped = escapeRegExp(term);
    if (!escaped) return;
    masked = masked.replace(new RegExp(escaped, 'gi'), '[hidden]');
  });
  return masked;
}

function wrapText(ctx, value, maxWidth, maxLines) {
  const words = String(value || '').split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines = [];
  let current = words[0];

  for (let i = 1; i < words.length; i += 1) {
    const next = `${current} ${words[i]}`;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
    } else {
      lines.push(current);
      current = words[i];
      if (lines.length === maxLines - 1) {
        break;
      }
    }
  }

  if (lines.length < maxLines) {
    lines.push(current);
  }

  if (lines.length > maxLines) {
    lines.length = maxLines;
  }

  if (words.length && lines.length === maxLines) {
    const full = lines.join(' ');
    if (full.length < value.length) {
      lines[maxLines - 1] = appendEllipsis(ctx, lines[maxLines - 1], maxWidth);
    }
  }

  return lines;
}

function appendEllipsis(ctx, text, maxWidth) {
  let next = String(text || '').trim();
  if (!next) return '...';
  while (next && ctx.measureText(`${next}...`).width > maxWidth) {
    next = next.slice(0, -1).trim();
  }
  return `${next || ''}...`;
}

function clipText(value, max) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(1, max - 3)).trim()}...`;
}

function summarizeForStory(value, max) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (clean.length <= max) return clean;

  const parts = (clean.match(/[^.!?]+[.!?]*/g) || []).map((item) => item.trim()).filter(Boolean);
  if (!parts.length) return clipText(clean, max);

  const picked = [];
  let total = 0;
  for (let i = 0; i < parts.length; i += 1) {
    const piece = parts[i];
    const nextTotal = total + piece.length + (picked.length ? 1 : 0);
    if (nextTotal > max && picked.length) break;
    if (nextTotal > max) {
      return clipText(piece, max);
    }
    picked.push(piece);
    total = nextTotal;
    if (total >= Math.floor(max * 0.75)) break;
  }
  return clipText(picked.join(' '), max);
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image failed to load'));
    image.src = url;
  });
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 50);
}

function downloadBlob(blob, fileName) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function hexToRgba(hex, alpha) {
  const clean = String(hex || '').replace('#', '').trim();
  if (!clean || (clean.length !== 3 && clean.length !== 6)) {
    return `rgba(255,255,255,${alpha})`;
  }
  const full = clean.length === 3 ? clean.split('').map((ch) => `${ch}${ch}`).join('') : clean;
  const int = Number.parseInt(full, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
