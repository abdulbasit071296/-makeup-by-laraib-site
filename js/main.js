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

  /* ---------- Hero entrance ---------- */
  /* The text (.hero-text) is a .stagger-reveal like every other
     section now — see the generic block further down. Only the video
     keeps its own bespoke entrance here (scale + slide, not a plain
     fade), since it plays continuously once visible and that motion
     is distinct from the text cascade. */
  if (heroSection) {
    const heroVideo = heroSection.querySelector(".hero-visual-video");

    if (heroVideo) {
      if (prefersReduced || !("IntersectionObserver" in window)) {
        heroVideo.classList.add("is-visible");
      } else {
        // The hero is already in view on load, so this fires almost
        // immediately — kept as an observer rather than a flat delay
        // so scrolling away and back also replays it, same as every
        // other reveal on the page.
        const heroVideoObserver = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              entry.target.classList.toggle("is-visible", entry.isIntersecting);
            });
          },
          { threshold: 0.2 }
        );
        heroVideoObserver.observe(heroVideo);
      }
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

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closeMenu();
  });

  /* ---------- Spatial grid: per-cell image scroll ---------- */
  /* Cells with more than one image auto-advance through them, holding
     on each for a while before stepping to the next. Looping is
     seamless via a duplicate of the first image appended at the end
     of each track — stepping onto it looks identical to the real
     first image, so the reset back to position 0 is invisible (same
     trick used for the old gallery's tracks). Cells with only one
     image (or the video cell) have no .spatial-scroll-track at all,
     so they're untouched.

     data-direction picks both the axis and which edge the new image
     enters from: "bottom"/"top" are vertical (translateY), "left"/
     "right" are horizontal (translateX). "bottom"/"right" use normal
     DOM order, so item 0 sits flush with the window at pos 0 and each
     step moves further negative to reveal the next item. "top"/"left"
     use a *reversed* flex order (column-reverse/row-reverse, set in
     CSS) so the new image enters from the opposite edge — but the
     reversed track's own box is never explicitly widened to fit every
     item, so item 0 ALSO ends up flush with the window at pos 0
     (confirmed by measuring actual rects), and later items overflow
     to the other side, needing a POSITIVE step to bring them in. So
     the two cases are simple mirror images of each other, not one
     counting up and the other counting down from the far end. */
  function initSpatialCellScroll() {
    const tracks = document.querySelectorAll(".spatial-scroll-track");
    if (!tracks.length) return;

    function wait(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    tracks.forEach((track, trackIndex) => {
      const items = track.children;
      const realCount = items.length - 1; // last child is the duplicate of the first
      if (realCount < 2) return;

      const cell = track.closest(".spatial-cell");
      const direction = track.getAttribute("data-direction") || "bottom";
      const horizontal = direction === "left" || direction === "right";
      const reversed = direction === "top" || direction === "left";
      let itemSize = 0;

      function measure() {
        const rect = cell.getBoundingClientRect();
        itemSize = horizontal ? rect.width : rect.height;
        Array.from(items).forEach((item) => {
          if (horizontal) item.style.width = itemSize + "px";
          else item.style.height = itemSize + "px";
        });
      }
      measure();
      window.addEventListener("resize", measure);

      // Sizes are set either way (above) so the first image always
      // renders correctly; reduced-motion just skips the stepping loop.
      if (prefersReduced) return;

      const STEP_MS = 900;
      const EASE = "cubic-bezier(.65,0,.35,1)";
      // Slight per-cell stagger so multiple cells don't all step at
      // the exact same instant.
      const HOLD_MS = 2600 + trackIndex * 350;

      function posFor(k) {
        // Reversed tracks (row-reverse/column-reverse) render their
        // first item already flush with the window at 0 — confirmed
        // by measuring actual rects, since the track's own box is
        // only one item wide (it's never explicitly widened to fit
        // all of them) and the flex items simply overflow toward the
        // reversed main-end. So later items sit on the opposite side
        // and need a POSITIVE shift to come in, the mirror image of
        // the normal case rather than counting down from the far end.
        return reversed ? k * itemSize : -k * itemSize;
      }

      function setTransform(pos, withTransition) {
        const axis = horizontal ? "X" : "Y";
        track.style.transition = withTransition ? `transform ${STEP_MS}ms ${EASE}` : "none";
        track.style.transform = `translate${axis}(${pos}px)`;
      }
      setTransform(posFor(0), false);

      async function loop() {
        for (let k = 1; k <= realCount; k++) {
          await wait(HOLD_MS);
          setTransform(posFor(k), true);
          await wait(STEP_MS);
        }
        // Landed on the duplicate of the first image — reset silently
        // (no transition) once it's held a moment, then repeat.
        await wait(HOLD_MS);
        setTransform(posFor(0), false);
        loop();
      }

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
        observer.observe(cell);
      } else {
        loop();
      }
    });
  }
  initSpatialCellScroll();

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

  /* ---------- Magic heading reveal ---------- */
  /* Section titles (not the hero, which has its own entrance relay
     above) split into words that rise into place with a stagger.
     Unlike .reveal, this keeps observing and toggles every time the
     heading crosses the viewport, so it replays on the way in AND
     plays in reverse on the way out. Runs after content.json has
     already populated these headings (initSite only runs once
     content:ready has fired), so the real text gets split, not a
     placeholder. */
  const magicHeadings = document.querySelectorAll(".section-head h2");
  if (magicHeadings.length) {
    const escapeForSplit = (str) =>
      String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    magicHeadings.forEach((h) => {
      const tokens = h.textContent.split(/(\s+)/);
      let wordIndex = 0;
      h.innerHTML = tokens
        .map((token) => {
          if (token === "" || /^\s+$/.test(token)) return token;
          const delay = wordIndex * 60;
          wordIndex++;
          return (
            '<span class="magic-word"><span class="magic-word-inner" style="--word-delay:' +
            delay +
            'ms">' +
            escapeForSplit(token) +
            "</span></span>"
          );
        })
        .join("");
      h.classList.add("magic-heading");
    });

    if (prefersReduced || !("IntersectionObserver" in window)) {
      magicHeadings.forEach((h) => h.classList.add("in-view"));
    } else {
      const headingObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            entry.target.classList.toggle("in-view", entry.isIntersecting);
          });
        },
        { threshold: 0.3 }
      );
      magicHeadings.forEach((h) => headingObserver.observe(h));
    }
  }

  /* ---------- Text cascade (every section) ---------- */
  /* Same toggle-on-every-crossing model as the magic heading above,
     applied to a whole stack of elements per section (see
     .stagger-reveal > * in style.css) instead of split words — so
     leaving and re-entering any section always replays its staggered
     fade-in. Originally built for Hair Care alone, now shared by
     every section's intro copy (.hero-text, .spatial-header,
     .section-head, .hair-care-copy). */
  const staggerReveals = document.querySelectorAll(".stagger-reveal");
  if (staggerReveals.length) {
    if (prefersReduced || !("IntersectionObserver" in window)) {
      staggerReveals.forEach((el) => el.classList.add("in-view"));
    } else {
      const staggerObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            entry.target.classList.toggle("in-view", entry.isIntersecting);
          });
        },
        { threshold: 0.2 }
      );
      staggerReveals.forEach((el) => staggerObserver.observe(el));
    }
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
