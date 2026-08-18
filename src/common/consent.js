/*
 * Site Label - permission wording, in one place.
 *
 * The browser's own permission dialog cannot be reworded: Edge always says
 * "Read and change your data on <site>", because that is the only phrasing it
 * has for host access. That sentence describes the ceiling of what the
 * permission could allow, not what this extension does with it.
 *
 * So the honest thing is to say, immediately before the prompt appears, what
 * is about to be asked, what it is used for, and what it is not used for -
 * and to word it identically everywhere. Hence this module.
 */
(function (root) {
  'use strict';

  const SL = (root.SL = root.SL || {});

  /* ------------------------------------------------------------------ *
   * The fixed permission set, for the options page
   * ------------------------------------------------------------------ */

  SL.PERMISSIONS = [
    {
      id: 'storage',
      name: 'Storage',
      allows: 'Save data on this computer.',
      used: 'Keeps your labels, groups, colours and settings. This is the only place Site Label stores anything, and it never leaves your browser.',
      prompted: false
    },
    {
      id: 'scripting',
      name: 'Scripting',
      allows: 'Run a script on pages the extension already has access to.',
      used: 'Draws the label on the sites you have added. It cannot reach any site you have not granted access to.',
      prompted: false
    },
    {
      id: 'activeTab',
      name: 'Active tab',
      allows: 'See the current tab’s address - only at the moment you click the toolbar icon.',
      used: 'Lets the popup show which site you are on and suggest a label and scope for it. It gives no access at all until you click the icon, and none afterwards.',
      prompted: false
    },
    {
      id: 'contextMenus',
      name: 'Context menu',
      allows: 'Add an item to the right-click menu.',
      used: 'Adds one entry, "Label this site with Site Label", as a shortcut to the same thing the popup does.',
      prompted: false
    },
    {
      id: 'host',
      name: 'Access to specific sites',
      allows: 'Read and change data on a site.',
      used: 'Draws the label on that one site. Requested per site, at the moment you add it, and never held in advance - Site Label installs with access to nothing.',
      prompted: true
    }
  ];

  /* ------------------------------------------------------------------ *
   * Turning match patterns into the words the user is about to read
   * ------------------------------------------------------------------ */

  /** The host phrase Edge itself uses in the prompt, for a match pattern. */
  SL.hostPhrase = function hostPhrase(pattern) {
    const match = /^(\*|https?):\/\/([^/]+)\//.exec(String(pattern || ''));
    if (!match) return String(pattern || '');
    const host = match[2];
    if (host.indexOf('*.') === 0) return 'all ' + host.slice(2) + ' sites';
    return host;
  };

  /**
   * Our best rendering of what Edge is about to say. Deliberately hedged with
   * "something like", because the exact string is the browser's to choose and
   * changes between versions.
   */
  SL.edgePromptText = function edgePromptText(patterns) {
    let phrases = [];
    (patterns || []).forEach((pattern) => {
      const phrase = SL.hostPhrase(pattern);
      if (phrases.indexOf(phrase) === -1) phrases.push(phrase);
    });
    if (!phrases.length) return '';

    // A subdomain grant produces both "contoso.com" and "all contoso.com
    // sites"; the second already covers the first, and listing both reads
    // like a stutter.
    const covered = phrases
      .filter((p) => p.indexOf('all ') === 0)
      .map((p) => p.slice(4).replace(/ sites$/, ''));
    if (covered.length) {
      phrases = phrases.filter((p) => p.indexOf('all ') === 0 || covered.indexOf(p) === -1);
    }

    return 'Read and change your data on ' + phrases.join(' and ');
  };

  /**
   * How far the access reaches. The pattern itself is printed alongside this,
   * so the wording does not repeat it.
   */
  SL.scopeSentence = function scopeSentence(pattern) {
    if (!pattern) return '';
    switch (pattern.type) {
      case 'origin':
        return 'this exact site and every page under it. Nothing else — not other subdomains, not the http version, not another port.';
      case 'host':
        return 'this one host, over http and https, on any port. No other host.';
      case 'host-suffix':
        return 'this domain and every subdomain of it. This is the widest of the options — if you only need one environment, choose “This site” instead.';
      case 'prefix':
        return 'the label appears only on pages beneath this path. Be aware that browsers grant access by site rather than by folder, so the permission itself still covers the whole site — this option narrows where the label shows, not what is granted.';
      case 'wildcard':
        return 'hosts matching this pattern. Edge cannot express the pattern exactly, so it grants the closest whole-subdomain equivalent shown above.';
      default:
        return '';
    }
  };

  /* ------------------------------------------------------------------ *
   * The explainer, built as DOM so nothing is ever parsed as HTML
   * ------------------------------------------------------------------ */

  function addRow(list, term, detail) {
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');
    dd.textContent = detail;
    list.appendChild(dt);
    list.appendChild(dd);
  }

  /**
   * Render the pre-prompt explainer into `container`.
   *
   * @param container element to fill
   * @param pattern   the saved-pattern object being granted
   * @param options   { compact: true } wraps the detail in a disclosure so it
   *                  fits the popup; false shows it all, for the options page.
   */
  SL.renderConsent = function renderConsent(container, pattern, options) {
    if (!container) return;
    container.textContent = '';

    const compact = !(options && options.compact === false);
    const matchPatterns = SL.patternToMatchPatterns(pattern);
    const prompt = SL.edgePromptText(matchPatterns);

    const head = document.createElement('p');
    head.className = 'consent-head';
    head.textContent = 'Edge will now ask your permission for this site.';
    container.appendChild(head);

    const summary = document.createElement('p');
    summary.className = 'consent-summary';
    summary.textContent = prompt
      ? 'It will word that as “' + prompt + '”.'
      : 'It will ask for access to this site.';
    container.appendChild(summary);

    const list = document.createElement('dl');
    list.className = 'consent-list';

    addRow(list, 'Why it sounds broad',
      'That sentence is the only wording Edge has for site access. It states what the ' +
      'permission could allow, not what Site Label does with it. Edge cannot be asked to ' +
      'phrase it more narrowly.');

    addRow(list, 'Exactly what is granted',
      matchPatterns.join(', ') + ' — ' + SL.scopeSentence(pattern));

    addRow(list, 'What Site Label does with it',
      'Two things. It adds one element to the page to draw your label, and it reads the ' +
      'page’s address to work out whether a label applies to it.');

    addRow(list, 'What it does not do',
      'It does not read or change the page’s content, text, form fields, passwords or ' +
      'cookies, and it does not touch any other site. The label is drawn in a closed shadow ' +
      'root, so the page cannot interfere with it either.');

    addRow(list, 'Nothing is sent anywhere',
      'Site Label contains no networking code at all — no requests, no analytics, no ' +
      'tracking, no remote scripts. Everything stays in this browser. Your labels leave only ' +
      'if you export them to a file yourself.');

    addRow(list, 'How to undo it',
      'Delete the label and the access is handed back automatically. You can also withdraw ' +
      'it per site under Settings, or at edge://extensions, at any time.');

    if (compact) {
      const details = document.createElement('details');
      details.className = 'consent-details';
      const trigger = document.createElement('summary');
      trigger.textContent = 'Exactly what can it access?';
      details.appendChild(trigger);
      details.appendChild(list);
      container.appendChild(details);
    } else {
      container.appendChild(list);
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
