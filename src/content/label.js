/*
 * Site Label - page renderer.
 *
 * Draws the label inside a closed shadow root attached to a single host
 * element, so no page CSS can reach it and none of our CSS can leak out.
 * The overlay is pointer-events:none unless the user opts into
 * click-to-dismiss, so it can never swallow a click in the app underneath.
 */
(function () {
  'use strict';

  if (window.__siteLabelLoaded) return;
  window.__siteLabelLoaded = true;

  const SL = globalThis.SL;
  const HOST_ID = 'site-label-root-' + Math.random().toString(36).slice(2, 10);
  const Z = '2147483647';

  let state = null;
  let current = null; // { site, group, style, text }
  let hostEl = null;
  let shadow = null;
  let hiddenForTab = false;
  let lastUrl = location.href;
  let originalTitle = null;
  let titleObserver = null;

  /* ------------------------------------------------------------------ *
   * Colour helpers (input is already sanitised hex)
   * ------------------------------------------------------------------ */

  function hexToRgb(hex) {
    let h = hex.slice(1);
    if (h.length === 3 || h.length === 4) {
      h = h.split('').map((c) => c + c).join('');
    }
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16)
    };
  }

  function shade(hex, amount) {
    const { r, g, b } = hexToRgb(hex);
    const f = (v) =>
      Math.max(0, Math.min(255, Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount)));
    return '#' + [f(r), f(g), f(b)].map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  /* ------------------------------------------------------------------ *
   * Stylesheet
   * ------------------------------------------------------------------ */

  function buildCss(style) {
    const bg = style.background;
    const fg = style.textColor;
    const alt = shade(bg, -0.18);
    const fill = style.stripes
      ? 'repeating-linear-gradient(45deg,' + bg + ',' + bg + ' 10px,' + alt + ' 10px,' + alt + ' 20px)'
      : bg;

    const s = style.scale;
    const r2 = (n) => Math.round(n * 100) / 100;

    /*
     * Every dimension is responsive. A value is expressed as
     * clamp(floor, <vmin>, ceiling), where the vmin figure is tuned so that a
     * viewport whose smaller side is 840px - a typical laptop - renders the
     * base size exactly. A 4K monitor therefore gets a proportionally larger
     * label instead of a tiny one, and a small window gets a smaller label
     * instead of one that swamps the page. The clamps stop either extreme
     * running away.
     */
    const resp = (base, minF, maxF) => {
      const b = base * s;
      return 'clamp(' + r2(b * (minF || 0.8)) + 'px, ' + r2(b / 8.4) +
             'vmin, ' + r2(b * (maxF || 1.6)) + 'px)';
    };

    const px = (n) => r2(n * s) + 'px';
    const glowSeconds = SL.glowDuration(style);
    // Three related hues either side of the label's own colour: the glow
    // brightens and shifts rather than merely blinking on and off.
    const gc = SL.glowColors(bg);
    const glowA = gc.a, glowB = gc.b, glowC = gc.c;
    const glowSoftA = gc.softA, glowSoftB = gc.softB, glowSoftC = gc.softC;

    // The placard's "hands" are drawn in CSS, so the character's skin tone has
    // to reach the stylesheet.
    // The placard is edged in the character's own colour, which ties the two
    // together now that there are no hands doing that job.
    const buddyTint = typeof SL.buddyHandColor === 'function'
      ? SL.buddyHandColor(style.buddy)
      : '#ffffff';

    return `
:host { all: initial; }
* { box-sizing: border-box; margin: 0; padding: 0; }

.sl-layer {
  position: fixed;
  inset: 0;
  z-index: ${Z};
  pointer-events: none;
  opacity: ${style.opacity};
  font-family: "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;
  font-weight: ${style.bold ? 700 : 500};
  line-height: 1.2;
  letter-spacing: .04em;
  text-transform: ${style.uppercase ? 'uppercase' : 'none'};
  color: ${fg};

  /* responsive scale, shared by every mode */
  --sl-font:  ${resp(style.fontSize, 0.85, 1.5)};
  --sl-rb:    ${resp(158, 0.58, 1.7)};
  --sl-barh:  ${resp(style.barHeight)};
  --sl-fw:    ${resp(style.frameWidth, 0.85, 1.5)};
  --sl-inset: ${resp(10, 0.9, 1.8)};
  --sl-edge:  ${resp(Math.max(3, style.frameWidth * 0.7), 0.85, 1.5)};
  --sl-cn:    ${resp(42, 0.7, 1.7)};
  --sl-buddy: ${resp(92, 0.7, 1.6)};
  --sl-buddy-tint: ${buddyTint};

  /* padding and rounding follow the text, so proportions hold at any size */
  --sl-pad-y: calc(var(--sl-font) * .42);
  --sl-pad-x: calc(var(--sl-font) * .95);
  --sl-radius: calc(var(--sl-font) * .5);

  font-size: var(--sl-font);
}
.sl-layer.sl-interactive .sl-hit { pointer-events: auto; cursor: pointer; }

/* Unlocked: the label accepts the mouse so it can be picked up and moved. */
.sl-layer.sl-unlocked .sl-hit {
  pointer-events: auto;
  cursor: grab;
  outline: 2px dashed ${shade(fg, -0.05)};
  outline-offset: 2px;
}
.sl-layer.sl-unlocked.sl-dragging .sl-hit { cursor: grabbing; }
.sl-layer.sl-unlocked { user-select: none; }

/* A dragged element is positioned outright, so any centring shift must go. */
.sl-placed { transform: none !important; }

.sl-text { white-space: nowrap; }
.sl-host {
  display: block;
  font-size: .78em;
  font-weight: 500;
  opacity: .85;
  letter-spacing: .02em;
  text-transform: none;
}

/* ---- corner ribbon ----
   The band is centred with translate rather than offset with top/left, so its
   position no longer drifts with the height of the text, and it sits exactly
   on the corner diagonal - the same distance along both axes. */
.sl-ribbon {
  position: absolute;
  width: var(--sl-rb);
  height: var(--sl-rb);
  overflow: hidden;
  --sl-off: calc(var(--sl-rb) * .19);
}
.sl-ribbon.tl { top: 0; left: 0; }
.sl-ribbon.tr { top: 0; right: 0; }
.sl-ribbon.bl { bottom: 0; left: 0; }
.sl-ribbon.br { bottom: 0; right: 0; }
.sl-ribbon > .sl-inner {
  position: absolute;
  left: 50%;
  top: 50%;
  width: calc(var(--sl-rb) * 1.46);
  padding: var(--sl-pad-y) 0;
  text-align: center;
  background: ${fill};
  box-shadow: 0 1px 6px rgba(0,0,0,.35);
}
.sl-ribbon.tl > .sl-inner {
  transform: translate(-50%,-50%) translate(calc(var(--sl-off) * -1), calc(var(--sl-off) * -1)) rotate(-45deg);
}
.sl-ribbon.tr > .sl-inner {
  transform: translate(-50%,-50%) translate(var(--sl-off), calc(var(--sl-off) * -1)) rotate(45deg);
}
.sl-ribbon.bl > .sl-inner {
  transform: translate(-50%,-50%) translate(calc(var(--sl-off) * -1), var(--sl-off)) rotate(45deg);
}
.sl-ribbon.br > .sl-inner {
  transform: translate(-50%,-50%) translate(var(--sl-off), var(--sl-off)) rotate(-45deg);
}
.sl-layer.sl-unlocked .sl-ribbon { overflow: visible; }

/* ---- bars ---- */
.sl-bar {
  position: absolute;
  left: 0;
  right: 0;
  min-height: var(--sl-barh);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sl-pad-x);
  padding: var(--sl-pad-y) var(--sl-pad-x);
  background: ${fill};
  box-shadow: 0 0 8px rgba(0,0,0,.3);
  overflow: hidden;
}
.sl-bar.top { top: 0; }
.sl-bar.bottom { bottom: 0; }
.sl-bar .sl-text { overflow: hidden; text-overflow: ellipsis; }
.sl-bar .sl-host { display: inline; font-size: .8em; }

/* ---- edge line: a hairline along one edge with a small tag on it ----
   Almost nothing is covered, but the colour is unmistakable in peripheral
   vision, which is the point. */
.sl-edge {
  position: absolute;
  left: 0;
  right: 0;
  height: var(--sl-edge);
  background: ${fill};
}
.sl-edge.top { top: 0; }
.sl-edge.bottom { bottom: 0; }
.sl-edge-chip {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  padding: calc(var(--sl-pad-y) * .8) var(--sl-pad-x);
  background: ${fill};
  box-shadow: 0 1px 5px rgba(0,0,0,.3);
  max-width: 60vw;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sl-edge-chip.top { top: 0; border-radius: 0 0 var(--sl-radius) var(--sl-radius); }
.sl-edge-chip.bottom { bottom: 0; border-radius: var(--sl-radius) var(--sl-radius) 0 0; }

/* ---- side tab: down one edge, clear of toolbars and page content ---- */
.sl-side {
  position: absolute;
  top: 50%;
  writing-mode: vertical-rl;
  padding: var(--sl-pad-x) var(--sl-pad-y);
  background: ${fill};
  box-shadow: 0 2px 8px rgba(0,0,0,.35);
  border-radius: var(--sl-radius);
  max-height: 70vh;
  overflow: hidden;
}
.sl-side.left { left: 0; transform: translateY(-50%) rotate(180deg); }
.sl-side.right { right: 0; transform: translateY(-50%); }
.sl-side .sl-host { display: none; }

/* ---- floating pill, centred on an edge ---- */
.sl-pill {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  padding: var(--sl-pad-y) calc(var(--sl-pad-x) * 1.3);
  background: ${fill};
  border-radius: 999px;
  box-shadow: 0 2px 10px rgba(0,0,0,.35);
  max-width: 60vw;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sl-pill.top { top: var(--sl-inset); }
.sl-pill.bottom { bottom: var(--sl-inset); }

/* ---- corner brackets: frames the screen without covering any of it ---- */
.sl-corner {
  position: absolute;
  width: var(--sl-cn);
  height: var(--sl-cn);
  border: 0 solid ${bg};
}
.sl-corner.tl { top: 0; left: 0; border-top-width: var(--sl-fw); border-left-width: var(--sl-fw); }
.sl-corner.tr { top: 0; right: 0; border-top-width: var(--sl-fw); border-right-width: var(--sl-fw); }
.sl-corner.bl { bottom: 0; left: 0; border-bottom-width: var(--sl-fw); border-left-width: var(--sl-fw); }
.sl-corner.br { bottom: 0; right: 0; border-bottom-width: var(--sl-fw); border-right-width: var(--sl-fw); }
.sl-corner-chip {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  padding: calc(var(--sl-pad-y) * .8) var(--sl-pad-x);
  background: ${fill};
  border-radius: 0 0 var(--sl-radius) var(--sl-radius);
  box-shadow: 0 1px 5px rgba(0,0,0,.3);
  max-width: 60vw;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ---- frame ---- */
.sl-frame {
  position: absolute;
  inset: 0;
  border: var(--sl-fw) solid ${bg};
  ${style.stripes ? 'border-image: ' + fill + ' 1;' : ''}
}
.sl-frame-tab {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  padding: var(--sl-pad-y) var(--sl-pad-x);
  background: ${fill};
  border-radius: 0 0 var(--sl-radius) var(--sl-radius);
  box-shadow: 0 1px 5px rgba(0,0,0,.3);
}

/* ---- badge ---- */
.sl-badge {
  position: absolute;
  padding: var(--sl-pad-y) var(--sl-pad-x);
  background: ${fill};
  border-radius: 999px;
  box-shadow: 0 2px 8px rgba(0,0,0,.35);
  max-width: 42vw;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sl-badge.tl { top: var(--sl-inset); left: var(--sl-inset); }
.sl-badge.tr { top: var(--sl-inset); right: var(--sl-inset); }
.sl-badge.bl { bottom: var(--sl-inset); left: var(--sl-inset); }
.sl-badge.br { bottom: var(--sl-inset); right: var(--sl-inset); }

/* ---- watermark ----
   Faint enough to read straight through, but no longer so faint that it
   looks like nothing rendered at all. */
.sl-watermark {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-22deg);
  font-size: calc(var(--sl-font) * 3.6);
  color: ${bg};
  opacity: .35;
  letter-spacing: .12em;
  white-space: nowrap;
  max-width: 92vw;
  overflow: hidden;
}

/* ---- buddy: a character holding the label on a placard ---- */
.sl-buddy {
  position: absolute;
  width: var(--sl-buddy);
  display: flex;
  flex-direction: column;
  align-items: center;
}
.sl-buddy.tl { top: var(--sl-inset); left: var(--sl-inset); }
.sl-buddy.tr { top: var(--sl-inset); right: var(--sl-inset); }
.sl-buddy.bl { bottom: var(--sl-inset); left: var(--sl-inset); }
.sl-buddy.br { bottom: var(--sl-inset); right: var(--sl-inset); }

.sl-buddy-svg {
  width: 100%;
  height: auto;
  display: block;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,.35));
  /* At rest the character is still. A constant bob plus a swaying placard plus
     a speech bubble was too much at once, so movement is saved for the
     periodic trick below, which makes it worth noticing. */
  transform-origin: 50% 100%;
}
.sl-buddy-eyes {
  transform-box: fill-box;
  transform-origin: center;
  animation: sl-buddy-blink 6.5s linear infinite;
}

/* The placard overlaps the shoulders, so the character reads as standing
   behind it rather than balancing on it. */
/*
 * The placard floats in front of the character rather than being held. Two
 * earlier attempts drew little hands gripping its top edge, and at this size
 * they read as feet planted in the sign - so the depth now comes from overlap
 * and a real drop shadow instead, and the card is edged in the character's own
 * colour so the pair still belong together.
 */
.sl-buddy-card {
  position: relative;
  margin-top: calc(var(--sl-buddy) * -0.22);
  padding: var(--sl-pad-y) var(--sl-pad-x);
  background: ${fill};
  color: ${fg};
  border: 2px solid var(--sl-buddy-tint);
  border-radius: var(--sl-radius);
  box-shadow:
    0 ${px(7)} ${px(16)} rgba(0,0,0,.45),
    0 ${px(2)} ${px(4)} rgba(0,0,0,.32);
  max-width: calc(var(--sl-buddy) * 2.1);
  transform: rotate(-3deg);
}
.sl-buddy-card .sl-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Resize grip, shown only while the buddy is unlocked. */
.sl-buddy-grip {
  position: absolute;
  width: calc(var(--sl-buddy) * 0.22);
  height: calc(var(--sl-buddy) * 0.22);
  min-width: 14px;
  min-height: 14px;
  border-radius: 50%;
  background: #ffffff;
  border: 2px solid ${shade(bg, -0.15)};
  box-shadow: 0 1px 4px rgba(0,0,0,.45);
  pointer-events: auto;
  display: none;
  z-index: 2;
}
.sl-layer.sl-unlocked .sl-buddy-grip { display: block; }
/* The grip goes on the corner facing into the page, opposite the corner the
   buddy is docked to. The dock corner is the anchor growth happens around, so
   a grip placed there would never move and dragging it would feel dead. */
.sl-buddy.br .sl-buddy-grip { top: calc(var(--sl-buddy) * -0.11); left: calc(var(--sl-buddy) * -0.11); cursor: nwse-resize; }
.sl-buddy.tl .sl-buddy-grip { bottom: calc(var(--sl-buddy) * -0.11); right: calc(var(--sl-buddy) * -0.11); cursor: nwse-resize; }
.sl-buddy.bl .sl-buddy-grip { top: calc(var(--sl-buddy) * -0.11); right: calc(var(--sl-buddy) * -0.11); cursor: nesw-resize; }
.sl-buddy.tr .sl-buddy-grip { bottom: calc(var(--sl-buddy) * -0.11); left: calc(var(--sl-buddy) * -0.11); cursor: nesw-resize; }
.sl-buddy-grip::after {
  content: '';
  position: absolute;
  inset: 26%;
  border-right: 2px solid ${shade(bg, -0.15)};
  border-bottom: 2px solid ${shade(bg, -0.15)};
}

/* ---- tricks ----
   Each character performs its own move on a timer, and the placard pops at the
   same moment so the eye finishes on the label. Parts of a character - wings,
   ears, raindrops - animate separately from its body, which is what makes the
   move read as the creature doing something rather than a picture wiggling. */
.sl-buddy.sl-trick .sl-buddy-card { animation: sl-card-pop .85s cubic-bezier(.22,1.4,.32,1); }

.sl-buddy.sl-trick-wobble  .sl-buddy-svg { animation: sl-trick-wobble 1.5s ease-in-out; }
.sl-buddy.sl-trick-waddle  .sl-buddy-svg { animation: sl-trick-waddle 1.8s ease-in-out; }
.sl-buddy.sl-trick-hop     .sl-buddy-svg { animation: sl-trick-hop 1.5s cubic-bezier(.3,1.5,.4,1); }
.sl-buddy.sl-trick-buzz    .sl-buddy-svg { animation: sl-trick-buzz 1.6s ease-in-out; }
.sl-buddy.sl-trick-drift   .sl-buddy-svg { animation: sl-trick-drift 2.2s ease-in-out; }
.sl-buddy.sl-trick-wag     .sl-buddy-svg { animation: sl-trick-wag 1.5s ease-in-out; }
.sl-buddy.sl-trick-drizzle .sl-buddy-svg { animation: sl-trick-drizzle 2.2s ease-in-out; }
.sl-buddy.sl-trick-yawn    .sl-buddy-svg { animation: sl-trick-yawn 2.2s ease-in-out; }
.sl-buddy.sl-trick-sway    .sl-buddy-svg { animation: sl-trick-sway 2.4s ease-in-out; }
.sl-buddy.sl-trick-pounce  .sl-buddy-svg { animation: sl-trick-pounce 1.5s ease-out; }

/* Parts move on their own axis, so each gets its own pivot. */
.sl-part-flipper, .sl-part-drop, .sl-part-ear, .sl-part-wing,
.sl-part-tentacle, .sl-part-tail, .sl-part-star, .sl-part-leaf {
  transform-box: fill-box;
}
.sl-part-flipper { transform-origin: 50% 10%; }
.sl-part-ear { transform-origin: 50% 100%; }
.sl-part-leaf { transform-origin: 50% 100%; }
.sl-part-tentacle { transform-origin: 50% 0%; }
.sl-part-tail { transform-origin: 0% 60%; }
.sl-part-star { transform-origin: center; }
.sl-part-drop { transform-origin: center; }
.sl-wing-l { transform-origin: 100% 60%; }
.sl-wing-r { transform-origin: 0% 60%; }

.sl-buddy.sl-trick-waddle .sl-part-flipper { animation: sl-part-flap .32s ease-in-out 5; }
.sl-buddy.sl-trick-waddle .sl-flip-r { animation-delay: .16s; }
.sl-buddy.sl-trick-hop .sl-part-ear { animation: sl-part-twitch .5s ease-in-out 3; }
.sl-buddy.sl-trick-hop .sl-ear-r { animation-delay: .1s; }
.sl-buddy.sl-trick-buzz .sl-part-wing { animation: sl-part-flutter .11s ease-in-out 14; }
.sl-buddy.sl-trick-drift .sl-part-tentacle { animation: sl-part-ripple 1.1s ease-in-out 2; }
.sl-buddy.sl-trick-drift .sl-tent-2 { animation-delay: .12s; }
.sl-buddy.sl-trick-drift .sl-tent-3 { animation-delay: .2s; }
.sl-buddy.sl-trick-drift .sl-tent-4 { animation-delay: .3s; }
.sl-buddy.sl-trick-wag .sl-part-tail { animation: sl-part-wagtail .17s ease-in-out 8; }
.sl-buddy.sl-trick-drizzle .sl-part-drop { animation: sl-part-fall 1.1s ease-in 2; }
.sl-buddy.sl-trick-drizzle .sl-drop-2 { animation-delay: .25s; }
.sl-buddy.sl-trick-drizzle .sl-drop-3 { animation-delay: .5s; }
.sl-buddy.sl-trick-yawn .sl-part-star { animation: sl-part-twinkle 1.1s ease-in-out 2; }
.sl-buddy.sl-trick-yawn .sl-star-2 { animation-delay: .2s; }
.sl-buddy.sl-trick-yawn .sl-star-3 { animation-delay: .45s; }
.sl-buddy.sl-trick-sway .sl-part-leaf { animation: sl-part-leaf-sway 2.4s ease-in-out; }

/* A cone rocks on its base and refuses to fall over. */
@keyframes sl-trick-wobble {
  0%, 100% { transform: rotate(0deg); }
  15%      { transform: rotate(-9deg); }
  35%      { transform: rotate(7deg); }
  55%      { transform: rotate(-5deg); }
  75%      { transform: rotate(3deg); }
}
/* A penguin shuffles from foot to foot. */
@keyframes sl-trick-waddle {
  0%, 100% { transform: rotate(0deg) translateX(0); }
  20%      { transform: rotate(-6deg) translateX(-4%); }
  45%      { transform: rotate(5deg) translateX(4%); }
  70%      { transform: rotate(-4deg) translateX(-2%); }
  88%      { transform: rotate(2deg) translateX(1%); }
}
@keyframes sl-part-flap {
  0%, 100% { transform: rotate(0deg); }
  50%      { transform: rotate(26deg); }
}
/* A bunny gathers itself and hops. */
@keyframes sl-trick-hop {
  0%, 100% { transform: translateY(0) scale(1, 1); }
  18%      { transform: translateY(4%) scale(1.06, .92); }
  45%      { transform: translateY(-20%) scale(.95, 1.08); }
  72%      { transform: translateY(0) scale(1.04, .96); }
}
@keyframes sl-part-twitch {
  0%, 100% { transform: rotate(0deg); }
  40%      { transform: rotate(-13deg); }
  70%      { transform: rotate(6deg); }
}
/* A bee hovers, never quite still. */
@keyframes sl-trick-buzz {
  0%, 100% { transform: translate(0, 0); }
  15%      { transform: translate(-3%, -8%); }
  35%      { transform: translate(3%, -4%); }
  55%      { transform: translate(-2%, -9%); }
  75%      { transform: translate(2%, -3%); }
}
@keyframes sl-part-flutter {
  0%, 100% { transform: rotate(0deg) scaleY(1); }
  50%      { transform: rotate(-18deg) scaleY(.7); }
}
/* A jellyfish pulses and glides upward. */
@keyframes sl-trick-drift {
  0%, 100% { transform: translateY(0) scale(1, 1); }
  30%      { transform: translateY(-9%) scale(.92, 1.1); }
  60%      { transform: translateY(-3%) scale(1.07, .93); }
}
@keyframes sl-part-ripple {
  0%, 100% { transform: rotate(0deg); }
  35%      { transform: rotate(7deg); }
  70%      { transform: rotate(-6deg); }
}
/* A corgi is delighted. */
@keyframes sl-trick-wag {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25%      { transform: translateY(-5%) rotate(-3deg); }
  50%      { transform: translateY(0) rotate(0deg); }
  75%      { transform: translateY(-4%) rotate(3deg); }
}
@keyframes sl-part-wagtail {
  0%, 100% { transform: rotate(-16deg); }
  50%      { transform: rotate(18deg); }
}
/* A cloud drifts while it rains. */
@keyframes sl-trick-drizzle {
  0%, 100% { transform: translateX(0) translateY(0); }
  30%      { transform: translateX(-3%) translateY(-3%); }
  65%      { transform: translateX(3%) translateY(-1%); }
}
@keyframes sl-part-fall {
  0%   { opacity: 0; transform: translateY(-40%) scale(.6); }
  25%  { opacity: 1; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(70%) scale(.85); }
}
/* The moon has a long, contented yawn. */
@keyframes sl-trick-yawn {
  0%, 100% { transform: rotate(0deg) scale(1); }
  30%      { transform: rotate(-6deg) scale(1.07); }
  60%      { transform: rotate(-4deg) scale(1.05); }
  85%      { transform: rotate(2deg) scale(.99); }
}
@keyframes sl-part-twinkle {
  0%, 100% { transform: scale(1) rotate(0deg); opacity: .85; }
  45%      { transform: scale(1.55) rotate(22deg); opacity: 1; }
}
/* Leaves catch a draught. */
@keyframes sl-trick-sway {
  0%, 100% { transform: rotate(0deg); }
  25%      { transform: rotate(4deg); }
  60%      { transform: rotate(-3.5deg); }
  85%      { transform: rotate(1.5deg); }
}
@keyframes sl-part-leaf-sway {
  0%, 100% { transform: rotate(0deg); }
  30%      { transform: rotate(7deg); }
  70%      { transform: rotate(-6deg); }
}
/* A cat crouches, thinks about it, then loses interest. */
@keyframes sl-trick-pounce {
  0%, 100% { transform: translateY(0) scaleY(1); }
  18%      { transform: translateY(3%) scaleY(.93); }
  40%      { transform: translateY(-14%) scaleY(1.05); }
  62%      { transform: translateY(0) scaleY(.97); }
}

/* The placard beat, timed with the trick. */
@keyframes sl-card-pop {
  0%   { transform: rotate(-3deg) scale(1); }
  30%  { transform: rotate(0.5deg) scale(1.16); }
  60%  { transform: rotate(-2deg) scale(1.06); }
  100% { transform: rotate(-3deg) scale(1); }
}

@keyframes sl-buddy-blink {
  0%, 91%, 100% { transform: scaleY(1); }
  94%, 96%      { transform: scaleY(.08); }
}

/* ---- meme-inspired styles ----
 * Each borrows a format's typography and layout rather than its picture. The
 * famous meme images are copyrighted photographs, so none is reproduced here;
 * the visual language does the work, and it recolours to the label and scales
 * with everything else.
 */

/* The classic image macro: heavy condensed caps, white with a black outline.
   No panel behind it - the caption sits straight over the page, which is what
   makes it read as a macro. A rule in the label's colour keeps the
   environment's identity in play. */
.sl-meme-impact {
  position: absolute;
  left: 0;
  right: 0;
  text-align: center;
  padding: 0 var(--sl-pad-x);
  font-family: Impact, Haettenschweiler, "Arial Narrow Bold",
               "Franklin Gothic Bold", "Segoe UI Black", sans-serif;
  font-weight: 400;
  font-size: calc(var(--sl-font) * 2.05);
  line-height: 1.06;
  letter-spacing: .01em;
  text-transform: uppercase;
  color: #ffffff;
  text-shadow:
    ${px(2)} ${px(2)} 0 #000, -${px(2)} ${px(2)} 0 #000,
    ${px(2)} -${px(2)} 0 #000, -${px(2)} -${px(2)} 0 #000,
    ${px(3)} 0 0 #000, -${px(3)} 0 0 #000,
    0 ${px(3)} 0 #000, 0 -${px(3)} 0 #000;
}
.sl-meme-impact.top { top: calc(var(--sl-inset) * 1.1); }
.sl-meme-impact .sl-host {
  font-family: "Segoe UI", system-ui, sans-serif;
  text-shadow: 0 1px 2px rgba(0,0,0,.9);
  font-size: .34em;
  letter-spacing: .04em;
}
.sl-meme-impact-rule {
  display: block;
  width: 42%;
  height: ${px(4)};
  margin: ${px(4)} auto 0;
  background: ${bg};
  border-radius: ${px(2)};
  box-shadow: 0 0 0 ${px(1.5)} rgba(0,0,0,.85);
}

/* Hazard tape: the label colour behind rolling diagonal stripes. */
.sl-meme-hazard {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  min-height: calc(var(--sl-barh) * 1.15);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--sl-pad-y) var(--sl-pad-x);
  background: ${bg};
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0,0,0,.45);
}
.sl-meme-hazard-stripes {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -60%;
  width: 220%;
  background: repeating-linear-gradient(
    45deg,
    rgba(0,0,0,.82) 0 ${px(16)},
    rgba(0,0,0,0) ${px(16)} ${px(32)}
  );
  /* Only a transform animates, so this stays cheap. */
  animation: sl-hazard-roll 1.9s linear infinite;
}
@keyframes sl-hazard-roll {
  from { transform: translateX(0); }
  to   { transform: translateX(${px(45.25)}); }
}
.sl-meme-hazard .sl-text,
.sl-meme-hazard .sl-host {
  position: relative;
  z-index: 1;
  text-shadow: 0 ${px(1)} ${px(3)} rgba(0,0,0,.95), 0 0 ${px(2)} rgba(0,0,0,.9);
}

/* Rubber stamp: double rule, wide tracking, set at an angle. */
.sl-meme-stamp {
  position: absolute;
  top: calc(var(--sl-inset) * 2.2);
  right: calc(var(--sl-inset) * 2.2);
  padding: calc(var(--sl-pad-y) * 1.15) calc(var(--sl-pad-x) * 1.5);
  color: ${bg};
  background: rgba(255,255,255,.05);
  border: ${px(3.5)} solid ${bg};
  border-radius: ${px(4)};
  outline: ${px(1.5)} solid ${bg};
  outline-offset: ${px(3)};
  font-weight: 800;
  font-size: calc(var(--sl-font) * 1.15);
  letter-spacing: .18em;
  text-transform: uppercase;
  transform: rotate(-13deg);
  text-shadow: 0 0 ${px(1)} rgba(255,255,255,.45);
  max-width: 44vw;
  overflow: hidden;
}
.sl-meme-stamp.sl-placed { transform: rotate(-13deg); }

/* Glitch: the label with two offset colour copies behind it. */
.sl-meme-glitch {
  position: absolute;
  top: calc(var(--sl-inset) * 1.6);
  left: calc(var(--sl-inset) * 1.6);
  padding: var(--sl-pad-y) var(--sl-pad-x);
  background: ${bg};
  color: ${fg};
  border-radius: ${px(3)};
  box-shadow: 0 2px 8px rgba(0,0,0,.4);
  isolation: isolate;
  max-width: 44vw;
  overflow: hidden;
}
.sl-glitch-copy {
  position: absolute;
  top: 0;
  left: 0;
  padding: inherit;
  white-space: nowrap;
  pointer-events: none;
  mix-blend-mode: screen;
}
.sl-glitch-copy.c1 { color: #00e5ff; animation: sl-glitch-1 1.9s steps(1, end) infinite; }
.sl-glitch-copy.c2 { color: #ff0057; animation: sl-glitch-2 1.9s steps(1, end) infinite; }
@keyframes sl-glitch-1 {
  0%, 88%, 100% { transform: translate(0, 0); opacity: 0; }
  90%           { transform: translate(-${px(2.5)}, ${px(1)}); opacity: .95; }
  94%           { transform: translate(${px(2)}, -${px(1)}); opacity: .8; }
}
@keyframes sl-glitch-2 {
  0%, 88%, 100% { transform: translate(0, 0); opacity: 0; }
  91%           { transform: translate(${px(2.5)}, -${px(1)}); opacity: .95; }
  96%           { transform: translate(-${px(2)}, ${px(1)}); opacity: .8; }
}

/* Terminal: monospace green on black, with a blinking block cursor. */
.sl-meme-terminal {
  position: absolute;
  bottom: calc(var(--sl-inset) * 1.6);
  left: calc(var(--sl-inset) * 1.6);
  display: flex;
  align-items: baseline;
  gap: .4em;
  padding: var(--sl-pad-y) calc(var(--sl-pad-x) * 1.1);
  background: #0b0f0c;
  color: ${shade(bg, 0.45)};
  border: ${px(1.5)} solid ${shade(bg, 0.1)};
  border-radius: ${px(3)};
  font-family: Consolas, "Cascadia Mono", "SF Mono", Menlo, monospace;
  font-weight: 600;
  letter-spacing: .06em;
  text-transform: none;
  box-shadow: 0 2px 10px rgba(0,0,0,.5), inset 0 0 ${px(14)} rgba(0,0,0,.6);
  max-width: 44vw;
  overflow: hidden;
}
.sl-meme-terminal .sl-prompt { opacity: .7; }
.sl-meme-terminal .sl-host { font-family: inherit; font-size: .78em; }
.sl-term-cursor {
  display: inline-block;
  width: .58em;
  height: 1em;
  background: ${shade(bg, 0.45)};
  animation: sl-term-blink 1.05s steps(1, end) infinite;
  transform: translateY(.1em);
}
@keyframes sl-term-blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }

/* ---- glow ----
   Not a specular sweep across the surface - that read as a reflection rather
   than a light. This is the label's own edge glowing: a halo that swells and
   fades while cycling through three related hues, so it pulls the eye the way
   a warning lamp does. */
.sl-glow .sl-inner,
.sl-glow .sl-bar,
.sl-glow .sl-badge,
.sl-glow .sl-pill,
.sl-glow .sl-side,
.sl-glow .sl-edge,
.sl-glow .sl-edge-chip,
.sl-glow .sl-corner-chip,
.sl-glow .sl-buddy-card,
.sl-glow .sl-frame-tab {
  animation: sl-glow-pulse ${glowSeconds}s ease-in-out infinite;
}

@keyframes sl-glow-pulse {
  0%, 100% {
    box-shadow: 0 0 ${px(5)} ${px(1)} ${glowA}, 0 0 ${px(12)} ${px(2)} ${glowSoftA}, 0 1px ${px(5)} rgba(0,0,0,.4);
    border-color: ${glowA};
  }
  33% {
    box-shadow: 0 0 ${px(11)} ${px(3)} ${glowB}, 0 0 ${px(26)} ${px(8)} ${glowSoftB}, 0 1px ${px(5)} rgba(0,0,0,.4);
    border-color: ${glowB};
  }
  66% {
    box-shadow: 0 0 ${px(9)} ${px(2)} ${glowC}, 0 0 ${px(20)} ${px(6)} ${glowSoftC}, 0 1px ${px(5)} rgba(0,0,0,.4);
    border-color: ${glowC};
  }
}

/* A frame or bracket set glows along its own border. */
.sl-glow .sl-frame,
.sl-glow .sl-corner {
  animation: sl-glow-edge ${glowSeconds}s ease-in-out infinite;
}
@keyframes sl-glow-edge {
  0%, 100% { border-color: ${glowA}; box-shadow: 0 0 ${px(8)} ${glowSoftA}, inset 0 0 ${px(8)} ${glowSoftA}; }
  33%      { border-color: ${glowB}; box-shadow: 0 0 ${px(22)} ${glowSoftB}, inset 0 0 ${px(20)} ${glowSoftB}; }
  66%      { border-color: ${glowC}; box-shadow: 0 0 ${px(16)} ${glowSoftC}, inset 0 0 ${px(14)} ${glowSoftC}; }
}

.sl-watermark.sl-glowing { animation: sl-pulse ${glowSeconds}s ease-in-out infinite; }
@keyframes sl-pulse {
  0%, 100% { opacity: .22; color: ${glowA}; }
  50%      { opacity: .48; color: ${glowB}; }
}

@media print { .sl-layer { display: none !important; } }
@media (prefers-reduced-motion: no-preference) {
  .sl-layer { transition: opacity .12s ease-out; }
}
/* Someone who has asked the system for less motion gets the highlight, but
   parked rather than running. */
@media (prefers-reduced-motion: reduce) {
  .sl-meme-hazard-stripes, .sl-glitch-copy, .sl-term-cursor { animation: none; }
  .sl-glitch-copy { opacity: 0; }
  .sl-glow .sl-inner, .sl-glow .sl-bar, .sl-glow .sl-badge, .sl-glow .sl-pill,
  .sl-glow .sl-side, .sl-glow .sl-edge, .sl-glow .sl-edge-chip,
  .sl-glow .sl-corner-chip, .sl-glow .sl-buddy-card, .sl-glow .sl-frame-tab,
  .sl-glow .sl-frame, .sl-glow .sl-corner {
    animation: none;
    box-shadow: 0 0 ${px(10)} ${px(3)} ${glowB}, 0 1px ${px(5)} rgba(0,0,0,.4);
  }
  .sl-watermark.sl-glowing, .sl-glow .sl-corner { animation: none; }
  .sl-buddy-svg, .sl-buddy-eyes, .sl-buddy-card,
  .sl-part-flipper, .sl-part-drop, .sl-part-ear, .sl-part-wing,
  .sl-part-tentacle, .sl-part-tail, .sl-part-star, .sl-part-leaf { animation: none; }
}
`;
  }

  /* ------------------------------------------------------------------ *
   * DOM construction - textContent only, never innerHTML
   * ------------------------------------------------------------------ */

  function makeTextNodes(parent, text, hostText) {
    const span = document.createElement('span');
    span.className = 'sl-text';
    span.textContent = text;
    parent.appendChild(span);
    if (hostText) {
      const sub = document.createElement('span');
      sub.className = 'sl-host';
      sub.textContent = hostText;
      parent.appendChild(sub);
    }
  }

  function cornerOf(mode) {
    if (mode.indexOf('top-left') !== -1) return 'tl';
    if (mode.indexOf('top-right') !== -1) return 'tr';
    if (mode.indexOf('bottom-left') !== -1) return 'bl';
    if (mode.indexOf('bottom-right') !== -1) return 'br';
    return 'tr';
  }

  function buildLayer(style, text) {
    const layer = document.createElement('div');
    layer.className =
      'sl-layer' +
      (style.clickToDismiss ? ' sl-interactive' : '') +
      (style.glow ? ' sl-glow' : '');
    const mode = style.displayMode;
    const hostText = style.showUrlHost ? location.hostname : '';
    let handle = null;
    let mover = null;
    let resizer = null;

    /** A filled, text-bearing element - the shape most modes are built from. */
    function chip(className) {
      const el = document.createElement('div');
      el.className = className + ' sl-hit';
      makeTextNodes(el, text, hostText);
      return el;
    }

    if (mode.startsWith('ribbon-')) {
      const wrap = document.createElement('div');
      wrap.className = 'sl-ribbon ' + cornerOf(mode);
      const inner = document.createElement('div');
      inner.className = 'sl-inner sl-hit';
      makeTextNodes(inner, text, hostText);
      wrap.appendChild(inner);
      layer.appendChild(wrap);
      handle = inner;
      mover = wrap;
    } else if (mode === 'bar-top' || mode === 'bar-bottom') {
      const bar = chip('sl-bar ' + (mode === 'bar-top' ? 'top' : 'bottom'));
      layer.appendChild(bar);
      handle = mover = bar;
    } else if (mode === 'edge-top' || mode === 'edge-bottom') {
      const side = mode === 'edge-top' ? 'top' : 'bottom';
      const line = document.createElement('div');
      line.className = 'sl-edge ' + side;
      layer.appendChild(line);
      const tag = chip('sl-edge-chip ' + side);
      layer.appendChild(tag);
      handle = mover = tag;
    } else if (mode === 'side-left' || mode === 'side-right') {
      const tab = chip('sl-side ' + (mode === 'side-left' ? 'left' : 'right'));
      layer.appendChild(tab);
      handle = mover = tab;
    } else if (mode === 'pill-top-center' || mode === 'pill-bottom-center') {
      const pill = chip('sl-pill ' + (mode === 'pill-top-center' ? 'top' : 'bottom'));
      layer.appendChild(pill);
      handle = mover = pill;
    } else if (mode === 'corners') {
      ['tl', 'tr', 'bl', 'br'].forEach((corner) => {
        const bracket = document.createElement('div');
        bracket.className = 'sl-corner ' + corner;
        layer.appendChild(bracket);
      });
      const tag = chip('sl-corner-chip');
      layer.appendChild(tag);
      handle = mover = tag;
    } else if (mode === 'frame' || mode === 'frame-labelled') {
      const frame = document.createElement('div');
      frame.className = 'sl-frame';
      layer.appendChild(frame);
      if (style.glow) {
        const halo = document.createElement('div');
        halo.className = 'sl-frame-glow';
        layer.appendChild(halo);
      }
      if (mode === 'frame-labelled') {
        const tab = chip('sl-frame-tab');
        layer.appendChild(tab);
        handle = mover = tab;
      }
    } else if (mode.startsWith('badge-')) {
      const badge = chip('sl-badge ' + cornerOf(mode));
      layer.appendChild(badge);
      handle = mover = badge;
    } else if (mode === 'buddy') {
      // The whole character is the grab handle - reaching for the little
      // placard alone was fiddly, and the figure is the obvious thing to grab.
      const wrap = document.createElement('div');
      wrap.className = 'sl-buddy br sl-hit';

      // If the character module is not loaded - which happens in a tab still
      // running an older injection - show the placard on its own rather than
      // failing and taking the whole label with it.
      if (typeof SL.buildBuddySvg === 'function') {
        wrap.appendChild(SL.buildBuddySvg(style.buddy));
      }

      const card = document.createElement('div');
      card.className = 'sl-buddy-card';
      makeTextNodes(card, text, hostText);
      wrap.appendChild(card);

      const grip = document.createElement('div');
      grip.className = 'sl-buddy-grip';
      wrap.appendChild(grip);

      layer.appendChild(wrap);
      handle = wrap;
      mover = wrap;
      resizer = { grip: grip, target: wrap };
    } else if (mode === 'meme-impact') {
      const cap = document.createElement('div');
      cap.className = 'sl-meme-impact sl-hit top';
      makeTextNodes(cap, text, hostText);
      const rule = document.createElement('span');
      rule.className = 'sl-meme-impact-rule';
      cap.appendChild(rule);
      layer.appendChild(cap);
      handle = mover = cap;
    } else if (mode === 'meme-hazard') {
      const bar = document.createElement('div');
      bar.className = 'sl-meme-hazard sl-hit';
      const stripes = document.createElement('span');
      stripes.className = 'sl-meme-hazard-stripes';
      bar.appendChild(stripes);
      makeTextNodes(bar, text, hostText);
      layer.appendChild(bar);
      handle = mover = bar;
    } else if (mode === 'meme-stamp') {
      const stamp = document.createElement('div');
      stamp.className = 'sl-meme-stamp sl-hit';
      makeTextNodes(stamp, text, hostText);
      layer.appendChild(stamp);
      handle = mover = stamp;
    } else if (mode === 'meme-glitch') {
      const chip = document.createElement('div');
      chip.className = 'sl-meme-glitch sl-hit';
      makeTextNodes(chip, text, hostText);
      // Two offset colour copies sitting behind the real text.
      ['c1', 'c2'].forEach((which) => {
        const copy = document.createElement('span');
        copy.className = 'sl-glitch-copy ' + which;
        copy.textContent = text;
        chip.appendChild(copy);
      });
      layer.appendChild(chip);
      handle = mover = chip;
    } else if (mode === 'meme-terminal') {
      const term = document.createElement('div');
      term.className = 'sl-meme-terminal sl-hit';
      const prompt = document.createElement('span');
      prompt.className = 'sl-prompt';
      prompt.textContent = '>';
      term.appendChild(prompt);
      makeTextNodes(term, text, hostText);
      const cursor = document.createElement('span');
      cursor.className = 'sl-term-cursor';
      term.appendChild(cursor);
      layer.appendChild(term);
      handle = mover = term;
    } else if (mode === 'watermark') {
      const wm = document.createElement('div');
      wm.className = 'sl-watermark sl-hit' + (style.glow ? ' sl-glowing' : '');
      makeTextNodes(wm, text, '');
      layer.appendChild(wm);
      handle = mover = wm;
    }

    return { layer: layer, handle: handle, mover: mover, resizer: resizer };
  }

  /* ------------------------------------------------------------------ *
   * Mount / unmount
   * ------------------------------------------------------------------ */

  function ensureHost() {
    if (hostEl && hostEl.isConnected) return hostEl;
    hostEl = document.createElement('div');
    hostEl.id = HOST_ID;
    hostEl.setAttribute('role', 'presentation');
    hostEl.style.cssText =
      'all:initial;position:fixed;inset:0;z-index:' + Z + ';pointer-events:none;';
    shadow = hostEl.attachShadow({ mode: 'closed' });
    (document.body || document.documentElement).appendChild(hostEl);
    return hostEl;
  }

  function applyPush(style) {
    const root = document.documentElement;
    root.style.removeProperty('--site-label-push');
    if (!style || !style.pushContent) {
      if (root.dataset.siteLabelPushed) {
        root.style.paddingTop = root.dataset.siteLabelPrevPadTop || '';
        root.style.paddingBottom = root.dataset.siteLabelPrevPadBottom || '';
        delete root.dataset.siteLabelPushed;
      }
      return;
    }
    if (style.displayMode !== 'bar-top' && style.displayMode !== 'bar-bottom') return;

    if (!root.dataset.siteLabelPushed) {
      root.dataset.siteLabelPrevPadTop = root.style.paddingTop || '';
      root.dataset.siteLabelPrevPadBottom = root.style.paddingBottom || '';
      root.dataset.siteLabelPushed = '1';
    }
    if (style.displayMode === 'bar-top') root.style.paddingTop = style.barHeight + 'px';
    else root.style.paddingBottom = style.barHeight + 'px';
  }

  /* ------------------------------------------------------------------ *
   * Free positioning and dragging
   * ------------------------------------------------------------------ */

  /**
   * Place a dragged label. Positions are stored as viewport fractions so they
   * survive a window resize, and the mode's own anchors are cleared so the
   * inline placement is the only thing deciding where it sits.
   */
  function applyPlacement(mover, style) {
    if (!mover || !SL.hasCustomPosition(style)) return;
    const isBar = style.displayMode === 'bar-top' || style.displayMode === 'bar-bottom';

    mover.classList.add('sl-placed');
    mover.style.top = (style.posY * 100).toFixed(3) + '%';
    mover.style.bottom = 'auto';

    // A bar always spans the full width; only its vertical place is its own.
    if (!isBar) {
      mover.style.left = (style.posX * 100).toFixed(3) + '%';
      mover.style.right = 'auto';
    }
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function enableDragging(layer, handle, mover, style) {
    if (!handle || !mover) return;

    let dragging = false;
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let originLeft = 0;
    let originTop = 0;
    let moved = false;

    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      const rect = mover.getBoundingClientRect();
      dragging = true;
      moved = false;
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      originLeft = rect.left;
      originTop = rect.top;
      layer.classList.add('sl-dragging');
      try {
        handle.setPointerCapture(pointerId);
      } catch (err) {
        /* capture is a nicety, not a requirement */
      }
      event.preventDefault();
      event.stopPropagation();
    });

    handle.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;

      const rect = mover.getBoundingClientRect();
      const maxLeft = Math.max(0, window.innerWidth - rect.width);
      const maxTop = Math.max(0, window.innerHeight - rect.height);

      mover.classList.add('sl-placed');
      mover.style.top = clamp(originTop + dy, 0, maxTop) + 'px';
      mover.style.bottom = 'auto';
      const isBar = style.displayMode === 'bar-top' || style.displayMode === 'bar-bottom';
      if (!isBar) {
        mover.style.left = clamp(originLeft + dx, 0, maxLeft) + 'px';
        mover.style.right = 'auto';
      }
      event.preventDefault();
    });

    function finish(event) {
      if (!dragging) return;
      dragging = false;
      layer.classList.remove('sl-dragging');
      try {
        handle.releasePointerCapture(pointerId);
      } catch (err) {
        /* already released */
      }
      if (!moved) return;

      const rect = mover.getBoundingClientRect();
      savePosition(
        clamp(rect.left / Math.max(1, window.innerWidth), 0, 1),
        clamp(rect.top / Math.max(1, window.innerHeight), 0, 1)
      );
      if (event) event.preventDefault();
    }

    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', finish);
    // A drag that ends on the label would otherwise read as a click.
    handle.addEventListener('click', (event) => {
      if (moved) {
        event.preventDefault();
        event.stopPropagation();
      }
    });
  }

  /**
   * Drag the grip to resize the buddy. Feedback is a live CSS scale on the
   * wrapper, which is cheap; the real `scale` is written once on release and
   * the label re-renders at the new size.
   */
  function enableResizing(layer, resizer, style) {
    if (!resizer || !resizer.grip) return;
    const grip = resizer.grip;
    const target = resizer.target;

    let active = false;
    let pointerId = null;
    let startY = 0;
    let startX = 0;
    let factor = 1;

    /*
     * Growth is anchored to the corner the buddy is docked to, so it expands
     * into the page instead of sliding off the edge. The grip is on the
     * opposite corner, and dragging it away from the anchor enlarges - which
     * means the sign of each axis depends on which corner we are docked to.
     */
    const dock = target.classList.contains('tl') ? 'tl'
      : target.classList.contains('tr') ? 'tr'
      : target.classList.contains('bl') ? 'bl'
      : 'br';
    const ORIGIN = { tl: '0% 0%', tr: '100% 0%', bl: '0% 100%', br: '100% 100%' };
    // x grows when dragging away from the anchor horizontally, y vertically.
    const SIGN = {
      tl: { x: 1, y: 1 },
      tr: { x: -1, y: 1 },
      bl: { x: 1, y: -1 },
      br: { x: -1, y: -1 }
    };
    const corner = ORIGIN[dock];
    const sign = SIGN[dock];

    grip.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      active = true;
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      factor = 1;
      target.style.transformOrigin = corner;
      layer.classList.add('sl-dragging');
      try {
        grip.setPointerCapture(pointerId);
      } catch (err) {
        /* capture is a nicety */
      }
      event.preventDefault();
      event.stopPropagation();
    });

    grip.addEventListener('pointermove', (event) => {
      if (!active) return;
      const dx = (event.clientX - startX) * sign.x;
      const dy = (event.clientY - startY) * sign.y;
      const delta = (dx + dy) / 2;
      const base = 120;
      factor = Math.max(0.5 / style.scale, Math.min(3 / style.scale, 1 + delta / base));
      target.style.transform = 'scale(' + factor.toFixed(3) + ')';
      event.preventDefault();
    });

    function finish(event) {
      if (!active) return;
      active = false;
      layer.classList.remove('sl-dragging');
      try {
        grip.releasePointerCapture(pointerId);
      } catch (err) {
        /* already released */
      }
      target.style.transform = '';
      target.style.transformOrigin = '';
      const next = Math.round(style.scale * factor * 100) / 100;
      if (Math.abs(next - style.scale) > 0.01) saveStylePatch({ scale: next });
      if (event) event.preventDefault();
    }

    grip.addEventListener('pointerup', finish);
    grip.addEventListener('pointercancel', finish);
    grip.addEventListener('click', (event) => event.stopPropagation());
  }

  /** Write a style change from the page back into this site's own override. */
  async function saveStylePatch(patch) {
    if (!current) return;
    const siteId = current.site.id;
    try {
      const fresh = await SL.getState();
      const site = fresh.sites.find((s) => s.id === siteId);
      if (!site) return;
      site.style = SL.normalizeStyleOverride(Object.assign({}, site.style, patch));
      await SL.saveState(fresh);
    } catch (err) {
      /* storage unavailable - the change stays visual only */
    }
  }

  /** Write the dragged position back to this site's own style override. */
  function savePosition(posX, posY) {
    return saveStylePatch({ posX: posX, posY: posY });
  }

  /* ------------------------------------------------------------------ *
   * Buddy tricks
   *
   * Each character performs its own move on a timer - the cup takes a sip, the
   * clock rings, the cat thinks about pouncing - and the placard pops at the
   * same moment so the label is what your eye lands on.
   * ------------------------------------------------------------------ */

  let buddyTimer = null;
  let buddyClearTimer = null;
  let buddyWrapEl = null;

  // Longest trick is the plant's sway at 2.4s; clear a little after that.
  const TRICK_MS = 2700;

  function stopBuddyTricks() {
    if (buddyTimer) clearTimeout(buddyTimer);
    if (buddyClearTimer) clearTimeout(buddyClearTimer);
    buddyTimer = null;
    buddyClearTimer = null;
    buddyWrapEl = null;
  }

  /** Run the character's move now, whether or not it is due. */
  function performTrick() {
    if (!buddyWrapEl || !current) return;
    const trick = SL.buddyTrick(current.style.buddy);

    // Remove first and force a reflow, or re-adding the same class does
    // nothing and the animation never replays.
    buddyWrapEl.classList.remove('sl-trick', 'sl-trick-' + trick);
    void buddyWrapEl.offsetWidth;
    buddyWrapEl.classList.add('sl-trick', 'sl-trick-' + trick);

    if (buddyClearTimer) clearTimeout(buddyClearTimer);
    buddyClearTimer = setTimeout(() => {
      if (buddyWrapEl) buddyWrapEl.classList.remove('sl-trick', 'sl-trick-' + trick);
    }, TRICK_MS);
  }

  /**
   * Queue the next trick. Jitter either side of the interval stops several
   * open tabs performing in unison, which is more startling than charming.
   */
  function scheduleBuddyTricks(style) {
    if (buddyTimer) clearTimeout(buddyTimer);
    if (!style.buddyTricks) return;
    const delay = style.buddyInterval * 1000 * (0.75 + Math.random() * 0.5);
    buddyTimer = setTimeout(() => {
      if (document.hidden) {
        // Nobody is watching; wait rather than perform to an empty room.
        scheduleBuddyTricks(style);
        return;
      }
      performTrick();
      scheduleBuddyTricks(style);
    }, delay);
  }

  function render() {
    const shouldShow =
      state &&
      state.settings.enabled &&
      current &&
      !hiddenForTab &&
      !(state.settings.hideOnFullscreen && document.fullscreenElement);

    stopBuddyTricks();

    if (!shouldShow) {
      if (hostEl && hostEl.isConnected) hostEl.remove();
      applyPush(null);
      applyTitle(null);
      return;
    }

    ensureHost();
    while (shadow.firstChild) shadow.removeChild(shadow.firstChild);

    const styleEl = document.createElement('style');
    styleEl.textContent = buildCss(current.style);
    shadow.appendChild(styleEl);

    const style = current.style;
    let built;
    try {
      built = buildLayer(style, current.text);
    } catch (err) {
      built = buildFallbackLayer(style, current.text);
    }
    const layer = built.layer;
    const unlocked = !style.locked && SL.isDraggableMode(style.displayMode);

    if (unlocked) layer.classList.add('sl-unlocked');
    applyPlacement(built.mover, style);

    // Click-to-dismiss would fight with dragging, so it waits until locked.
    if (style.clickToDismiss && !unlocked) {
      layer.addEventListener('click', (event) => {
        event.stopPropagation();
        hiddenForTab = true;
        render();
      });
    }
    if (unlocked) {
      enableDragging(layer, built.handle, built.mover, style);
      enableResizing(layer, built.resizer, style);
    }

    shadow.appendChild(layer);

    if (style.displayMode === 'buddy') {
      buddyWrapEl = layer.querySelector('.sl-buddy');
      scheduleBuddyTricks(style);
    }

    applyPush(current.style);
    applyTitle(current.text);
  }

  /* ------------------------------------------------------------------ *
   * Optional tab-title prefix
   * ------------------------------------------------------------------ */

  function applyTitle(text) {
    const want = state && state.settings.titlePrefix && text ? '[' + text + '] ' : null;

    if (!want) {
      if (titleObserver) {
        titleObserver.disconnect();
        titleObserver = null;
      }
      if (originalTitle !== null && document.title !== originalTitle) {
        document.title = originalTitle;
      }
      originalTitle = null;
      return;
    }

    const setPrefix = () => {
      const titleEl = document.querySelector('title');
      if (!titleEl) return;
      const raw = titleEl.textContent || '';
      if (raw.startsWith(want)) return;
      originalTitle = raw;
      titleEl.textContent = want + raw;
    };

    setPrefix();

    if (!titleObserver) {
      const titleEl = document.querySelector('title');
      if (!titleEl) return;
      titleObserver = new MutationObserver(() => setPrefix());
      titleObserver.observe(titleEl, { childList: true, characterData: true, subtree: true });
    }
  }

  /* ------------------------------------------------------------------ *
   * Match evaluation
   * ------------------------------------------------------------------ */

  function evaluate() {
    if (!state) return;
    const site = SL.findMatch(location.href, state.sites);
    if (!site) {
      current = null;
      render();
      reportToBackground(null);
      return;
    }
    const group = SL.getGroup(state, site.groupId);
    current = {
      site: site,
      group: group,
      style: SL.resolveStyle(site, group),
      text: SL.resolveLabelText(site, group)
    };
    render();
    reportToBackground(current);
  }

  function reportToBackground(match) {
    try {
      chrome.runtime.sendMessage(
        {
          type: 'sl:pageStatus',
          url: location.href,
          label: match ? match.text : '',
          color: match ? match.style.background : '',
          matched: !!match
        },
        () => void chrome.runtime.lastError
      );
    } catch (err) {
      /* service worker asleep or extension reloading - nothing to do */
    }
  }

  /* ------------------------------------------------------------------ *
   * Keeping the label alive on single page apps
   * ------------------------------------------------------------------ */

  function watchForRemoval() {
    // Frameworks such as the D365 F&O client replace large parts of the DOM;
    // if our host element goes with it, put it straight back.
    const observer = new MutationObserver(() => {
      if (current && !hiddenForTab && hostEl && !hostEl.isConnected) render();
    });
    observer.observe(document.documentElement, { childList: true, subtree: false });
    if (document.body) observer.observe(document.body, { childList: true, subtree: false });
  }

  function watchForNavigation() {
    const check = () => {
      if (location.href === lastUrl) return;
      lastUrl = location.href;
      hiddenForTab = false;
      evaluate();
    };
    window.addEventListener('popstate', check);
    window.addEventListener('hashchange', check);
    // History pushState in an SPA fires no event we can listen to without
    // patching page globals, so poll cheaply instead.
    setInterval(check, 700);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) check();
    });
    document.addEventListener('fullscreenchange', render);
  }

  /* ------------------------------------------------------------------ *
   * Wiring
   * ------------------------------------------------------------------ */

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[SL.STORAGE_KEY]) return;
    state = SL.normalizeState(changes[SL.STORAGE_KEY].newValue);
    evaluate();
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message !== 'object') return undefined;

    if (message.type === 'sl:toggleTab') {
      hiddenForTab = !hiddenForTab;
      render();
      sendResponse({ hidden: hiddenForTab });
      return undefined;
    }
    if (message.type === 'sl:refresh') {
      // Files were re-injected under a running instance; re-read and redraw.
      SL.getState().then((loaded) => {
        state = loaded;
        evaluate();
      });
      sendResponse({ ok: true });
      return undefined;
    }
    if (message.type === 'sl:buddyTrick') {
      performTrick();
      sendResponse({ ok: !!buddyWrapEl });
      return undefined;
    }
    if (message.type === 'sl:getStatus') {
      sendResponse({
        matched: !!current,
        hidden: hiddenForTab,
        siteId: current ? current.site.id : null,
        label: current ? current.text : ''
      });
      return undefined;
    }
    return undefined;
  });

  function start() {
    SL.getState().then((loaded) => {
      state = loaded;
      evaluate();
      watchForRemoval();
      watchForNavigation();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
