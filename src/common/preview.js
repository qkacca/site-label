/*
 * Site Label - shared style preview.
 *
 * A scaled-down approximation of what the content script draws, used by both
 * the popup and the options page so the two never drift apart.
 */
(function (root) {
  'use strict';

  const SL = (root.SL = root.SL || {});

  /**
   * Draw `style` into `box` (a positioned container). Any previous preview
   * nodes are cleared first; elements marked .preview-page are left alone.
   */
  SL.renderPreview = function renderPreview(box, style, text) {
    if (!box) return;
    Array.from(box.querySelectorAll('.pv')).forEach((el) => el.remove());

    const clean = SL.normalizeStyle(style);
    const caption = (text || 'LABEL').trim() || 'LABEL';
    const mode = clean.displayMode;

    // The preview box is a fraction of a real viewport, so the size multiplier
    // is damped - otherwise a large label fills the whole swatch and stops
    // being a useful comparison.
    const s = 1 + (clean.scale - 1) * 0.55;
    const px = (n) => Math.round(n * s * 10) / 10 + 'px';

    const el = document.createElement('div');
    el.className = 'pv';
    el.textContent = clean.uppercase ? caption.toUpperCase() : caption;
    el.style.position = 'absolute';
    el.style.background = clean.background;
    el.style.color = clean.textColor;
    el.style.opacity = String(clean.opacity);
    el.style.fontSize = px(Math.max(9, clean.fontSize - 3));
    el.style.fontWeight = clean.bold ? '700' : '500';
    el.style.letterSpacing = '.04em';
    el.style.whiteSpace = 'nowrap';
    el.style.pointerEvents = 'none';

    const placed = SL.hasCustomPosition(clean);
    const isBar = mode === 'bar-top' || mode === 'bar-bottom';
    const glowSeconds = SL.glowDuration(clean) + 's';

    // Mirror the page's glow so the editor shows the real effect.
    function addGlow(target) {
      if (!clean.glow) return;
      const gc = SL.glowColors(clean.background);
      target.classList.add('pv-glow');
      target.style.setProperty('--pv-dur', glowSeconds);
      target.style.setProperty('--pv-a', gc.a);
      target.style.setProperty('--pv-b', gc.b);
      target.style.setProperty('--pv-c', gc.c);
      target.style.setProperty('--pv-sa', gc.softA);
      target.style.setProperty('--pv-sb', gc.softB);
      target.style.setProperty('--pv-sc', gc.softC);
    }

    if (mode.startsWith('ribbon-')) {
      const top = mode.indexOf('top') !== -1;
      const left = mode.indexOf('left') !== -1;
      el.style.padding = px(2) + ' 0';
      el.style.width = px(150);
      el.style.textAlign = 'center';
      el.style[top ? 'top' : 'bottom'] = px(14);
      el.style[left ? 'left' : 'right'] = '-' + px(46);
      el.style.transform = 'rotate(' + ((top && left) || (!top && !left) ? -45 : 45) + 'deg)';
    } else if (isBar) {
      el.style.left = '0';
      el.style.right = '0';
      el.style.textAlign = 'center';
      el.style.padding = px(3) + ' 0';
      el.style[mode === 'bar-top' ? 'top' : 'bottom'] = '0';
    } else if (mode === 'edge-top' || mode === 'edge-bottom') {
      const side = mode === 'edge-top' ? 'top' : 'bottom';
      const line = document.createElement('div');
      line.className = 'pv';
      line.style.position = 'absolute';
      line.style.left = '0';
      line.style.right = '0';
      line.style[side] = '0';
      line.style.height = px(Math.max(3, clean.frameWidth * 0.7));
      line.style.background = clean.background;
      line.style.opacity = String(clean.opacity);
      box.appendChild(line);
      el.style.left = '50%';
      el.style.transform = 'translateX(-50%)';
      el.style[side] = '0';
      el.style.padding = px(2) + ' ' + px(9);
      el.style.borderRadius = side === 'top' ? '0 0 5px 5px' : '5px 5px 0 0';
    } else if (mode === 'side-left' || mode === 'side-right') {
      el.style.top = '50%';
      el.style.writingMode = 'vertical-rl';
      el.style.padding = px(9) + ' ' + px(3);
      el.style.borderRadius = '5px';
      if (mode === 'side-left') {
        el.style.left = '0';
        el.style.transform = 'translateY(-50%) rotate(180deg)';
      } else {
        el.style.right = '0';
        el.style.transform = 'translateY(-50%)';
      }
    } else if (mode === 'pill-top-center' || mode === 'pill-bottom-center') {
      el.style.left = '50%';
      el.style.transform = 'translateX(-50%)';
      el.style[mode === 'pill-top-center' ? 'top' : 'bottom'] = px(8);
      el.style.padding = px(3) + ' ' + px(12);
      el.style.borderRadius = '999px';
    } else if (mode === 'buddy') {
      const wrap = document.createElement('div');
      wrap.className = 'pv';
      wrap.style.position = 'absolute';
      wrap.style.right = px(8);
      wrap.style.bottom = px(6);
      wrap.style.width = px(52);
      wrap.style.display = 'flex';
      wrap.style.flexDirection = 'column';
      wrap.style.alignItems = 'center';
      wrap.style.opacity = String(clean.opacity);
      if (SL.buildBuddySvg) {
        const figure = SL.buildBuddySvg(clean.buddy);
        figure.setAttribute('class', 'pv-buddy-svg');
        figure.style.width = '100%';
        figure.style.height = 'auto';
        wrap.appendChild(figure);
      }
      // Matches the page: the card floats in front, edged in the character's
      // own colour, with a real shadow doing the depth.
      el.classList.add('pv-buddy-card');
      el.style.position = 'relative';
      el.style.marginTop = '-' + px(11);
      el.style.border = '1.5px solid ' +
        (SL.buddyHandColor ? SL.buddyHandColor(clean.buddy) : '#ffffff');
      el.style.boxShadow = '0 4px 9px rgba(0,0,0,.45), 0 1px 2px rgba(0,0,0,.3)';
      el.style.padding = px(2) + ' ' + px(7);
      el.style.borderRadius = '4px';
      el.style.transform = 'rotate(-3deg)';
      el.style.maxWidth = '100%';
      el.style.overflow = 'hidden';
      el.style.textOverflow = 'ellipsis';
      el.style.opacity = '1';
      addGlow(el);
      wrap.appendChild(el);
      box.appendChild(wrap);
      return;
    } else if (mode === 'meme-impact') {
      el.style.left = '0';
      el.style.right = '0';
      el.style.top = px(6);
      el.style.textAlign = 'center';
      el.style.background = 'none';
      el.style.color = '#ffffff';
      el.style.fontFamily = 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif';
      el.style.fontWeight = '400';
      el.style.fontSize = px(19);
      el.style.textShadow = '1.5px 1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px -1.5px 0 #000';
    } else if (mode === 'meme-hazard') {
      el.style.left = '0';
      el.style.right = '0';
      el.style.top = '0';
      el.style.textAlign = 'center';
      el.style.padding = px(4) + ' 0';
      el.style.backgroundImage = 'repeating-linear-gradient(45deg, rgba(0,0,0,.82) 0 6px, rgba(0,0,0,0) 6px 12px)';
      el.style.backgroundColor = clean.background;
    } else if (mode === 'meme-stamp') {
      el.style.top = px(14);
      el.style.right = px(12);
      el.style.padding = px(3) + ' ' + px(9);
      el.style.background = 'none';
      el.style.color = clean.background;
      el.style.border = '2px solid ' + clean.background;
      el.style.borderRadius = '3px';
      el.style.letterSpacing = '.16em';
      el.style.transform = 'rotate(-13deg)';
    } else if (mode === 'meme-glitch') {
      el.style.top = px(10);
      el.style.left = px(10);
      el.style.padding = px(2) + ' ' + px(8);
      el.style.borderRadius = '3px';
      el.style.textShadow = '-1.5px 0 #00e5ff, 1.5px 0 #ff0057';
    } else if (mode === 'meme-terminal') {
      el.style.bottom = px(10);
      el.style.left = px(10);
      el.style.padding = px(2) + ' ' + px(8);
      el.style.background = '#0b0f0c';
      el.style.color = '#7fe3a0';
      el.style.border = '1px solid #2f6f45';
      el.style.borderRadius = '3px';
      el.style.fontFamily = 'Consolas, "Cascadia Mono", monospace';
      el.style.letterSpacing = '.06em';
      el.textContent = '> ' + el.textContent;
    } else if (mode === 'corners') {
      const size = px(16);
      const w = px(Math.max(2, clean.frameWidth - 1));
      [['tl','top','left'], ['tr','top','right'], ['bl','bottom','left'], ['br','bottom','right']]
        .forEach(function (c) {
          const b = document.createElement('div');
          b.className = 'pv';
          b.style.position = 'absolute';
          b.style.width = size;
          b.style.height = size;
          b.style[c[1]] = '0';
          b.style[c[2]] = '0';
          b.style.opacity = String(clean.opacity);
          b.style['border' + c[1][0].toUpperCase() + c[1].slice(1)] = w + ' solid ' + clean.background;
          b.style['border' + c[2][0].toUpperCase() + c[2].slice(1)] = w + ' solid ' + clean.background;
          box.appendChild(b);
        });
      el.style.top = '0';
      el.style.left = '50%';
      el.style.transform = 'translateX(-50%)';
      el.style.padding = px(2) + ' ' + px(9);
      el.style.borderRadius = '0 0 5px 5px';
    } else if (mode === 'frame' || mode === 'frame-labelled') {
      const frame = document.createElement('div');
      frame.className = 'pv';
      frame.style.position = 'absolute';
      frame.style.inset = '0';
      frame.style.border = px(Math.max(2, clean.frameWidth - 2)) + ' solid ' + clean.background;
      frame.style.opacity = String(clean.opacity);
      frame.style.pointerEvents = 'none';
      box.appendChild(frame);
      if (clean.glow) {
        const halo = document.createElement('div');
        halo.className = 'pv pv-breathe';
        halo.style.position = 'absolute';
        halo.style.inset = '0';
        halo.style.border = px(Math.max(2, clean.frameWidth - 2)) + ' solid #ffffff';
        halo.style.mixBlendMode = 'overlay';
        halo.style.pointerEvents = 'none';
        halo.style.setProperty('--pv-dur', glowSeconds);
        box.appendChild(halo);
      }
      if (mode !== 'frame-labelled') return;
      el.style.top = '0';
      el.style.left = '50%';
      el.style.transform = 'translateX(-50%)';
      el.style.padding = px(2) + ' ' + px(10);
      el.style.borderRadius = '0 0 5px 5px';
    } else if (mode.startsWith('badge-')) {
      el.style.padding = px(3) + ' ' + px(10);
      el.style.borderRadius = '999px';
      el.style[mode.indexOf('top') !== -1 ? 'top' : 'bottom'] = px(8);
      el.style[mode.indexOf('left') !== -1 ? 'left' : 'right'] = px(8);
    } else if (mode === 'watermark') {
      el.style.top = '50%';
      el.style.left = '50%';
      el.style.transform = 'translate(-50%,-50%) rotate(-20deg)';
      el.style.background = 'none';
      el.style.color = clean.background;
      el.style.opacity = '0.42';
      el.style.fontSize = px(22);
      if (clean.glow) {
        el.classList.add('pv-pulse');
        el.style.setProperty('--pv-dur', glowSeconds);
      }
    }

    // Show where a dragged label has been put, so the editor matches the page.
    if (placed && mode !== 'frame') {
      el.style.top = (clean.posY * 100).toFixed(2) + '%';
      el.style.bottom = 'auto';
      if (!isBar) {
        el.style.left = (clean.posX * 100).toFixed(2) + '%';
        el.style.right = 'auto';
        if (mode === 'frame-labelled' || mode === 'watermark') el.style.transform = 'none';
      }
    }

    if (mode !== 'watermark' && mode !== 'frame') addGlow(el);
    box.appendChild(el);
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
