/* Loads content.json and renders it into the page before main.js runs.
   Fields are addressed by dot-path via data-key (text) / data-key-html
   (innerHTML, for the few fields that contain markup like <em>) /
   data-key-img (image src or CSS background-image). Repeating sections
   (service cards, gallery, instagram, testimonials) are rendered fully
   from the content arrays so items can be added/removed from the
   admin panel. Fires "content:ready" on document when done, which
   main.js waits for before wiring up interactive behaviour. */
(function () {
  function getByPath(obj, path) {
    return path.split(".").reduce((v, k) => (v == null ? v : v[k]), obj);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  const INSTA_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/></svg>';

  function applyText(content) {
    document.querySelectorAll("[data-key]").forEach((el) => {
      const val = getByPath(content, el.getAttribute("data-key"));
      if (val != null) el.textContent = val;
    });
    document.querySelectorAll("[data-key-html]").forEach((el) => {
      const val = getByPath(content, el.getAttribute("data-key-html"));
      if (val != null) el.innerHTML = val;
    });
    document.querySelectorAll("[data-key-img]").forEach((el) => {
      const val = getByPath(content, el.getAttribute("data-key-img"));
      if (!val) return;
      if (el.tagName === "IMG" || el.tagName === "VIDEO") {
        // Reassigning .src to the same value it already has still makes
        // the browser treat it as a fresh media load. For <video> this
        // resets playback and can silently cancel autoplay eligibility
        // that was already granted at initial parse time (confirmed
        // contributing to the hero video never autoplaying on iOS
        // Safari) — so only touch it when the value has actually changed.
        if (el.getAttribute("src") !== val) el.src = val;
      } else {
        el.style.backgroundImage = "url('" + val + "')";
      }
    });
  }

  function applyTextStyles(content) {
    Object.entries(content.textStyles || {}).forEach(([key, style]) => {
      document.querySelectorAll('[data-key="' + key + '"], [data-key-html="' + key + '"]').forEach((el) => {
        if (style.fontSize) el.style.fontSize = style.fontSize;
        el.style.fontWeight = style.bold ? "700" : "";
        el.style.fontStyle = style.italic ? "italic" : "";
      });
    });
  }

  function renderServices(services) {
    const grid = document.getElementById("services-grid");
    if (!grid || !Array.isArray(services.cards)) return;
    grid.innerHTML = services.cards
      .map((card) => {
        const items = (card.items || [])
          .map(
            (i) =>
              "<li><span>" + escapeHtml(i.name) + "</span><span>" + escapeHtml(i.price) + "</span></li>"
          )
          .join("");
        const note = card.note ? '<p class="service-note">' + escapeHtml(card.note) + "</p>" : "";
        const waHref =
          "https://wa.me/923315017157?text=" + encodeURIComponent(card.whatsappText || "");
        return (
          '<article class="service-card has-photo">' +
          '<div class="service-photo"><img src="' +
          escapeHtml(card.image) +
          '" alt="' +
          escapeHtml(card.imageAlt || "") +
          '" loading="lazy" /></div>' +
          '<div class="service-body">' +
          "<h3>" +
          escapeHtml(card.title) +
          "</h3>" +
          '<ul class="service-list">' +
          items +
          "</ul>" +
          note +
          '<a href="' +
          waHref +
          '" class="btn btn-primary btn-sm wa-link" target="_blank" rel="noopener noreferrer">Book on WhatsApp</a>' +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov"];
  function isVideoSrc(src) {
    const lower = src.toLowerCase();
    return VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
  }

  /* Our Brides gallery: left track steps down through 3 uniform cards.
     Right track holds row A (cards 4, 5) and row B (cards 6-9) stacked
     as ONE continuous strip, repeated twice (A, B, A, B). Both rows are
     always fully visible at once — a step slides the strip up so
     whichever row is on top scrolls out while the other moves into its
     place, and the row that scrolled out reappears at the bottom (via
     the repeated copy). Six cards stay visible throughout; only their
     top/bottom order swaps. Only 7 real photos exist right now for 9
     card slots, so slots beyond that cycle back via modulo — harmless,
     and stops mattering once more photos/videos are added later. */
  function renderGalleryBento2(gallery) {
    const leftTrack = document.getElementById("bento2-left-track");
    const rightTrack = document.getElementById("bento2-right-track");
    if (!leftTrack || !rightTrack || !Array.isArray(gallery.images) || gallery.images.length === 0) return;

    const imgs = gallery.images;
    const pick = (i) => imgs[i % imgs.length];

    function cardHtml(img, cls) {
      const isVid = isVideoSrc(img.src);
      const inner = isVid
        ? '<video src="' + escapeHtml(img.src) + '" autoplay muted loop playsinline></video>'
        : '<img src="' + escapeHtml(img.src) + '" alt="' + escapeHtml(img.alt || "") + '" loading="lazy" />';
      return (
        '<button type="button" class="' +
        cls +
        '" data-full="' +
        escapeHtml(img.src) +
        '" data-media="' +
        (isVid ? "video" : "image") +
        '">' +
        inner +
        "</button>"
      );
    }

    function cellHtml(img, cellNumClass) {
      return '<div class="bento2-cell ' + cellNumClass + '">' + cardHtml(img, "bento2-cell-media") + "</div>";
    }

    // Left body: tripled so the existing downward-step animation always
    // has a same-content copy ahead/behind to land on.
    const leftCardsOnce = [pick(0), pick(1), pick(2)].map((img) => cardHtml(img, "bento2-card")).join("");
    leftTrack.innerHTML = leftCardsOnce + leftCardsOnce + leftCardsOnce;

    const rowA =
      '<div class="bento2-row-a">' + cellHtml(pick(3), "bento2-cell-4") + cellHtml(pick(4), "bento2-cell-5") + "</div>";
    const rowB =
      '<div class="bento2-row-b">' +
      '<div class="bento2-col-left">' +
      cellHtml(pick(5), "bento2-cell-6") +
      cellHtml(pick(7), "bento2-cell-8") +
      "</div>" +
      '<div class="bento2-col-right">' +
      cellHtml(pick(6), "bento2-cell-7") +
      cellHtml(pick(8), "bento2-cell-9") +
      "</div>" +
      "</div>";
    rightTrack.innerHTML = rowA + rowB + rowA + rowB;
  }

  function renderInstagram(instagram, instagramUrl) {
    const track = document.getElementById("insta-track");
    if (!track || !Array.isArray(instagram.images)) return;
    track.innerHTML = instagram.images
      .map(
        (src) =>
          '<a href="' +
          escapeHtml(instagramUrl) +
          '" target="_blank" rel="noopener noreferrer" class="insta-item">' +
          '<img src="' +
          escapeHtml(src) +
          '" alt="" />' +
          '<span class="insta-icon">' +
          INSTA_ICON +
          "</span></a>"
      )
      .join("");
  }

  function applyContactLinks(contact) {
    document.querySelectorAll('a[href*="wa.me/"]').forEach((a) => {
      a.href = a.href.replace(/wa\.me\/\d+/, "wa.me/" + contact.whatsapp);
    });
    document.querySelectorAll('a[href^="tel:"]').forEach((a) => {
      a.href = "tel:+" + contact.whatsapp;
    });
    document.querySelectorAll('a[href*="instagram.com"]').forEach((a) => {
      a.href = contact.instagramUrl;
    });
  }

  // On a slow/flaky connection this fetch can fail or time out outright,
  // which would otherwise leave services/gallery/instagram permanently
  // empty with no recovery. Retry a few times with backoff before giving up.
  function fetchContentWithRetry(attempt) {
    return fetch("content.json", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("bad status " + r.status);
        return r.json();
      })
      .catch((err) => {
        if (attempt >= 4) throw err;
        const delay = 600 * attempt; // 600ms, 1200ms, 1800ms
        return new Promise((resolve) => setTimeout(resolve, delay)).then(() =>
          fetchContentWithRetry(attempt + 1)
        );
      });
  }

  fetchContentWithRetry(1)
    .catch(() => null)
    .then((content) => {
      if (content) {
        window.SITE_CONTENT = content;
        applyText(content);
        renderServices(content.services || {});
        renderGalleryBento2(content.gallery || {});
        renderInstagram(content.instagram || {}, (content.contact || {}).instagramUrl || "#");
        applyContactLinks(content.contact || {});
        applyTextStyles(content);
      }
      document.dispatchEvent(new CustomEvent("content:ready"));
    });
})();
