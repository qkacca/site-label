/*
 * Site Label - shared schema, defaults and sanitisers.
 *
 * Loaded as a classic script in every context (service worker via
 * importScripts, extension pages via <script>, content script via the
 * manifest/registration js array). Everything hangs off globalThis.SL.
 */
(function (root) {
  'use strict';

  const SL = (root.SL = root.SL || {});

  SL.SCHEMA_VERSION = 1;
  SL.EXPORT_KIND = 'site-label/export';

  /* ------------------------------------------------------------------ *
   * Display modes
   * ------------------------------------------------------------------ */

  SL.DISPLAY_MODES = [
    { id: 'ribbon-top-left', label: 'Corner ribbon - top left', group: 'Ribbon' },
    { id: 'ribbon-top-right', label: 'Corner ribbon - top right', group: 'Ribbon' },
    { id: 'ribbon-bottom-left', label: 'Corner ribbon - bottom left', group: 'Ribbon' },
    { id: 'ribbon-bottom-right', label: 'Corner ribbon - bottom right', group: 'Ribbon' },
    { id: 'bar-top', label: 'Top bar (under the address bar)', group: 'Bar' },
    { id: 'bar-bottom', label: 'Bottom bar', group: 'Bar' },
    { id: 'edge-top', label: 'Edge line - top, with a tag', group: 'Edge' },
    { id: 'edge-bottom', label: 'Edge line - bottom, with a tag', group: 'Edge' },
    { id: 'side-left', label: 'Side tab - left edge', group: 'Edge' },
    { id: 'side-right', label: 'Side tab - right edge', group: 'Edge' },
    { id: 'frame', label: 'Border frame around the page', group: 'Frame' },
    { id: 'frame-labelled', label: 'Border frame with a tab', group: 'Frame' },
    { id: 'corners', label: 'Corner brackets', group: 'Frame' },
    { id: 'pill-top-center', label: 'Floating pill - top centre', group: 'Badge' },
    { id: 'pill-bottom-center', label: 'Floating pill - bottom centre', group: 'Badge' },
    { id: 'badge-top-left', label: 'Floating badge - top left', group: 'Badge' },
    { id: 'badge-top-right', label: 'Floating badge - top right', group: 'Badge' },
    { id: 'badge-bottom-left', label: 'Floating badge - bottom left', group: 'Badge' },
    { id: 'badge-bottom-right', label: 'Floating badge - bottom right', group: 'Badge' },
    { id: 'watermark', label: 'Centred watermark', group: 'Badge' },
    { id: 'buddy', label: 'Buddy - a character holding your label', group: 'Buddy' },
    { id: 'meme-impact', label: 'Impact caption - the classic macro (any)', group: 'Meme' },
    { id: 'meme-hazard', label: 'Caution tape - rolling hazard stripes (Production)', group: 'Meme' },
    { id: 'meme-stamp', label: 'Approval stamp - rubber stamp (UAT)', group: 'Meme' },
    { id: 'meme-glitch', label: 'Glitch text - RGB split (Test / SIT)', group: 'Meme' },
    { id: 'meme-terminal', label: 'Terminal - green on black (Dev / Local)', group: 'Meme' }
  ];

  SL.DISPLAY_MODE_IDS = SL.DISPLAY_MODES.map((m) => m.id);

  /* ------------------------------------------------------------------ *
   * Colour presets
   * ------------------------------------------------------------------ */

  SL.COLOR_PRESETS = [
    { id: 'red', name: 'Production red', background: '#c62828', textColor: '#ffffff' },
    { id: 'orange', name: 'UAT orange', background: '#e65100', textColor: '#ffffff' },
    { id: 'amber', name: 'Warning amber', background: '#f9a825', textColor: '#1a1a1a' },
    { id: 'gold', name: 'Gold', background: '#d4a017', textColor: '#1a1a1a' },
    { id: 'bronze', name: 'Bronze', background: '#8d6e2f', textColor: '#ffffff' },
    { id: 'copper', name: 'Copper', background: '#b3541e', textColor: '#ffffff' },
    { id: 'green', name: 'Training green', background: '#2e7d32', textColor: '#ffffff' },
    { id: 'lime', name: 'Lime', background: '#558b2f', textColor: '#ffffff' },
    { id: 'teal', name: 'Sandbox teal', background: '#00695c', textColor: '#ffffff' },
    { id: 'cyan', name: 'Cyan', background: '#00838f', textColor: '#ffffff' },
    { id: 'blue', name: 'Dev blue', background: '#1565c0', textColor: '#ffffff' },
    { id: 'indigo', name: 'Build indigo', background: '#283593', textColor: '#ffffff' },
    { id: 'purple', name: 'Test purple', background: '#6a1b9a', textColor: '#ffffff' },
    { id: 'pink', name: 'Support pink', background: '#ad1457', textColor: '#ffffff' },
    { id: 'slate', name: 'Neutral slate', background: '#37474f', textColor: '#ffffff' },
    { id: 'black', name: 'Black', background: '#111111', textColor: '#ffffff' },
    { id: 'ice', name: 'Ice', background: '#b3e5fc', textColor: '#0d3c55' },
    { id: 'white', name: 'White', background: '#f5f5f5', textColor: '#1a1a1a' }
  ];

  SL.MAX_CUSTOM_COLORS = 24;

  /** Presets followed by whatever colours the user has saved themselves. */
  SL.allSwatches = function allSwatches(settings) {
    const custom = (settings && settings.customColors) || [];
    return SL.COLOR_PRESETS.concat(
      custom.map((entry, index) => ({
        id: 'custom-' + index,
        name: 'Custom ' + (index + 1),
        background: entry.background,
        textColor: entry.textColor,
        custom: true
      }))
    );
  };

  /* ------------------------------------------------------------------ *
   * Defaults
   * ------------------------------------------------------------------ */

  SL.DEFAULT_STYLE = Object.freeze({
    displayMode: 'ribbon-top-right',
    background: '#c62828',
    textColor: '#ffffff',
    // How solid the label is, background and text together. The UI presents
    // the inverse of this as "transparency", which is how people describe it.
    opacity: 0.92,
    // Overall size multiplier: scales the whole label, not just the text.
    scale: 1,
    // Which character holds the placard in "buddy" mode.
    buddy: 'cone',
    // Whether the buddy performs its little routine now and then, and how
    // often. Replaced the speech bubbles, which got repetitive fast.
    buddyTricks: true,
    buddyInterval: 120,
    // A light that travels across the label, like cabin lighting.
    glow: false,
    // 1 = a slow drift, 10 = a quick sweep. Converted to a duration on render.
    glowSpeed: 4,
    fontSize: 13,
    bold: true,
    uppercase: true,
    stripes: false,
    pushContent: false,
    clickToDismiss: false,
    showUrlHost: false,
    frameWidth: 6,
    barHeight: 26,
    // Locked labels ignore the mouse entirely. Unlock one to drag it.
    locked: true,
    // Where a dragged label sits, as a fraction of the viewport.
    // -1 on either axis means "use the position the display mode implies".
    posX: -1,
    posY: -1
  });

  SL.DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    titlePrefix: false,
    badgeOnIcon: true,
    hideOnFullscreen: true,
    customColors: [],
    // 'auto' follows the browser; the explicit values are for when Edge's
    // appearance and the system setting disagree.
    theme: 'auto',
    schemaVersion: SL.SCHEMA_VERSION
  });

  /**
   * Apply the chosen theme to an extension page. 'auto' leaves it to
   * prefers-color-scheme; the explicit values stamp the root so the page
   * matches Edge even when Edge's appearance differs from the OS setting.
   */
  SL.applyTheme = function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
    else root.removeAttribute('data-theme');
  };

  /**
   * Meme-inspired styles matched to environments.
   *
   * These borrow each format's *typography and layout* - Impact captions,
   * hazard tape, a rubber stamp, RGB-split glitch text, a terminal - and not
   * the images. The well-known meme pictures are copyrighted photographs and
   * artwork, usually of real people, so reproducing them in a published
   * extension is not an option. The visual language carries the joke anyway,
   * and unlike a photograph it scales and recolours to the label.
   */
  SL.MEME_FOR_ENV = {
    PRODUCTION: 'meme-hazard',
    UAT: 'meme-stamp',
    STAGING: 'meme-stamp',
    TEST: 'meme-glitch',
    SIT: 'meme-glitch',
    QA: 'meme-glitch',
    DEV: 'meme-terminal',
    BUILD: 'meme-terminal',
    LOCAL: 'meme-terminal',
    SANDBOX: 'meme-impact',
    DEMO: 'meme-impact',
    TRAINING: 'meme-impact'
  };

  SL.MEME_MODES = ['meme-impact', 'meme-hazard', 'meme-stamp', 'meme-glitch', 'meme-terminal'];

  SL.memeForEnvironment = function memeForEnvironment(label) {
    const key = String(label || '').trim().toUpperCase();
    return SL.MEME_FOR_ENV[key] || 'meme-impact';
  };

  SL.isMemeMode = function isMemeMode(mode) {
    return SL.MEME_MODES.indexOf(mode) !== -1;
  };

  /** Display modes that can be picked up and moved. */
  SL.isDraggableMode = function isDraggableMode(mode) {
    return mode !== 'frame';
  };

  /* ------------------------------------------------------------------ *
   * Small helpers
   * ------------------------------------------------------------------ */

  const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

  SL.uid = function uid() {
    const bytes = new Uint8Array(9);
    (root.crypto || root.msCrypto).getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  };

  function hexToRgbParts(hex) {
    let h = String(hex).replace('#', '');
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0);
  }

  /**
   * Rotate a colour's hue and optionally lift its lightness. Used to build the
   * glow's colour cycle from the label's own colour, so a red label glows
   * through warm reds rather than some unrelated hue.
   */
  SL.hueShift = function hueShift(hex, degrees, lift) {
    const [r, g, b] = hexToRgbParts(hex);
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    const d = max - min;
    let h = 0;
    let sat = 0;
    if (d !== 0) {
      sat = d / (1 - Math.abs(2 * l - 1));
      if (max === rn) h = ((gn - bn) / d) % 6;
      else if (max === gn) h = (bn - rn) / d + 2;
      else h = (rn - gn) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    h = (h + (degrees || 0) + 360) % 360;
    const light = Math.max(0, Math.min(1, l + (lift || 0)));
    const c = (1 - Math.abs(2 * light - 1)) * Math.min(1, sat + 0.15);
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = light - c / 2;
    const seg = Math.floor(h / 60) % 6;
    const rgb = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][seg]
      .map((v) => Math.round((v + m) * 255));
    return '#' + rgb.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
  };

  /** The three hues the glow cycles through, from the label's own colour. */
  SL.glowColors = function glowColors(background) {
    // Small hue steps and modest lightness lifts: the glow should read as the
    // label's own colour burning brighter, not as a different colour
    // altogether. Larger shifts turned a red label pink.
    return {
      a: SL.hueShift(background, -12, 0.06),
      b: SL.hueShift(background, 0, 0.20),
      c: SL.hueShift(background, 14, 0.10),
      softA: SL.hueShift(background, -12, 0.20),
      softB: SL.hueShift(background, 0, 0.32),
      softC: SL.hueShift(background, 14, 0.24)
    };
  };

  SL.clampNumber = function clampNumber(value, min, max, fallback) {
    const n = typeof value === 'number' ? value : parseFloat(value);
    if (!isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  };

  /**
   * Only ever accept a literal hex colour. Rejecting everything else keeps
   * url(), expression(), var() and other CSS payloads out of the stylesheet
   * we build for the shadow root.
   */
  SL.sanitizeColor = function sanitizeColor(value, fallback) {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    return HEX_RE.test(trimmed) ? trimmed.toLowerCase() : fallback;
  };

  /** Label / group text: plain single-line text, hard length cap. */
  SL.sanitizeText = function sanitizeText(value, maxLength) {
    if (typeof value !== 'string') return '';
    return value
      .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\ufeff]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLength || 60);
  };

  SL.bool = function bool(value, fallback) {
    return typeof value === 'boolean' ? value : fallback;
  };

  SL.oneOf = function oneOf(value, allowed, fallback) {
    return allowed.indexOf(value) !== -1 ? value : fallback;
  };

  /* ------------------------------------------------------------------ *
   * Normalisers - every object that reaches storage or the renderer goes
   * through these, whether it came from our own UI or an imported file.
   * ------------------------------------------------------------------ */

  SL.normalizeStyle = function normalizeStyle(input, base) {
    const src = input && typeof input === 'object' ? input : {};
    const def = base || SL.DEFAULT_STYLE;
    return {
      displayMode: SL.oneOf(src.displayMode, SL.DISPLAY_MODE_IDS, def.displayMode),
      background: SL.sanitizeColor(src.background, def.background),
      textColor: SL.sanitizeColor(src.textColor, def.textColor),
      opacity: SL.clampNumber(src.opacity, 0.15, 1, def.opacity),
      scale: Math.round(SL.clampNumber(src.scale, 0.5, 3, def.scale) * 100) / 100,
      buddy: SL.oneOf(src.buddy, SL.BUDDY_IDS || [], def.buddy),
      // Migrates the old buddyChatter flag, so anyone who had switched the
      // speech off keeps the quiet buddy they asked for.
      buddyTricks: SL.bool(
        src.buddyTricks !== undefined ? src.buddyTricks : src.buddyChatter,
        def.buddyTricks
      ),
      buddyInterval: Math.round(SL.clampNumber(src.buddyInterval, 5, 900, def.buddyInterval)),
      glow: SL.bool(src.glow, def.glow),
      glowSpeed: Math.round(SL.clampNumber(src.glowSpeed, 1, 10, def.glowSpeed)),
      fontSize: Math.round(SL.clampNumber(src.fontSize, 8, 32, def.fontSize)),
      bold: SL.bool(src.bold, def.bold),
      uppercase: SL.bool(src.uppercase, def.uppercase),
      stripes: SL.bool(src.stripes, def.stripes),
      pushContent: SL.bool(src.pushContent, def.pushContent),
      clickToDismiss: SL.bool(src.clickToDismiss, def.clickToDismiss),
      showUrlHost: SL.bool(src.showUrlHost, def.showUrlHost),
      frameWidth: Math.round(SL.clampNumber(src.frameWidth, 2, 24, def.frameWidth)),
      barHeight: Math.round(SL.clampNumber(src.barHeight, 16, 64, def.barHeight)),
      locked: SL.bool(src.locked, def.locked),
      posX: SL.clampNumber(src.posX, -1, 1, def.posX),
      posY: SL.clampNumber(src.posY, -1, 1, def.posY)
    };
  };

  /**
   * Seconds for one pass of the glow. Speed 1 drifts across in 12s, speed 10
   * sweeps in a little over a second.
   */
  SL.glowDuration = function glowDuration(style) {
    const speed = SL.clampNumber(style && style.glowSpeed, 1, 10, 4);
    return Math.round((12 / speed) * 100) / 100;
  };

  /** Transparency as the UI shows it: 0% = solid, 85% = barely there. */
  SL.opacityToTransparency = function opacityToTransparency(opacity) {
    return Math.round((1 - SL.clampNumber(opacity, 0.15, 1, 0.92)) * 100);
  };

  SL.transparencyToOpacity = function transparencyToOpacity(percent) {
    const clamped = SL.clampNumber(percent, 0, 85, 8);
    // Rounded so the stored value stays a clean 2dp figure rather than
    // something like 0.15000000000000002.
    const opacity = Math.round((1 - clamped / 100) * 100) / 100;
    return SL.clampNumber(opacity, 0.15, 1, 0.92);
  };

  /** True when a label has been dragged somewhere of its own. */
  SL.hasCustomPosition = function hasCustomPosition(style) {
    return !!style && style.posX >= 0 && style.posY >= 0;
  };

  /**
   * A partial style. Only keys that are present *and* carry a genuinely valid
   * value survive; anything unparseable is dropped rather than replaced, so a
   * bad value in an imported file falls through to the group's style instead
   * of silently becoming a default.
   *
   * Validity is detected by normalising twice against two bases that differ in
   * every key: a value that parsed cleanly gives the same answer both times,
   * while one that fell back takes on whichever base it was given.
   */
  const PROBE_BASE = Object.freeze({
    displayMode: 'watermark',
    background: '#010203',
    textColor: '#040506',
    opacity: 0.5,
    scale: 1.7,
    buddy: 'moon',
    buddyTricks: false,
    buddyInterval: 300,
    glow: true,
    glowSpeed: 9,
    fontSize: 11,
    bold: false,
    uppercase: false,
    stripes: true,
    pushContent: true,
    clickToDismiss: true,
    showUrlHost: true,
    frameWidth: 7,
    barHeight: 33,
    locked: false,
    posX: 0.33,
    posY: 0.66
  });

  SL.normalizeStyleOverride = function normalizeStyleOverride(input) {
    if (!input || typeof input !== 'object') return {};
    const withDefaults = SL.normalizeStyle(input, SL.DEFAULT_STYLE);
    const withProbe = SL.normalizeStyle(input, PROBE_BASE);
    const out = {};
    Object.keys(withDefaults).forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(input, key)) return;
      if (withDefaults[key] === withProbe[key]) out[key] = withDefaults[key];
    });
    return out;
  };

  SL.normalizeGroup = function normalizeGroup(input) {
    const src = input && typeof input === 'object' ? input : {};
    const name = SL.sanitizeText(src.name, 40);
    if (!name) return null;
    return {
      id: SL.sanitizeText(src.id, 40) || SL.uid(),
      name: name,
      style: SL.normalizeStyle(src.style),
      notes: SL.sanitizeText(src.notes, 200)
    };
  };

  SL.normalizeSite = function normalizeSite(input) {
    const src = input && typeof input === 'object' ? input : {};
    const pattern = SL.normalizePattern(src.pattern);
    if (!pattern) return null;
    return {
      id: SL.sanitizeText(src.id, 40) || SL.uid(),
      label: SL.sanitizeText(src.label, 60),
      pattern: pattern,
      groupId: SL.sanitizeText(src.groupId, 40) || null,
      style: SL.normalizeStyleOverride(src.style),
      enabled: SL.bool(src.enabled, true),
      notes: SL.sanitizeText(src.notes, 200),
      createdAt: typeof src.createdAt === 'number' ? src.createdAt : Date.now()
    };
  };

  /** User-saved colour pairs. Invalid entries are dropped, duplicates collapse. */
  SL.normalizeCustomColors = function normalizeCustomColors(input) {
    if (!Array.isArray(input)) return [];
    const seen = new Set();
    const out = [];
    input.slice(0, SL.MAX_CUSTOM_COLORS * 2).forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      const background = SL.sanitizeColor(entry.background, null);
      if (!background) return;
      const textColor = SL.sanitizeColor(entry.textColor, '#ffffff');
      const key = background + '|' + textColor;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ background: background, textColor: textColor });
    });
    return out.slice(0, SL.MAX_CUSTOM_COLORS);
  };

  SL.normalizeSettings = function normalizeSettings(input) {
    const src = input && typeof input === 'object' ? input : {};
    return {
      enabled: SL.bool(src.enabled, SL.DEFAULT_SETTINGS.enabled),
      titlePrefix: SL.bool(src.titlePrefix, SL.DEFAULT_SETTINGS.titlePrefix),
      badgeOnIcon: SL.bool(src.badgeOnIcon, SL.DEFAULT_SETTINGS.badgeOnIcon),
      hideOnFullscreen: SL.bool(src.hideOnFullscreen, SL.DEFAULT_SETTINGS.hideOnFullscreen),
      customColors: SL.normalizeCustomColors(src.customColors),
      theme: SL.oneOf(src.theme, ['auto', 'light', 'dark'], 'auto'),
      schemaVersion: SL.SCHEMA_VERSION
    };
  };

  /* ------------------------------------------------------------------ *
   * Effective style resolution: defaults <- group <- site override
   * ------------------------------------------------------------------ */

  SL.resolveStyle = function resolveStyle(site, group) {
    const base = group && group.style ? group.style : SL.DEFAULT_STYLE;
    const merged = Object.assign({}, SL.DEFAULT_STYLE, base, site ? site.style : null);
    return SL.normalizeStyle(merged);
  };

  /**
   * The parts of a style that differ from the group it belongs to. Storing
   * only these keeps a site following its group for everything it has not
   * deliberately overridden.
   */
  SL.styleOverrideAgainst = function styleOverrideAgainst(style, group) {
    const full = SL.normalizeStyle(style);
    const out = {};
    Object.keys(full).forEach((key) => {
      if (!group || !group.style || group.style[key] !== full[key]) out[key] = full[key];
    });
    return out;
  };

  SL.resolveLabelText = function resolveLabelText(site, group) {
    if (site && site.label) return site.label;
    if (group && group.name) return group.name;
    return 'LABELLED';
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
