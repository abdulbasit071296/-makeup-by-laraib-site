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
      if (el.tagName === "IMG" || el.tagName === "VIDEO") el.src = val;
      else el.style.backgroundImage = "url('" + val + "')";
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

  function renderGallery(gallery) {
    const track = document.getElementById("gallery-track");
    if (!track || !Array.isArray(gallery.images)) return;
    track.innerHTML = gallery.images
      .map(
        (img) =>
          '<li class="slide" data-full="' +
          escapeHtml(img.src) +
          '"><button type="button" class="slide-btn"><img src="' +
          escapeHtml(img.src) +
          '" alt="' +
          escapeHtml(img.alt || "") +
          '" loading="lazy" /></button></li>'
      )
      .join("");
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
        renderGallery(content.gallery || {});
        renderInstagram(content.instagram || {}, (content.contact || {}).instagramUrl || "#");
        applyContactLinks(content.contact || {});
        applyTextStyles(content);
      }
      document.dispatchEvent(new CustomEvent("content:ready"));
    });
})();
