/*
 * Site Label - background service worker.
 *
 * Site Label ships with no host permissions at all. The user grants access
 * one site at a time when they add it, and this worker keeps the registered
 * content scripts in step with whatever has actually been granted. Revoke a
 * permission and the script deregisters itself.
 */

importScripts(
  '/src/common/buddies.js',
  '/src/common/schema.js',
  '/src/common/matcher.js',
  '/src/common/storage.js'
);

const SL = globalThis.SL;

const REGISTRATION_ID = 'site-label-main';
const CONTENT_FILES = [
  'src/common/buddies.js',
  'src/common/schema.js',
  'src/common/matcher.js',
  'src/common/storage.js',
  'src/content/label.js'
];
const MENU_ID = 'site-label-add';

/* -------------------------------------------------------------------- *
 * Content script registration
 * -------------------------------------------------------------------- */

/** Keep only the patterns the user has actually granted. */
async function grantedPatternsOnly(patterns) {
  const checks = await Promise.all(
    patterns.map(async (pattern) => {
      try {
        const has = await chrome.permissions.contains({ origins: [pattern] });
        return has ? pattern : null;
      } catch (err) {
        return null;
      }
    })
  );
  return checks.filter(Boolean);
}

async function syncRegistrations() {
  const state = await SL.getState();
  const wanted = state.settings.enabled ? SL.sitesToMatchPatterns(state.sites) : [];
  const matches = await grantedPatternsOnly(wanted);

  let existing = [];
  try {
    existing = await chrome.scripting.getRegisteredContentScripts({ ids: [REGISTRATION_ID] });
  } catch (err) {
    existing = [];
  }

  if (!matches.length) {
    if (existing.length) {
      try {
        await chrome.scripting.unregisterContentScripts({ ids: [REGISTRATION_ID] });
      } catch (err) {
        /* already gone */
      }
    }
    return [];
  }

  const definition = {
    id: REGISTRATION_ID,
    matches: matches,
    js: CONTENT_FILES,
    runAt: 'document_idle',
    allFrames: false,
    persistAcrossSessions: true,
    world: 'ISOLATED'
  };

  // Whether the id is already registered decides which API applies, and the
  // answer changes as soon as the first call succeeds.
  let registered = existing.length > 0;

  async function apply(patterns) {
    const candidate = Object.assign({}, definition, { matches: patterns });
    if (registered) {
      await chrome.scripting.updateContentScripts([candidate]);
    } else {
      await chrome.scripting.registerContentScripts([candidate]);
      registered = true;
    }
  }

  try {
    await apply(matches);
    return matches;
  } catch (err) {
    /* fall through to the per-pattern retry below */
  }

  // One unusable pattern should not cost every other label its script, so
  // build the set up one pattern at a time and keep whatever sticks.
  const safe = [];
  for (const pattern of matches) {
    try {
      await apply(safe.concat(pattern));
      safe.push(pattern);
    } catch (inner) {
      /* skip this pattern */
    }
  }

  if (!safe.length && registered) {
    try {
      await chrome.scripting.unregisterContentScripts({ ids: [REGISTRATION_ID] });
    } catch (err) {
      /* nothing registered */
    }
  }
  return safe;
}

/**
 * Inject into tabs that are already open, so a freshly added site is
 * labelled without the user having to reload.
 */
async function injectIntoOpenTabs() {
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({});
  } catch (err) {
    return;
  }
  const state = await SL.getState();
  if (!state.settings.enabled) return;

  for (const tab of tabs) {
    // tab.url is only populated for tabs we hold permission for.
    if (!tab.id || !tab.url || !SL.isLabelableUrl(tab.url)) continue;
    if (!SL.findMatch(tab.url, state.sites)) continue;
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: false },
        files: CONTENT_FILES
      });
      // label.js will not re-initialise itself in a tab where it is already
      // running, so nudge the existing instance to redraw with whatever new
      // files just arrived alongside it.
      chrome.tabs.sendMessage(tab.id, { type: 'sl:refresh' }, () => void chrome.runtime.lastError);
    } catch (err) {
      /* no permission for this tab, or a restricted page */
    }
  }
}

/* -------------------------------------------------------------------- *
 * Toolbar badge
 * -------------------------------------------------------------------- */

async function setBadge(tabId, label, color) {
  if (typeof tabId !== 'number') return;
  const state = await SL.getState();
  const show = state.settings.badgeOnIcon && label;
  try {
    await chrome.action.setBadgeText({ tabId: tabId, text: show ? label.slice(0, 4) : '' });
    if (show) {
      await chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: color || '#c62828' });
      if (chrome.action.setBadgeTextColor) {
        await chrome.action.setBadgeTextColor({ tabId: tabId, color: '#ffffff' });
      }
      await chrome.action.setTitle({ tabId: tabId, title: 'Site Label - ' + label });
    } else {
      await chrome.action.setTitle({ tabId: tabId, title: 'Site Label' });
    }
  } catch (err) {
    /* tab closed mid-update */
  }
}

/* -------------------------------------------------------------------- *
 * Messages
 * -------------------------------------------------------------------- */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') return false;

  switch (message.type) {
    case 'sl:pageStatus':
      setBadge(sender.tab && sender.tab.id, message.label, message.color);
      sendResponse({ ok: true });
      return false;

    // The popup stages the rule here *before* it opens the permission prompt,
    // because Edge may tear the popup down to show that prompt and take the
    // completion callback with it. Saving a rule grants nothing on its own -
    // access is still governed entirely by the permission the user answers.
    case 'sl:stageSite':
      (async () => {
        try {
          const state = await SL.getState();
          let groupId = message.groupId || null;

          if (message.newGroupName) {
            const group = SL.upsertGroup(state, {
              name: message.newGroupName,
              style: message.style
            });
            groupId = group.id;
          }

          const group = SL.getGroup(state, groupId);
          const site = SL.upsertSite(state, {
            id: message.id,
            label: message.label,
            pattern: message.pattern,
            groupId: groupId,
            style: SL.styleOverrideAgainst(message.style, group),
            enabled: true
          });

          await SL.saveState(state);
          await syncRegistrations();
          sendResponse({ ok: true, id: site.id });
        } catch (err) {
          sendResponse({ ok: false, error: err && err.message });
        }
      })();
      return true;

    // The user declined the prompt, so take the staged rule back out again.
    case 'sl:unstageSite':
      (async () => {
        const state = await SL.getState();
        SL.removeSite(state, message.id);
        await SL.saveState(state);
        await syncRegistrations();
        sendResponse({ ok: true });
      })();
      return true;

    case 'sl:sync':
      (async () => {
        const matches = await syncRegistrations();
        if (message.injectNow) await injectIntoOpenTabs();
        sendResponse({ ok: true, registered: matches.length });
      })();
      return true; // async response

    default:
      return false;
  }
});

/* -------------------------------------------------------------------- *
 * Lifecycle
 * -------------------------------------------------------------------- */

/** A starter set of groups so the first run is not an empty screen. */
const SEED_GROUPS = [
  { name: 'Production', preset: 'red', mode: 'ribbon-top-right' },
  { name: 'UAT', preset: 'orange', mode: 'ribbon-top-right' },
  { name: 'Test', preset: 'purple', mode: 'ribbon-top-right' },
  { name: 'Dev', preset: 'blue', mode: 'ribbon-top-right' }
];

/* Each seeded group also carries the character that suits it, so switching a
   group to Buddy mode gives the right one without having to pick. */
function seedBuddy(name) {
  return SL.buddyForEnvironment(name.toUpperCase());
}

async function seedIfEmpty() {
  const state = await SL.getState();
  if (state.groups.length || state.sites.length) return;

  SEED_GROUPS.forEach((seed) => {
    const preset = SL.COLOR_PRESETS.find((p) => p.id === seed.preset);
    SL.upsertGroup(state, {
      name: seed.name,
      style: Object.assign({}, SL.DEFAULT_STYLE, {
        displayMode: seed.mode,
        background: preset.background,
        textColor: preset.textColor,
        buddy: seedBuddy(seed.name)
      })
    });
  });
  await SL.saveState(state);
}

function createMenu() {
  try {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: MENU_ID,
        title: 'Label this site with Site Label',
        contexts: ['page']
      });
      void chrome.runtime.lastError;
    });
  } catch (err) {
    /* context menus unavailable */
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  (async () => {
    await seedIfEmpty();
    createMenu();
    await syncRegistrations();
    // An update can add new content script files. Push them into tabs that are
    // already open, so upgrading does not require reloading every tab by hand.
    if (details.reason === 'update') await injectIntoOpenTabs();
    if (details.reason === 'install') {
      chrome.tabs.create({ url: chrome.runtime.getURL('src/options/options.html?welcome=1') });
    }
  })();
});

chrome.runtime.onStartup.addListener(() => {
  syncRegistrations();
  createMenu();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[SL.STORAGE_KEY]) syncRegistrations();
});

chrome.permissions.onAdded.addListener(() => {
  syncRegistrations().then(injectIntoOpenTabs);
});

chrome.permissions.onRemoved.addListener(() => {
  syncRegistrations();
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== MENU_ID) return;
  const url = info.pageUrl;
  if (!SL.isLabelableUrl(url)) return;
  chrome.tabs.create({
    url: chrome.runtime.getURL('src/options/options.html?add=' + encodeURIComponent(url))
  });
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'toggle-label') return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || !tab.id) return;
    chrome.tabs.sendMessage(tab.id, { type: 'sl:toggleTab' }, () => void chrome.runtime.lastError);
  });
});
