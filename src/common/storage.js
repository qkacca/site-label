/*
 * Site Label - storage access, plus export/import of environment groups.
 *
 * Everything lives in chrome.storage.local. Nothing is ever sent anywhere;
 * sharing happens only through files the user explicitly exports.
 */
(function (root) {
  'use strict';

  const SL = (root.SL = root.SL || {});

  SL.STORAGE_KEY = 'siteLabelState';
  SL.MAX_SITES = 2000;
  SL.MAX_GROUPS = 200;

  SL.emptyState = function emptyState() {
    return {
      settings: SL.normalizeSettings({}),
      groups: [],
      sites: []
    };
  };

  SL.normalizeState = function normalizeState(input) {
    const src = input && typeof input === 'object' ? input : {};
    const groups = [];
    const seenGroupIds = new Set();
    (Array.isArray(src.groups) ? src.groups : []).slice(0, SL.MAX_GROUPS).forEach((g) => {
      const group = SL.normalizeGroup(g);
      if (!group || seenGroupIds.has(group.id)) return;
      seenGroupIds.add(group.id);
      groups.push(group);
    });

    const sites = [];
    const seenSiteIds = new Set();
    (Array.isArray(src.sites) ? src.sites : []).slice(0, SL.MAX_SITES).forEach((s) => {
      const site = SL.normalizeSite(s);
      if (!site || seenSiteIds.has(site.id)) return;
      // Drop references to groups that no longer exist.
      if (site.groupId && !seenGroupIds.has(site.groupId)) site.groupId = null;
      seenSiteIds.add(site.id);
      sites.push(site);
    });

    return {
      settings: SL.normalizeSettings(src.settings),
      groups: groups,
      sites: sites
    };
  };

  SL.getState = function getState() {
    return new Promise((resolve) => {
      chrome.storage.local.get(SL.STORAGE_KEY, (result) => {
        if (chrome.runtime.lastError) {
          resolve(SL.emptyState());
          return;
        }
        resolve(SL.normalizeState(result && result[SL.STORAGE_KEY]));
      });
    });
  };

  SL.saveState = function saveState(state) {
    const clean = SL.normalizeState(state);
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [SL.STORAGE_KEY]: clean }, () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(clean);
      });
    });
  };

  /** Read-modify-write helper. */
  SL.updateState = async function updateState(mutator) {
    const state = await SL.getState();
    const next = mutator(state) || state;
    return SL.saveState(next);
  };

  /* ------------------------------------------------------------------ *
   * Mutators
   * ------------------------------------------------------------------ */

  SL.upsertSite = function upsertSite(state, site) {
    const clean = SL.normalizeSite(site);
    if (!clean) throw new Error('That address could not be turned into a rule.');

    const byId = state.sites.findIndex((s) => s.id === clean.id);
    if (byId !== -1) {
      state.sites[byId] = Object.assign({}, state.sites[byId], clean);
      return state.sites[byId];
    }

    // Same pattern saved twice = update in place rather than duplicate.
    const byPattern = state.sites.findIndex(
      (s) => s.pattern.type === clean.pattern.type && s.pattern.value === clean.pattern.value
    );
    if (byPattern !== -1) {
      clean.id = state.sites[byPattern].id;
      clean.createdAt = state.sites[byPattern].createdAt;
      state.sites[byPattern] = clean;
      return clean;
    }

    if (state.sites.length >= SL.MAX_SITES) throw new Error('Site limit reached.');
    state.sites.push(clean);
    return clean;
  };

  SL.removeSite = function removeSite(state, id) {
    state.sites = state.sites.filter((s) => s.id !== id);
    return state;
  };

  SL.upsertGroup = function upsertGroup(state, group) {
    const clean = SL.normalizeGroup(group);
    if (!clean) throw new Error('A group needs a name.');
    const idx = state.groups.findIndex((g) => g.id === clean.id);
    if (idx !== -1) {
      state.groups[idx] = clean;
      return clean;
    }
    if (state.groups.length >= SL.MAX_GROUPS) throw new Error('Group limit reached.');
    state.groups.push(clean);
    return clean;
  };

  /** Removing a group leaves its sites in place, untagged. */
  SL.removeGroup = function removeGroup(state, id) {
    state.groups = state.groups.filter((g) => g.id !== id);
    state.sites.forEach((s) => {
      if (s.groupId === id) s.groupId = null;
    });
    return state;
  };

  SL.getGroup = function getGroup(state, id) {
    if (!id) return null;
    return state.groups.find((g) => g.id === id) || null;
  };

  /* ------------------------------------------------------------------ *
   * Export
   * ------------------------------------------------------------------ */

  /**
   * Build an export payload. Pass an array of group ids to export just those
   * groups and their sites; pass null for everything.
   */
  SL.buildExport = function buildExport(state, groupIds) {
    const all = !groupIds || !groupIds.length;
    const idSet = new Set(groupIds || []);
    const includeUngrouped = all || idSet.has('__ungrouped__');

    const groups = state.groups.filter((g) => all || idSet.has(g.id));
    const keep = new Set(groups.map((g) => g.id));
    const sites = state.sites.filter((s) => {
      if (s.groupId) return keep.has(s.groupId);
      return includeUngrouped;
    });

    return {
      kind: SL.EXPORT_KIND,
      version: SL.SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      groups: groups,
      sites: sites
    };
  };

  SL.exportFilename = function exportFilename(groups) {
    const part =
      groups && groups.length === 1
        ? groups[0].name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
        : 'all';
    const date = new Date().toISOString().slice(0, 10);
    return 'site-label-' + part + '-' + date + '.json';
  };

  /* ------------------------------------------------------------------ *
   * Import
   * ------------------------------------------------------------------ */

  /**
   * Parse and validate an export file. Never throws; returns a report the UI
   * shows to the user *before* anything is written or any permission asked
   * for. Unknown fields are dropped by the normalisers.
   */
  SL.validateImport = function validateImport(text) {
    const report = { ok: false, error: '', groups: [], sites: [], skipped: 0 };

    if (typeof text !== 'string' || !text.trim()) {
      report.error = 'The file is empty.';
      return report;
    }
    if (text.length > 4 * 1024 * 1024) {
      report.error = 'That file is too large to be a Site Label export.';
      return report;
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      report.error = 'This is not a valid JSON file.';
      return report;
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      report.error = 'This file is not a Site Label export.';
      return report;
    }
    if (data.kind !== SL.EXPORT_KIND) {
      report.error = 'This file is not a Site Label export.';
      return report;
    }
    if (typeof data.version !== 'number' || data.version > SL.SCHEMA_VERSION) {
      report.error = 'This export was made by a newer version of Site Label.';
      return report;
    }

    const rawGroups = Array.isArray(data.groups) ? data.groups : [];
    const rawSites = Array.isArray(data.sites) ? data.sites : [];
    if (rawGroups.length > SL.MAX_GROUPS || rawSites.length > SL.MAX_SITES) {
      report.error = 'This export contains more entries than Site Label allows.';
      return report;
    }

    let skipped = 0;
    rawGroups.forEach((g) => {
      const group = SL.normalizeGroup(g);
      if (group) report.groups.push(group);
      else skipped++;
    });

    const groupIds = new Set(report.groups.map((g) => g.id));
    rawSites.forEach((s) => {
      const site = SL.normalizeSite(s);
      if (!site) {
        skipped++;
        return;
      }
      if (site.groupId && !groupIds.has(site.groupId)) site.groupId = null;
      report.sites.push(site);
    });

    report.skipped = skipped;
    if (!report.groups.length && !report.sites.length) {
      report.error = 'There was nothing usable in that file.';
      return report;
    }

    report.ok = true;
    return report;
  };

  /**
   * Apply a validated import.
   *   mode 'merge'   - add to what is already there (default)
   *   mode 'replace' - drop existing groups and sites first
   *
   * Ids from the file are re-issued on merge so two people exchanging
   * exports can never overwrite each other's rules by id collision.
   */
  SL.applyImport = function applyImport(state, report, mode) {
    if (mode === 'replace') {
      state.groups = [];
      state.sites = [];
    }

    const idMap = new Map();
    const added = { groups: 0, sites: 0, updated: 0 };

    report.groups.forEach((incoming) => {
      const existing = state.groups.find(
        (g) => g.name.toLowerCase() === incoming.name.toLowerCase()
      );
      if (existing) {
        idMap.set(incoming.id, existing.id);
        existing.style = incoming.style;
        existing.notes = incoming.notes || existing.notes;
        added.updated++;
      } else {
        const group = Object.assign({}, incoming, { id: SL.uid() });
        idMap.set(incoming.id, group.id);
        state.groups.push(group);
        added.groups++;
      }
    });

    report.sites.forEach((incoming) => {
      const site = Object.assign({}, incoming, {
        id: SL.uid(),
        groupId: incoming.groupId ? idMap.get(incoming.groupId) || null : null
      });
      const before = state.sites.length;
      SL.upsertSite(state, site);
      if (state.sites.length > before) added.sites++;
      else added.updated++;
    });

    return added;
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
