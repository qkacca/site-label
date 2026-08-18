/*
 * Site Label - Buddy characters.
 *
 * A buddy stands in the corner holding your label on a placard, and every so
 * often performs its own small routine.
 *
 * The cast is chosen to be decent company for a long working day. Three of the
 * original desk objects were kept because they earned their place - the safety
 * cone, the office cat and the desk plant - and the rest come from somewhere
 * softer than an office.
 *
 * Characters are also matched to environments: a cautious cone for Production,
 * a formal penguin for UAT, a hopeful bunny for Test. See BUDDY_FOR_ENV.
 *
 * Everything here is original. A published extension cannot use a real
 * person's likeness or a character somebody else owns.
 *
 * Characters are data, built with createElementNS. Nothing is parsed as markup.
 */
(function (root) {
  'use strict';

  const SL = (root.SL = root.SL || {});
  const NS = 'http://www.w3.org/2000/svg';

  /* ------------------------------------------------------------------ *
   * The cast
   *
   * kind      'shapes' draws from its own shape list; 'bust' is the
   *           head-and-shoulders form (Biscuit).
   * trick     the move it performs on a timer.
   * hand      the character's colour, used to edge the placard.
   * eyes      where the eyes sit; eyeStyle picks how they are drawn.
   * Shapes carrying a 'class' are animated separately from the body.
   * ------------------------------------------------------------------ */

  SL.BUDDIES = [
    {
      id: 'cone',
      name: 'Cone the Safety Marshal',
      blurb: 'Immovable, vigilant, takes the job seriously',
      kind: 'shapes',
      trick: 'wobble',
      hand: '#f7f7f7',
      eyes: [[43, 44], [57, 44]],
      mouth: 'M45 55 Q50 59 55 55',
      mouthColor: '#a8410f',
      shapes: [
        ['rect', { x: 18, y: 78, width: 64, height: 11, rx: 4, fill: '#f06a1e', stroke: '#c8541a', 'stroke-width': 1.6 }],
        ['path', { d: 'M50 6 L76 80 L24 80 Z', fill: '#f06a1e', stroke: '#c8541a', 'stroke-width': 1.8 }],
        ['path', { d: 'M36 62 L64 62 L67 72 L33 72 Z', fill: '#f7f7f7', stroke: '#d8d4cf', 'stroke-width': 1 }],
        ['path', { d: 'M42 26 L58 26 L60 33 L40 33 Z', fill: '#f7f7f7', stroke: '#d8d4cf', 'stroke-width': 1 }]
      ],
      lines: [
        'Caution. You are entering {label}.',
        'Slow down. This is {label}.',
        'Safety first. {label}.'
      ]
    },
    {
      id: 'penguin',
      name: 'Pip the Penguin',
      blurb: 'Formal on top, chaotic underneath',
      kind: 'shapes',
      trick: 'waddle',
      hand: '#f2a33c',
      eyes: [[43, 40], [57, 40]],
      mouth: null,
      shapes: [
        ['ellipse', { cx: 31, cy: 84, rx: 9, ry: 5, fill: '#f2a33c', stroke: '#cf7f1c', 'stroke-width': 1.2 }],
        ['ellipse', { cx: 69, cy: 84, rx: 9, ry: 5, fill: '#f2a33c', stroke: '#cf7f1c', 'stroke-width': 1.2 }],
        ['ellipse', { cx: 50, cy: 54, rx: 28, ry: 32, fill: '#37424e', stroke: '#252d36', 'stroke-width': 1.6 }],
        ['ellipse', { cx: 50, cy: 60, rx: 19, ry: 25, fill: '#f9f6f0', stroke: '#e2ded6', 'stroke-width': 1.2 }],
        ['path', { d: 'M25 46 Q14 60 22 76', stroke: '#252d36', 'stroke-width': 7, fill: 'none', 'stroke-linecap': 'round', 'class': 'sl-part-flipper sl-flip-l' }],
        ['path', { d: 'M75 46 Q86 60 78 76', stroke: '#252d36', 'stroke-width': 7, fill: 'none', 'stroke-linecap': 'round', 'class': 'sl-part-flipper sl-flip-r' }],
        ['path', { d: 'M44 47 L56 47 L50 56 Z', fill: '#f2a33c', stroke: '#cf7f1c', 'stroke-width': 1.1 }]
      ],
      lines: [
        'Waddling through {label}, formally.',
        'Dressed for the occasion. The occasion is {label}.',
        'It is {label}. I checked. Twice.'
      ]
    },
    {
      id: 'bunny',
      name: 'Mochi the Bunny',
      blurb: 'Soft, twitchy, permanently hopeful',
      kind: 'shapes',
      trick: 'hop',
      hand: '#f3d9e2',
      eyes: [[43, 52], [57, 52]],
      mouth: 'M46 63 Q50 67 54 63',
      mouthColor: '#c88fa2',
      shapes: [
        ['ellipse', { cx: 38, cy: 22, rx: 8, ry: 19, fill: '#fbf3ee', stroke: '#e6d8cf', 'stroke-width': 1.4, 'class': 'sl-part-ear sl-ear-l' }],
        ['ellipse', { cx: 38, cy: 24, rx: 4, ry: 13, fill: '#f6ccd8', 'class': 'sl-part-ear sl-ear-l' }],
        ['ellipse', { cx: 62, cy: 22, rx: 8, ry: 19, fill: '#fbf3ee', stroke: '#e6d8cf', 'stroke-width': 1.4, 'class': 'sl-part-ear sl-ear-r' }],
        ['ellipse', { cx: 62, cy: 24, rx: 4, ry: 13, fill: '#f6ccd8', 'class': 'sl-part-ear sl-ear-r' }],
        ['circle', { cx: 50, cy: 55, r: 26, fill: '#fbf3ee', stroke: '#e6d8cf', 'stroke-width': 1.6 }],
        ['circle', { cx: 32, cy: 60, r: 5, fill: '#f6ccd8', opacity: '0.7' }],
        ['circle', { cx: 68, cy: 60, r: 5, fill: '#f6ccd8', opacity: '0.7' }],
        ['ellipse', { cx: 50, cy: 58, rx: 4, ry: 3, fill: '#e79ab0' }]
      ],
      lines: [
        'Hop! You are in {label}.',
        'Twitching my ears at {label}.',
        'Soft news: this is {label}.'
      ]
    },
    {
      id: 'bee',
      name: 'Bumble the Bee',
      blurb: 'Busy, cheerful, slightly wobbly in flight',
      kind: 'shapes',
      trick: 'buzz',
      hand: '#f6c945',
      eyes: [[43, 52], [57, 52]],
      mouth: 'M45 62 Q50 67 55 62',
      mouthColor: '#8a6a12',
      shapes: [
        ['path', { d: 'M40 32 Q34 18 28 13', stroke: '#3a3222', 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'round' }],
        ['path', { d: 'M60 32 Q66 18 72 13', stroke: '#3a3222', 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'round' }],
        ['circle', { cx: 27, cy: 11, r: 3.5, fill: '#3a3222' }],
        ['circle', { cx: 73, cy: 11, r: 3.5, fill: '#3a3222' }],
        ['ellipse', { cx: 25, cy: 41, rx: 15, ry: 10, fill: '#e8f4fb', opacity: '0.85', stroke: '#c2dced', 'stroke-width': 1.2, 'class': 'sl-part-wing sl-wing-l' }],
        ['ellipse', { cx: 75, cy: 41, rx: 15, ry: 10, fill: '#e8f4fb', opacity: '0.85', stroke: '#c2dced', 'stroke-width': 1.2, 'class': 'sl-part-wing sl-wing-r' }],
        ['ellipse', { cx: 50, cy: 58, rx: 26, ry: 23, fill: '#f6c945', stroke: '#cf9f14', 'stroke-width': 1.6 }],
        ['path', { d: 'M28 68 Q50 76 72 68 L70 77 Q50 84 30 77 Z', fill: '#3a3222' }],
        ['path', { d: 'M25 47 Q50 41 75 47 L75 53 Q50 47 25 53 Z', fill: '#3a3222', opacity: '0.9' }]
      ],
      lines: [
        'Buzzing about in {label}.',
        'Busy, busy. Also, {label}.',
        'Pollinating {label}.'
      ]
    },
    {
      id: 'jellyfish',
      name: 'Blinky the Jellyfish',
      blurb: 'Drifts along, no notes, no worries',
      kind: 'shapes',
      trick: 'drift',
      hand: '#d3b3f2',
      eyes: [[43, 40], [57, 40]],
      mouth: 'M45 50 Q50 55 55 50',
      mouthColor: '#7d55a8',
      shapes: [
        ['path', { d: 'M28 56 Q26 40 32 44 Q36 60 32 76', stroke: '#c9a7f0', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round', 'class': 'sl-part-tentacle sl-tent-1' }],
        ['path', { d: 'M42 58 Q40 42 44 46 Q46 62 42 78', stroke: '#d9bdf7', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round', 'class': 'sl-part-tentacle sl-tent-2' }],
        ['path', { d: 'M58 58 Q60 42 56 46 Q54 62 58 78', stroke: '#d9bdf7', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round', 'class': 'sl-part-tentacle sl-tent-3' }],
        ['path', { d: 'M72 56 Q74 40 68 44 Q64 60 68 76', stroke: '#c9a7f0', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round', 'class': 'sl-part-tentacle sl-tent-4' }],
        ['path', { d: 'M21 52 Q21 16 50 16 Q79 16 79 52 Q65 60 50 56 Q35 60 21 52 Z', fill: '#dcc2f8', stroke: '#bf9ae8', 'stroke-width': 1.6 }],
        ['path', { d: 'M31 27 Q38 21 47 21', stroke: '#ffffff', 'stroke-width': 3, fill: 'none', opacity: '0.7', 'stroke-linecap': 'round' }]
      ],
      lines: [
        'Drifting gently through {label}.',
        'No thoughts. Just {label}.',
        'Floating along in {label}.'
      ]
    },
    {
      id: 'corgi',
      name: 'Waffle the Corgi',
      blurb: 'Delighted by absolutely everything',
      kind: 'shapes',
      trick: 'wag',
      hand: '#e8b57a',
      eyes: [[42, 44], [58, 44]],
      mouth: null,
      shapes: [
        ['path', { d: 'M76 56 Q92 48 89 65 Q85 74 75 69 Z', fill: '#e8b57a', stroke: '#c9924f', 'stroke-width': 1.4, 'class': 'sl-part-tail' }],
        ['path', { d: 'M28 34 L23 7 L46 24 Z', fill: '#e8b57a', stroke: '#c9924f', 'stroke-width': 1.4 }],
        ['path', { d: 'M72 34 L77 7 L54 24 Z', fill: '#e8b57a', stroke: '#c9924f', 'stroke-width': 1.4 }],
        ['circle', { cx: 50, cy: 46, r: 27, fill: '#eebf88', stroke: '#c9924f', 'stroke-width': 1.6 }],
        ['ellipse', { cx: 50, cy: 59, rx: 15, ry: 11, fill: '#fbf3ea', stroke: '#e0d3c4', 'stroke-width': 1.1 }],
        ['ellipse', { cx: 50, cy: 54, rx: 4.5, ry: 3.5, fill: '#3a2f28' }],
        ['path', { d: 'M50 58 Q50 63 44 65 M50 58 Q50 63 56 65', stroke: '#a8836a', 'stroke-width': 1.6, fill: 'none' }],
        ['path', { d: 'M46 67 Q50 76 54 67 Z', fill: '#f2919c' }]
      ],
      lines: [
        'Best environment ever! {label}!',
        'Tail wagging for {label}.',
        'You came back! And it is {label}.'
      ]
    },
    {
      id: 'cloud',
      name: 'Nimbus the Rain Cloud',
      blurb: 'Gentle, drizzly, oddly soothing',
      kind: 'shapes',
      trick: 'drizzle',
      hand: '#b9cfe4',
      eyes: [[42, 38], [58, 38]],
      mouth: 'M44 49 Q50 55 56 49',
      mouthColor: '#7b93ab',
      shapes: [
        ['circle', { cx: 31, cy: 36, r: 17, fill: '#eef4fa', stroke: '#cddced', 'stroke-width': 1.5 }],
        ['circle', { cx: 50, cy: 26, r: 21, fill: '#eef4fa', stroke: '#cddced', 'stroke-width': 1.5 }],
        ['circle', { cx: 69, cy: 36, r: 17, fill: '#eef4fa', stroke: '#cddced', 'stroke-width': 1.5 }],
        ['rect', { x: 15, y: 36, width: 70, height: 24, rx: 12, fill: '#eef4fa', stroke: '#cddced', 'stroke-width': 1.5 }],
        ['path', { d: 'M34 64 Q31 70 34 74 Q37 70 34 64 Z', fill: '#7fb4e0', 'class': 'sl-part-drop sl-drop-1' }],
        ['path', { d: 'M50 68 Q47 74 50 78 Q53 74 50 68 Z', fill: '#7fb4e0', 'class': 'sl-part-drop sl-drop-2' }],
        ['path', { d: 'M66 64 Q63 70 66 74 Q69 70 66 64 Z', fill: '#7fb4e0', 'class': 'sl-part-drop sl-drop-3' }]
      ],
      lines: [
        'A light drizzle over {label}.',
        'Bring a coat. You are in {label}.',
        'Softly raining on {label}.'
      ]
    },
    {
      id: 'moon',
      name: 'Luna the Sleepy Moon',
      blurb: 'Calm, dozy, up far too late',
      kind: 'shapes',
      trick: 'yawn',
      hand: '#ffe9a8',
      eyes: [[41, 46], [59, 46]],
      eyeStyle: 'sleepy',
      mouth: null,
      shapes: [
        ['path', { d: 'M15 20 L17 26 L23 28 L17 30 L15 36 L13 30 L7 28 L13 26 Z', fill: '#ffe9a8', 'class': 'sl-part-star sl-star-1' }],
        ['path', { d: 'M87 30 L89 36 L95 38 L89 40 L87 46 L85 40 L79 38 L85 36 Z', fill: '#ffe9a8', 'class': 'sl-part-star sl-star-2' }],
        ['path', { d: 'M84 68 L85.5 72 L90 73.5 L85.5 75 L84 79 L82.5 75 L78 73.5 L82.5 72 Z', fill: '#ffe9a8', 'class': 'sl-part-star sl-star-3' }],
        ['circle', { cx: 48, cy: 50, r: 29, fill: '#ffeeb8', stroke: '#e9d283', 'stroke-width': 1.8 }],
        ['circle', { cx: 32, cy: 38, r: 5, fill: '#f6dd99', opacity: '0.9' }],
        ['circle', { cx: 63, cy: 63, r: 6.5, fill: '#f6dd99', opacity: '0.9' }],
        ['circle', { cx: 60, cy: 31, r: 3.5, fill: '#f6dd99', opacity: '0.9' }],
        ['ellipse', { cx: 48, cy: 61, rx: 5.5, ry: 6.5, fill: '#d8a86a', opacity: '0.7' }]
      ],
      lines: [
        'Still up. Still {label}.',
        'Quietly watching over {label}.',
        'Sleepy in {label}.'
      ]
    },
    {
      id: 'plant',
      name: 'Mango the Desk Plant',
      blurb: 'Serene, patient, mildly thirsty',
      kind: 'shapes',
      trick: 'sway',
      hand: '#d98a63',
      eyes: [[44, 68], [56, 68]],
      mouth: 'M46 76 Q50 80 54 76',
      mouthColor: '#8a4a2a',
      shapes: [
        ['path', { d: 'M50 58 Q20 48 25 16 Q50 22 50 58', fill: '#3f8f5b', stroke: '#2f6f45', 'stroke-width': 1.4, 'class': 'sl-part-leaf sl-leaf-l' }],
        ['path', { d: 'M50 58 Q80 48 75 16 Q50 22 50 58', fill: '#4aa066', stroke: '#2f6f45', 'stroke-width': 1.4, 'class': 'sl-part-leaf sl-leaf-r' }],
        ['path', { d: 'M50 58 Q41 28 50 4 Q61 28 50 58', fill: '#57b374', stroke: '#2f6f45', 'stroke-width': 1.3, 'class': 'sl-part-leaf sl-leaf-c' }],
        ['path', { d: 'M34 58 L66 58 L62 90 L38 90 Z', fill: '#c96f4a', stroke: '#a85736', 'stroke-width': 1.6 }],
        ['rect', { x: 31, y: 53, width: 38, height: 10, rx: 3, fill: '#d98a63', stroke: '#a85736', 'stroke-width': 1.4 }]
      ],
      lines: [
        'Photosynthesising quietly in {label}.',
        'I have been in {label} all week. Nobody watered me.',
        'Leaf it alone - this is {label}.'
      ]
    },
    {
      id: 'cat',
      name: 'Biscuit the Office Cat',
      blurb: 'Unbothered, superior, occasionally helpful',
      kind: 'bust',
      trick: 'pounce',
      skin: '#f4a259',
      accent: '#d8813a',
      head: 'circle',
      build: 'slim',
      hand: '#f4a259',
      mouth: 'none',
      eyes: [[40, 40], [60, 40]],
      extras: [
        ['path', { d: 'M27 26 L23 6 L43 19 Z', fill: '#f4a259' }],
        ['path', { d: 'M73 26 L77 6 L57 19 Z', fill: '#f4a259' }],
        ['path', { d: 'M46 50 Q50 55 54 50', stroke: '#7a4a1e', 'stroke-width': 2.4, fill: 'none' }],
        ['line', { x1: 16, y1: 47, x2: 33, y2: 49, stroke: '#7a4a1e', 'stroke-width': 1.8 }],
        ['line', { x1: 84, y1: 47, x2: 67, y2: 49, stroke: '#7a4a1e', 'stroke-width': 1.8 }]
      ],
      lines: [
        'It is {label}. I was going to mention it. Eventually.',
        'Yes, {label}. Now feed me.',
        'Mm. {label}. Do what you like, I suppose.'
      ]
    }
  ];

  SL.BUDDY_IDS = SL.BUDDIES.map((b) => b.id);
  SL.DEFAULT_BUDDY = 'cone';

  SL.buddyById = function buddyById(id) {
    return SL.BUDDIES.find((b) => b.id === id) || SL.BUDDIES[0];
  };

  /* ------------------------------------------------------------------ *
   * Characters matched to environments
   *
   * The character reinforces what the environment is for, so the corner of the
   * screen carries a mood as well as a name: a cone standing guard over
   * Production, a penguin doing things properly in UAT, a bunny hopefully
   * trying things in Test, a jellyfish with no consequences in a sandbox.
   * ------------------------------------------------------------------ */

  SL.BUDDY_FOR_ENV = {
    PRODUCTION: 'cone',
    UAT: 'penguin',
    STAGING: 'penguin',
    TEST: 'bunny',
    SIT: 'bunny',
    QA: 'bunny',
    DEV: 'bee',
    BUILD: 'bee',
    SANDBOX: 'jellyfish',
    DEMO: 'corgi',
    TRAINING: 'plant',
    LOCAL: 'moon',
    LCS: 'cat',
    DATAVERSE: 'cloud'
  };

  SL.buddyForEnvironment = function buddyForEnvironment(label) {
    const key = String(label || '').trim().toUpperCase();
    return SL.BUDDY_FOR_ENV[key] || SL.DEFAULT_BUDDY;
  };

  /** Plain descriptions of each move, for the settings UI. */
  SL.TRICK_NAMES = {
    wobble: 'rocks and refuses to fall over',
    waddle: 'flaps its flippers and waddles',
    hop: 'twitches its ears and hops',
    buzz: 'flutters its wings and hovers',
    drift: 'pulses and trails its tentacles',
    wag: 'wags its tail, delighted',
    drizzle: 'lets a little rain fall',
    yawn: 'yawns while the stars twinkle',
    sway: 'sways its leaves',
    pounce: 'crouches, then loses interest'
  };

  /** The move this character performs when its timer fires. */
  SL.buddyTrick = function buddyTrick(id) {
    return SL.buddyById(id).trick || 'wobble';
  };

  /** The character's own colour, used for the placard edge. */
  SL.buddyHandColor = function buddyHandColor(id) {
    const buddy = SL.buddyById(id);
    return buddy.hand || buddy.skin || '#e8b98a';
  };

  /* ------------------------------------------------------------------ *
   * Lines
   *
   * Speech bubbles are switched off. The lines are kept so they can be brought
   * back without rewriting the cast.
   * ------------------------------------------------------------------ */

  SL.buddyLine = function buddyLine(buddyId, label, index) {
    const buddy = SL.buddyById(buddyId);
    const lines = buddy.lines;
    const pick = typeof index === 'number'
      ? lines[Math.abs(index) % lines.length]
      : lines[Math.floor(Math.random() * lines.length)];
    return pick.split('{label}').join(label || 'this environment');
  };

  /* ------------------------------------------------------------------ *
   * Drawing
   * ------------------------------------------------------------------ */

  function el(tag, attrs) {
    const node = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach((key) => node.setAttribute(key, String(attrs[key])));
    return node;
  }

  function darken(hex, amount) {
    let h = String(hex).replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const parts = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    return '#' + parts
      .map((v) => Math.max(0, Math.round(v * (1 - amount))).toString(16).padStart(2, '0'))
      .join('');
  }

  const BUSTS = {
    slim: 'M19 100 Q19 74 50 74 Q81 74 81 100 Z',
    normal: 'M13 100 Q13 72 50 72 Q87 72 87 100 Z',
    wide: 'M7 100 Q7 70 50 70 Q93 70 93 100 Z'
  };

  /** Eyes live in their own group so they can blink together. */
  function buildEyes(buddy) {
    const group = el('g', {});
    group.setAttribute('class', 'sl-buddy-eyes');
    const pairs = buddy.eyes || [[40, 40], [60, 40]];

    pairs.forEach((p) => {
      if (buddy.eyeStyle === 'sleepy') {
        // Closed, contented eyes - a downward arc reads as dozing.
        group.appendChild(el('path', {
          d: 'M' + (p[0] - 6) + ' ' + p[1] + ' Q' + p[0] + ' ' + (p[1] + 6) + ' ' + (p[0] + 6) + ' ' + p[1],
          stroke: '#8a6a2a', 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'round'
        }));
        return;
      }
      group.appendChild(el('ellipse', {
        cx: p[0], cy: p[1], rx: 6.4, ry: 7, fill: '#ffffff',
        stroke: 'rgba(0,0,0,.16)', 'stroke-width': 1
      }));
      group.appendChild(el('circle', { cx: p[0], cy: p[1] + 1, r: 3.2, fill: '#1b2430' }));
      group.appendChild(el('circle', { cx: p[0] - 1.9, cy: p[1] - 1.6, r: 1.3, fill: '#ffffff' }));
    });
    return group;
  }

  /**
   * Build the character as an <svg>. Most draw from their own shape list;
   * Biscuit uses the bust form, a head and shoulders behind the placard.
   */
  SL.buildBuddySvg = function buildBuddySvg(buddyId) {
    const buddy = SL.buddyById(buddyId);

    const svg = el('svg', {
      viewBox: '0 0 100 100',
      xmlns: NS,
      'aria-hidden': 'true',
      focusable: 'false'
    });
    svg.setAttribute('class', 'sl-buddy-svg');

    if (buddy.kind === 'bust') {
      const bustOutline = darken(buddy.accent, 0.3);
      const headOutline = darken(buddy.skin, 0.22);

      svg.appendChild(el('path', {
        d: BUSTS[buddy.build] || BUSTS.normal,
        fill: buddy.accent, stroke: bustOutline, 'stroke-width': 1.6
      }));
      svg.appendChild(el('rect', {
        x: 43, y: 57, width: 14, height: 17, rx: 5,
        fill: buddy.skin, stroke: headOutline, 'stroke-width': 1.2
      }));
      svg.appendChild(el(buddy.head === 'rect' ? 'rect' : 'circle',
        buddy.head === 'rect'
          ? { x: 24, y: 14, width: 52, height: 52, rx: 13, fill: buddy.skin, stroke: headOutline, 'stroke-width': 1.6 }
          : { cx: 50, cy: 40, r: 26, fill: buddy.skin, stroke: headOutline, 'stroke-width': 1.6 }));
    } else {
      (buddy.shapes || []).forEach((shape) => svg.appendChild(el(shape[0], shape[1])));
    }

    svg.appendChild(buildEyes(buddy));

    if (buddy.mouth && buddy.mouth !== 'none') {
      svg.appendChild(el('path', {
        d: buddy.mouth,
        stroke: buddy.mouthColor || '#8a5a3b',
        'stroke-width': 2.4,
        'stroke-linecap': 'round',
        fill: 'none'
      }));
    }

    if (buddy.kind === 'bust') {
      (buddy.extras || []).forEach((shape) => svg.appendChild(el(shape[0], shape[1])));
    }

    return svg;
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
