function initSite() {
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Header scroll state ---------- */
  /* Header stays transparent (name only) while the hero is behind it;
     once the hero scrolls past, it becomes solid with the full nav. */
  const header = document.getElementById("site-header");
  const heroSection = document.getElementById("home");
  const onScroll = () => {
    const overHero = heroSection && heroSection.getBoundingClientRect().bottom > header.offsetHeight;
    header.classList.toggle("scrolled", !overHero);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  /* ---------- Hero entrance (plays once) ---------- */
  /* The video plays continuously once it appears, so there's no
     repeating theme cycle anymore — just a single relay on load:
     each element only starts entering once the previous one's own
     transition has actually finished (listens for transitionend),
     video first, then eyebrow → title → subtitle → actions. */
  if (heroSection) {
    const heroVideo = heroSection.querySelector(".hero-visual-video");
    const heroEyebrow = heroSection.querySelector(".hero-eyebrow");
    const heroTitle = heroSection.querySelector(".hero-title");
    const heroSubtitle = heroSection.querySelector(".hero-subtitle");
    const heroActions = heroSection.querySelector(".hero-actions");
    const heroSequence = [heroVideo, heroEyebrow, heroTitle, heroSubtitle, heroActions].filter(Boolean);

    if (prefersReduced) {
      heroSequence.forEach((el) => el.classList.add("is-visible"));
    } else if (heroSequence.length) {
      const ENTER_MS = 1300;

      function enterOneByOne(elements) {
        let i = 0;
        function enterNext() {
          if (i >= elements.length) return;
          const el = elements[i];
          let advanced = false;
          const advance = () => {
            if (advanced) return;
            advanced = true;
            el.removeEventListener("transitionend", onEnd);
            i += 1;
            enterNext();
          };
          const onEnd = (e) => {
            if (e.target === el) advance();
          };
          el.addEventListener("transitionend", onEnd);
          el.classList.add("is-visible");
          // Safety net only — the transitionend above is what normally
          // advances the sequence; this just prevents a stall if a
          // browser quirk ever drops the event.
          setTimeout(advance, ENTER_MS + 300);
        }
        enterNext();
      }

      enterOneByOne(heroSequence);

      // Absolute backstop: on a slow/janky device the per-element relay
      // above can stall partway (confirmed happening — subtitle and the
      // WhatsApp button staying invisible indefinitely), leaving content
      // permanently hidden. Force everything visible after a fixed delay
      // no matter what state the relay is in.
      setTimeout(() => {
        heroSequence.forEach((el) => el.classList.add("is-visible"));
      }, 4000);
    }

    if (heroVideo) {
      // Autoplay can be silently blocked by the browser even when muted
      // in some cases; retry explicitly so the video doesn't sit frozen.
      const playPromise = heroVideo.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          heroVideo.muted = true;
          heroVideo.play().catch(() => {});
        });
      }

      // Some mobile browsers (data-saver / low-power modes) block autoplay
      // outright, leaving the static poster + native play button visible.
      // The first touch/scroll/click anywhere satisfies the browser's
      // user-gesture requirement, so retry there as a safety net.
      const resumeVideoOnInteraction = () => {
        if (heroVideo.paused) heroVideo.play().catch(() => {});
      };
      ["touchstart", "scroll", "click"].forEach((evt) => {
        document.addEventListener(evt, resumeVideoOnInteraction, { passive: true, once: true });
      });
    }
  }

  /* ---------- Mobile menu ---------- */
  const navToggle = document.getElementById("nav-toggle");
  const mobileMenu = document.getElementById("mobile-menu");

  function closeMenu() {
    navToggle.setAttribute("aria-expanded", "false");
    mobileMenu.classList.remove("open");
    document.body.style.overflow = "";
  }

  function openMenu() {
    navToggle.setAttribute("aria-expanded", "true");
    mobileMenu.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  navToggle.addEventListener("click", () => {
    const isOpen = navToggle.getAttribute("aria-expanded") === "true";
    isOpen ? closeMenu() : openMenu();
  });

  mobileMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  /* ---------- Testimonials: live rotating cards ----------
     Each testimonial stays fully visible for a full 3s before the
     next change starts — the exit/entrance animation time is added
     on top of that, not carved out of it (a fixed-period timer had
     the transitions eating almost the entire interval, so the cards
     barely finished settling before exiting again). Cards fade/rise
     out together (slow, 1.1s), the text is swapped once hidden, then
     they fade back in one after another — staggered 350ms apart. */
  const testimonialData =
    (window.SITE_CONTENT && window.SITE_CONTENT.testimonials && window.SITE_CONTENT.testimonials.items) || [
      { initials: "AK", quote: "I stopped worrying the moment Laraib started — every detail felt intentional, from the base to the final setting spray.", name: "Ayesha K.", role: "Bride" },
      { initials: "MR", quote: "My engagement makeup lasted through the entire evening, photos included. Exactly the soft-glam look I asked for.", name: "Mehak R.", role: "Bride-to-be" },
      { initials: "ST", quote: "Booked for my sister's mehndi and she looked stunning. Laraib really listens to what you want.", name: "Sana T.", role: "Sister of the Bride" },
      { initials: "HM", quote: "The trial session made all the difference — no surprises on the wedding day, just calm and confidence.", name: "Hira M.", role: "Bride" },
      { initials: "FA", quote: "Professional, punctual, and the jewellery setting was flawless. Worth every rupee.", name: "Fatima A.", role: "Bride" },
      { initials: "NS", quote: "Party makeup that photographed beautifully under every light. Already rebooked for my next event.", name: "Noor S.", role: "Client" },
    ];

  const testimonialCards = [0, 1, 2]
    .map((i) => document.getElementById(`testimonial-${i}`))
    .filter(Boolean);

  if (testimonialCards.length === 3 && testimonialData.length >= 3) {
    const fillCard = (card, data) => {
      const quoteEl = card.querySelector(".testimonial-quote");
      const nameEl = card.querySelector(".testimonial-name");
      const roleEl = card.querySelector(".testimonial-role");
      const avatarEl = card.querySelector(".testimonial-avatar");
      if (quoteEl) quoteEl.textContent = data.quote;
      if (nameEl) nameEl.textContent = data.name;
      if (roleEl) roleEl.textContent = data.role;
      if (avatarEl) avatarEl.textContent = data.initials;
    };

    let offset = 0;
    const EXIT_MS = 1100;
    const STAGGER_MS = 350;
    const ENTER_MS = 1100;
    const HOLD_MS = 3000;

    const cycleTestimonials = () => {
      offset = (offset + 3) % testimonialData.length;

      testimonialCards.forEach((card) => card.classList.add("is-changing"));

      setTimeout(() => {
        testimonialCards.forEach((card, i) => {
          fillCard(card, testimonialData[(offset + i) % testimonialData.length]);
        });

        testimonialCards.forEach((card, i) => {
          setTimeout(() => card.classList.remove("is-changing"), i * STAGGER_MS);
        });

        const lastCardSettleMs = (testimonialCards.length - 1) * STAGGER_MS + ENTER_MS;
        scheduleNextTestimonialCycle(lastCardSettleMs + HOLD_MS);
      }, EXIT_MS);
    };

    function scheduleNextTestimonialCycle(delay) {
      setTimeout(cycleTestimonials, delay);
    }

    if (!prefersReduced) {
      scheduleNextTestimonialCycle(HOLD_MS);
    }
  }

  /* ---------- Gallery lightbox ---------- */
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const lightboxClose = document.getElementById("lightbox-close");

  function openLightbox(src, alt) {
    lightboxImg.src = src;
    lightboxImg.alt = alt || "";
    lightbox.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    lightbox.classList.remove("open");
    document.body.style.overflow = "";
    lightboxImg.src = "";
  }

  const galleryBento2 = document.getElementById("gallery-bento2");
  if (galleryBento2) {
    galleryBento2.addEventListener("click", (e) => {
      const tile = e.target.closest(".bento2-card, .bento2-cell-media");
      if (!tile || tile.getAttribute("data-media") === "video") return;
      const full = tile.getAttribute("data-full");
      const img = tile.querySelector("img");
      openLightbox(full, img ? img.alt : "");
    });
  }

  lightboxClose.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  // Single Escape handler for both dismissible overlays (previously two
  // separate keydown listeners did the same job).
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closeMenu();
    closeLightbox();
  });

  /* ---------- Bento gallery: step sequencer ----------
     One combined loop. Left column (3 uniform cards, card 2 slightly
     larger) takes 3 downward steps, same as before. Right side is ONE
     continuous strip — row A (cards 4, 5) then row B (cards 6-9),
     repeated twice (A, B, A, B) — and always shows one full A+B pair
     at once. A step slides the strip up by whichever row is currently
     on top, so that row scrolls out while the other row moves up into
     its place, and the row that scrolled out reappears at the bottom
     from the repeated copy. Six cards stay visible throughout; only
     their top/bottom order swaps. Two such steps (A out/B in, then B
     out/A in) return the strip to its starting look, at which point
     position resets silently and the cycle repeats. */
  function initBentoStepper() {
    const leftBody = document.querySelector(".bento2-left");
    const leftTrack = document.getElementById("bento2-left-track");
    const rightBody = document.querySelector(".bento2-right");
    const rightTrack = document.getElementById("bento2-right-track");
    if (!leftBody || !leftTrack || !rightBody || !rightTrack) return;
    if (leftTrack.children.length === 0 || rightTrack.children.length === 0) return;

    const EASE = "cubic-bezier(.65,0,.35,1)";
    const LEFT_STEP_MS = 1050;
    const RIGHT_STEP_MS = 800;
    const SETTLE_MS = 250;
    const LONG_PAUSE_MS = 1600; // pause between row A's step and row B's step
    const GAP = 10; // matches the 0.625rem gap in CSS

    if (prefersReduced) {
      // Respect reduced-motion here (unlike the Instagram marquee) since
      // this is a much larger, more insistent full-body motion, not a
      // small background strip.
      return;
    }

    let cancelled = false;
    let leftCardH = 0;
    let rowAH = 0;
    let rowBH = 0;

    function measure() {
      // Cards have no CSS height of their own — the images inside rely
      // on height:100% of their card, so without an explicit pixel
      // height set here that's a circular reference that resolves to
      // ~0. Compute a real, FIXED height once from each container and
      // apply it directly — never recomputed mid-animation, only on
      // load/resize, so the layout never shifts while stepping.
      const leftCards = leftTrack.querySelectorAll(".bento2-card");
      leftCardH = (leftBody.clientHeight - GAP * 2) / 3;
      leftCards.forEach((c) => (c.style.height = leftCardH + "px"));

      // Row A : Row B keeps the same 1:2 share of the right body's
      // total height that the old static layout used, minus the one
      // gap that sits between them when both are visible together.
      const rightContentH = rightBody.clientHeight - GAP;
      rowAH = rightContentH / 3;
      rowBH = rightContentH - rowAH;
      rightTrack.querySelectorAll(":scope > .bento2-row-a").forEach((r) => (r.style.height = rowAH + "px"));
      rightTrack.querySelectorAll(":scope > .bento2-row-b").forEach((r) => (r.style.height = rowBH + "px"));
    }
    measure();
    window.addEventListener("resize", measure);

    function setTransform(el, y, transitionMs) {
      el.style.transition = transitionMs ? `transform ${transitionMs}ms ${EASE}` : "none";
      el.style.transform = `translateY(${y}px)`;
    }

    const leftSlot = () => leftCardH + GAP;

    // Start on the middle copy of the tripled track so there's always a
    // same-content copy both ahead and behind to land on.
    setTransform(leftTrack, -leftSlot() * 3, 0);
    let leftPos = -leftSlot() * 3;
    setTransform(rightTrack, 0, 0);
    let rightPos = 0;

    function wait(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async function runLeft() {
      for (let i = 0; i < 3; i++) {
        if (cancelled) return;
        leftPos += leftSlot();
        setTransform(leftTrack, leftPos, LEFT_STEP_MS);
        await wait(LEFT_STEP_MS + SETTLE_MS);
      }
      // Landed back on the identical middle-copy position — reset
      // silently (no transition) so the count never grows unbounded.
      leftPos = -leftSlot() * 3;
      setTransform(leftTrack, leftPos, 0);
    }

    async function runRight() {
      // Step 1: row A (currently on top) scrolls up and out; row B
      // moves up to take its place.
      if (cancelled) return;
      rightPos -= rowAH + GAP;
      setTransform(rightTrack, rightPos, RIGHT_STEP_MS);
      await wait(RIGHT_STEP_MS + SETTLE_MS);
      if (cancelled) return;
      await wait(LONG_PAUSE_MS);

      // Step 2: row B (now on top) scrolls up and out; the repeated
      // copy of row A moves up to take its place — visually identical
      // to where the strip started.
      if (cancelled) return;
      rightPos -= rowBH + GAP;
      setTransform(rightTrack, rightPos, RIGHT_STEP_MS);
      await wait(RIGHT_STEP_MS + SETTLE_MS);

      // Reset silently (no transition) back to the start position so
      // the offset never grows unbounded.
      rightPos = 0;
      setTransform(rightTrack, rightPos, 0);
    }

    // Left finishes -> right starts immediately -> right finishes ->
    // left starts immediately. The only deliberate pause is the one
    // inside runRight, between its two steps.
    async function loop() {
      while (!cancelled) {
        await runLeft();
        if (cancelled) return;

        await runRight();
        if (cancelled) return;
      }
    }

    const gallery = document.getElementById("gallery-bento2");

    // Self-heal on return, same reasoning as the old gallery carousel:
    // don't trust whatever state a background tab left this in.
    if ("IntersectionObserver" in window) {
      let running = false;
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !running) {
              running = true;
              loop();
            }
          });
        },
        { threshold: 0.2 }
      );
      observer.observe(gallery);
    } else {
      loop();
    }
  }

  initBentoStepper();

  /* ---------- Instagram marquee: duplicate for seamless loop ---------- */
  const instaTrack = document.getElementById("insta-track");
  if (instaTrack) {
    const originals = Array.from(instaTrack.children);
    originals.forEach((node) => {
      const clone = node.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      clone.setAttribute("tabindex", "-1");
      instaTrack.appendChild(clone);
    });

    // Safari can fail to actually start a CSS animation on an element
    // that's off-screen at load, leaving it stuck on frame one until some
    // later scroll-triggered repaint "wakes" it up (confirmed happening —
    // it started working only after scrolling up and down). Force a
    // restart by toggling the animation off and back on once the section
    // is actually visible, rather than trusting it started on its own.
    if ("IntersectionObserver" in window) {
      const instaMarquee = document.querySelector(".insta-marquee");
      const restartAnimation = () => {
        instaTrack.style.animation = "none";
        void instaTrack.offsetWidth; // force reflow
        instaTrack.style.animation = "";
      };
      const instaObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) restartAnimation();
          });
        },
        { threshold: 0.1 }
      );
      instaObserver.observe(instaMarquee || instaTrack);
    }
  }

  /* ---------- Scroll reveal ---------- */
  const revealEls = document.querySelectorAll(".reveal");

  if (prefersReduced || !("IntersectionObserver" in window)) {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -6% 0px" }
    );
    revealEls.forEach((el) => observer.observe(el));
  }
}

/* content-loader.js renders the dynamic sections (services, gallery,
   instagram, testimonial data) from content.json before this can safely
   read them, so wait for both the DOM and that render pass. Both
   conditions are also checked immediately (not just listened for) since
   content.json can resolve fast enough that "content:ready" fires before
   this script finishes registering its listener — a plain addEventListener
   would then wait forever for an event that already happened. */
let domReady = document.readyState !== "loading";
let contentReady = !!window.SITE_CONTENT;
function tryInitSite() {
  if (domReady && contentReady) initSite();
}
if (!domReady) {
  document.addEventListener("DOMContentLoaded", () => {
    domReady = true;
    tryInitSite();
  });
}
if (!contentReady) {
  document.addEventListener("content:ready", () => {
    contentReady = true;
    tryInitSite();
  });
}
tryInitSite();
