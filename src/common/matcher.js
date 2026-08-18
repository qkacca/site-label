/*
 * Site Label - URL matching.
 *
 * A saved site stores a *base* pattern; every page underneath it keeps the
 * label. Five pattern types, from broadest to narrowest:
 *
 *   host-suffix  contoso.com                     -> contoso.com and *.contoso.com, any scheme
 *   host         uat.contoso.com                 -> that host, any scheme/port
 *   origin       https://uat.contoso.com         -> that scheme+host+port, all paths   (default)
 *   prefix       https://contoso.com/tenant-a    -> URLs starting with this
 *   wildcard     https://*-uat.contoso.com/*     -> glob, * only
 *
 * When several saved sites match one URL the most specific wins.
 */
(function (root) {
  'use strict';

  const SL = (root.SL = root.SL || {});

  SL.PATTERN_TYPES = ['origin', 'host', 'host-suffix', 'prefix', 'wildcard'];

  /** Only ordinary web pages are ever labelled. */
  SL.ALLOWED_SCHEMES = ['http:', 'https:'];

  const HOST_RE = /^[a-z0-9.-]+(:\d{1,5})?$/i;
  const WILDCARD_HOST_RE = /^[a-z0-9.*-]+(:\d{1,5})?$/i;

  /* ------------------------------------------------------------------ *
   * URL parsing
   * ------------------------------------------------------------------ */

  SL.parseUrl = function parseUrl(url) {
    if (typeof url !== 'string' || url.length > 4096) return null;
    let u;
    try {
      u = new URL(url);
    } catch (err) {
      return null;
    }
    if (SL.ALLOWED_SCHEMES.indexOf(u.protocol) === -1) return null;
    return {
      href: u.href,
      protocol: u.protocol,
      hostname: u.hostname.toLowerCase(),
      port: u.port,
      host: u.host.toLowerCase(),
      origin: u.protocol + '//' + u.host.toLowerCase(),
      pathname: u.pathname,
      // Matching ignores query and hash so that a D365 menu item
      // (?mi=...&cmp=...) does not break the match.
      base: u.protocol + '//' + u.host.toLowerCase() + u.pathname
    };
  };

  SL.isLabelableUrl = function isLabelableUrl(url) {
    return SL.parseUrl(url) !== null;
  };

  /* ------------------------------------------------------------------ *
   * Pattern normalisation
   * ------------------------------------------------------------------ */

  SL.normalizePattern = function normalizePattern(input) {
    if (!input || typeof input !== 'object') return null;
    const type = SL.oneOf(input.type, SL.PATTERN_TYPES, null);
    if (!type) return null;

    let value = typeof input.value === 'string' ? input.value.trim() : '';
    if (!value || value.length > 512) return null;

    switch (type) {
      case 'origin': {
        const parsed = SL.parseUrl(value);
        if (!parsed) return null;
        return { type: type, value: parsed.origin };
      }
      case 'host':
      case 'host-suffix': {
        const host = value.replace(/^\*\./, '').replace(/^[a-z]+:\/\//i, '').split('/')[0].toLowerCase();
        if (!host || !HOST_RE.test(host) || host.indexOf('..') !== -1) return null;
        return { type: type, value: host };
      }
      case 'prefix': {
        const parsed = SL.parseUrl(value);
        if (!parsed) return null;
        // Keep the path, drop query/hash, drop a trailing slash so that
        // ".../tenant-a" and ".../tenant-a/" behave the same.
        let base = parsed.base;
        if (base.length > 1 && base.charAt(base.length - 1) === '/') base = base.slice(0, -1);
        return { type: type, value: base };
      }
      case 'wildcard': {
        const norm = SL.normalizeWildcard(value);
        return norm ? { type: type, value: norm } : null;
      }
      default:
        return null;
    }
  };

  /**
   * Wildcards must still describe an http/https URL, must not start with a
   * bare "*" (which would match every site on the web) and are capped at a
   * handful of stars so the generated regex stays cheap.
   */
  SL.normalizeWildcard = function normalizeWildcard(value) {
    const raw = String(value).trim().toLowerCase();
    if (!raw || raw.length > 512) return null;
    if ((raw.match(/\*/g) || []).length > 6) return null;

    const m = /^(https?|\*):\/\/([^/]+)(\/.*)?$/.exec(raw);
    if (!m) return null;

    const host = m[2];
    if (!WILDCARD_HOST_RE.test(host)) return null;
    if (host === '*' || host === '*.') return null;
    // "*.contoso.com" is fine; "*contoso" or a lone TLD wildcard is not.
    if (host.indexOf('*') !== -1 && !/^\*\.[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) {
      if (!/^[a-z0-9-]*\*[a-z0-9-]*(\.[a-z0-9-]+)+$/.test(host)) return null;
    }
    const path = m[3] || '/*';
    return m[1] + '://' + host + path;
  };

  function globToRegExp(glob) {
    const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^]*');
    return new RegExp('^' + escaped + '$');
  }

  /* ------------------------------------------------------------------ *
   * Matching
   * ------------------------------------------------------------------ */

  SL.patternMatches = function patternMatches(pattern, parsed) {
    if (!pattern || !parsed) return false;
    switch (pattern.type) {
      case 'origin':
        return parsed.origin === pattern.value;
      case 'host':
        return parsed.hostname === pattern.value || parsed.host === pattern.value;
      case 'host-suffix':
        return (
          parsed.hostname === pattern.value ||
          parsed.hostname.endsWith('.' + pattern.value)
        );
      case 'prefix': {
        if (parsed.base === pattern.value) return true;
        // Boundary-aware so /tenant-a does not match /tenant-abc.
        return parsed.base.startsWith(pattern.value + '/');
      }
      case 'wildcard': {
        const glob = pattern.value.replace(/^\*:\/\//, parsed.protocol + '//');
        try {
          return globToRegExp(glob).test(parsed.base) || globToRegExp(glob).test(parsed.origin + '/');
        } catch (err) {
          return false;
        }
      }
      default:
        return false;
    }
  };

  /** Higher = more specific. Used to pick a winner among several matches. */
  SL.patternSpecificity = function patternSpecificity(pattern) {
    if (!pattern) return -1;
    const len = pattern.value.length;
    switch (pattern.type) {
      case 'prefix':
        return 4000 + len;
      case 'wildcard':
        return 3000 + len - (pattern.value.match(/\*/g) || []).length * 20;
      case 'origin':
        return 2000 + len;
      case 'host':
        return 1000 + len;
      case 'host-suffix':
        return 100 + len;
      default:
        return 0;
    }
  };

  /**
   * Best matching enabled site for a URL, or null.
   * Ties break towards the most recently created rule.
   */
  SL.findMatch = function findMatch(url, sites) {
    const parsed = SL.parseUrl(url);
    if (!parsed || !Array.isArray(sites)) return null;

    let best = null;
    let bestScore = -1;
    for (let i = 0; i < sites.length; i++) {
      const site = sites[i];
      if (!site || site.enabled === false) continue;
      if (!SL.patternMatches(site.pattern, parsed)) continue;
      const score = SL.patternSpecificity(site.pattern);
      if (score > bestScore || (score === bestScore && best && (site.createdAt || 0) > (best.createdAt || 0))) {
        best = site;
        bestScore = score;
      }
    }
    return best;
  };

  /* ------------------------------------------------------------------ *
   * Host permissions / content script registration
   * ------------------------------------------------------------------ */

  /**
   * Match patterns covering a saved pattern. Deliberately narrow: a site
   * saved as an origin only ever grants that origin.
   */
  SL.patternToMatchPatterns = function patternToMatchPatterns(pattern) {
    if (!pattern) return [];
    switch (pattern.type) {
      case 'origin':
        return [pattern.value + '/*'];
      case 'host':
        return ['*://' + pattern.value + '/*'];
      case 'host-suffix':
        return ['*://' + pattern.value + '/*', '*://*.' + pattern.value + '/*'];
      case 'prefix':
        return [pattern.value + '/*', pattern.value];
      case 'wildcard': {
        const v = pattern.value;
        // chrome match patterns only allow "*" as a whole-subdomain prefix,
        // so anything fancier falls back to the host's own origin.
        const m = /^(https?|\*):\/\/([^/]+)(\/.*)?$/.exec(v);
        if (!m) return [];
        const scheme = m[1] === '*' ? '*' : m[1];
        let host = m[2];
        if (host.indexOf('*') !== -1 && !/^\*\./.test(host)) {
          host = '*.' + host.replace(/^[^.]*\*[^.]*\./, '');
        }
        return [scheme + '://' + host + '/*'];
      }
      default:
        return [];
    }
  };

  SL.sitesToMatchPatterns = function sitesToMatchPatterns(sites) {
    const set = new Set();
    (sites || []).forEach((site) => {
      if (!site || site.enabled === false) return;
      SL.patternToMatchPatterns(site.pattern).forEach((p) => set.add(p));
    });
    return Array.from(set);
  };

  /* ------------------------------------------------------------------ *
   * Suggestions when adding the page you are on
   * ------------------------------------------------------------------ */

  /**
   * Environment guesses. Ordered - the first hit wins, and "prod" style
   * hosts are only assumed when nothing non-production matched, so that
   * "uat.prod-cluster.example" is treated as UAT rather than Production.
   */
  const ENV_RULES = [
    { re: /(^|[^a-z])(uat)([^a-z]|$)/, label: 'UAT', preset: 'orange' },
    { re: /(^|[^a-z])(preprod|pre-prod|staging|stage)([^a-z]|$)/, label: 'STAGING', preset: 'orange' },
    { re: /(^|[^a-z])(train|training)([^a-z]|$)/, label: 'TRAINING', preset: 'green' },
    { re: /(^|[^a-z])(dev|develop|development)([^a-z]|$)/, label: 'DEV', preset: 'blue' },
    { re: /(^|[^a-z])(test|tst|qa|sit)([^a-z]|$)/, label: 'TEST', preset: 'purple' },
    { re: /(^|[^a-z])(build|bld)([^a-z]|$)/, label: 'BUILD', preset: 'indigo' },
    { re: /(^|[^a-z])(demo)([^a-z]|$)/, label: 'DEMO', preset: 'teal' },
    { re: /(^|[^a-z])(sandbox|sbx)([^a-z]|$)/, label: 'SANDBOX', preset: 'teal' },
    { re: /(^|[^a-z])(local|localhost)([^a-z]|$)/, label: 'LOCAL', preset: 'slate' }
  ];

  /**
   * Dynamics 365 F&O / CE production hosts look like
   * "<name>.operations.dynamics.com" while every sandbox carries an extra
   * "sandbox" segment. LCS and Power Platform get their own hints.
   */
  function d365Hint(hostname) {
    if (/\.sandbox\.(operations|ax)\.dynamics\.com$/.test(hostname)) {
      return { label: 'SANDBOX', preset: 'teal', note: 'D365 F&O sandbox' };
    }
    if (/\.(operations|ax)\.dynamics\.com$/.test(hostname)) {
      return { label: 'PRODUCTION', preset: 'red', note: 'D365 F&O production' };
    }
    if (/^lcs\.dynamics\.com$/.test(hostname)) {
      return { label: 'LCS', preset: 'slate', note: 'Lifecycle Services' };
    }
    if (/\.crm\d*\.dynamics\.com$/.test(hostname)) {
      return { label: 'DATAVERSE', preset: 'indigo', note: 'Dataverse / D365 CE' };
    }
    return null;
  }

  SL.guessEnvironment = function guessEnvironment(url) {
    const parsed = SL.parseUrl(url);
    if (!parsed) return { label: '', preset: 'slate', note: '', buddy: SL.DEFAULT_BUDDY };

    const hostname = parsed.hostname;
    const hint = d365Hint(hostname);
    // The keyword scan runs first so an explicitly named UAT box inside the
    // dynamics.com space is not mislabelled as Production.
    const scanTarget = hostname.replace(/\.(operations|ax|crm\d*)\.dynamics\.com$/, '');

    for (let i = 0; i < ENV_RULES.length; i++) {
      if (ENV_RULES[i].re.test(scanTarget)) {
        return {
          label: ENV_RULES[i].label,
          preset: ENV_RULES[i].preset,
          note: hint ? hint.note : '',
          buddy: SL.buddyForEnvironment(ENV_RULES[i].label)
        };
      }
    }
    if (hint) return Object.assign({}, hint, { buddy: SL.buddyForEnvironment(hint.label) });
    return { label: '', preset: 'slate', note: '', buddy: SL.DEFAULT_BUDDY };
  };

  /** Candidate patterns offered in the popup, best first. */
  SL.suggestPatterns = function suggestPatterns(url) {
    const parsed = SL.parseUrl(url);
    if (!parsed) return [];

    const out = [
      {
        pattern: { type: 'origin', value: parsed.origin },
        title: 'This site',
        detail: parsed.origin + ' and every page under it'
      }
    ];

    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length) {
      const first = parsed.origin + '/' + segments[0];
      out.push({
        pattern: { type: 'prefix', value: first },
        title: 'This section only',
        detail: first + '/...'
      });
    }

    const parts = parsed.hostname.split('.');
    if (parts.length > 2) {
      const parent = parts.slice(1).join('.');
      out.push({
        pattern: { type: 'host-suffix', value: parent },
        title: 'All subdomains',
        detail: parent + ' and *.' + parent
      });
    }

    return out;
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
