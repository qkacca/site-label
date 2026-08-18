/*
 * Site Label - checks for the matching and validation logic.
 *
 *   node tools/test-matcher.js
 *
 * Runs the real schema.js / matcher.js / storage.js in plain Node. Anything
 * touching chrome.* is out of scope here; this covers the URL reasoning and
 * the import sanitising, which is where the risk actually sits.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const sandbox = { console: console, crypto: require('crypto').webcrypto, URL: URL };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

['src/common/buddies.js', 'src/common/schema.js', 'src/common/matcher.js',
 'src/common/storage.js', 'src/common/consent.js'].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });
});

const SL = sandbox.SL;

let passed = 0;
let failed = 0;

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
  } else {
    failed++;
    console.error('FAIL  ' + name + '\n        expected ' + JSON.stringify(expected) +
                  '\n        actual   ' + JSON.stringify(actual));
  }
}

function site(label, type, value, extra) {
  return SL.normalizeSite(Object.assign({ label: label, pattern: { type: type, value: value } }, extra));
}

function matchLabel(url, sites) {
  const found = SL.findMatch(url, sites);
  return found ? found.label : null;
}

/* ------------------------------------------------------------------ *
 * Base URL -> sub pages
 * ------------------------------------------------------------------ */

const uat = site('UAT', 'origin', 'https://contoso-uat.sandbox.operations.dynamics.com');
const sites = [uat];

check('origin matches the bare origin',
  matchLabel('https://contoso-uat.sandbox.operations.dynamics.com/', sites), 'UAT');

check('origin matches a deep D365 menu item URL',
  matchLabel('https://contoso-uat.sandbox.operations.dynamics.com/?cmp=USMF&mi=LedgerJournalTable', sites), 'UAT');

check('origin matches a sub path',
  matchLabel('https://contoso-uat.sandbox.operations.dynamics.com/Modules/Finance/GL', sites), 'UAT');

check('origin matches a fragment-only SPA route',
  matchLabel('https://contoso-uat.sandbox.operations.dynamics.com/#/vendors/1234', sites), 'UAT');

check('origin does not match a different host',
  matchLabel('https://contoso-prod.operations.dynamics.com/', sites), null);

check('origin does not match a different scheme',
  matchLabel('http://contoso-uat.sandbox.operations.dynamics.com/', sites), null);

check('origin does not match a different port',
  matchLabel('https://contoso-uat.sandbox.operations.dynamics.com:8443/', sites), null);

/* ------------------------------------------------------------------ *
 * Subdomain and prefix rules
 * ------------------------------------------------------------------ */

const suffix = [site('CORP', 'host-suffix', 'contoso.com')];
check('host-suffix matches the apex', matchLabel('https://contoso.com/x', suffix), 'CORP');
check('host-suffix matches a subdomain', matchLabel('https://uat.contoso.com/x', suffix), 'CORP');
check('host-suffix matches a nested subdomain', matchLabel('https://a.b.contoso.com/', suffix), 'CORP');
check('host-suffix does not match a lookalike domain',
  matchLabel('https://notcontoso.com/', suffix), null);
check('host-suffix does not match a suffix collision',
  matchLabel('https://evil-contoso.com/', suffix), null);

const prefix = [site('TENANT A', 'prefix', 'https://apps.contoso.com/tenant-a')];
check('prefix matches its own path', matchLabel('https://apps.contoso.com/tenant-a', prefix), 'TENANT A');
check('prefix matches a child path', matchLabel('https://apps.contoso.com/tenant-a/orders/5', prefix), 'TENANT A');
check('prefix ignores the query string', matchLabel('https://apps.contoso.com/tenant-a?x=1', prefix), 'TENANT A');
check('prefix respects path boundaries', matchLabel('https://apps.contoso.com/tenant-abc', prefix), null);

/* ------------------------------------------------------------------ *
 * Specificity: the narrowest rule wins
 * ------------------------------------------------------------------ */

const layered = [
  site('CORP', 'host-suffix', 'contoso.com'),
  site('UAT', 'origin', 'https://uat.contoso.com'),
  site('PAYROLL UAT', 'prefix', 'https://uat.contoso.com/payroll')
];
check('broad rule applies where nothing narrower does',
  matchLabel('https://www.contoso.com/', layered), 'CORP');
check('origin beats host-suffix',
  matchLabel('https://uat.contoso.com/home', layered), 'UAT');
check('prefix beats origin',
  matchLabel('https://uat.contoso.com/payroll/run', layered), 'PAYROLL UAT');

/* ------------------------------------------------------------------ *
 * Disabled rules are skipped
 * ------------------------------------------------------------------ */

check('a disabled rule is ignored',
  matchLabel('https://uat.contoso.com/', [site('UAT', 'origin', 'https://uat.contoso.com', { enabled: false })]), null);

/* ------------------------------------------------------------------ *
 * Wildcards
 * ------------------------------------------------------------------ */

const wild = [site('UAT', 'wildcard', 'https://*-uat.contoso.com/*')];
check('wildcard matches a generated host', matchLabel('https://finance-uat.contoso.com/page', wild), 'UAT');
check('wildcard rejects a non-matching host', matchLabel('https://finance-prod.contoso.com/page', wild), null);
check('a bare-star wildcard is rejected outright',
  SL.normalizePattern({ type: 'wildcard', value: 'https://*/*' }), null);

/* ------------------------------------------------------------------ *
 * Only ordinary web pages
 * ------------------------------------------------------------------ */

['javascript:alert(1)', 'file:///C:/secret.txt', 'edge://settings', 'chrome://extensions',
 'data:text/html,<h1>x', 'about:blank', 'ftp://contoso.com/'].forEach((url) => {
  check('rejects ' + url, SL.isLabelableUrl(url), false);
});
check('accepts an ordinary https page', SL.isLabelableUrl('https://contoso.com/a'), true);
check('accepts an ordinary http page', SL.isLabelableUrl('http://localhost:8080/a'), true);

/* ------------------------------------------------------------------ *
 * Permission patterns stay narrow
 * ------------------------------------------------------------------ */

check('origin grants only that origin',
  SL.patternToMatchPatterns({ type: 'origin', value: 'https://uat.contoso.com' }),
  ['https://uat.contoso.com/*']);
check('host-suffix grants the apex and its subdomains',
  SL.patternToMatchPatterns({ type: 'host-suffix', value: 'contoso.com' }),
  ['*://contoso.com/*', '*://*.contoso.com/*']);

/* ------------------------------------------------------------------ *
 * Colour and text sanitising
 * ------------------------------------------------------------------ */

check('accepts a plain hex colour', SL.sanitizeColor('#C62828', '#000000'), '#c62828');
check('rejects a CSS url() payload', SL.sanitizeColor('url(https://x/y.png)', '#000000'), '#000000');
check('rejects a CSS expression', SL.sanitizeColor('red;}body{display:none', '#000000'), '#000000');
check('rejects a var() reference', SL.sanitizeColor('var(--x)', '#000000'), '#000000');
check('strips control characters from label text',
  SL.sanitizeText('UA\u0000T\u2028X', 60), 'UA T X');
check('caps label length', SL.sanitizeText('x'.repeat(200), 60).length, 60);
check('clamps a silly font size', SL.normalizeStyle({ fontSize: 9999 }).fontSize, 32);
check('falls back on an unknown display mode',
  SL.normalizeStyle({ displayMode: 'evil' }).displayMode, SL.DEFAULT_STYLE.displayMode);

/* ------------------------------------------------------------------ *
 * Environment detection
 * ------------------------------------------------------------------ */

check('detects a D365 F&O production host',
  SL.guessEnvironment('https://contoso.operations.dynamics.com/').label, 'PRODUCTION');
check('detects a D365 F&O sandbox host',
  SL.guessEnvironment('https://contoso-test.sandbox.operations.dynamics.com/').label, 'TEST');
check('a named UAT box inside dynamics.com is not called production',
  SL.guessEnvironment('https://contoso-uat.operations.dynamics.com/').label, 'UAT');
check('detects LCS', SL.guessEnvironment('https://lcs.dynamics.com/').label, 'LCS');
check('detects a dev host', SL.guessEnvironment('https://dev.contoso.com/').label, 'DEV');

/* ------------------------------------------------------------------ *
 * Import validation
 * ------------------------------------------------------------------ */

check('rejects a non-JSON file', SL.validateImport('not json').ok, false);
check('rejects a JSON file that is not ours', SL.validateImport('{"kind":"something-else"}').ok, false);
check('rejects an export from a newer version',
  SL.validateImport(JSON.stringify({ kind: SL.EXPORT_KIND, version: 99 })).ok, false);

const goodExport = JSON.stringify({
  kind: SL.EXPORT_KIND,
  version: 1,
  groups: [{ id: 'g1', name: 'UAT', style: { background: '#e65100' } }],
  sites: [
    { id: 's1', label: 'UAT', pattern: { type: 'origin', value: 'https://uat.contoso.com' }, groupId: 'g1' },
    { id: 's2', label: 'BAD', pattern: { type: 'origin', value: 'file:///etc/passwd' } },
    { id: 's3', label: 'BAD2', pattern: { type: 'nonsense', value: 'x' } }
  ]
});
const report = SL.validateImport(goodExport);
check('accepts a well-formed export', report.ok, true);
check('keeps the valid site only', report.sites.length, 1);
check('counts the unusable entries', report.skipped, 2);
check('keeps the group', report.groups.length, 1);

const hostile = JSON.stringify({
  kind: SL.EXPORT_KIND,
  version: 1,
  groups: [],
  sites: [{
    label: '<img src=x onerror=alert(1)>',
    pattern: { type: 'origin', value: 'https://x.com' },
    style: { background: 'url(javascript:alert(1))', displayMode: '../../evil', fontSize: 1e9 },
    evilExtraField: 'dropped'
  }]
});
const hostileReport = SL.validateImport(hostile);
const imported = hostileReport.sites[0];
check('an import cannot smuggle in a colour', imported.style.background, undefined);
check('an import cannot smuggle in a display mode', imported.style.displayMode, undefined);
check('unknown fields are dropped', imported.evilExtraField, undefined);
check('label text survives as inert text', imported.label, '<img src=x onerror=alert(1)>');

/* ------------------------------------------------------------------ *
 * Style overrides: valid keys are kept, invalid ones fall through to the
 * group rather than turning into a default.
 * ------------------------------------------------------------------ */

check('a valid override is kept',
  SL.normalizeStyleOverride({ background: '#123456' }), { background: '#123456' });
check('an override of a boolean is kept',
  SL.normalizeStyleOverride({ bold: false }), { bold: false });
check('an override matching the default is still kept',
  SL.normalizeStyleOverride({ background: SL.DEFAULT_STYLE.background }),
  { background: SL.DEFAULT_STYLE.background });
check('an out-of-range number clamps into range',
  SL.normalizeStyleOverride({ fontSize: 9999 }), { fontSize: 32 });
check('a non-numeric size is dropped entirely',
  SL.normalizeStyleOverride({ fontSize: 'huge' }), {});
check('absent keys stay absent', SL.normalizeStyleOverride({}), {});

const groupStyle = SL.normalizeStyle({ background: '#e65100', displayMode: 'bar-top' });
const child = SL.normalizeSite({
  label: 'X',
  pattern: { type: 'origin', value: 'https://x.com' },
  style: { background: 'nonsense' }
});
check('a rejected override lets the group colour through',
  SL.resolveStyle(child, { style: groupStyle }).background, '#e65100');

/* ------------------------------------------------------------------ *
 * styleOverrideAgainst: what a site stores relative to its group
 * ------------------------------------------------------------------ */

const grp = { style: SL.normalizeStyle({ background: '#e65100', displayMode: 'bar-top' }) };
check('keys equal to the group are not stored',
  SL.styleOverrideAgainst(grp.style, grp), {});
check('only the differing key is stored',
  SL.styleOverrideAgainst(Object.assign({}, grp.style, { background: '#123456' }), grp),
  { background: '#123456' });
check('with no group the whole style is stored',
  Object.keys(SL.styleOverrideAgainst(SL.DEFAULT_STYLE, null)).length,
  Object.keys(SL.DEFAULT_STYLE).length);

/* ------------------------------------------------------------------ *
 * Merge on import
 * ------------------------------------------------------------------ */

const state = SL.emptyState();
SL.applyImport(state, SL.validateImport(goodExport), 'merge');
check('merge adds the group', state.groups.length, 1);
check('merge adds the site', state.sites.length, 1);
SL.applyImport(state, SL.validateImport(goodExport), 'merge');
check('importing the same file twice does not duplicate groups', state.groups.length, 1);
check('importing the same file twice does not duplicate sites', state.sites.length, 1);

/* ------------------------------------------------------------------ *
 * New style fields
 * ------------------------------------------------------------------ */

check('scale defaults to 1', SL.normalizeStyle({}).scale, 1);
check('scale clamps at the top', SL.normalizeStyle({ scale: 99 }).scale, 3);
check('scale clamps at the bottom', SL.normalizeStyle({ scale: 0.01 }).scale, 0.5);
check('labels are locked by default', SL.normalizeStyle({}).locked, true);
check('no position means -1', SL.normalizeStyle({}).posX, -1);
check('a dragged position survives', SL.normalizeStyle({ posX: 0.25, posY: 0.8 }).posY, 0.8);
check('an out-of-range position clamps', SL.normalizeStyle({ posX: 5 }).posX, 1);
check('hasCustomPosition is false by default',
  SL.hasCustomPosition(SL.normalizeStyle({})), false);
check('hasCustomPosition is true once dragged',
  SL.hasCustomPosition(SL.normalizeStyle({ posX: 0.2, posY: 0.3 })), true);
check('a frame cannot be dragged', SL.isDraggableMode('frame'), false);
check('a ribbon can be dragged', SL.isDraggableMode('ribbon-top-right'), true);

/* ------------------------------------------------------------------ *
 * Buddy characters
 * ------------------------------------------------------------------ */

check('there are ten characters', SL.BUDDIES.length, 10);
check('character ids are unique', new Set(SL.BUDDY_IDS).size, SL.BUDDIES.length);
check('every character is fully described',
  SL.BUDDIES.every((b) => b.id && b.name && b.blurb && b.kind && b.hand && b.trick), true);
check('drawn characters bring their own artwork',
  SL.BUDDIES.filter((b) => b.kind === 'shapes')
    .every((b) => Array.isArray(b.shapes) && b.shapes.length > 0), true);
check('the bust character brings a palette and accessories',
  SL.BUDDIES.filter((b) => b.kind === 'bust')
    .every((b) => b.skin && b.accent && Array.isArray(b.extras)), true);
check('every character declares a known kind',
  SL.BUDDIES.every((b) => b.kind === 'shapes' || b.kind === 'bust'), true);
// Lines are dormant while speech bubbles are off, but they are kept ready.
check('every character has lines held in reserve',
  SL.BUDDIES.every((b) => Array.isArray(b.lines) && b.lines.length >= 3), true);

['cat', 'bee', 'bunny', 'cone', 'plant'].forEach((id) => {
  check(id + ' is in the cast', SL.BUDDY_IDS.indexOf(id) !== -1, true);
});
check('Mochi the Bunny is present', SL.buddyById('bunny').name, 'Mochi the Bunny');
check('Biscuit the Office Cat is present', SL.buddyById('cat').name, 'Biscuit the Office Cat');
check('Bumble the Bee is present', SL.buddyById('bee').name, 'Bumble the Bee');

check('a trick is defined for every character',
  SL.BUDDIES.every((b) => b.trick && SL.TRICK_NAMES[b.trick]), true);
check('every character has its own trick',
  new Set(SL.BUDDIES.map((b) => b.trick)).size, SL.BUDDIES.length);
check('the trick lookup falls back safely', typeof SL.buddyTrick('nope'), 'string');

check('buddy is a known character after normalising',
  SL.normalizeStyle({ buddy: 'bunny' }).buddy, 'bunny');
check('an unknown buddy falls back to the default',
  SL.normalizeStyle({ buddy: '../evil' }).buddy, SL.DEFAULT_STYLE.buddy);
check('tricks are on by default', SL.normalizeStyle({}).buddyTricks, true);
check('the interval clamps at the fast end',
  SL.normalizeStyle({ buddyInterval: 1 }).buddyInterval, 5);
check('five seconds is allowed',
  SL.normalizeStyle({ buddyInterval: 5 }).buddyInterval, 5);
check('the interval clamps at the slow end',
  SL.normalizeStyle({ buddyInterval: 99999 }).buddyInterval, 900);
check('a rubbish interval falls back',
  SL.normalizeStyle({ buddyInterval: 'often' }).buddyInterval, 120);
check('the old chatter flag migrates to tricks',
  SL.normalizeStyle({ buddyChatter: false }).buddyTricks, false);
check('buddy is a real display mode', SL.DISPLAY_MODE_IDS.indexOf('buddy') !== -1, true);
check('a buddy can be dragged', SL.isDraggableMode('buddy'), true);

check('every hand colour is usable',
  SL.BUDDIES.every((b) => SL.sanitizeColor(SL.buddyHandColor(b.id), null) !== null), true);
check('the hand colour helper falls back safely',
  SL.sanitizeColor(SL.buddyHandColor('nope'), null) !== null, true);

/* ------------------------------------------------------------------ *
 * Characters matched to environments
 * ------------------------------------------------------------------ */

check('Production gets the safety cone', SL.buddyForEnvironment('PRODUCTION'), 'cone');
check('UAT gets the penguin', SL.buddyForEnvironment('UAT'), 'penguin');
check('Test gets the bunny', SL.buddyForEnvironment('TEST'), 'bunny');
check('SIT gets the bunny too', SL.buddyForEnvironment('SIT'), 'bunny');
check('Dev gets the bee', SL.buddyForEnvironment('DEV'), 'bee');
check('a sandbox gets the jellyfish', SL.buddyForEnvironment('SANDBOX'), 'jellyfish');
check('training gets the plant', SL.buddyForEnvironment('TRAINING'), 'plant');
check('local gets the moon', SL.buddyForEnvironment('LOCAL'), 'moon');
check('the mapping is case-insensitive', SL.buddyForEnvironment('production'), 'cone');
check('an unknown environment falls back to the default',
  SL.buddyForEnvironment('WHATEVER'), SL.DEFAULT_BUDDY);
check('every mapped character actually exists',
  Object.keys(SL.BUDDY_FOR_ENV).every((k) => SL.BUDDY_IDS.indexOf(SL.BUDDY_FOR_ENV[k]) !== -1), true);

check('a production host suggests the cone',
  SL.guessEnvironment('https://contoso.operations.dynamics.com/').buddy, 'cone');
check('a UAT host suggests the penguin',
  SL.guessEnvironment('https://contoso-uat.contoso.com/').buddy, 'penguin');
check('a test host suggests the bunny',
  SL.guessEnvironment('https://test.contoso.com/').buddy, 'bunny');
check('an unrecognised host still suggests something',
  SL.BUDDY_IDS.indexOf(SL.guessEnvironment('https://example.com/').buddy) !== -1, true);

/* ------------------------------------------------------------------ *
 * Meme-inspired styles
 * ------------------------------------------------------------------ */

check('there are five meme styles', SL.MEME_MODES.length, 5);
check('every meme style is a real display mode',
  SL.MEME_MODES.every((m) => SL.DISPLAY_MODE_IDS.indexOf(m) !== -1), true);
check('meme styles are grouped together',
  SL.DISPLAY_MODES.filter((m) => m.group === 'Meme').length, 5);
check('meme styles survive normalising',
  SL.MEME_MODES.every((m) => SL.normalizeStyle({ displayMode: m }).displayMode === m), true);
check('meme styles can be dragged',
  SL.MEME_MODES.every((m) => SL.isDraggableMode(m)), true);
check('isMemeMode recognises them', SL.isMemeMode('meme-hazard'), true);
check('isMemeMode rejects other modes', SL.isMemeMode('ribbon-top-right'), false);

// Each format is matched to the environment its tone suits.
check('Production gets the caution tape', SL.memeForEnvironment('PRODUCTION'), 'meme-hazard');
check('UAT gets the approval stamp', SL.memeForEnvironment('UAT'), 'meme-stamp');
check('Test gets the glitch', SL.memeForEnvironment('TEST'), 'meme-glitch');
check('SIT gets the glitch too', SL.memeForEnvironment('SIT'), 'meme-glitch');
check('Dev gets the terminal', SL.memeForEnvironment('DEV'), 'meme-terminal');
check('Local gets the terminal too', SL.memeForEnvironment('LOCAL'), 'meme-terminal');
check('a sandbox gets the Impact caption', SL.memeForEnvironment('SANDBOX'), 'meme-impact');
check('the meme mapping is case-insensitive',
  SL.memeForEnvironment('production'), 'meme-hazard');
check('an unknown environment falls back to the caption',
  SL.memeForEnvironment('WHATEVER'), 'meme-impact');
check('every mapped meme style exists',
  Object.keys(SL.MEME_FOR_ENV).every((k) => SL.MEME_MODES.indexOf(SL.MEME_FOR_ENV[k]) !== -1), true);

/* These borrow typography and layout, never the meme photographs themselves -
 * those are copyrighted images, usually of real people. No style may reference
 * an external image. */
const rendererSource = fs.readFileSync(path.join(root, 'src/content/label.js'), 'utf8');
check('no meme style pulls in an external image',
  /url\(\s*['"]?https?:/.test(rendererSource), false);

/* ------------------------------------------------------------------ *
 * Ribbon geometry
 *
 * The band is centred with a transform rather than offset with top/left. An
 * earlier version used offsets, which put the band off the corner diagonal and
 * made its position drift with the text size. Guard the fix at source, since
 * the geometry itself can only be measured in a browser.
 * ------------------------------------------------------------------ */

check('all four ribbon corners exist',
  ['ribbon-top-left', 'ribbon-top-right', 'ribbon-bottom-left', 'ribbon-bottom-right']
    .every((m) => SL.DISPLAY_MODE_IDS.indexOf(m) !== -1), true);
check('the ribbon band is centred with a transform',
  /\.sl-ribbon\.tl > \.sl-inner \{\s*\n?\s*transform: translate\(-50%,-50%\)/.test(rendererSource), true);
check('all four corners take an equal diagonal offset',
  (rendererSource.match(/translate\(-50%,-50%\) translate\(/g) || []).length, 4);
check('the corner offset comes from the ribbon size',
  /--sl-off: calc\(var\(--sl-rb\) \* \.19\)/.test(rendererSource), true);
check('the ribbon box is responsive',
  /--sl-rb:\s*\$\{resp\(158/.test(rendererSource), true);

/* ------------------------------------------------------------------ *
 * Glow colours and the theme setting
 * ------------------------------------------------------------------ */

const redGlow = SL.glowColors('#c62828');
check('the glow yields three distinct colours',
  new Set([redGlow.a, redGlow.b, redGlow.c]).size, 3);
check('every glow colour is a usable hex',
  Object.keys(redGlow).every((k) => SL.sanitizeColor(redGlow[k], null) !== null), true);
// A red label glowing pink was the bug that prompted the tuning; the glow has
// to stay in the label's own colour family.
check('a red label glows red, not pink',
  redGlow.b.slice(1, 3) > redGlow.b.slice(3, 5) && redGlow.b.slice(1, 3) > redGlow.b.slice(5, 7), true);
check('a blue label glows blue',
  (function () { const g = SL.glowColors('#1565c0'); return g.b.slice(5, 7) > g.b.slice(1, 3); })(), true);
check('a green label glows green',
  (function () { const g = SL.glowColors('#2e7d32'); return g.b.slice(3, 5) > g.b.slice(1, 3); })(), true);
check('hue rotation is stable for grey',
  SL.sanitizeColor(SL.hueShift('#808080', 40, 0.1), null) !== null, true);

check('theme defaults to following the browser', SL.normalizeSettings({}).theme, 'auto');
check('an explicit theme is kept', SL.normalizeSettings({ theme: 'dark' }).theme, 'dark');
check('an unknown theme falls back to auto', SL.normalizeSettings({ theme: 'neon' }).theme, 'auto');

/* ------------------------------------------------------------------ *
 * Display modes
 * ------------------------------------------------------------------ */

check('every mode has a label and a group',
  SL.DISPLAY_MODES.every((m) => m.id && m.label && m.group), true);
check('mode ids are unique',
  new Set(SL.DISPLAY_MODE_IDS).size, SL.DISPLAY_MODE_IDS.length);

['edge-top', 'edge-bottom', 'side-left', 'side-right', 'corners',
 'pill-top-center', 'pill-bottom-center'].forEach((id) => {
  check(id + ' is a known mode', SL.DISPLAY_MODE_IDS.indexOf(id) !== -1, true);
  check(id + ' survives normalising', SL.normalizeStyle({ displayMode: id }).displayMode, id);
  check(id + ' can be dragged', SL.isDraggableMode(id), true);
});

check('a border frame still cannot be dragged', SL.isDraggableMode('frame'), false);
check('corner brackets can be dragged by their tag', SL.isDraggableMode('corners'), true);

/* ------------------------------------------------------------------ *
 * Transparency: stored as opacity, shown as its inverse
 * ------------------------------------------------------------------ */

check('a solid label is 0% transparent', SL.opacityToTransparency(1), 0);
check('the default reads as 8% transparent', SL.opacityToTransparency(0.92), 8);
check('half opacity reads as 50% transparent', SL.opacityToTransparency(0.5), 50);
check('0% transparency is fully solid', SL.transparencyToOpacity(0), 1);
check('50% transparency is half opacity', SL.transparencyToOpacity(50), 0.5);
check('85% transparency hits the floor', SL.transparencyToOpacity(85), 0.15);
check('transparency beyond the floor still clamps', SL.transparencyToOpacity(200), 0.15);
check('transparency round-trips', SL.opacityToTransparency(SL.transparencyToOpacity(35)), 35);
check('opacity below the floor clamps on normalise',
  SL.normalizeStyle({ opacity: 0.01 }).opacity, 0.15);

/* ------------------------------------------------------------------ *
 * Glow
 * ------------------------------------------------------------------ */

check('glow is off by default', SL.normalizeStyle({}).glow, false);
check('glow speed defaults to 4', SL.normalizeStyle({}).glowSpeed, 4);
check('glow speed clamps high', SL.normalizeStyle({ glowSpeed: 500 }).glowSpeed, 10);
check('glow speed clamps low', SL.normalizeStyle({ glowSpeed: 0 }).glowSpeed, 1);
check('a non-numeric glow speed falls back', SL.normalizeStyle({ glowSpeed: 'fast' }).glowSpeed, 4);
check('speed 1 is a 12 second drift', SL.glowDuration({ glowSpeed: 1 }), 12);
check('speed 4 is a 3 second pass', SL.glowDuration({ glowSpeed: 4 }), 3);
check('speed 10 is the quickest sweep', SL.glowDuration({ glowSpeed: 10 }), 1.2);
check('a missing speed still yields a duration', SL.glowDuration({}), 3);
check('glow survives as an override', SL.normalizeStyleOverride({ glow: true }), { glow: true });
check('a rubbish glow flag is dropped', SL.normalizeStyleOverride({ glow: 'yes' }), {});

/* ------------------------------------------------------------------ *
 * Colours: gold preset and the user's own palette
 * ------------------------------------------------------------------ */

check('gold is a preset',
  !!SL.COLOR_PRESETS.find((p) => p.id === 'gold'), true);
check('presets all carry a valid colour',
  SL.COLOR_PRESETS.every((p) => SL.sanitizeColor(p.background, null) === p.background), true);

check('custom colours are kept',
  SL.normalizeCustomColors([{ background: '#ABCDEF', textColor: '#000000' }]),
  [{ background: '#abcdef', textColor: '#000000' }]);
check('a bad custom colour is dropped',
  SL.normalizeCustomColors([{ background: 'url(x)', textColor: '#000' }]), []);
check('duplicate custom colours collapse',
  SL.normalizeCustomColors([
    { background: '#111111', textColor: '#ffffff' },
    { background: '#111111', textColor: '#ffffff' }
  ]).length, 1);
check('the palette is capped',
  SL.normalizeCustomColors(
    Array.from({ length: 100 }, (_, i) => ({
      background: '#' + i.toString(16).padStart(6, '0'),
      textColor: '#ffffff'
    }))
  ).length, SL.MAX_CUSTOM_COLORS);
check('allSwatches appends the custom colours',
  SL.allSwatches({ customColors: [{ background: '#123456', textColor: '#ffffff' }] }).length,
  SL.COLOR_PRESETS.length + 1);

/* ------------------------------------------------------------------ *
 * Upgrading from 1.0.0: existing data must come through untouched and
 * simply pick up defaults for the fields that did not exist yet.
 * ------------------------------------------------------------------ */

const legacyState = {
  settings: {
    enabled: true, titlePrefix: true, badgeOnIcon: false,
    hideOnFullscreen: true, schemaVersion: 1
  },
  groups: [{
    id: 'grp-legacy', name: 'UAT',
    style: {
      displayMode: 'bar-top', background: '#e65100', textColor: '#ffffff',
      opacity: 0.92, fontSize: 13, bold: true, uppercase: true, stripes: false,
      pushContent: true, clickToDismiss: false, showUrlHost: false,
      frameWidth: 6, barHeight: 26
    }
  }],
  sites: [{
    id: 'site-legacy', label: 'UAT PAYROLL',
    pattern: { type: 'prefix', value: 'https://uat.contoso.com/payroll' },
    groupId: 'grp-legacy', style: { background: '#123456' },
    enabled: true, createdAt: 1700000000000
  }]
};

const upgraded = SL.normalizeState(legacyState);
check('upgrade keeps the site', upgraded.sites.length, 1);
check('upgrade keeps the site id', upgraded.sites[0].id, 'site-legacy');
check('upgrade keeps the label text', upgraded.sites[0].label, 'UAT PAYROLL');
check('upgrade keeps the pattern', upgraded.sites[0].pattern.value, 'https://uat.contoso.com/payroll');
check('upgrade keeps createdAt', upgraded.sites[0].createdAt, 1700000000000);
check('upgrade keeps the group link', upgraded.sites[0].groupId, 'grp-legacy');
check('upgrade keeps the colour override', upgraded.sites[0].style.background, '#123456');
check('upgrade keeps the group', upgraded.groups[0].name, 'UAT');
check('upgrade keeps the group styling', upgraded.groups[0].style.pushContent, true);
check('upgrade keeps a non-default setting', upgraded.settings.titlePrefix, true);
check('upgrade keeps badgeOnIcon off', upgraded.settings.badgeOnIcon, false);
check('upgrade adds the new size default', upgraded.groups[0].style.scale, 1);
check('upgrade adds the new lock default', upgraded.groups[0].style.locked, true);
check('upgrade leaves glow off', upgraded.groups[0].style.glow, false);
check('upgrade adds a glow speed default', upgraded.groups[0].style.glowSpeed, 4);
check('upgrade preserves the old opacity exactly', upgraded.groups[0].style.opacity, 0.92);
check('upgrade adds an empty palette', upgraded.settings.customColors, []);
check('upgrade leaves the old site unpositioned',
  SL.hasCustomPosition(SL.resolveStyle(upgraded.sites[0], upgraded.groups[0])), false);
check('upgrade still resolves the inherited style',
  SL.resolveStyle(upgraded.sites[0], upgraded.groups[0]).displayMode, 'bar-top');

/* ------------------------------------------------------------------ *
 * Permission wording
 * ------------------------------------------------------------------ */

check('every permission is explained',
  SL.PERMISSIONS.every((p) => p.name && p.allows && p.used), true);
check('only site access is prompted for',
  SL.PERMISSIONS.filter((p) => p.prompted).map((p) => p.id), ['host']);

check('a single host is named as Edge names it',
  SL.edgePromptText(['https://uat.contoso.com/*']),
  'Read and change your data on uat.contoso.com');
check('a subdomain wildcard is described as all sites',
  SL.edgePromptText(['*://*.contoso.com/*']),
  'Read and change your data on all contoso.com sites');
check('duplicate phrases collapse',
  SL.edgePromptText(['https://a.com/*', 'https://a.com/*']),
  'Read and change your data on a.com');
check('no patterns means no prompt text', SL.edgePromptText([]), '');

check('a subdomain grant does not stutter the apex',
  SL.edgePromptText(['*://contoso.com/*', '*://*.contoso.com/*']),
  'Read and change your data on all contoso.com sites');

check('the origin scope says it is limited',
  SL.scopeSentence({ type: 'origin', value: 'https://uat.contoso.com' }).indexOf('Nothing else') !== -1,
  true);
check('the subdomain scope warns it is the widest',
  SL.scopeSentence({ type: 'host-suffix', value: 'contoso.com' }).indexOf('widest') !== -1,
  true);
check('the prefix scope is honest that the grant is site-wide',
  SL.scopeSentence({ type: 'prefix', value: 'https://a.com/x' }).indexOf('by site rather than by folder') !== -1,
  true);
check('no scope sentence repeats the pattern value',
  SL.scopeSentence({ type: 'origin', value: 'https://uat.contoso.com' }).indexOf('contoso') === -1,
  true);

/* ------------------------------------------------------------------ *
 * The trust claims have to stay true: the shipped code must contain no
 * way to reach the network, and no HTML-parsing sink.
 * ------------------------------------------------------------------ */

const SHIPPED = [
  'src/common/schema.js', 'src/common/matcher.js', 'src/common/storage.js',
  'src/common/preview.js', 'src/common/consent.js', 'src/common/buddies.js',
  'src/content/label.js',
  'src/background/service-worker.js', 'src/popup/popup.js', 'src/options/options.js'
];

const BANNED = [
  [/\bfetch\s*\(/, 'fetch()'],
  [/XMLHttpRequest/, 'XMLHttpRequest'],
  [/\bWebSocket\b/, 'WebSocket'],
  [/EventSource/, 'EventSource'],
  [/sendBeacon/, 'sendBeacon'],
  [/\beval\s*\(/, 'eval()'],
  [/new\s+Function\s*\(/, 'new Function()'],
  [/\.innerHTML\s*=/, 'innerHTML assignment'],
  [/insertAdjacentHTML/, 'insertAdjacentHTML'],
  [/document\.write/, 'document.write'],
  [/chrome\.downloads/, 'chrome.downloads'],
  [/chrome\.cookies/, 'chrome.cookies'],
  [/chrome\.history/, 'chrome.history']
];

SHIPPED.forEach((file) => {
  // Comments are stripped first, so a comment mentioning innerHTML is fine.
  const code = fs.readFileSync(path.join(root, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  BANNED.forEach((entry) => {
    check('no ' + entry[1] + ' in ' + file, entry[0].test(code), false);
  });
});

/* ------------------------------------------------------------------ *
 * Module wiring.
 *
 * A shared module that is added to src/common but not loaded in every
 * context fails at runtime, not at build time - the content script throws
 * mid-render and the label vanishes. These checks catch that on the bench
 * instead of in somebody's browser.
 * ------------------------------------------------------------------ */

const swSource = fs.readFileSync(path.join(root, 'src/background/service-worker.js'), 'utf8');
const popupHtml = fs.readFileSync(path.join(root, 'src/popup/popup.html'), 'utf8');
const optionsHtml = fs.readFileSync(path.join(root, 'src/options/options.html'), 'utf8');
const packageSource = fs.readFileSync(path.join(root, 'tools/package.py'), 'utf8');
const labelSource = fs.readFileSync(path.join(root, 'src/content/label.js'), 'utf8');

// Modules the on-page renderer relies on must travel with it.
const CONTENT_DEPS = ['buddies.js', 'schema.js', 'matcher.js', 'storage.js'];
const contentBlock = swSource.slice(
  swSource.indexOf('const CONTENT_FILES'),
  swSource.indexOf(']', swSource.indexOf('const CONTENT_FILES'))
);
CONTENT_DEPS.forEach((file) => {
  check(file + ' is injected with the content script', contentBlock.indexOf(file) !== -1, true);
  check(file + ' is imported by the service worker',
    swSource.slice(0, swSource.indexOf('const SL')).indexOf(file) !== -1, true);
  check(file + ' is loaded by the popup', popupHtml.indexOf(file) !== -1, true);
  check(file + ' is loaded by the options page', optionsHtml.indexOf(file) !== -1, true);
  check(file + ' is in the packaged file list', packageSource.indexOf(file) !== -1, true);
});

// The renderer must not hard-depend on a helper that can be absent.
check('the buddy renderer checks the character module is present',
  /typeof SL\.buildBuddySvg === 'function'/.test(labelSource), true);
check('a failed layer build falls back rather than blanking the label',
  labelSource.indexOf('buildFallbackLayer') !== -1 &&
  /catch \(err\) \{\s*built = buildFallbackLayer/.test(labelSource), true);

/* ------------------------------------------------------------------ */

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
