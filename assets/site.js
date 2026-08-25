  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Lenis smooth scroll + GSAP ScrollTrigger sync ---- */
  let lenis = null;
  const hasGsap = typeof gsap !== 'undefined';
  const hasLenis = typeof Lenis !== 'undefined';

  if (hasGsap && typeof ScrollTrigger !== 'undefined') gsap.registerPlugin(ScrollTrigger);
  if (hasGsap && typeof SplitText !== 'undefined') gsap.registerPlugin(SplitText);

  if (hasLenis && !reduceMotion && window.matchMedia('(hover: hover)').matches){
    lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      anchors: true
    });
    if (hasGsap){
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }

  /* ---- Logo mark: cursor tilt + click pulse ---- */
  const logoMarks = [document.getElementById('logoMarkHeader'), document.getElementById('logoMarkFooter')].filter(Boolean);
  logoMarks.forEach(mark => {
    if (window.matchMedia('(hover: hover)').matches && !reduceMotion){
      mark.addEventListener('mousemove', (e) => {
        const rect = mark.getBoundingClientRect();
        const relX = (e.clientX - rect.left) / rect.width - 0.5;
        const relY = (e.clientY - rect.top) / rect.height - 0.5;
        mark.style.transform = 'scale(1.14) rotateY(' + (relX * 26) + 'deg) rotateX(' + (relY * -26) + 'deg)';
      });
      mark.addEventListener('mouseleave', () => { mark.style.transform = ''; });
    }
    mark.closest('a, .foot-logo').addEventListener('click', () => {
      mark.classList.remove('pulse');
      void mark.offsetWidth;
      mark.classList.add('pulse');
    });
  });

  const menuToggle = document.getElementById('menuToggle');
  const navLinks = document.getElementById('navLinks');

  menuToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    menuToggle.classList.toggle('open', isOpen);
    menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      menuToggle.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
    });
  });

  /* ---- Parallax layers: background art drifts at different speeds on scroll ---- */
  const parallaxLayers = Array.from(document.querySelectorAll('.parallax-layer')).map(el => ({
    el,
    speed: parseFloat(el.getAttribute('data-parallax')) || 0.1,
    section: el.closest('section') || el.parentElement
  }));

  if (parallaxLayers.length && !reduceMotion && window.matchMedia('(hover: hover)').matches){
    let parallaxRaf = null;
    function updateParallax(){
      parallaxLayers.forEach(layer => {
        const rect = layer.section.getBoundingClientRect();
        const offset = rect.top * layer.speed;
        layer.el.style.transform = 'translateY(' + offset.toFixed(1) + 'px)';
      });
      parallaxRaf = null;
    }
    function onParallaxScroll(){
      if (parallaxRaf) return;
      parallaxRaf = requestAnimationFrame(updateParallax);
    }
    window.addEventListener('scroll', onParallaxScroll, { passive: true });
    window.addEventListener('resize', onParallaxScroll, { passive: true });
    updateParallax();
  }


  /* ---- Hero video scrub: horizontal mouse movement drives currentTime ----
     The source is attached from JS so phones never download the clip - the
     element is display:none under 960px but the browser would still fetch it.
     Seeks are coalesced to one per animation frame; a mouse fires far more
     move events than the decoder can service, and queued seeks compound. */
  const scrubVideo = document.getElementById('heroScrubVideo');
  const isDesktopWidth = window.matchMedia('(min-width: 961px)').matches;
  const canScrub = isDesktopWidth && window.matchMedia('(hover: hover)').matches;

  // Baseline: load and autoplay a looping video on any desktop-width screen,
  // regardless of hover support, so the hero never falls back to a blank
  // background on touchscreens or hybrid devices. Mouse-scrub (below) then
  // takes manual control only when a real mouse is present.
  if (scrubVideo && isDesktopWidth && !reduceMotion){
    scrubVideo.src = scrubVideo.dataset.src;
    scrubVideo.loop = true;
    scrubVideo.play().catch(() => {});
  }

  if (scrubVideo && canScrub && !reduceMotion){
    const SCRUB_SENSITIVITY = 0.8;
    let prevX = null, targetTime = 0, seeking = false, frameQueued = false;
    let scrubbing = false;

    function commitSeek(){
      frameQueued = false;
      if (seeking) return;
      const dur = scrubVideo.duration;
      if (!isFinite(dur) || dur <= 0) return;
      if (Math.abs(scrubVideo.currentTime - targetTime) < 0.01) return;
      seeking = true;
      scrubVideo.currentTime = targetTime;
    }

    function queueSeek(){
      if (frameQueued) return;
      frameQueued = true;
      requestAnimationFrame(commitSeek);
    }

    window.addEventListener('mousemove', (e) => {
      if (prevX === null){ prevX = e.clientX; targetTime = scrubVideo.currentTime || 0; return; }
      const dur = scrubVideo.duration;
      if (!isFinite(dur) || dur <= 0){ prevX = e.clientX; return; }
      if (!scrubbing){ scrubbing = true; scrubVideo.pause(); scrubVideo.loop = false; }
      const delta = e.clientX - prevX;
      prevX = e.clientX;
      targetTime = Math.min(Math.max(targetTime + (delta / window.innerWidth) * SCRUB_SENSITIVITY * dur, 0), dur);
      queueSeek();
    }, { passive: true });

    scrubVideo.addEventListener('seeked', () => {
      seeking = false;
      if (Math.abs(scrubVideo.currentTime - targetTime) > 0.02) queueSeek();
    });
  }

  /* ---- 3D tilt on cursor proximity ---- */
  const hoverCapableNow = window.matchMedia('(hover: hover)').matches && window.matchMedia('(pointer: fine)').matches;
  if (!reduceMotion && hoverCapableNow){
    const tiltTargets = Array.from(document.querySelectorAll('.panel:not(.more), .manifesto-card'));
    const TILT_RADIUS = 220;
    const MAX_TILT = 9;
    const LIFT = 6;

    let tiltRects = [];
    function cacheTiltRects(){
      tiltRects = tiltTargets.map(el => {
        const r = el.getBoundingClientRect();
        return { el: el, cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height };
      });
    }
    cacheTiltRects();
    window.addEventListener('resize', cacheTiltRects);
    let tiltScrollT = null;
    window.addEventListener('scroll', () => {
      clearTimeout(tiltScrollT);
      tiltScrollT = setTimeout(cacheTiltRects, 120);
    }, { passive: true });

    let tiltMouseX = -9999, tiltMouseY = -9999;
    window.addEventListener('mousemove', (e) => {
      tiltMouseX = e.clientX; tiltMouseY = e.clientY;
    }, { passive: true });

    function tiltLoop(){
      tiltRects.forEach(item => {
        const dx = tiltMouseX - item.cx;
        const dy = tiltMouseY - item.cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < TILT_RADIUS){
          const strength = 1 - dist / TILT_RADIUS;
          const rotateY = (dx / (item.w / 2)) * MAX_TILT * strength;
          const rotateX = -(dy / (item.h / 2)) * MAX_TILT * strength;
          const lift = -LIFT * strength;
          item.el.style.transform =
            'perspective(900px) translateY(' + lift.toFixed(1) + 'px) ' +
            'rotateX(' + rotateX.toFixed(2) + 'deg) rotateY(' + rotateY.toFixed(2) + 'deg)';
        } else if (item.el.style.transform){
          item.el.style.transform = '';
        }
      });
      requestAnimationFrame(tiltLoop);
    }
    requestAnimationFrame(tiltLoop);
  }

  /* ---- Click spark burst ---- */
  if (!reduceMotion && hoverCapableNow){
    const SPARK_COLORS = ['#C8420E', '#0B3EF5'];
    document.addEventListener('click', (e) => {
      const count = 6;
      for (let i = 0; i < count; i++){
        const spark = document.createElement('span');
        spark.className = 'click-spark';
        const angle = (Math.PI * 2 * i) / count + (Math.random() * 0.6 - 0.3);
        const distance = 28 + Math.random() * 22;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;
        spark.style.left = e.clientX + 'px';
        spark.style.top = e.clientY + 'px';
        spark.style.background = SPARK_COLORS[i % 2];
        spark.style.setProperty('--tx', tx + 'px');
        spark.style.setProperty('--ty', ty + 'px');
        document.body.appendChild(spark);
        setTimeout(() => spark.remove(), 550);
      }
    });
  }

  /* ---- Scroll reveal ---- */
  const revealTargets = document.querySelectorAll('.manifesto-card, .panel, .stage, .mini-gauge, .faq-item');
  if (!reduceMotion && hasGsap && typeof ScrollTrigger !== 'undefined'){
    gsap.set(revealTargets, { opacity: 0, y: 26 });
    ScrollTrigger.batch(revealTargets, {
      start: 'top 88%',
      once: true,
      onEnter: (batch) => gsap.to(batch, {
        opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.09
      })
    });
  } else if (!reduceMotion && 'IntersectionObserver' in window){
    revealTargets.forEach(el => el.classList.add('reveal'));
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting){
          entry.target.classList.add('reveal-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    revealTargets.forEach(el => io.observe(el));
  }

  /* ---- Results: ring fill + count-up on scroll into view ---- */
  function animateCountUp(el, duration){
    const finalText = el.textContent;
    const numbers = finalText.match(/[\d.]+/g);
    if (!numbers) return;
    const start = performance.now();
    function tick(now){
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      let i = 0;
      el.textContent = finalText.replace(/[\d.]+/g, (match) => {
        const target = parseFloat(numbers[i++]);
        const decimals = match.includes('.') ? match.split('.')[1].length : 0;
        return (target * eased).toFixed(decimals);
      });
      if (t < 1) requestAnimationFrame(tick);
      else el.textContent = finalText;
    }
    requestAnimationFrame(tick);
  }

  const miniGauges = document.querySelectorAll('.mini-gauge');
  if (miniGauges.length && 'IntersectionObserver' in window){
    const gaugeIo = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const gauge = entry.target;
        const fg = gauge.querySelector('.fg');
        const val = gauge.querySelector('.val');
        if (fg){
          const target = fg.getAttribute('stroke-dashoffset');
          if (reduceMotion){
            fg.style.strokeDashoffset = target;
          } else {
            fg.style.strokeDashoffset = fg.getAttribute('stroke-dasharray');
            fg.style.transition = 'stroke-dashoffset 1.3s cubic-bezier(.2,.8,.2,1), filter .3s ease';
            requestAnimationFrame(() => {
              requestAnimationFrame(() => { fg.style.strokeDashoffset = target; });
            });
          }
        }
        if (val && !reduceMotion) animateCountUp(val, 1300);
        gaugeIo.unobserve(gauge);
      });
    }, { threshold: 0.4 });
    miniGauges.forEach(g => gaugeIo.observe(g));
  }

  /* ---- Scroll progress bar + floating UI visibility ---- */
  const progressFill = document.getElementById('progressFill');
  const floatCta = document.getElementById('floatCta');
  const backToTop = document.getElementById('backToTop');
  const heroEl = document.querySelector('.hero');

  function onScroll(){
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    if (progressFill) progressFill.style.width = pct + '%';

    const heroBottom = heroEl ? heroEl.offsetTop + heroEl.offsetHeight : 400;
    const pastHero = scrollTop > heroBottom;
    if (floatCta) floatCta.classList.toggle('visible', pastHero);
    if (backToTop) backToTop.classList.toggle('visible', scrollTop > 600);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  /* ---- FAQ accordion ---- */
  document.querySelectorAll('.faq-q').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.parentElement;
      const answer = item.querySelector('.faq-a');
      const isOpen = btn.getAttribute('aria-expanded') === 'true';

      document.querySelectorAll('.faq-q').forEach(other => {
        if (other !== btn){
          other.setAttribute('aria-expanded', 'false');
          other.parentElement.querySelector('.faq-a').style.maxHeight = null;
        }
      });

      btn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
      answer.style.maxHeight = isOpen ? null : answer.scrollHeight + 'px';
    });
  });

  /* ---- Custom cursor ---- */
  const cursorEl = document.getElementById('customCursor');
  const cursorDot = cursorEl ? cursorEl.querySelector('.cursor-dot') : null;
  const cursorRing = cursorEl ? cursorEl.querySelector('.cursor-ring') : null;
  const cursorCapable = window.matchMedia('(hover: hover)').matches && window.matchMedia('(pointer: fine)').matches;

  if (cursorEl && cursorCapable && !reduceMotion){
    document.body.classList.add('custom-cursor-active');
    let dotX = window.innerWidth / 2, dotY = window.innerHeight / 2;
    let lastMoveX = dotX, lastMoveY = dotY;
    let stretchIdleTimer = null;

    const setDot = hasGsap ? gsap.quickTo(cursorDot, 'x', { duration: 0, ease: 'none' }) : null;
    const setDotY = hasGsap ? gsap.quickTo(cursorDot, 'y', { duration: 0, ease: 'none' }) : null;
    const setRingX = hasGsap ? gsap.quickTo(cursorRing, 'x', { duration: 0.15, ease: 'power3.out' }) : null;
    const setRingY = hasGsap ? gsap.quickTo(cursorRing, 'y', { duration: 0.15, ease: 'power3.out' }) : null;
    const setRingRotation = hasGsap ? gsap.quickTo(cursorRing, 'rotation', { duration: 0.2, ease: 'power3.out' }) : null;
    const setRingScaleX = hasGsap ? gsap.quickTo(cursorRing, 'scaleX', { duration: 0.2, ease: 'power3.out' }) : null;
    const setRingScaleY = hasGsap ? gsap.quickTo(cursorRing, 'scaleY', { duration: 0.2, ease: 'power3.out' }) : null;

    window.addEventListener('mousemove', (e) => {
      cursorEl.classList.add('active');
      dotX = e.clientX; dotY = e.clientY;
      if (hasGsap){
        setDot(dotX); setDotY(dotY);
        setRingX(dotX); setRingY(dotY);

        const dx = dotX - lastMoveX;
        const dy = dotY - lastMoveY;
        lastMoveX = dotX; lastMoveY = dotY;
        const speed = Math.sqrt(dx * dx + dy * dy);
        const stretch = Math.min(speed / 45, 0.55);
        if (stretch > 0.04){
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          setRingRotation(angle);
          setRingScaleX(1 + stretch);
          setRingScaleY(1 - stretch * 0.35);
        }
        clearTimeout(stretchIdleTimer);
        stretchIdleTimer = setTimeout(() => {
          setRingScaleX(1); setRingScaleY(1);
        }, 90);
      } else {
        cursorDot.style.transform = 'translate(' + dotX + 'px,' + dotY + 'px)';
        cursorRing.style.transform = 'translate(' + dotX + 'px,' + dotY + 'px)';
      }
    }, { passive: true });

    document.addEventListener('mouseleave', () => cursorEl.classList.remove('active'));

    const hoverTargets = 'a, button, .panel, .manifesto-card, .faq-q, input[type="range"]';
    document.querySelectorAll(hoverTargets).forEach(target => {
      target.addEventListener('mouseenter', () => cursorEl.classList.add('hover'));
      target.addEventListener('mouseleave', () => cursorEl.classList.remove('hover'));
    });
  }

  /* ---- Liquid tendril trail: dark gooey trail with spikes and drips ---- */
  if (cursorCapable && !reduceMotion){
    const trailCanvas = document.createElement('canvas');
    trailCanvas.className = 'ink-trail-canvas';
    trailCanvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(trailCanvas);
    const ctx = trailCanvas.getContext('2d');

    function resizeInkCanvas(){
      const dpr = window.devicePixelRatio || 1;
      trailCanvas.width = window.innerWidth * dpr;
      trailCanvas.height = window.innerHeight * dpr;
      trailCanvas.style.width = window.innerWidth + 'px';
      trailCanvas.style.height = window.innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resizeInkCanvas();
    window.addEventListener('resize', resizeInkCanvas);

    let inkPoints = [];
    let drips = [];
    const INK_MAX_AGE = 480;
    const DRIP_MAX_AGE = 500;

    window.addEventListener('mousemove', (e) => {
      inkPoints.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (Math.random() < 0.12){
        drips.push({
          x: e.clientX + (Math.random() * 10 - 5),
          y: e.clientY,
          t: performance.now()
        });
      }
    }, { passive: true });

    function drawInkTrail(){
      const now = performance.now();
      inkPoints = inkPoints.filter(p => now - p.t < INK_MAX_AGE);
      drips = drips.filter(d => now - d.t < DRIP_MAX_AGE);
      ctx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
      ctx.lineCap = 'round';

      for (let i = 1; i < inkPoints.length; i++){
        const p0 = inkPoints[i - 1];
        const p1 = inkPoints[i];
        const age = now - p1.t;
        const lifeRatio = 1 - age / INK_MAX_AGE;
        if (lifeRatio <= 0) continue;

        const dx = p1.x - p0.x, dy = p1.y - p0.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = -dy / len, ny = dx / len;
        const jag = Math.sin(now / 85 + i * 1.4) * 5 * lifeRatio;

        ctx.beginPath();
        ctx.moveTo(p0.x + nx * jag, p0.y + ny * jag);
        ctx.lineTo(p1.x + nx * jag, p1.y + ny * jag);
        ctx.strokeStyle = 'rgba(11,15,20,' + (lifeRatio * 0.75) + ')';
        ctx.lineWidth = Math.max(1.5, lifeRatio * 9);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(p0.x + nx * (jag + 2), p0.y + ny * (jag + 2));
        ctx.lineTo(p1.x + nx * (jag + 2), p1.y + ny * (jag + 2));
        ctx.strokeStyle = 'rgba(120,130,145,' + (lifeRatio * 0.25) + ')';
        ctx.lineWidth = Math.max(0.6, lifeRatio * 1.6);
        ctx.stroke();

        if (i % 4 === 0 && lifeRatio > 0.45){
          const spikeLen = 15 * lifeRatio;
          const spikeDir = i % 8 === 0 ? 1 : -1;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p1.x + nx * spikeLen * spikeDir, p1.y + ny * spikeLen * spikeDir);
          ctx.strokeStyle = 'rgba(11,15,20,' + (lifeRatio * 0.55) + ')';
          ctx.lineWidth = Math.max(0.6, lifeRatio * 2.2);
          ctx.stroke();
        }
      }

      drips.forEach(d => {
        const ratio = 1 - (now - d.t) / DRIP_MAX_AGE;
        if (ratio <= 0) return;
        const fallY = d.y + (1 - ratio) * 28;
        ctx.beginPath();
        ctx.arc(d.x, fallY, Math.max(0.8, ratio * 2.6), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(11,15,20,' + (ratio * 0.65) + ')';
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      requestAnimationFrame(drawInkTrail);
    }
    requestAnimationFrame(drawInkTrail);
  }

  /* ---- Magnetic buttons ---- */
  if (hasGsap && cursorCapable && !reduceMotion){
    document.querySelectorAll('.btn').forEach(btn => {
      const moveX = gsap.quickTo(btn, 'x', { duration: 0.4, ease: 'power3.out' });
      const moveY = gsap.quickTo(btn, 'y', { duration: 0.4, ease: 'power3.out' });
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const relX = e.clientX - rect.left - rect.width / 2;
        const relY = e.clientY - rect.top - rect.height / 2;
        moveX(relX * 0.35);
        moveY(relY * 0.35);
      });
      btn.addEventListener('mouseleave', () => { moveX(0); moveY(0); });
    });
  }

  /* ---- Kinetic typography: hero headline reveal on load, section headings on scroll ---- */
  if (hasGsap && typeof SplitText !== 'undefined' && !reduceMotion){
    const heroH1 = document.querySelector('.hero h1');
    if (heroH1){
      const split = new SplitText(heroH1, { type: 'words,lines', mask: 'lines', linesClass: 'split-line' });
      gsap.from(split.words, {
        yPercent: 120,
        rotate: 4,
        opacity: 0,
        duration: 0.9,
        ease: 'power4.out',
        stagger: 0.05,
        delay: 0.15
      });
    }

    if (typeof ScrollTrigger !== 'undefined'){
      const sectionHeads = document.querySelectorAll('.section-head h2, .manifesto-head h2, .faq h2, .cta h2, .process .wrap > h2, .results .wrap > h2, .deliverables .wrap > h2');
      sectionHeads.forEach(h2 => {
        const split2 = new SplitText(h2, { type: 'lines', mask: 'lines', linesClass: 'split-line' });
        gsap.from(split2.lines, {
          yPercent: 110,
          opacity: 0,
          duration: 0.8,
          ease: 'power4.out',
          stagger: 0.08,
          scrollTrigger: {
            trigger: h2,
            start: 'top 85%',
            once: true
          }
        });
      });
    }
  }

  /* ---- Shared focus trap for modal overlays ---- */
  function trapFocus(container, e){
    if (e.key !== 'Tab') return;
    const focusable = container.querySelectorAll(
      'a[href], button:not([disabled]):not([style*="display: none"]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first){
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last){
      e.preventDefault();
      first.focus();
    }
  }

  /* ---- Audit overlay: multi-step questionnaire ---- */
  (function(){
    const overlay = document.getElementById('auditOverlay');
    if (!overlay) return;
    const form = document.getElementById('auditForm');
    const steps = Array.from(form.querySelectorAll('.audit-step')).filter(s => s.id !== 'auditDone' && s.id !== 'auditError');
    const backBtn = document.getElementById('auditBack');
    const nextBtn = document.getElementById('auditNext');
    const submitBtn = document.getElementById('auditSubmit');
    const closeBtn = document.getElementById('auditClose');
    const progressFill = document.getElementById('auditProgressFill');
    const stepCount = document.getElementById('auditStepCount');
    const total = steps.length;
    let current = 0;
    let lastFocused = null;

    function showStep(i){
      steps.forEach((s, idx) => s.classList.toggle('is-active', idx === i));
      current = i;
      backBtn.style.visibility = i === 0 ? 'hidden' : 'visible';
      const isLast = i === total - 1;
      nextBtn.style.display = isLast ? 'none' : '';
      submitBtn.style.display = isLast ? '' : 'none';
      if (progressFill) progressFill.style.width = ((i + 1) / total * 100) + '%';
      if (stepCount) stepCount.textContent = 'Step ' + (i + 1) + ' of ' + total;
      const firstInput = steps[i].querySelector('input, textarea, .audit-chip');
      if (firstInput) setTimeout(() => firstInput.focus(), 60);
    }

    function validateStep(i){
      const required = steps[i].querySelectorAll('[required]');
      for (const field of required){
        if (!field.value.trim()){
          field.classList.add('invalid');
          field.focus();
          return false;
        }
        if (field.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(field.value.trim())){
          field.classList.add('invalid');
          field.focus();
          return false;
        }
        field.classList.remove('invalid');
      }
      const urlFields = steps[i].querySelectorAll('input[type="url"]');
      for (const field of urlFields){
        const val = field.value.trim();
        if (val && !/^(https?:\/\/)?([\w-]+\.)+[a-zA-Z]{2,}([\/?#].*)?$/i.test(val)){
          field.classList.add('invalid');
          field.focus();
          return false;
        }
        field.classList.remove('invalid');
      }
      return true;
    }

    /* ---- Currency-aware budget ranges ---- */
    const BUDGET_RANGES = {
      AED: ['Under AED 7.5K', 'AED 7.5K - 18K', 'AED 18K - 55K', 'AED 55K+'],
      USD: ['Under $2K', '$2K - $5K', '$5K - $15K', '$15K+'],
      EUR: ['Under \u20ac2K', '\u20ac2K - \u20ac5K', '\u20ac5K - \u20ac14K', '\u20ac14K+'],
      GBP: ['Under \u00a31.5K', '\u00a31.5K - \u00a34K', '\u00a34K - \u00a312K', '\u00a312K+']
    };
    const currencySelect = document.getElementById('auditCurrency');
    const budgetTierChips = document.querySelectorAll('#auditBudgetChips .audit-chip[data-tier]');

    function renderBudgetRanges(){
      const currency = currencySelect ? currencySelect.value : 'AED';
      const ranges = BUDGET_RANGES[currency] || BUDGET_RANGES.AED;
      budgetTierChips.forEach(chip => {
        const tier = Number(chip.getAttribute('data-tier'));
        const label = ranges[tier];
        chip.textContent = label;
        chip.setAttribute('data-value', label + ' / month (' + currency + ')');
      });
    }
    renderBudgetRanges();
    if (currencySelect){
      currencySelect.addEventListener('change', renderBudgetRanges);
    }

    form.querySelectorAll('.audit-chips').forEach(group => {
      const single = group.classList.contains('audit-chips-single');
      group.querySelectorAll('.audit-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          if (single){
            group.querySelectorAll('.audit-chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
          } else {
            chip.classList.toggle('selected');
          }
        });
      });
    });

    form.querySelectorAll('input, textarea').forEach(field => {
      field.addEventListener('input', () => field.classList.remove('invalid'));
    });

    nextBtn.addEventListener('click', () => {
      if (validateStep(current) && current < total - 1) showStep(current + 1);
    });
    backBtn.addEventListener('click', () => {
      if (current > 0) showStep(current - 1);
    });

    function collectChips(name){
      const group = form.querySelector('.audit-chips[data-name="' + name + '"]');
      if (!group) return '';
      return Array.from(group.querySelectorAll('.audit-chip.selected'))
        .map(c => c.getAttribute('data-value')).join(', ');
    }

    const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xbgrwgdw';

    function setLoading(isLoading){
      submitBtn.classList.toggle('is-loading', isLoading);
      submitBtn.disabled = isLoading;
      submitBtn.textContent = isLoading ? 'Sending...' : 'Send My Audit Request';
    }

    async function submitAudit(){
      const get = (n) => (form.querySelector('[name="' + n + '"]') || {}).value || '';
      const goals = collectChips('goals');
      const budget = collectChips('budget');
      const rawWebsite = get('website').trim();
      const website = rawWebsite && !/^https?:\/\//i.test(rawWebsite) ? 'https://' + rawWebsite : rawWebsite;

      const payload = {
        name: get('name'),
        company: get('company'),
        industry: get('industry'),
        website: website,
        social: get('social'),
        goals: goals || '(none selected)',
        budget: budget || '(not specified)',
        email: get('email'),
        phone: get('phone') || '(not provided)',
        notes: get('notes') || '(none)',
        _subject: 'Free Audit Request - ' + (get('company') || get('name') || 'New Lead')
      };

      setLoading(true);
      try {
        const res = await fetch(FORMSPREE_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Submission failed');

        form.querySelector('.audit-nav').style.display = 'none';
        steps.forEach(s => s.classList.remove('is-active'));
        const done = document.getElementById('auditDone');
        if (done) done.classList.add('is-active');
        if (progressFill) progressFill.style.width = '100%';
        if (stepCount) stepCount.textContent = 'Done';
      } catch (err) {
        form.querySelector('.audit-nav').style.display = 'none';
        steps.forEach(s => s.classList.remove('is-active'));
        const errorStep = document.getElementById('auditError');
        if (errorStep) errorStep.classList.add('is-active');
      } finally {
        setLoading(false);
      }
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validateStep(current)) return;
      submitAudit();
    });

    const retryBtn = document.getElementById('auditRetry');
    if (retryBtn){
      retryBtn.addEventListener('click', () => {
        const errorStep = document.getElementById('auditError');
        if (errorStep) errorStep.classList.remove('is-active');
        form.querySelector('.audit-nav').style.display = '';
        showStep(total - 1);
      });
    }

    function openAudit(){
      lastFocused = document.activeElement;
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      if (lenis) lenis.stop();
      showStep(0);
    }
    window.openHypAudit = openAudit;

    if (new URLSearchParams(window.location.search).get('startAudit') === '1'){
      setTimeout(openAudit, 300);
    }
    function closeAudit(){
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (lenis) lenis.start();
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }

    closeBtn.addEventListener('click', closeAudit);
    const doneClose = document.getElementById('auditDoneClose');
    if (doneClose) doneClose.addEventListener('click', closeAudit);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeAudit(); });
    document.addEventListener('keydown', (e) => {
      if (!overlay.classList.contains('is-open')) return;
      if (e.key === 'Escape') closeAudit();
      else if (e.key === 'Tab') trapFocus(overlay, e);
    });

    const auditTriggers = document.querySelectorAll(
      '.desktop-cta, .mobile-cta, #floatCta, .hero-ctas .btn.solid, .cta .btn, .ai-edge-copy .btn.solid'
    );
    auditTriggers.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof navLinks !== 'undefined' && navLinks){
          navLinks.classList.remove('open');
          if (typeof menuToggle !== 'undefined' && menuToggle){
            menuToggle.classList.remove('open');
            menuToggle.setAttribute('aria-expanded', 'false');
          }
        }
        openAudit();
      });
    });
  })();

  /* ---- Service drawer: click a service tile for a quick, specific rundown ---- */
  (function(){
    const scrim = document.getElementById('serviceDrawerScrim');
    const drawer = document.getElementById('serviceDrawer');
    if (!scrim || !drawer) return;
    const closeBtn = document.getElementById('serviceDrawerClose');
    const closeBtn2 = document.getElementById('serviceDrawerClose2');
    const iconEl = document.getElementById('serviceDrawerIcon');
    const tagEl = document.getElementById('serviceDrawerTag');
    const titleEl = document.getElementById('serviceDrawerTitle');
    const ledeEl = document.getElementById('serviceDrawerLede');
    const listEl = document.getElementById('serviceDrawerList');
    const fullPageLink = document.getElementById('serviceDrawerFullPage');
    const auditBtn = document.getElementById('serviceDrawerAudit');
    let lastFocused = null;

    const ICONS = {
      'seo': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="6.5"></circle><line x1="15.5" y1="15.5" x2="21" y2="21"></line></svg>',
      'paid-media': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="5"></circle><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"></circle></svg>',
      'web-dev': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="15" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><circle cx="6.3" cy="6.7" r="0.6" fill="currentColor" stroke="none"></circle><circle cx="8.6" cy="6.7" r="0.6" fill="currentColor" stroke="none"></circle></svg>',
      'creative': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20 L4.8 16.2 L15.5 5.5 A1.8 1.8 0 0 1 18 5.5 L18.5 6 A1.8 1.8 0 0 1 18.5 8.5 L7.8 19.2 Z"></path><line x1="13.5" y1="7.5" x2="16.5" y2="10.5"></line></svg>',
      'media-production': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8.5 A1.5 1.5 0 0 1 5.5 7 H8 L9.2 5 H14.8 L16 7 H18.5 A1.5 1.5 0 0 1 20 8.5 V17 A1.5 1.5 0 0 1 18.5 18.5 H5.5 A1.5 1.5 0 0 1 4 17 Z"></path><circle cx="12" cy="12.5" r="3.4"></circle></svg>',
      'social': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6 A2 2 0 0 1 6 4 H18 A2 2 0 0 1 20 6 V13 A2 2 0 0 1 18 15 H10 L6 19 V15 H6 A2 2 0 0 1 4 13 Z"></path></svg>',
      'cro': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5 H20 L14 12.5 V18 L10 20 V12.5 Z"></path></svg>'
    };

    const CONTENT = {
      'seo': {
        tag: 'Search & Organic',
        title: "Ranking For The Right Words Is The Job.",
        lede: "Traffic that doesn't convert is a vanity metric with extra steps. We build for intent, not volume.",
        points: [
          "Technical audit first - speed, crawl errors, structure - fixed before content strategy starts",
          "Content built around what buyers actually search, not keyword-stuffed filler",
          "Link building that grows authority without risking a penalty",
          "Reporting shows real organic traffic and conversions, not \"impressions\""
        ]
      },
      'paid-media': {
        tag: 'Acquisition',
        title: "Ad Spend Without A System Is Gambling With Extra Steps.",
        lede: "We run wherever your buyers actually are, and we watch the numbers daily - not once a month.",
        points: [
          "Google, Meta, TikTok and beyond - picked by where your audience lives",
          "Creative tested weekly, not set-and-forget",
          "Budget shifts toward what's converting, not what's comfortable",
          "You see cost per acquisition, not just click-through rate"
        ]
      },
      'web-dev': {
        tag: 'Website',
        title: "A Site That Looks Good And Converts Nothing Is A Brochure.",
        lede: "We design for the person about to leave the page, not the person judging the portfolio.",
        points: [
          "Built to convert first, decorated second",
          "Load times that don't cost you customers before they've read a word",
          "Mobile-first, because that's where most of your traffic already is",
          "You leave with a site your own team can actually update"
        ]
      },
      'creative': {
        tag: 'Identity',
        title: "Your Brand Is The Reason Someone Picks You Over The Next Tab.",
        lede: "Not a logo. Not a font pairing. The actual reason to choose you specifically.",
        points: [
          "Identity systems built to hold up across every platform, not just a mockup",
          "Messaging that says one clear thing instead of everything at once",
          "Content designed for how people actually scroll, not how it looks in a deck",
          "No 60-page brand guideline nobody will ever open"
        ]
      },
      'media-production': {
        tag: 'Video & Photo',
        title: "Stock Footage Looks Like Stock Footage. People Can Tell.",
        lede: "Shot for your brand and your audience - not borrowed from a library everyone else uses too.",
        points: [
          "Video and photo built around the platform it's actually going on",
          "Turnaround measured in weeks, not months",
          "Usable across ads, social, and your site without reshooting",
          "Direction that matches the tone you've already built, not a generic template"
        ]
      },
      'social': {
        tag: 'Content & Community',
        title: "Posting Isn't A Strategy. It's A Symptom Of Not Having One.",
        lede: "A calendar with no goal behind it is just noise on a schedule.",
        points: [
          "Content tied to actual business outcomes, not just a posting cadence",
          "Community management that replies like a person, not a script",
          "Platform-specific content - one post recycled five ways doesn't work anymore",
          "Growth measured by engagement that converts, not follower count alone"
        ]
      },
      'cro': {
        tag: 'Conversion',
        title: "Traffic You're Already Paying For, Converting At A Rate You're Leaving On The Table.",
        lede: "The cheapest growth channel is usually the one you already have - you're just losing people in it.",
        points: [
          "Funnel audits that find exactly where people drop off",
          "Testing focused on the pages that actually move revenue",
          "Email and lifecycle automation that doesn't read like spam",
          "Fewer clicks between \"interested\" and \"paid\""
        ]
      }
    };

    function openDrawer(serviceId){
      const data = CONTENT[serviceId];
      if (!data) return;
      lastFocused = document.activeElement;
      iconEl.innerHTML = ICONS[serviceId] || '';
      tagEl.textContent = data.tag;
      titleEl.textContent = data.title;
      ledeEl.textContent = data.lede;
      listEl.innerHTML = '';
      data.points.forEach(p => {
        const li = document.createElement('li');
        li.textContent = p;
        listEl.appendChild(li);
      });
      if (fullPageLink) fullPageLink.href = '/' + serviceId + '/';
      scrim.classList.add('is-open');
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      if (lenis) lenis.stop();
      setTimeout(() => closeBtn.focus(), 60);
    }

    function closeDrawer(){
      scrim.classList.remove('is-open');
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (lenis) lenis.start();
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }

    document.querySelectorAll('.panel-clickable').forEach(panel => {
      panel.addEventListener('click', (e) => {
        e.preventDefault();
        openDrawer(panel.getAttribute('data-service'));
      });
      panel.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' '){
          e.preventDefault();
          openDrawer(panel.getAttribute('data-service'));
        }
      });
    });

    closeBtn.addEventListener('click', closeDrawer);
    closeBtn2.addEventListener('click', closeDrawer);
    scrim.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (e) => {
      if (!drawer.classList.contains('is-open')) return;
      if (e.key === 'Escape') closeDrawer();
      else if (e.key === 'Tab') trapFocus(drawer, e);
    });
    auditBtn.addEventListener('click', () => {
      closeDrawer();
      setTimeout(() => { if (window.openHypAudit) window.openHypAudit(); }, 260);
    });
  })();
