/*
 * Site Label - popup.
 *
 * Two jobs: label the page you are looking at, and adjust the label that is
 * already on it. Access to a site is requested at the moment you add it, and
 * that request has to happen inside the click handler with no awaits before
 * it, or the browser drops the user gesture and refuses the prompt.
 */
(function () {
  'use strict';

  const SL = globalThis.SL;
  const $ = (id) => document.getElementById(id);

  let state = null;
  let tab = null;
  let parsedUrl = null;
  let matchedSite = null;
  let suggestions = [];
  let chosenScopeIndex = 0;
  let draftStyle = Object.assign({}, SL.DEFAULT_STYLE);

  /* ------------------------------------------------------------------ *
   * Helpers
   * ------------------------------------------------------------------ */

  function fillModeSelect(select, selected) {
    const groups = {};
    SL.DISPLAY_MODES.forEach((mode) => {
      if (!groups[mode.group]) {
        const og = document.createElement('optgroup');
        og.label = mode.group;
        select.appendChild(og);
        groups[mode.group] = og;
      }
      const opt = document.createElement('option');
      opt.value = mode.id;
      opt.textContent = mode.label;
      if (mode.id === selected) opt.selected = true;
      groups[mode.group].appendChild(opt);
    });
  }

  function buildSwatches(container, onPick, selectedBg) {
    container.textContent = '';
    SL.allSwatches(state.settings).forEach((preset) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'swatch';
      button.style.background = preset.background;
      button.title = preset.name;
      button.setAttribute('aria-label', preset.name);
      button.setAttribute('aria-pressed', String(preset.background === selectedBg));
      button.addEventListener('click', () => {
        Array.from(container.children).forEach((child) =>
          child.setAttribute('aria-pressed', 'false')
        );
        button.setAttribute('aria-pressed', 'true');
        onPick(preset);
      });
      container.appendChild(button);
    });
  }

  function renderPreview() {
    SL.renderPreview($('preview'), draftStyle, $('labelText').value);
  }

  /* ------------------------------------------------------------------ *
   * Consent text - always say exactly what will be granted
   * ------------------------------------------------------------------ */

  function updateConsentNote() {
    const suggestion = suggestions[chosenScopeIndex];
    if (!suggestion) return;
    SL.renderConsent($('consentNote'), suggestion.pattern, { compact: true });
  }

  /* ------------------------------------------------------------------ *
   * Add form
   * ------------------------------------------------------------------ */

  function renderScopes() {
    const list = $('scopeList');
    list.textContent = '';
    suggestions.forEach((suggestion, index) => {
      const row = document.createElement('label');
      row.className = 'scope';

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'scope';
      radio.value = String(index);
      radio.checked = index === chosenScopeIndex;
      radio.addEventListener('change', () => {
        chosenScopeIndex = index;
        updateConsentNote();
      });

      const wrap = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'scope-title';
      title.textContent = suggestion.title;
      const detail = document.createElement('div');
      detail.className = 'scope-detail';
      detail.textContent = suggestion.detail;
      wrap.appendChild(title);
      wrap.appendChild(detail);

      row.appendChild(radio);
      row.appendChild(wrap);
      list.appendChild(row);
    });
  }

  function renderGroupSelect() {
    const select = $('groupSelect');
    select.textContent = '';

    const none = document.createElement('option');
    none.value = '';
    none.textContent = 'No group';
    select.appendChild(none);

    state.groups.forEach((group) => {
      const opt = document.createElement('option');
      opt.value = group.id;
      opt.textContent = group.name;
      select.appendChild(opt);
    });

    const createNew = document.createElement('option');
    createNew.value = '__new__';
    createNew.textContent = 'New group…';
    select.appendChild(createNew);
  }

  /** Picking a group adopts its look, unless the user has already tweaked one. */
  function applyGroupStyle(groupId) {
    const group = SL.getGroup(state, groupId);
    if (!group) return;
    draftStyle = Object.assign({}, group.style);
    $('bgColor').value = draftStyle.background;
    $('fgColor').value = draftStyle.textColor;
    $('modeSelect').value = draftStyle.displayMode;
    buildSwatches($('presetSwatches'), onPresetPicked, draftStyle.background);
    syncDraftControls();
    renderPreview();
  }

  /** Push draftStyle back out to the sliders, after adopting a group's look. */
  function syncDraftControls() {
    $('sizeRange').value = String(Math.round(draftStyle.scale * 100));
    $('sizeOut').textContent = $('sizeRange').value + '%';
    $('transparencyRange').value = String(SL.opacityToTransparency(draftStyle.opacity));
    $('transparencyOut').textContent = $('transparencyRange').value + '%';
    $('glowToggle').checked = draftStyle.glow;
    $('glowSpeedRange').value = String(draftStyle.glowSpeed);
    syncGlowLabel('glowToggle', 'glowSpeedRange', 'glowSpeedOut');
    $('addBuddy').value = draftStyle.buddy;
    $('addBuddyChatter').checked = draftStyle.buddyTricks;
    $('addBuddyInterval').value = String(draftStyle.buddyInterval);
    toggleBuddyBox('add', draftStyle.displayMode);
  }

  function onPresetPicked(preset) {
    draftStyle.background = preset.background;
    draftStyle.textColor = preset.textColor;
    $('bgColor').value = preset.background;
    $('fgColor').value = preset.textColor;
    renderPreview();
  }

  function setupAddForm() {
    const guess = SL.guessEnvironment(tab.url);
    $('labelText').value = guess.label || parsedUrl.hostname.split('.')[0].toUpperCase();
    if (guess.note) {
      $('guessNote').hidden = false;
      $('guessNote').textContent = 'Detected: ' + guess.note;
    }

    const preset =
      SL.COLOR_PRESETS.find((p) => p.id === guess.preset) || SL.COLOR_PRESETS[0];
    draftStyle.background = preset.background;
    draftStyle.textColor = preset.textColor;
    // The character reinforces what the environment is for: a cone on guard
    // over Production, a hopeful bunny in Test.
    if (guess.buddy) draftStyle.buddy = guess.buddy;

    // If a group already matches the guessed environment, start from it.
    const match = state.groups.find(
      (g) => g.name.toLowerCase() === (guess.label || '').toLowerCase()
    );

    renderGroupSelect();
    fillModeSelect($('modeSelect'), draftStyle.displayMode);
    buildSwatches($('presetSwatches'), onPresetPicked, draftStyle.background);
    $('bgColor').value = draftStyle.background;
    $('fgColor').value = draftStyle.textColor;

    if (match) {
      $('groupSelect').value = match.id;
      applyGroupStyle(match.id);
    }

    suggestions = SL.suggestPatterns(tab.url);
    renderScopes();
    updateConsentNote();
    renderPreview();

    $('labelText').addEventListener('input', renderPreview);
    $('bgColor').addEventListener('input', (e) => {
      draftStyle.background = SL.sanitizeColor(e.target.value, draftStyle.background);
      renderPreview();
    });
    $('fgColor').addEventListener('input', (e) => {
      draftStyle.textColor = SL.sanitizeColor(e.target.value, draftStyle.textColor);
      renderPreview();
    });
    $('modeSelect').addEventListener('change', (e) => {
      draftStyle.displayMode = e.target.value;
      toggleBuddyBox('add', e.target.value);
      renderPreview();
    });
    setupBuddyPanel('add', draftStyle, (patch) => {
      Object.assign(draftStyle, patch);
      renderPreview();
    });
    toggleBuddyBox('add', draftStyle.displayMode);
    $('sizeRange').value = String(Math.round(draftStyle.scale * 100));
    $('sizeOut').textContent = $('sizeRange').value + '%';
    $('sizeRange').addEventListener('input', (e) => {
      draftStyle.scale = Number(e.target.value) / 100;
      $('sizeOut').textContent = e.target.value + '%';
      renderPreview();
    });
    $('saveColorBtn').addEventListener('click', saveCurrentColour);

    $('transparencyRange').value = String(SL.opacityToTransparency(draftStyle.opacity));
    $('transparencyOut').textContent = $('transparencyRange').value + '%';
    $('transparencyRange').addEventListener('input', (e) => {
      draftStyle.opacity = SL.transparencyToOpacity(Number(e.target.value));
      $('transparencyOut').textContent = e.target.value + '%';
      renderPreview();
    });

    $('glowToggle').checked = draftStyle.glow;
    $('glowSpeedRange').value = String(draftStyle.glowSpeed);
    syncGlowLabel('glowToggle', 'glowSpeedRange', 'glowSpeedOut');
    $('glowToggle').addEventListener('change', (e) => {
      draftStyle.glow = e.target.checked;
      syncGlowLabel('glowToggle', 'glowSpeedRange', 'glowSpeedOut');
      renderPreview();
    });
    $('glowSpeedRange').addEventListener('input', (e) => {
      draftStyle.glowSpeed = Number(e.target.value);
      syncGlowLabel('glowToggle', 'glowSpeedRange', 'glowSpeedOut');
      renderPreview();
    });
    $('groupSelect').addEventListener('change', (e) => {
      const isNew = e.target.value === '__new__';
      $('newGroupName').hidden = !isNew;
      if (!isNew) applyGroupStyle(e.target.value);
    });

    $('addForm').hidden = false;
  }

  /* ------------------------------------------------------------------ *
   * Buddy controls - the same three settings in both panels
   * ------------------------------------------------------------------ */

  function fillBuddySelect(select, selected) {
    select.textContent = '';
    SL.BUDDIES.forEach((buddy) => {
      const opt = document.createElement('option');
      opt.value = buddy.id;
      opt.textContent = buddy.name;
      if (buddy.id === selected) opt.selected = true;
      select.appendChild(opt);
    });
  }

  function describeInterval(seconds) {
    if (seconds < 60) return 'about every ' + seconds + ' seconds';
    const mins = Math.round(seconds / 60);
    return 'about every ' + mins + (mins === 1 ? ' minute' : ' minutes');
  }

  /**
   * Wire one buddy panel. `prefix` is 'add' or 'matched'; `onChange` receives
   * the changed key so each panel can save in its own way.
   */
  function setupBuddyPanel(prefix, style, onChange) {
    const sel = $(prefix + 'Buddy');
    const chatter = $(prefix + 'BuddyChatter');
    const interval = $(prefix + 'BuddyInterval');
    const out = $(prefix + 'BuddyIntervalOut');
    const blurb = $(prefix + 'BuddyBlurb');

    fillBuddySelect(sel, style.buddy);
    chatter.checked = style.buddyTricks;
    interval.value = String(style.buddyInterval);

    const refresh = () => {
      const buddy = SL.buddyById(sel.value);
      blurb.textContent = buddy.blurb + ' — ' + SL.TRICK_NAMES[buddy.trick];
      interval.disabled = !chatter.checked;
      out.textContent = chatter.checked ? describeInterval(Number(interval.value)) : 'never';
    };
    refresh();

    sel.addEventListener('change', () => { refresh(); onChange({ buddy: sel.value }); });
    chatter.addEventListener('change', () => { refresh(); onChange({ buddyTricks: chatter.checked }); });
    interval.addEventListener('input', () => { refresh(); onChange({ buddyInterval: Number(interval.value) }); });
  }

  /** The buddy settings only make sense for the buddy display mode. */
  function toggleBuddyBox(prefix, mode) {
    $(prefix + 'BuddyBox').hidden = mode !== 'buddy';
  }

  /** Keep the glow speed slider and its caption in step with the toggle. */
  function syncGlowLabel(toggleId, speedId, outId) {
    const on = $(toggleId).checked;
    $(speedId).disabled = !on;
    $(outId).textContent = on
      ? SL.glowDuration({ glowSpeed: Number($(speedId).value) }) + 's per pass'
      : 'off';
  }

  /** Add the colour currently in the pickers to the saved palette. */
  async function saveCurrentColour() {
    const background = SL.sanitizeColor($('bgColor').value, null);
    if (!background) return;
    const textColor = SL.sanitizeColor($('fgColor').value, '#ffffff');

    const fresh = await SL.getState();
    const existing = fresh.settings.customColors || [];
    if (existing.some((c) => c.background === background && c.textColor === textColor)) {
      $('saveColorBtn').textContent = 'Already saved';
    } else if (existing.length >= SL.MAX_CUSTOM_COLORS) {
      $('saveColorBtn').textContent = 'Palette full';
    } else {
      fresh.settings.customColors = existing.concat({
        background: background,
        textColor: textColor
      });
      await SL.saveState(fresh);
      state = fresh;
      buildSwatches($('presetSwatches'), onPresetPicked, background);
      $('saveColorBtn').textContent = 'Saved';
    }
    setTimeout(() => {
      $('saveColorBtn').textContent = 'Save colour';
    }, 1400);
  }

  /**
   * Submit. Everything needed is read synchronously, then the permission
   * prompt goes up immediately so the user gesture is still valid.
   */
  function onAddSubmit(event) {
    event.preventDefault();
    $('addError').hidden = true;

    const suggestion = suggestions[chosenScopeIndex];
    if (!suggestion) return;

    const origins = SL.patternToMatchPatterns(suggestion.pattern);
    const labelText = SL.sanitizeText($('labelText').value, 60);
    const groupChoice = $('groupSelect').value;
    const newGroupName = SL.sanitizeText($('newGroupName').value, 40);
    const style = Object.assign({}, draftStyle);

    if (!labelText && !newGroupName && !groupChoice) {
      showAddError('Give the label some text first.');
      return;
    }

    $('addBtn').disabled = true;

    // Hand the rule to the service worker first. Showing the permission prompt
    // can destroy this popup, and with it the callback below, so the worker
    // saves the rule independently and finishes the job on permissions.onAdded.
    // Nothing is granted by staging - the prompt still decides that.
    const siteId = SL.uid();
    chrome.runtime.sendMessage(
      {
        type: 'sl:stageSite',
        id: siteId,
        label: labelText,
        pattern: suggestion.pattern,
        groupId: groupChoice && groupChoice !== '__new__' ? groupChoice : null,
        newGroupName: groupChoice === '__new__' ? newGroupName : '',
        style: style
      },
      () => void chrome.runtime.lastError
    );

    chrome.permissions.request({ origins: origins }, (granted) => {
      if (chrome.runtime.lastError) {
        showAddError(chrome.runtime.lastError.message);
        return;
      }
      if (!granted) {
        // Roll the staged rule back so a declined prompt leaves nothing behind.
        chrome.runtime.sendMessage({ type: 'sl:unstageSite', id: siteId }, () => {
          void chrome.runtime.lastError;
          showAddError('Without access to this site the label cannot be drawn.');
        });
        return;
      }
      chrome.runtime.sendMessage({ type: 'sl:sync', injectNow: true }, () => {
        void chrome.runtime.lastError;
        window.close();
      });
    });
  }

  function showAddError(message) {
    $('addError').hidden = false;
    $('addError').textContent = message;
    $('addBtn').disabled = false;
  }

  /* ------------------------------------------------------------------ *
   * Existing label panel
   * ------------------------------------------------------------------ */

  function setupMatchedPanel() {
    const group = SL.getGroup(state, matchedSite.groupId);
    const style = SL.resolveStyle(matchedSite, group);
    const text = SL.resolveLabelText(matchedSite, group);

    $('matchedLabel').textContent = text;
    $('matchedLabel').style.color = style.background;
    $('matchedScope').textContent =
      describePattern(matchedSite.pattern) + (group ? ' · ' + group.name : '');

    const pill = $('statePill');
    pill.hidden = false;
    pill.textContent = 'Labelled';
    pill.style.background = style.background;
    pill.style.color = style.textColor;
    $('brandDot').style.background = style.background;

    fillModeSelect($('matchedMode'), style.displayMode);
    buildSwatches($('matchedSwatches'), (preset) => {
      updateMatched({ background: preset.background, textColor: preset.textColor });
    }, style.background);

    $('matchedMode').addEventListener('change', (e) => {
      updateMatched({ displayMode: e.target.value });
      refreshLockControls(e.target.value);
      toggleBuddyBox('matched', e.target.value);
    });

    setupBuddyPanel('matched', style, (patch) => updateMatched(patch));
    toggleBuddyBox('matched', style.displayMode);
    $('matchedBuddySay').addEventListener('click', () => {
      chrome.tabs.sendMessage(tab.id, { type: 'sl:buddyTrick' }, () => void chrome.runtime.lastError);
    });

    $('matchedScale').value = String(Math.round(style.scale * 100));
    $('matchedScaleOut').textContent = $('matchedScale').value + '%';
    $('matchedScale').addEventListener('input', (e) => {
      $('matchedScaleOut').textContent = e.target.value + '%';
      updateMatched({ scale: Number(e.target.value) / 100 });
    });

    $('matchedTransparency').value = String(SL.opacityToTransparency(style.opacity));
    $('matchedTransparencyOut').textContent = $('matchedTransparency').value + '%';
    $('matchedTransparency').addEventListener('input', (e) => {
      $('matchedTransparencyOut').textContent = e.target.value + '%';
      updateMatched({ opacity: SL.transparencyToOpacity(Number(e.target.value)) });
    });

    $('matchedGlow').checked = style.glow;
    $('matchedGlowSpeed').value = String(style.glowSpeed);
    syncGlowLabel('matchedGlow', 'matchedGlowSpeed', 'matchedGlowSpeedOut');
    $('matchedGlow').addEventListener('change', (e) => {
      syncGlowLabel('matchedGlow', 'matchedGlowSpeed', 'matchedGlowSpeedOut');
      updateMatched({ glow: e.target.checked });
    });
    $('matchedGlowSpeed').addEventListener('input', (e) => {
      syncGlowLabel('matchedGlow', 'matchedGlowSpeed', 'matchedGlowSpeedOut');
      updateMatched({ glowSpeed: Number(e.target.value) });
    });

    $('matchedLock').checked = style.locked;
    $('matchedLock').addEventListener('change', (e) => {
      updateMatched({ locked: e.target.checked });
      refreshLockControls($('matchedMode').value);
    });

    $('resetPosBtn').addEventListener('click', () => {
      updateMatched({ posX: -1, posY: -1 });
      $('resetPosBtn').hidden = true;
    });

    refreshLockControls(style.displayMode);

    $('hideTabBtn').addEventListener('click', () => {
      chrome.tabs.sendMessage(tab.id, { type: 'sl:toggleTab' }, () => {
        void chrome.runtime.lastError;
        window.close();
      });
    });

    $('editBtn').addEventListener('click', () => {
      openOptions('?edit=' + encodeURIComponent(matchedSite.id));
    });

    $('removeBtn').addEventListener('click', onRemove);

    $('matchedPanel').hidden = false;
  }

  /** A border frame has nothing to drag, so the lock controls hide for it. */
  function refreshLockControls(mode) {
    const draggable = SL.isDraggableMode(mode);
    const group = SL.getGroup(state, matchedSite.groupId);
    const style = SL.resolveStyle(matchedSite, group);

    $('matchedLock').disabled = !draggable;
    $('lockHint').textContent = !draggable
      ? 'A border frame surrounds the page, so there is nothing to reposition.'
      : style.locked
        ? 'Unlock to drag the label anywhere on the page.'
        : 'Unlocked - drag the label on the page to move it.';
    $('resetPosBtn').hidden = !SL.hasCustomPosition(style);
  }

  async function updateMatched(patch) {
    const fresh = await SL.getState();
    const site = fresh.sites.find((s) => s.id === matchedSite.id);
    if (!site) return;
    site.style = SL.normalizeStyleOverride(Object.assign({}, site.style, patch));
    await SL.saveState(fresh);
    matchedSite = site;
    state = fresh;
  }

  /**
   * Removing the rule also hands back the host permission, provided no other
   * rule still needs it. Leaving permissions behind would be untidy at best.
   */
  async function onRemove() {
    const pattern = matchedSite.pattern;
    const fresh = await SL.getState();
    SL.removeSite(fresh, matchedSite.id);
    await SL.saveState(fresh);

    const stillNeeded = new Set(SL.sitesToMatchPatterns(fresh.sites));
    const origins = SL.patternToMatchPatterns(pattern).filter((p) => !stillNeeded.has(p));

    const finish = () =>
      chrome.runtime.sendMessage({ type: 'sl:sync' }, () => {
        void chrome.runtime.lastError;
        window.close();
      });

    if (origins.length) chrome.permissions.remove({ origins: origins }, finish);
    else finish();
  }

  function describePattern(pattern) {
    switch (pattern.type) {
      case 'origin':
        return pattern.value;
      case 'host':
        return pattern.value;
      case 'host-suffix':
        return pattern.value + ' and subdomains';
      case 'prefix':
        return pattern.value + '/…';
      case 'wildcard':
        return pattern.value;
      default:
        return '';
    }
  }

  /* ------------------------------------------------------------------ *
   * Shell
   * ------------------------------------------------------------------ */

  function openOptions(query) {
    chrome.tabs.create({
      url: chrome.runtime.getURL('src/options/options.html' + (query || ''))
    });
    window.close();
  }

  async function init() {
    state = await SL.getState();
    SL.applyTheme(state.settings.theme);

    $('globalToggle').checked = state.settings.enabled;
    $('globalToggle').addEventListener('change', async (e) => {
      const fresh = await SL.getState();
      fresh.settings.enabled = e.target.checked;
      await SL.saveState(fresh);
      chrome.runtime.sendMessage({ type: 'sl:sync', injectNow: true }, () =>
        void chrome.runtime.lastError
      );
    });

    $('openOptions').addEventListener('click', () => openOptions(''));
    $('openImport').addEventListener('click', () => openOptions('?tab=transfer'));
    $('addForm').addEventListener('submit', onAddSubmit);

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    tab = tabs && tabs[0];

    if (!tab || !tab.url) {
      $('currentHost').textContent = 'No page';
      $('unsupported').hidden = false;
      return;
    }

    parsedUrl = SL.parseUrl(tab.url);
    if (!parsedUrl) {
      $('currentHost').textContent = 'Not a web page';
      $('currentUrl').textContent = tab.url.slice(0, 80);
      $('unsupported').hidden = false;
      return;
    }

    $('currentHost').textContent = parsedUrl.hostname;
    $('currentUrl').textContent = parsedUrl.origin + parsedUrl.pathname;

    matchedSite = SL.findMatch(tab.url, state.sites);
    if (matchedSite) setupMatchedPanel();
    else setupAddForm();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
