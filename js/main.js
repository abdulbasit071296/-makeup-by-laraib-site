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

  const galleryTrack = document.getElementById("gallery-track");
  if (galleryTrack) {
    galleryTrack.addEventListener("click", (e) => {
      const slide = e.target.closest(".slide");
      if (!slide) return;
      const full = slide.getAttribute("data-full");
      const img = slide.querySelector("img");
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

  /* ---------- Gallery slider: infinite coverflow loop ----------
     The real slide set is tripled (copy A / B / C). currentIdx is a
     single authoritative counter — every button click or autoplay
     tick moves it by exactly 1, independent of whether the browser's
     scroll animation has visually caught up yet. Re-deriving "where
     are we" from scroll geometry on every step (the previous approach)
     could read a stale/in-flight position and silently compute the
     same target twice in a row, which is what made the carousel
     appear to get stuck after hovering or revisiting the section.
     Geometry is only consulted afterwards, to follow manual drag/swipe. */
  function initSlider(rootId, trackId, autoplayMs) {
    const root = document.getElementById(rootId);
    const track = document.getElementById(trackId);
    if (!root || !track) return;

    const originals = Array.from(track.children);
    const realCount = originals.length;
    if (realCount === 0) return;

    originals.forEach((node) => track.appendChild(node.cloneNode(true)));
    originals.forEach((node) => track.appendChild(node.cloneNode(true)));

    const slides = Array.from(track.children);
    const prevBtn = root.querySelector(".slider-arrow-prev");
    const nextBtn = root.querySelector(".slider-arrow-next");

    let currentIdx = realCount;

    function slideTarget(i) {
      const clamped = Math.max(0, Math.min(slides.length - 1, i));
      const slide = slides[clamped];
      const trackRect = track.getBoundingClientRect();
      const slideRect = slide.getBoundingClientRect();
      return track.scrollLeft + (slideRect.left - trackRect.left) - (trackRect.width - slideRect.width) / 2;
    }

    function scrollToIndex(i, instant) {
      track.scrollTo({ left: slideTarget(i), behavior: instant || prefersReduced ? "auto" : "smooth" });
    }

    function nearestIndex() {
      const trackRect = track.getBoundingClientRect();
      const center = trackRect.left + trackRect.width / 2;
      let closest = 0;
      let closestDist = Infinity;
      slides.forEach((slide, i) => {
        const rect = slide.getBoundingClientRect();
        const dist = Math.abs((rect.left + rect.width / 2) - center);
        if (dist < closestDist) {
          closestDist = dist;
          closest = i;
        }
      });
      return closest;
    }

    function setActive(i) {
      slides.forEach((slide, idx) => slide.classList.toggle("is-active", idx === i));
    }

    /* Moves to index i (normalizing back into the safe middle copy
       first if needed) and updates the one authoritative counter. */
    function goTo(i, instant) {
      let target = i;
      if (target < realCount) target += realCount;
      else if (target >= realCount * 2) target -= realCount;
      currentIdx = target;
      scrollToIndex(target, instant);
      setActive(target);
    }

    function step(delta) {
      goTo(currentIdx + delta);
    }

    /* Follows manual drag/swipe: once native scrolling settles, resync
       the authoritative counter from the actual visual position. */
    let settleTimer = null;
    track.addEventListener("scroll", () => {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        const nearest = nearestIndex();
        if (nearest < realCount || nearest >= realCount * 2) {
          goTo(nearest, true);
        } else {
          currentIdx = nearest;
          setActive(nearest);
        }
      }, 120);
    }, { passive: true });

    goTo(realCount, true);

    /* Autoplay: stop() always clears any existing timer before start()
       creates a new one, so overlapping pointer/focus/touch events can
       never leak duplicate intervals. */
    let timer = null;
    const stopAutoplay = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    const startAutoplay = () => {
      if (prefersReduced || !autoplayMs) return;
      stopAutoplay();
      timer = setInterval(() => step(1), autoplayMs);
    };

    prevBtn.addEventListener("click", () => {
      step(-1);
      startAutoplay();
    });
    nextBtn.addEventListener("click", () => {
      step(1);
      startAutoplay();
    });

    startAutoplay();
    /* Pause/resume is tied to the image track itself, not the whole
       .coverflow wrapper — that wrapper also contains the arrow
       buttons and its own bottom padding, so its box is much taller
       than the pictures. Hanging the listener there meant the cursor
       had to clear all of that extra space (not just leave a picture)
       before pointerleave ever fired, so autoplay could stay paused
       long after the user had visually moved on. */
    track.addEventListener("pointerenter", stopAutoplay);
    track.addEventListener("pointerleave", startAutoplay);
    root.addEventListener("focusin", stopAutoplay);
    root.addEventListener("focusout", startAutoplay);
    track.addEventListener("touchstart", stopAutoplay, { passive: true });
    track.addEventListener("touchend", startAutoplay, { passive: true });
    track.addEventListener("touchcancel", startAutoplay, { passive: true });

    /* Self-heal on return: if the section scrolls back into view after
       being off-screen, re-assert the current position and make sure
       autoplay is actually running rather than trusting whatever state
       it was left in. */
    if ("IntersectionObserver" in window) {
      const visibilityObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            goTo(currentIdx, true);
            startAutoplay();
          }
        });
      }, { threshold: 0.3 });
      visibilityObserver.observe(root);
    }
  }

  initSlider("gallery-slider", "gallery-track", 1500);

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
