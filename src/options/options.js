/*
 * Site Label - options page.
 *
 * Sites, groups, import/export and settings. Host permissions are always
 * requested from a real click, and every write goes through the shared
 * normalisers in schema.js.
 */
(function () {
  'use strict';

  const SL = globalThis.SL;
  const $ = (id) => document.getElementById(id);

  let state = null;
  let accessMap = new Map(); // siteId -> boolean
  let activeTab = 'sites';
  let addSuggestions = [];
  let pendingImport = null;

  /* ------------------------------------------------------------------ *
   * Small utilities
   * ------------------------------------------------------------------ */

  function toast(message) {
    const el = $('toast');
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      el.hidden = true;
    }, 2600);
  }

  function notifyBackground(injectNow) {
    chrome.runtime.sendMessage({ type: 'sl:sync', injectNow: !!injectNow }, () =>
      void chrome.runtime.lastError
    );
  }

  async function reload() {
    state = await SL.getState();
    await refreshAccessMap();
    render();
  }

  async function persist() {
    await SL.saveState(state);
    notifyBackground(true);
    await reload();
  }

  async function refreshAccessMap() {
    accessMap = new Map();
    await Promise.all(
      state.sites.map(async (site) => {
        const patterns = SL.patternToMatchPatterns(site.pattern);
        if (!patterns.length) {
          accessMap.set(site.id, false);
          return;
        }
        try {
          const has = await chrome.permissions.contains({ origins: patterns });
          accessMap.set(site.id, !!has);
        } catch (err) {
          accessMap.set(site.id, false);
        }
      })
    );
  }

  function describePattern(pattern) {
    switch (pattern.type) {
      case 'host-suffix':
        return pattern.value + ' and all subdomains';
      case 'prefix':
        return pattern.value + '/…';
      case 'host':
        return pattern.value + ' (any scheme)';
      default:
        return pattern.value;
    }
  }

  function fillModeSelect(select, selected) {
    select.textContent = '';
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

  function fillGroupSelect(select, selected, includeNone) {
    select.textContent = '';
    if (includeNone) {
      const none = document.createElement('option');
      none.value = '';
      none.textContent = 'No group';
      select.appendChild(none);
    }
    state.groups.forEach((group) => {
      const opt = document.createElement('option');
      opt.value = group.id;
      opt.textContent = group.name;
      if (group.id === selected) opt.selected = true;
      select.appendChild(opt);
    });
  }

  function buildSwatches(container, selectedBg, onPick) {
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
        Array.from(container.children).forEach((c) => c.setAttribute('aria-pressed', 'false'));
        button.setAttribute('aria-pressed', 'true');
        onPick(preset);
      });
      container.appendChild(button);
    });
  }

  /* ------------------------------------------------------------------ *
   * Tabs
   * ------------------------------------------------------------------ */

  function setTab(name) {
    activeTab = name;
    ['sites', 'groups', 'transfer', 'settings'].forEach((tab) => {
      $('panel-' + tab).hidden = tab !== name;
    });
    Array.from($('tabs').children).forEach((button) => {
      button.setAttribute('aria-selected', String(button.dataset.tab === name));
    });
    if (name === 'transfer') renderTransfer();
    if (name === 'settings') renderSettings();
  }

  /* ------------------------------------------------------------------ *
   * Sites
   * ------------------------------------------------------------------ */

  function renderSites() {
    const list = $('sitesList');
    list.textContent = '';

    const query = $('siteSearch').value.trim().toLowerCase();
    const sites = state.sites
      .filter((site) => {
        if (!query) return true;
        const group = SL.getGroup(state, site.groupId);
        return (
          site.label.toLowerCase().indexOf(query) !== -1 ||
          site.pattern.value.toLowerCase().indexOf(query) !== -1 ||
          (group && group.name.toLowerCase().indexOf(query) !== -1)
        );
      })
      .sort((a, b) => a.pattern.value.localeCompare(b.pattern.value));

    $('sitesSummary').textContent =
      state.sites.length +
      (state.sites.length === 1 ? ' site' : ' sites') +
      ' · ' +
      state.groups.length +
      (state.groups.length === 1 ? ' group' : ' groups');

    $('sitesEmpty').hidden = state.sites.length !== 0;

    const missing = state.sites.filter((site) => !accessMap.get(site.id));
    if (missing.length) {
      const banner = document.createElement('div');
      banner.className = 'row-card';
      const text = document.createElement('div');
      text.className = 'row-main';
      text.textContent =
        missing.length + (missing.length === 1 ? ' site is' : ' sites are') +
        ' waiting for access. Labels stay hidden until Edge grants it.';
      const grant = document.createElement('button');
      grant.type = 'button';
      grant.className = 'primary';
      grant.textContent = 'Grant access';
      grant.addEventListener('click', () => grantMissingAccess(missing));
      banner.appendChild(text);
      banner.appendChild(grant);
      list.appendChild(banner);
    }

    sites.forEach((site) => {
      const group = SL.getGroup(state, site.groupId);
      const style = SL.resolveStyle(site, group);
      const label = SL.resolveLabelText(site, group);

      const row = document.createElement('div');
      row.className = 'row-card';

      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = label;
      chip.style.background = style.background;
      chip.style.color = style.textColor;
      if (!site.enabled) chip.style.opacity = '.4';

      const main = document.createElement('div');
      main.className = 'row-main';
      const title = document.createElement('div');
      title.className = 'row-title';
      title.textContent = describePattern(site.pattern);
      const sub = document.createElement('div');
      sub.className = 'row-sub';
      sub.textContent = (group ? group.name + ' · ' : '') + style.displayMode;
      main.appendChild(title);
      main.appendChild(sub);

      const actions = document.createElement('div');
      actions.className = 'row-actions';

      const tag = document.createElement('span');
      if (!accessMap.get(site.id)) {
        tag.className = 'tag warn';
        tag.textContent = 'No access';
        const grant = document.createElement('button');
        grant.type = 'button';
        grant.className = 'tiny';
        grant.textContent = 'Grant';
        grant.addEventListener('click', () => grantMissingAccess([site]));
        actions.appendChild(tag);
        actions.appendChild(grant);
      } else if (!site.enabled) {
        tag.className = 'tag';
        tag.textContent = 'Off';
        actions.appendChild(tag);
      }

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'tiny';
      toggle.textContent = site.enabled ? 'Turn off' : 'Turn on';
      toggle.addEventListener('click', async () => {
        site.enabled = !site.enabled;
        await persist();
      });

      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'tiny';
      edit.textContent = 'Edit';
      edit.addEventListener('click', () => openSiteEditor(site));

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'tiny';
      remove.textContent = 'Delete';
      remove.addEventListener('click', () => removeSite(site));

      actions.appendChild(toggle);
      actions.appendChild(edit);
      actions.appendChild(remove);

      row.appendChild(chip);
      row.appendChild(main);
      row.appendChild(actions);
      list.appendChild(row);
    });
  }

  /** Ask for every origin the given sites need, in one prompt. */
  function grantMissingAccess(sites) {
    const origins = [];
    sites.forEach((site) => {
      SL.patternToMatchPatterns(site.pattern).forEach((pattern) => {
        if (origins.indexOf(pattern) === -1) origins.push(pattern);
      });
    });
    if (!origins.length) return;

    chrome.permissions.request({ origins: origins }, (granted) => {
      if (chrome.runtime.lastError) {
        toast(chrome.runtime.lastError.message);
        return;
      }
      if (!granted) {
        toast('Access was not granted, so those labels stay hidden.');
        return;
      }
      notifyBackground(true);
      reload().then(() => toast('Access granted.'));
    });
  }

  async function removeSite(site) {
    if (!confirm('Delete the label for ' + describePattern(site.pattern) + '?')) return;

    SL.removeSite(state, site.id);
    await SL.saveState(state);

    // Hand back permissions this rule no longer needs.
    const stillNeeded = new Set(SL.sitesToMatchPatterns(state.sites));
    const origins = SL.patternToMatchPatterns(site.pattern).filter((p) => !stillNeeded.has(p));
    if (origins.length) {
      chrome.permissions.remove({ origins: origins }, () => void chrome.runtime.lastError);
    }
    notifyBackground(false);
    await reload();
    toast('Label deleted.');
  }

  /* ---- add site form ---- */

  function refreshAddScopes() {
    const select = $('newSiteScope');
    select.textContent = '';
    addSuggestions = SL.suggestPatterns($('newSiteUrl').value.trim());

    if (!addSuggestions.length) {
      const opt = document.createElement('option');
      opt.textContent = 'Enter a web address first';
      select.appendChild(opt);
      $('newSiteConsent').textContent = '';
      return;
    }

    addSuggestions.forEach((suggestion, index) => {
      const opt = document.createElement('option');
      opt.value = String(index);
      opt.textContent = suggestion.title + ' - ' + suggestion.detail;
      select.appendChild(opt);
    });
    updateAddConsent();

    const guess = SL.guessEnvironment($('newSiteUrl').value.trim());
    if (guess.label && !$('newSiteLabel').value) $('newSiteLabel').value = guess.label;
  }

  function updateAddConsent() {
    const suggestion = addSuggestions[Number($('newSiteScope').value) || 0];
    if (!suggestion) return;
    SL.renderConsent($('newSiteConsent'), suggestion.pattern, { compact: false });
  }

  function onAddSiteSubmit(event) {
    event.preventDefault();
    $('addSiteError').hidden = true;

    const suggestion = addSuggestions[Number($('newSiteScope').value) || 0];
    if (!suggestion) {
      $('addSiteError').hidden = false;
      $('addSiteError').textContent = 'That does not look like a web address.';
      return;
    }

    const label = SL.sanitizeText($('newSiteLabel').value, 60);
    const groupId = $('newSiteGroup').value || null;
    const origins = SL.patternToMatchPatterns(suggestion.pattern);

    chrome.permissions.request({ origins: origins }, async (granted) => {
      if (!granted) {
        $('addSiteError').hidden = false;
        $('addSiteError').textContent =
          'Without access to that site the label cannot be drawn. The rule was not saved.';
        return;
      }
      try {
        SL.upsertSite(state, {
          label: label,
          pattern: suggestion.pattern,
          groupId: groupId,
          style: {},
          enabled: true
        });
        await persist();
        $('addSiteForm').hidden = true;
        $('addSiteForm').reset();
        toast('Site added.');
      } catch (err) {
        $('addSiteError').hidden = false;
        $('addSiteError').textContent = err.message;
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * Groups
   * ------------------------------------------------------------------ */

  function renderGroups() {
    const list = $('groupsList');
    list.textContent = '';
    $('groupsEmpty').hidden = state.groups.length !== 0;

    state.groups.forEach((group) => {
      const count = state.sites.filter((s) => s.groupId === group.id).length;

      const row = document.createElement('div');
      row.className = 'row-card';

      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = group.name;
      chip.style.background = group.style.background;
      chip.style.color = group.style.textColor;

      const main = document.createElement('div');
      main.className = 'row-main';
      const title = document.createElement('div');
      title.className = 'row-title';
      title.textContent = group.name;
      const sub = document.createElement('div');
      sub.className = 'row-sub';
      sub.textContent =
        count + (count === 1 ? ' site' : ' sites') + ' · ' + group.style.displayMode;
      main.appendChild(title);
      main.appendChild(sub);

      const actions = document.createElement('div');
      actions.className = 'row-actions';

      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'tiny';
      edit.textContent = 'Edit';
      edit.addEventListener('click', () => openGroupEditor(group));

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'tiny';
      remove.textContent = 'Delete';
      remove.addEventListener('click', async () => {
        if (!confirm('Delete the group "' + group.name + '"? Its sites are kept, without a group.')) return;
        SL.removeGroup(state, group.id);
        await persist();
        toast('Group deleted.');
      });

      actions.appendChild(edit);
      actions.appendChild(remove);
      row.appendChild(chip);
      row.appendChild(main);
      row.appendChild(actions);
      list.appendChild(row);
    });
  }

  /* ------------------------------------------------------------------ *
   * Editor dialog (shared by sites and groups)
   * ------------------------------------------------------------------ */

  let editorTarget = null; // { kind: 'site'|'group', id }
  let editorPosition = { posX: -1, posY: -1 };

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

  function readEditorStyle() {
    return SL.normalizeStyle({
      displayMode: $('editorMode').value,
      background: $('editorBg').value,
      textColor: $('editorFg').value,
      opacity: SL.transparencyToOpacity(Number($('editorTransparency').value)),
      scale: Number($('editorScale').value) / 100,
      glow: $('editorGlow').checked,
      buddy: $('editorBuddy').value,
      buddyTricks: $('editorBuddyChatter').checked,
      buddyInterval: Number($('editorBuddyInterval').value),
      glowSpeed: Number($('editorGlowSpeed').value),
      locked: $('editorLocked').checked,
      posX: editorPosition.posX,
      posY: editorPosition.posY,
      fontSize: Number($('editorFontSize').value),
      bold: $('editorBold').checked,
      uppercase: $('editorUppercase').checked,
      stripes: $('editorStripes').checked,
      pushContent: $('editorPush').checked,
      clickToDismiss: $('editorClickDismiss').checked,
      showUrlHost: $('editorShowHost').checked,
      frameWidth: Number($('editorFrameWidth').value),
      barHeight: Number($('editorBarHeight').value)
    });
  }

  function writeEditorStyle(style) {
    $('editorMode').value = style.displayMode;
    $('editorBg').value = style.background;
    $('editorFg').value = style.textColor;
    $('editorTransparency').value = String(SL.opacityToTransparency(style.opacity));
    $('editorScale').value = String(Math.round(style.scale * 100));
    $('editorGlow').checked = style.glow;
    fillBuddySelect($('editorBuddy'), style.buddy);
    $('editorBuddyChatter').checked = style.buddyTricks;
    $('editorBuddyInterval').value = String(style.buddyInterval);
    $('editorGlowSpeed').value = String(style.glowSpeed);
    $('editorLocked').checked = style.locked;
    // The dragged position is carried through the dialog rather than edited
    // directly - it is set by dragging on the page, and cleared by the button.
    editorPosition = { posX: style.posX, posY: style.posY };
    $('editorFontSize').value = String(style.fontSize);
    $('editorBold').checked = style.bold;
    $('editorUppercase').checked = style.uppercase;
    $('editorStripes').checked = style.stripes;
    $('editorPush').checked = style.pushContent;
    $('editorClickDismiss').checked = style.clickToDismiss;
    $('editorShowHost').checked = style.showUrlHost;
    $('editorFrameWidth').value = String(style.frameWidth);
    $('editorBarHeight').value = String(style.barHeight);
    syncEditorOutputs();
  }

  function syncEditorOutputs() {
    $('editorScaleOut').textContent = $('editorScale').value + '%';
    $('editorFontSizeOut').textContent = $('editorFontSize').value + 'px';
    $('editorTransparencyOut').textContent = $('editorTransparency').value + '% see-through';
    $('editorGlowSpeedOut').textContent =
      SL.glowDuration({ glowSpeed: Number($('editorGlowSpeed').value) }) + 's per pass';
    $('editorGlowSpeed').disabled = !$('editorGlow').checked;
    $('editorBarHeightOut').textContent = $('editorBarHeight').value + 'px';
    $('editorFrameWidthOut').textContent = $('editorFrameWidth').value + 'px';

    // The buddy settings only apply to the buddy display mode.
    const isBuddy = $('editorMode').value === 'buddy';
    $('editorBuddyBox').hidden = !isBuddy;
    if (isBuddy) {
      const buddy = SL.buddyById($('editorBuddy').value);
      $('editorBuddyBlurb').textContent = buddy.blurb + ' — ' + SL.TRICK_NAMES[buddy.trick];
      const chatty = $('editorBuddyChatter').checked;
      $('editorBuddyInterval').disabled = !chatty;
      const secs = Number($('editorBuddyInterval').value);
      $('editorBuddyIntervalOut').textContent = !chatty
        ? 'never'
        : secs < 60
          ? 'about every ' + secs + ' seconds'
          : 'about every ' + Math.round(secs / 60) + ' minutes';
    }

    const draggable = SL.isDraggableMode($('editorMode').value);
    const placed = editorPosition.posX >= 0 && editorPosition.posY >= 0;

    $('editorLocked').disabled = !draggable;
    $('editorResetPos').hidden = !placed;
    $('editorPosNote').hidden = draggable && !placed;
    if (!draggable) {
      $('editorPosNote').hidden = false;
      $('editorPosNote').textContent =
        'A border frame surrounds the whole page, so there is nothing to reposition.';
    } else if (placed) {
      $('editorPosNote').textContent =
        'This label has been moved to ' +
        Math.round(editorPosition.posX * 100) + '% across, ' +
        Math.round(editorPosition.posY * 100) + '% down.';
    }
  }

  function refreshEditorPreview() {
    const style = readEditorStyle();
    const text = $('editorLabel').value || 'LABEL';
    SL.renderPreview($('editorPreview'), style, text);
    buildSwatches($('editorSwatches'), style.background, (preset) => {
      $('editorBg').value = preset.background;
      $('editorFg').value = preset.textColor;
      refreshEditorPreview();
    });
    updatePatternHelp();
  }

  function updatePatternHelp() {
    const help = {
      origin: 'Matches this exact scheme and host, and every page under it.',
      host: 'Matches this host over http or https, on any port.',
      'host-suffix': 'Matches the host and every subdomain of it.',
      prefix: 'Matches addresses that begin with this. Query strings are ignored.',
      wildcard: 'Use * as a placeholder, for example https://*-uat.contoso.com/*'
    };
    $('editorPatternHelp').textContent = help[$('editorPatternType').value] || '';
  }

  function openSiteEditor(site) {
    const group = SL.getGroup(state, site.groupId);
    editorTarget = { kind: 'site', id: site.id };

    $('editorTitle').textContent = 'Edit site label';
    $('editorLabelCaption').textContent = 'Label text';
    $('editorPatternField').hidden = false;
    $('editorGroupField').hidden = false;
    $('editorLabel').value = site.label;
    $('editorPatternType').value = site.pattern.type;
    $('editorPatternValue').value = site.pattern.value;
    fillGroupSelect($('editorGroup'), site.groupId || '', true);
    fillModeSelect($('editorMode'), SL.resolveStyle(site, group).displayMode);
    writeEditorStyle(SL.resolveStyle(site, group));
    refreshEditorPreview();
    $('editorError').hidden = true;
    $('editor').showModal();
  }

  function openGroupEditor(group) {
    editorTarget = { kind: 'group', id: group ? group.id : null };

    $('editorTitle').textContent = group ? 'Edit group' : 'New group';
    $('editorLabelCaption').textContent = 'Group name';
    $('editorPatternField').hidden = true;
    $('editorGroupField').hidden = true;
    $('editorLabel').value = group ? group.name : '';
    const style = group ? group.style : SL.DEFAULT_STYLE;
    fillModeSelect($('editorMode'), style.displayMode);
    writeEditorStyle(SL.normalizeStyle(style));
    refreshEditorPreview();
    $('editorError').hidden = true;
    $('editor').showModal();
  }

  async function saveEditor() {
    const style = readEditorStyle();
    const text = SL.sanitizeText($('editorLabel').value, 60);

    if (editorTarget.kind === 'group') {
      if (!text) {
        $('editorError').hidden = false;
        $('editorError').textContent = 'A group needs a name.';
        return;
      }
      try {
        SL.upsertGroup(state, {
          id: editorTarget.id || undefined,
          name: text,
          style: style
        });
      } catch (err) {
        $('editorError').hidden = false;
        $('editorError').textContent = err.message;
        return;
      }
      $('editor').close();
      await persist();
      toast('Group saved.');
      return;
    }

    const site = state.sites.find((s) => s.id === editorTarget.id);
    if (!site) return;

    const pattern = SL.normalizePattern({
      type: $('editorPatternType').value,
      value: $('editorPatternValue').value
    });
    if (!pattern) {
      $('editorError').hidden = false;
      $('editorError').textContent = 'That pattern is not valid for a web address.';
      return;
    }

    const patternChanged =
      pattern.type !== site.pattern.type || pattern.value !== site.pattern.value;
    const groupId = $('editorGroup').value || null;
    const group = SL.getGroup(state, groupId);

    site.label = text;
    site.groupId = groupId;
    // Store only what differs from the group, so group edits still cascade.
    site.style = SL.styleOverrideAgainst(style, group);
    site.pattern = pattern;

    if (!patternChanged) {
      $('editor').close();
      await persist();
      toast('Saved.');
      return;
    }

    // A new pattern needs its own permission before it can do anything.
    const origins = SL.patternToMatchPatterns(pattern);
    chrome.permissions.request({ origins: origins }, async (granted) => {
      $('editor').close();
      await persist();
      toast(granted ? 'Saved.' : 'Saved, but access to the new address was not granted.');
    });
  }

  /* ------------------------------------------------------------------ *
   * Transfer
   * ------------------------------------------------------------------ */

  function renderTransfer() {
    const box = $('exportChoices');
    box.textContent = '';

    const ungrouped = state.sites.filter((s) => !s.groupId).length;

    state.groups.forEach((group) => {
      const count = state.sites.filter((s) => s.groupId === group.id).length;
      box.appendChild(
        makeCheck(group.id, group.name + ' (' + count + (count === 1 ? ' site)' : ' sites)'))
      );
    });
    if (ungrouped) {
      box.appendChild(
        makeCheck('__ungrouped__', 'Sites with no group (' + ungrouped + ')')
      );
    }
    if (!state.groups.length && !ungrouped) {
      const note = document.createElement('p');
      note.className = 'muted small';
      note.textContent = 'Nothing to export yet.';
      box.appendChild(note);
    }
  }

  function makeCheck(value, text) {
    const label = document.createElement('label');
    label.className = 'check';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = value;
    const span = document.createElement('span');
    span.textContent = text;
    label.appendChild(input);
    label.appendChild(span);
    return label;
  }

  function doExport(groupIds) {
    const payload = SL.buildExport(state, groupIds);
    if (!payload.groups.length && !payload.sites.length) {
      $('exportStatus').hidden = false;
      $('exportStatus').textContent = 'Nothing selected to export.';
      return;
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = SL.exportFilename(payload.groups);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);

    $('exportStatus').hidden = false;
    $('exportStatus').textContent =
      'Exported ' + payload.groups.length + ' group(s) and ' + payload.sites.length + ' site(s).';
  }

  function onImportFile(event) {
    const file = event.target.files && event.target.files[0];
    $('importError').hidden = true;
    $('importStatus').hidden = true;
    $('importReport').hidden = true;
    $('importActions').hidden = true;
    pendingImport = null;
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      showImportError('That file is too large to be a Site Label export.');
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => showImportError('The file could not be read.');
    reader.onload = () => {
      const report = SL.validateImport(String(reader.result || ''));
      if (!report.ok) {
        showImportError(report.error);
        return;
      }
      pendingImport = report;
      showImportReport(report);
    };
    reader.readAsText(file);
  }

  function showImportError(message) {
    $('importError').hidden = false;
    $('importError').textContent = message;
  }

  /** Show exactly what is in the file before anything is written. */
  function showImportReport(report) {
    const box = $('importReport');
    box.textContent = '';

    const heading = document.createElement('strong');
    heading.textContent =
      'This file contains ' + report.groups.length + ' group(s) and ' +
      report.sites.length + ' site(s).';
    box.appendChild(heading);

    const list = document.createElement('ul');
    report.groups.forEach((group) => {
      const item = document.createElement('li');
      item.textContent = 'Group: ' + group.name;
      list.appendChild(item);
    });
    report.sites.slice(0, 12).forEach((site) => {
      const item = document.createElement('li');
      item.textContent = (site.label || '(no text)') + ' - ' + describePattern(site.pattern);
      list.appendChild(item);
    });
    if (report.sites.length > 12) {
      const item = document.createElement('li');
      item.textContent = '…and ' + (report.sites.length - 12) + ' more.';
      list.appendChild(item);
    }
    box.appendChild(list);

    if (report.skipped) {
      const note = document.createElement('p');
      note.className = 'small';
      note.textContent = report.skipped + ' entr(y/ies) were not readable and will be ignored.';
      box.appendChild(note);
    }

    box.hidden = false;
    $('importActions').hidden = false;
  }

  async function applyImport(mode) {
    if (!pendingImport) return;
    if (mode === 'replace' && !confirm('Replace every site and group you already have?')) return;

    const added = SL.applyImport(state, pendingImport, mode);
    await SL.saveState(state);
    notifyBackground(false);
    await reload();

    $('importActions').hidden = true;
    $('importReport').hidden = true;
    $('importFile').value = '';
    pendingImport = null;

    $('importStatus').hidden = false;
    $('importStatus').textContent =
      'Imported ' + added.groups + ' group(s) and ' + added.sites + ' site(s). ' +
      'Open the Sites tab to grant access so the labels appear.';
    toast('Import complete.');
  }

  /* ------------------------------------------------------------------ *
   * Settings
   * ------------------------------------------------------------------ */

  async function renderSettings() {
    $('setTitlePrefix').checked = state.settings.titlePrefix;
    $('setBadge').checked = state.settings.badgeOnIcon;
    $('setFullscreen').checked = state.settings.hideOnFullscreen;
    $('setTheme').value = state.settings.theme;
    renderCustomColors();
    renderPermissionInfo();

    const list = $('permissionsList');
    list.textContent = '';

    let granted = { origins: [] };
    try {
      granted = await chrome.permissions.getAll();
    } catch (err) {
      /* nothing granted */
    }
    const origins = granted.origins || [];

    if (!origins.length) {
      const note = document.createElement('p');
      note.className = 'muted small';
      note.textContent = 'Site Label has no site access at the moment.';
      list.appendChild(note);
      return;
    }

    origins.forEach((origin) => {
      const row = document.createElement('div');
      row.className = 'row-card';

      const main = document.createElement('div');
      main.className = 'row-main';
      main.textContent = origin;

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'tiny';
      remove.textContent = 'Remove access';
      remove.addEventListener('click', () => {
        chrome.permissions.remove({ origins: [origin] }, () => {
          notifyBackground(false);
          reload().then(() => {
            setTab('settings');
            toast('Access removed.');
          });
        });
      });

      row.appendChild(main);
      row.appendChild(remove);
      list.appendChild(row);
    });
  }

  /** The fixed permission set, spelled out with what each one is for. */
  function renderPermissionInfo() {
    const box = $('permissionInfo');
    box.textContent = '';

    SL.PERMISSIONS.forEach((perm) => {
      const row = document.createElement('div');
      row.className = 'perm-row';

      const head = document.createElement('div');
      head.className = 'perm-head';

      const name = document.createElement('span');
      name.className = 'perm-name';
      name.textContent = perm.name;

      const tag = document.createElement('span');
      tag.className = 'tag' + (perm.prompted ? ' warn' : ' ok');
      tag.textContent = perm.prompted ? 'You are asked each time' : 'No prompt, no site access';

      head.appendChild(name);
      head.appendChild(tag);

      const allows = document.createElement('p');
      allows.className = 'perm-allows';
      allows.textContent = 'Allows: ' + perm.allows;

      const used = document.createElement('p');
      used.className = 'perm-used';
      used.textContent = 'Used for: ' + perm.used;

      row.appendChild(head);
      row.appendChild(allows);
      row.appendChild(used);
      box.appendChild(row);
    });
  }

  /* ---- custom colour palette ---- */

  function renderCustomColors() {
    const list = $('customColorList');
    list.textContent = '';
    const custom = state.settings.customColors || [];

    if (!custom.length) {
      const note = document.createElement('p');
      note.className = 'muted small';
      note.textContent = 'No custom colours yet.';
      list.appendChild(note);
      return;
    }

    custom.forEach((entry, index) => {
      const row = document.createElement('div');
      row.className = 'row-card';

      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = 'Sample';
      chip.style.background = entry.background;
      chip.style.color = entry.textColor;

      const main = document.createElement('div');
      main.className = 'row-main';
      main.textContent = entry.background + ' on ' + entry.textColor + ' text';

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'tiny';
      remove.textContent = 'Remove';
      remove.addEventListener('click', async () => {
        state.settings.customColors = custom.filter((_, i) => i !== index);
        await SL.saveState(state);
        await reload();
        setTab('settings');
      });

      row.appendChild(chip);
      row.appendChild(main);
      row.appendChild(remove);
      list.appendChild(row);
    });
  }

  async function addCustomColor(background, textColor) {
    const bg = SL.sanitizeColor(background, null);
    if (!bg) {
      toast('That is not a valid colour.');
      return;
    }
    const fg = SL.sanitizeColor(textColor, '#ffffff');
    const custom = state.settings.customColors || [];

    if (custom.some((c) => c.background === bg && c.textColor === fg)) {
      toast('That colour is already in the palette.');
      return;
    }
    if (custom.length >= SL.MAX_CUSTOM_COLORS) {
      toast('The palette is full - remove one first.');
      return;
    }

    state.settings.customColors = custom.concat({ background: bg, textColor: fg });
    await SL.saveState(state);
    await reload();
    setTab('settings');
    toast('Colour added to the palette.');
  }

  async function saveSetting(key, value) {
    state.settings[key] = value;
    await SL.saveState(state);
    notifyBackground(true);
  }

  function revokeAll() {
    chrome.permissions.getAll((granted) => {
      const origins = (granted && granted.origins) || [];
      if (!origins.length) {
        toast('There was no site access to remove.');
        return;
      }
      chrome.permissions.remove({ origins: origins }, () => {
        notifyBackground(false);
        reload().then(() => {
          setTab('settings');
          toast('All site access removed.');
        });
      });
    });
  }

  function resetEverything() {
    if (!confirm('Delete every site, group and setting? This cannot be undone.')) return;

    chrome.permissions.getAll((granted) => {
      const origins = (granted && granted.origins) || [];
      const finish = async () => {
        await SL.saveState(SL.emptyState());
        notifyBackground(false);
        await reload();
        setTab('settings');
        $('resetStatus').hidden = false;
        $('resetStatus').textContent = 'Everything has been deleted.';
      };
      if (origins.length) chrome.permissions.remove({ origins: origins }, finish);
      else finish();
    });
  }

  /* ------------------------------------------------------------------ *
   * Render dispatch
   * ------------------------------------------------------------------ */

  function render() {
    $('globalToggle').checked = state.settings.enabled;
    $('globalToggleText').textContent = state.settings.enabled ? 'Labels on' : 'Labels paused';
    renderSites();
    renderGroups();
    fillGroupSelect($('newSiteGroup'), '', true);
    if (activeTab === 'transfer') renderTransfer();
    if (activeTab === 'settings') renderSettings();
  }

  /* ------------------------------------------------------------------ *
   * Init
   * ------------------------------------------------------------------ */

  function wire() {
    Array.from($('tabs').children).forEach((button) => {
      button.addEventListener('click', () => setTab(button.dataset.tab));
    });

    $('globalToggle').addEventListener('change', async (e) => {
      state.settings.enabled = e.target.checked;
      await SL.saveState(state);
      notifyBackground(true);
      render();
    });

    $('siteSearch').addEventListener('input', renderSites);
    $('addSiteBtn').addEventListener('click', () => {
      $('addSiteForm').hidden = !$('addSiteForm').hidden;
      if (!$('addSiteForm').hidden) $('newSiteUrl').focus();
    });
    $('cancelAddSite').addEventListener('click', () => {
      $('addSiteForm').hidden = true;
    });
    $('newSiteUrl').addEventListener('input', refreshAddScopes);
    $('newSiteScope').addEventListener('change', updateAddConsent);
    $('addSiteForm').addEventListener('submit', onAddSiteSubmit);

    $('addGroupBtn').addEventListener('click', () => openGroupEditor(null));

    ['editorMode', 'editorBg', 'editorFg', 'editorLabel', 'editorBold', 'editorUppercase',
     'editorStripes', 'editorShowHost', 'editorFontSize', 'editorBarHeight',
     'editorFrameWidth', 'editorScale', 'editorLocked', 'editorPush',
     'editorClickDismiss', 'editorTransparency', 'editorGlow',
     'editorGlowSpeed', 'editorBuddy', 'editorBuddyChatter',
     'editorBuddyInterval'].forEach((id) => {
      $(id).addEventListener('input', () => {
        syncEditorOutputs();
        refreshEditorPreview();
      });
    });
    $('editorPatternType').addEventListener('change', updatePatternHelp);
    $('editorResetPos').addEventListener('click', () => {
      editorPosition = { posX: -1, posY: -1 };
      syncEditorOutputs();
      refreshEditorPreview();
    });
    $('editorSaveColor').addEventListener('click', () =>
      addCustomColor($('editorBg').value, $('editorFg').value).then(refreshEditorPreview)
    );
    $('addCustomColor').addEventListener('click', () =>
      addCustomColor($('newCustomBg').value, $('newCustomFg').value)
    );
    $('editorSave').addEventListener('click', saveEditor);
    $('editorCancel').addEventListener('click', () => $('editor').close());
    // The dialog's form uses method="dialog", so Enter in a text field would
    // otherwise close it and quietly discard the edit.
    $('editorForm').addEventListener('submit', (event) => {
      event.preventDefault();
      saveEditor();
    });

    $('exportBtn').addEventListener('click', () => {
      const chosen = Array.from($('exportChoices').querySelectorAll('input:checked')).map(
        (input) => input.value
      );
      if (!chosen.length) {
        $('exportStatus').hidden = false;
        $('exportStatus').textContent = 'Tick at least one group first.';
        return;
      }
      doExport(chosen);
    });
    $('exportAllBtn').addEventListener('click', () => doExport(null));

    $('importFile').addEventListener('change', onImportFile);
    $('importMergeBtn').addEventListener('click', () => applyImport('merge'));
    $('importReplaceBtn').addEventListener('click', () => applyImport('replace'));
    $('importCancelBtn').addEventListener('click', () => {
      pendingImport = null;
      $('importFile').value = '';
      $('importReport').hidden = true;
      $('importActions').hidden = true;
    });

    $('setTitlePrefix').addEventListener('change', (e) => saveSetting('titlePrefix', e.target.checked));
    $('setBadge').addEventListener('change', (e) => saveSetting('badgeOnIcon', e.target.checked));
    $('setFullscreen').addEventListener('change', (e) => saveSetting('hideOnFullscreen', e.target.checked));
    $('setTheme').addEventListener('change', async (e) => {
      await saveSetting('theme', e.target.value);
      SL.applyTheme(e.target.value);
    });
    $('revokeAllBtn').addEventListener('click', revokeAll);
    $('resetBtn').addEventListener('click', resetEverything);

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[SL.STORAGE_KEY] && !$('editor').open) reload();
    });
  }

  async function init() {
    wire();
    state = await SL.getState();
    SL.applyTheme(state.settings.theme);
    await refreshAccessMap();

    const params = new URLSearchParams(location.search);
    if (params.get('welcome')) $('welcome').hidden = false;

    setTab(params.get('tab') === 'transfer' ? 'transfer' : 'sites');
    render();

    const addUrl = params.get('add');
    if (addUrl && SL.isLabelableUrl(addUrl)) {
      $('addSiteForm').hidden = false;
      $('newSiteUrl').value = addUrl;
      refreshAddScopes();
      $('newSiteLabel').focus();
    }

    const editId = params.get('edit');
    if (editId) {
      const site = state.sites.find((s) => s.id === editId);
      if (site) openSiteEditor(site);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
