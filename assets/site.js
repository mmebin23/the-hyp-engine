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


  /* ---- Hero motion-blur slider (replaces the scrub video) ---- */
  const heroSlides = document.querySelectorAll('.hero-slide');
  if (heroSlides.length){
    let heroSlideIndex = 0;
    let heroSlideTimer = null;
    const heroCurrentEl = document.getElementById('heroSliderCurrent');

    function goToHeroSlide(newIndex){
      if (newIndex === heroSlideIndex || !heroSlides[newIndex]) return;
      const oldSlide = heroSlides[heroSlideIndex];
      const newSlide = heroSlides[newIndex];
      oldSlide.classList.add('is-leaving');
      oldSlide.classList.remove('is-active');
      newSlide.classList.add('is-active');
      setTimeout(() => { oldSlide.classList.remove('is-leaving'); }, 1000);
      heroSlideIndex = newIndex;
      if (heroCurrentEl) heroCurrentEl.textContent = String(newIndex + 1).padStart(2, '0');
    }
    function nextHeroSlide(){ goToHeroSlide((heroSlideIndex + 1) % heroSlides.length); }
    function prevHeroSlide(){ goToHeroSlide((heroSlideIndex - 1 + heroSlides.length) % heroSlides.length); }

    const heroPrevBtn = document.getElementById('heroSliderPrev');
    const heroNextBtn = document.getElementById('heroSliderNext');
    function resetHeroAutoAdvance(){
      clearInterval(heroSlideTimer);
      if (!reduceMotion) heroSlideTimer = setInterval(nextHeroSlide, 6000);
    }
    if (heroNextBtn) heroNextBtn.addEventListener('click', () => { nextHeroSlide(); resetHeroAutoAdvance(); });
    if (heroPrevBtn) heroPrevBtn.addEventListener('click', () => { prevHeroSlide(); resetHeroAutoAdvance(); });
    resetHeroAutoAdvance();
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

    let tiltIsScrolling = false;
    let tiltScrollT = null;
    window.addEventListener('scroll', () => {
      tiltIsScrolling = true;
      clearTimeout(tiltScrollT);
      tiltScrollT = setTimeout(() => {
        cacheTiltRects();
        tiltIsScrolling = false;
      }, 150);
    }, { passive: true });

    let tiltMouseX = -9999, tiltMouseY = -9999;
    let tiltRunning = false;
    let tiltIdleTimer = null;

    function startTiltLoop(){
      if (tiltRunning) return;
      tiltRunning = true;
      requestAnimationFrame(tiltLoop);
    }

    window.addEventListener('mousemove', (e) => {
      tiltMouseX = e.clientX; tiltMouseY = e.clientY;
      startTiltLoop();
      clearTimeout(tiltIdleTimer);
      tiltIdleTimer = setTimeout(() => { tiltRunning = false; }, 300);
    }, { passive: true });

    function tiltLoop(){
      if (!tiltRunning) return;
      if (tiltIsScrolling){
        tiltRects.forEach(item => {
          if (item.el.style.transform) item.el.style.transform = '';
        });
        requestAnimationFrame(tiltLoop);
        return;
      }
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
  }

  /* ---- Click spark burst ---- */
  if (!reduceMotion && hoverCapableNow){
    const SPARK_COLORS = ['#FF6B1A', '#C8420E'];
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

  if (backToTop){
    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  /* ---- FAQ accordion ---- */
  document.querySelectorAll('.faq-q').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.parentElement;
      const answer = item.querySelector('.faq-a');
      const answerP = answer.querySelector('p');
      const isOpen = btn.getAttribute('aria-expanded') === 'true';

      document.querySelectorAll('.faq-q').forEach(other => {
        if (other !== btn){
          other.setAttribute('aria-expanded', 'false');
          const otherAnswer = other.parentElement.querySelector('.faq-a');
          otherAnswer.style.maxHeight = null;
          const otherP = otherAnswer.querySelector('p');
          if (otherP && otherP.dataset.typeTimer){
            clearInterval(Number(otherP.dataset.typeTimer));
            otherP.textContent = otherP.dataset.fullText || otherP.textContent;
          }
        }
      });

      btn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');

      if (isOpen){
        answer.style.maxHeight = null;
        if (answerP && answerP.dataset.typeTimer){
          clearInterval(Number(answerP.dataset.typeTimer));
          answerP.textContent = answerP.dataset.fullText || answerP.textContent;
        }
        return;
      }

      if (answerP && !answerP.dataset.fullText){
        answerP.dataset.fullText = answerP.textContent;
      }
      answer.style.maxHeight = answer.scrollHeight + 'px';

      if (answerP && answerP.dataset.fullText && !reduceMotion){
        const fullText = answerP.dataset.fullText;
        answerP.textContent = '';
        let i = 0;
        const timer = setInterval(() => {
          i += 2;
          answerP.textContent = fullText.slice(0, i);
          if (i >= fullText.length){
            answerP.textContent = fullText;
            clearInterval(timer);
            delete answerP.dataset.typeTimer;
          }
        }, 12);
        answerP.dataset.typeTimer = String(timer);
      }
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

    let inkTrailRunning = false;

    function startInkTrailLoop(){
      if (inkTrailRunning) return;
      inkTrailRunning = true;
      requestAnimationFrame(drawInkTrail);
    }

    window.addEventListener('mousemove', (e) => {
      inkPoints.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (Math.random() < 0.12){
        drips.push({
          x: e.clientX + (Math.random() * 10 - 5),
          y: e.clientY,
          t: performance.now()
        });
      }
      startInkTrailLoop();
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
        ctx.strokeStyle = 'rgba(200,66,14,' + (lifeRatio * 0.6) + ')';
        ctx.lineWidth = Math.max(1.5, lifeRatio * 8);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(p0.x + nx * (jag + 2), p0.y + ny * (jag + 2));
        ctx.lineTo(p1.x + nx * (jag + 2), p1.y + ny * (jag + 2));
        ctx.strokeStyle = 'rgba(255,255,255,' + (lifeRatio * 0.4) + ')';
        ctx.lineWidth = Math.max(0.6, lifeRatio * 1.6);
        ctx.stroke();

        if (i % 4 === 0 && lifeRatio > 0.45){
          const spikeLen = 15 * lifeRatio;
          const spikeDir = i % 8 === 0 ? 1 : -1;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p1.x + nx * spikeLen * spikeDir, p1.y + ny * spikeLen * spikeDir);
          ctx.strokeStyle = 'rgba(255,140,70,' + (lifeRatio * 0.45) + ')';
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
        ctx.fillStyle = 'rgba(200,66,14,' + (ratio * 0.5) + ')';
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      if (inkPoints.length === 0 && drips.length === 0){
        inkTrailRunning = false;
        return;
      }
      requestAnimationFrame(drawInkTrail);
    }
  }

  /* ---- Services 3D showcase ---- */
  const hasThree = typeof THREE !== 'undefined';
  const services3dCanvas = document.getElementById('services3dCanvas');
  const services3dStage = document.querySelector('.services-3d-stage');
  if (hasThree && hasGsap && services3dCanvas && services3dStage && cursorCapable && !reduceMotion && services3dStage.clientWidth > 0 && services3dStage.clientHeight > 0){
   try {
    const SERVICE_DATA = [
      { title: 'SEO', tag: 'Organic Growth Engine', icon: 'seo', slug: 'seo' },
      { title: 'Paid Media', tag: 'Google, Meta, TikTok & more', icon: 'paid-media', slug: 'paid-media' },
      { title: 'Web Design & Dev', tag: 'Sites Built To Convert', icon: 'web-dev', slug: 'web-dev' },
      { title: 'Creative & Branding', tag: 'Identity, Design & Content', icon: 'creative', slug: 'creative' },
      { title: 'Media Production', tag: 'Video & Photography', icon: 'media-production', slug: 'media-production' },
      { title: 'Social Media', tag: 'Content & Community', icon: 'social', slug: 'social' },
      { title: 'CRO & Automation', tag: 'Funnels That Compound', icon: 'cro', slug: 'cro' }
    ];

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, services3dStage.clientWidth / services3dStage.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 14);

    const renderer = new THREE.WebGLRenderer({ canvas: services3dCanvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(services3dStage.clientWidth, services3dStage.clientHeight);

    scene.add(new THREE.AmbientLight(0x332211, 1.2));
    const keyLight = new THREE.PointLight(0xff8f4d, 3, 40);
    keyLight.position.set(6, 6, 10);
    scene.add(keyLight);
    const fillLight = new THREE.PointLight(0xff6b1a, 1.2, 40);
    fillLight.position.set(-8, -4, 6);
    scene.add(fillLight);

    function makeStarLayer(count, spread, size, opacity, color){
      const geo = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++){
        positions[i * 3] = (Math.random() - 0.5) * spread;
        positions[i * 3 + 1] = (Math.random() - 0.5) * spread;
        positions[i * 3 + 2] = (Math.random() - 0.5) * spread - 10;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({ color, size, transparent: true, opacity, sizeAttenuation: true });
      return new THREE.Points(geo, mat);
    }
    const starsFar = makeStarLayer(220, 60, 0.045, 0.35, 0xffffff);
    const starsNear = makeStarLayer(70, 40, 0.09, 0.6, 0xffd9b8);
    const starsAccent = makeStarLayer(18, 30, 0.16, 0.8, 0xff8f4d);
    scene.add(starsFar, starsNear, starsAccent);

    function roundRectPath(ctx, x, y, w, h, r){
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    function drawIcon(ctx, type, cx, cy, r){
      ctx.strokeStyle = '#FF6B1A';
      ctx.fillStyle = '#FF6B1A';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      switch (type){
        case 'seo':
          ctx.arc(cx - r * 0.15, cy - r * 0.15, r * 0.5, 0, Math.PI * 2);
          ctx.moveTo(cx + r * 0.22, cy + r * 0.22);
          ctx.lineTo(cx + r * 0.6, cy + r * 0.6);
          break;
        case 'paid-media':
          ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
          ctx.moveTo(cx + r * 0.32, cy);
          ctx.arc(cx, cy, r * 0.32, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(cx, cy, r * 0.1, 0, Math.PI * 2);
          ctx.fill();
          return;
        case 'web-dev':
          roundRectPath(ctx, cx - r * 0.6, cy - r * 0.45, r * 1.2, r * 0.9, 6);
          ctx.moveTo(cx - r * 0.6, cy - r * 0.18);
          ctx.lineTo(cx + r * 0.6, cy - r * 0.18);
          break;
        case 'creative':
          ctx.moveTo(cx - r * 0.5, cy + r * 0.5);
          ctx.lineTo(cx + r * 0.25, cy - r * 0.3);
          ctx.lineTo(cx + r * 0.5, cy - r * 0.05);
          ctx.lineTo(cx - r * 0.25, cy + r * 0.5);
          ctx.closePath();
          break;
        case 'media-production':
          roundRectPath(ctx, cx - r * 0.6, cy - r * 0.32, r * 1.2, r * 0.72, 8);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(cx, cy + r * 0.06, r * 0.28, 0, Math.PI * 2);
          break;
        case 'social':
          roundRectPath(ctx, cx - r * 0.58, cy - r * 0.42, r * 1.16, r * 0.72, 14);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(cx - r * 0.2, cy + r * 0.3);
          ctx.lineTo(cx - r * 0.35, cy + r * 0.58);
          ctx.lineTo(cx - r * 0.35, cy + r * 0.3);
          ctx.closePath();
          break;
        case 'cro':
          ctx.moveTo(cx - r * 0.55, cy - r * 0.4);
          ctx.lineTo(cx + r * 0.55, cy - r * 0.4);
          ctx.lineTo(cx + r * 0.15, cy + r * 0.1);
          ctx.lineTo(cx + r * 0.15, cy + r * 0.5);
          ctx.lineTo(cx - r * 0.15, cy + r * 0.35);
          ctx.lineTo(cx - r * 0.15, cy + r * 0.1);
          ctx.closePath();
          break;
      }
      ctx.stroke();
    }

    function makeCardTexture(svc){
      const canvas = document.createElement('canvas');
      canvas.width = 640; canvas.height = 400;
      const ctx = canvas.getContext('2d');

      roundRectPath(ctx, 6, 6, canvas.width - 12, canvas.height - 12, 30);
      ctx.fillStyle = 'rgba(22,21,19,0.97)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 2;
      ctx.stroke();

      roundRectPath(ctx, 56, 56, 96, 96, 20);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fill();
      drawIcon(ctx, svc.icon, 104, 104, 30);

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 46px Arial, sans-serif';
      ctx.fillText(svc.title, 56, 245);

      ctx.fillStyle = 'rgba(230,225,215,0.55)';
      ctx.font = '600 21px monospace';
      ctx.fillText(svc.tag.toUpperCase(), 56, 288);

      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      texture.anisotropy = 4;
      return texture;
    }

    const objectGroup = new THREE.Group();
    const objects = SERVICE_DATA.map((svc, i) => {
      const texture = makeCardTexture(svc);
      const geo = new THREE.PlaneGeometry(3.6, 2.25);
      const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.5 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData.slug = svc.slug;
      mesh.userData.index = i;

      const glowMat = new THREE.MeshBasicMaterial({
        color: 0xff6b1a,
        transparent: true,
        opacity: 0.03,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const glowShell = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.9), glowMat);
      glowShell.position.z = -0.05;
      mesh.add(glowShell);

      mesh.scale.setScalar(0.32);
      mesh.userData.swayOffset = Math.random() * Math.PI * 2;

      const angle = (i / SERVICE_DATA.length) * Math.PI * 2;
      mesh.userData.baseY = Math.sin(angle * 0.6) * 1.5;
      const radius = 7;
      mesh.position.set(Math.cos(angle) * radius, Math.sin(angle * 0.6) * 1.5, Math.sin(angle) * radius);
      mesh.userData.glowShell = glowShell;
      objectGroup.add(mesh);
      return mesh;
    });
    scene.add(objectGroup);

    function renderScene(){ renderer.render(scene, camera); }

    let rafRunning = false;
    let idleT = 0;
    let baseCameraX = camera.position.x, baseCameraY = camera.position.y;
    function idleTick(){
      if (!rafRunning) return;
      idleT += 0.01;
      objects.forEach((m, i) => {
        const sway = m.userData.swayOffset;
        m.rotation.y = Math.sin(idleT * 0.5 + sway) * 0.18;
        m.rotation.x = Math.cos(idleT * 0.4 + sway) * 0.06;
        m.position.y = m.userData.baseY + Math.sin(idleT * 0.8 + sway) * 0.25;
      });
      starsFar.rotation.y += 0.00015;
      starsNear.rotation.y += 0.00035;
      starsAccent.rotation.y += 0.0006;
      camera.position.x = baseCameraX + Math.sin(idleT * 0.4) * 0.35;
      camera.position.y = baseCameraY + Math.cos(idleT * 0.3) * 0.2;
      camera.lookAt(0, 0, 0);
      renderScene();
      requestAnimationFrame(idleTick);
    }
    function startLoop(){
      if (rafRunning) return;
      rafRunning = true;
      requestAnimationFrame(idleTick);
    }
    function stopLoop(){ rafRunning = false; }

    const services3dIO = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) startLoop(); else stopLoop();
      });
    }, { threshold: 0.05 });
    services3dIO.observe(services3dStage);

    window.addEventListener('resize', () => {
      const w = services3dStage.clientWidth, h = services3dStage.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });

    const raycaster = new THREE.Raycaster();
    const pointerNDC = new THREE.Vector2();
    function getIntersectedCard(clientX, clientY){
      const rect = services3dCanvas.getBoundingClientRect();
      pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNDC, camera);
      const hits = raycaster.intersectObjects(objects, false);
      return hits.length ? hits[0].object : null;
    }
    services3dCanvas.addEventListener('click', (e) => {
      const hit = getIntersectedCard(e.clientX, e.clientY);
      if (hit && hit.userData.slug) window.location.href = '/' + hit.userData.slug + '/';
    });
    services3dCanvas.addEventListener('mousemove', (e) => {
      const hit = getIntersectedCard(e.clientX, e.clientY);
      services3dCanvas.style.cursor = hit ? 'pointer' : '';
    });

    const services3dLabelEl = document.getElementById('services3dLabel');
    const services3dTagEl = document.getElementById('services3dTag');
    const services3dTitleEl = document.getElementById('services3dTitle');
    const services3dDots = document.querySelectorAll('.services-3d-dot');
    let services3dActive = -1;

    function setActiveService(i){
      if (i === services3dActive) return;
      services3dActive = i;
      const svc = SERVICE_DATA[i];
      services3dLabelEl.classList.remove('is-visible');
      services3dLabelEl.setAttribute('href', '/' + svc.slug + '/');
      setTimeout(() => {
        services3dTagEl.textContent = svc.tag;
        services3dTitleEl.textContent = svc.title;
        services3dLabelEl.classList.add('is-visible');
      }, 120);
      services3dDots.forEach(d => d.classList.toggle('active', Number(d.dataset.i) === i));

      objects.forEach((m, idx) => {
        const isActive = idx === i;
        const targetScale = isActive ? 2.0 : 0.32;
        gsap.to(m.scale, { x: targetScale, y: targetScale, z: targetScale, duration: 0.7, ease: 'power2.out' });
        gsap.to(m.material, { opacity: isActive ? 1 : 0.5, duration: 0.7 });
        gsap.to(m.userData.glowShell.material, { opacity: isActive ? 0.22 : 0.03, duration: 0.7 });
      });

      const targetAngle = (i / SERVICE_DATA.length) * Math.PI * 2;
      gsap.to(camera.position, {
        x: Math.cos(targetAngle) * 3,
        y: 1,
        duration: 1,
        ease: 'power2.inOut',
        onUpdate: () => {
          camera.lookAt(0, 0, 0);
          baseCameraX = camera.position.x;
          baseCameraY = camera.position.y;
        }
      });
    }

    ScrollTrigger.create({
      trigger: '.services-3d-stage',
      start: 'top top',
      end: '+=' + (SERVICE_DATA.length * 400),
      pin: true,
      scrub: 0.6,
      onUpdate: (self) => {
        const idx = Math.min(SERVICE_DATA.length - 1, Math.floor(self.progress * SERVICE_DATA.length));
        setActiveService(idx);
      },
      onEnter: () => setActiveService(0)
    });
   } catch (err){
    console.warn('3D services showcase failed to initialize, hiding section:', err);
    if (services3dStage.closest('.services-3d')) services3dStage.closest('.services-3d').style.display = 'none';
   }
  }

  /* ---- Creative hero photo parallax ---- */
  const creativeHeroPhoto = document.querySelector('.creative-hero-photo');
  const creativeHeroImg = document.querySelector('.creative-hero-img');
  if (creativeHeroPhoto && creativeHeroImg && hasGsap && cursorCapable && !reduceMotion){
    const movePhotoX = gsap.quickTo(creativeHeroImg, 'x', { duration: 0.6, ease: 'power2.out' });
    const movePhotoY = gsap.quickTo(creativeHeroImg, 'y', { duration: 0.6, ease: 'power2.out' });
    creativeHeroPhoto.addEventListener('mousemove', (e) => {
      const rect = creativeHeroPhoto.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width - 0.5;
      const relY = (e.clientY - rect.top) / rect.height - 0.5;
      movePhotoX(relX * -24);
      movePhotoY(relY * -18);
    });
    creativeHeroPhoto.addEventListener('mouseleave', () => {
      movePhotoX(0); movePhotoY(0);
    });
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

