(function () {
  let content = null;
  let activeTab = "header";
  let dirty = false;

  const adminPanel = document.getElementById("admin-panel");
  const adminTabs = document.getElementById("admin-tabs");
  const saveStatus = document.getElementById("save-status");
  const logoutBtn = document.getElementById("logout-btn");

  function el(tag, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function getPath(obj, path) {
    return path.split(".").reduce((v, k) => (v == null ? v : v[k]), obj);
  }

  function setPath(obj, path, value) {
    const keys = path.split(".");
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
    cur[keys[keys.length - 1]] = value;
  }

  function markDirty() {
    dirty = true;
    saveStatus.textContent = "Unsaved changes";
    saveStatus.className = "save-status";
  }

  /* ---------- Auth ---------- */
  async function checkSession() {
    const res = await fetch("/api/session");
    const data = await res.json();
    if (data.authed) {
      await enterApp();
    } else {
      location.href = "admin.html";
    }
  }

  logoutBtn.addEventListener("click", async () => {
    if (dirty && !confirm("You have unsaved changes. Log out anyway?")) return;
    await fetch("/api/logout", { method: "POST" });
    location.href = "admin.html";
  });

  async function enterApp() {
    const res = await fetch("/api/content");
    content = await res.json();
    content.textStyles = content.textStyles || {};
    renderTabs();
    renderTab(activeTab);
  }

  /* ---------- Tabs ---------- */
  function renderTabs() {
    adminTabs.querySelectorAll(".admin-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === activeTab);
      btn.addEventListener("click", () => {
        if (dirty && !confirm("You have unsaved changes on this tab. Switch anyway?")) return;
        activeTab = btn.dataset.tab;
        renderTabs();
        renderTab(activeTab);
      });
    });
  }

  const TAB_RENDERERS = {
    header: renderHeaderTab,
    hero: renderHeroTab,
    services: renderServicesTab,
    testimonials: renderTestimonialsTab,
    instagram: renderInstagramTab,
    footer: renderFooterTab,
  };

  function renderTab(tab) {
    adminPanel.innerHTML = "";
    dirty = false;
    saveStatus.textContent = "";
    const section = el("div", "panel-section");
    TAB_RENDERERS[tab](section);

    const saveBar = el("div", "panel-save-bar");
    const saveBtn = el("button", "btn-primary");
    saveBtn.type = "button";
    saveBtn.textContent = "Save Changes";
    saveBtn.style.width = "auto";
    saveBtn.style.padding = "10px 22px";
    saveBtn.addEventListener("click", saveContent);
    saveBar.appendChild(saveBtn);
    section.appendChild(saveBar);

    adminPanel.appendChild(section);
  }

  function pruneEmptyStyles() {
    Object.keys(content.textStyles).forEach((key) => {
      const s = content.textStyles[key];
      if (!s.fontSize && !s.bold && !s.italic) delete content.textStyles[key];
    });
  }

  async function saveContent() {
    pruneEmptyStyles();
    saveStatus.textContent = "Saving...";
    saveStatus.className = "save-status";
    try {
      const res = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(content),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Save failed");
      dirty = false;
      saveStatus.textContent = "Saved";
      saveStatus.className = "save-status ok";
    } catch (err) {
      saveStatus.textContent = "Error: " + err.message;
      saveStatus.className = "save-status err";
    }
  }

  /* ---------- Field builders ---------- */
  function textField(container, opts) {
    const group = el("div", "field-group");
    const label = el("label", "field-label");
    label.textContent = opts.label;
    group.appendChild(label);

    const input = opts.multiline ? el("textarea") : el("input");
    if (!opts.multiline) input.type = "text";
    input.value = getPath(content, opts.key) || "";
    input.addEventListener("input", () => {
      setPath(content, opts.key, input.value);
      markDirty();
    });
    group.appendChild(input);

    if (opts.hint) {
      const hint = el("p", "field-label");
      hint.style.marginTop = "6px";
      hint.style.marginBottom = "0";
      hint.style.fontWeight = "400";
      hint.textContent = opts.hint;
      group.appendChild(hint);
    }

    if (opts.styleable) {
      content.textStyles[opts.key] = content.textStyles[opts.key] || {};
      const style = content.textStyles[opts.key];
      const styleRow = el("div", "style-row");

      const sizeLabel = el("label");
      sizeLabel.append("Font size (px)");
      const sizeInput = el("input");
      sizeInput.type = "number";
      sizeInput.min = "10";
      sizeInput.max = "96";
      sizeInput.placeholder = "Default";
      sizeInput.value = style.fontSize ? parseInt(style.fontSize, 10) : "";
      sizeInput.addEventListener("input", () => {
        style.fontSize = sizeInput.value ? sizeInput.value + "px" : undefined;
        markDirty();
      });
      sizeLabel.appendChild(sizeInput);
      styleRow.appendChild(sizeLabel);

      const boldLabel = el("label");
      const boldInput = el("input");
      boldInput.type = "checkbox";
      boldInput.checked = !!style.bold;
      boldInput.addEventListener("change", () => {
        style.bold = boldInput.checked;
        markDirty();
      });
      boldLabel.appendChild(boldInput);
      boldLabel.append("Bold");
      styleRow.appendChild(boldLabel);

      const italicLabel = el("label");
      const italicInput = el("input");
      italicInput.type = "checkbox";
      italicInput.checked = !!style.italic;
      italicInput.addEventListener("change", () => {
        style.italic = italicInput.checked;
        markDirty();
      });
      italicLabel.appendChild(italicInput);
      italicLabel.append("Italic");
      styleRow.appendChild(italicLabel);

      group.appendChild(styleRow);
    }

    container.appendChild(group);
  }

  function uploadFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const res = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: file.name, dataBase64: reader.result }),
          });
          const data = await res.json();
          if (!res.ok || !data.ok) throw new Error(data.error || "Upload failed");
          resolve(data.path);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error("Could not read file"));
      reader.readAsDataURL(file);
    });
  }

  function imageField(container, opts) {
    const group = el("div", "field-group");
    const label = el("label", "field-label");
    label.textContent = opts.label;
    group.appendChild(label);

    const row = el("div", "image-field");
    const preview = el(opts.isVideo ? "video" : "img", "image-preview" + (opts.isVideo ? " is-video" : ""));
    if (opts.isVideo) {
      preview.muted = true;
      preview.loop = true;
      preview.autoplay = true;
      preview.playsInline = true;
    }
    preview.src = getPath(content, opts.key) || "";
    row.appendChild(preview);

    const actions = el("div", "image-actions");
    const fileInput = el("input");
    fileInput.type = "file";
    fileInput.accept = opts.isVideo ? "video/*" : "image/*";
    fileInput.hidden = true;

    const uploadBtn = el("button", "btn-sm");
    uploadBtn.type = "button";
    uploadBtn.textContent = "Replace";
    uploadBtn.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) return;
      uploadBtn.disabled = true;
      uploadBtn.textContent = "Uploading...";
      try {
        const path = await uploadFile(file);
        setPath(content, opts.key, path);
        preview.src = path;
        markDirty();
      } catch (err) {
        alert("Upload failed: " + err.message);
      }
      uploadBtn.disabled = false;
      uploadBtn.textContent = "Replace";
    });

    actions.appendChild(uploadBtn);
    actions.appendChild(fileInput);

    if (opts.removable) {
      const removeBtn = el("button", "btn-sm danger");
      removeBtn.type = "button";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => {
        if (opts.onRemove) opts.onRemove();
        markDirty();
      });
      actions.appendChild(removeBtn);
    }

    row.appendChild(actions);
    group.appendChild(row);
    container.appendChild(group);
  }

  function sectionHead(container, prefix, title) {
    textField(container, { key: prefix + ".eyebrow", label: "Eyebrow (small label above heading)", styleable: true });
    textField(container, { key: prefix + ".heading", label: "Heading", styleable: true });
    textField(container, { key: prefix + ".lead", label: "Description text", multiline: true, styleable: true });
  }

  /* ---------- Tabs ---------- */
  function renderHeaderTab(container) {
    const h = el("h2");
    h.textContent = "Header & Contact";
    container.appendChild(h);
    const hint = el("p", "panel-hint");
    hint.textContent = "Logo, navigation labels, and the contact details used across the site (WhatsApp buttons, Instagram links, phone).";
    container.appendChild(hint);

    imageField(container, { key: "header.logo", label: "Logo (shown in header and footer)" });
    textField(container, { key: "header.brandName", label: "Brand name", styleable: true, hint: "Wrap a word in <em>...</em> to italicize it, e.g. Makeup by <em>Laraib</em>." });
    textField(container, { key: "header.navHome", label: "Nav label — Home", styleable: true });
    textField(container, { key: "header.navServices", label: "Nav label — Services", styleable: true });
    textField(container, { key: "header.navGallery", label: "Nav label — Our Brides", styleable: true });
    textField(container, { key: "header.navTestimonials", label: "Nav label — Testimonials", styleable: true });
    textField(container, { key: "header.navContact", label: "Nav label — Contact", styleable: true });
    textField(container, { key: "header.navCta", label: "Header button text (desktop)", styleable: true });
    textField(container, { key: "common.bookWhatsAppText", label: '"Book on WhatsApp" button text (used in several places)', styleable: true });
    textField(container, { key: "contact.whatsapp", label: "WhatsApp number (digits with country code, e.g. 923315017157)" });
    textField(container, { key: "contact.phoneDisplay", label: "Phone number as shown on the site" });
    textField(container, { key: "contact.instagramUrl", label: "Instagram profile URL" });
  }

  function renderHeroTab(container) {
    const h = el("h2");
    h.textContent = "Hero";
    container.appendChild(h);
    const hint = el("p", "panel-hint");
    hint.textContent = "The first thing visitors see — the video, background image, and headline text.";
    container.appendChild(hint);

    imageField(container, { key: "hero.bgImage", label: "Background image (shown behind/before the video loads)" });
    imageField(container, { key: "hero.video", label: "Hero video", isVideo: true });
    textField(container, { key: "hero.eyebrow", label: "Eyebrow text", styleable: true });
    textField(container, { key: "hero.title", label: "Title", styleable: true, hint: "Wrap a word in <em>...</em> to italicize it." });
    textField(container, { key: "hero.subtitle", label: "Subtitle", multiline: true, styleable: true });
  }

  function renderServicesTab(container) {
    const h = el("h2");
    h.textContent = "Services";
    container.appendChild(h);
    const hint = el("p", "panel-hint");
    hint.textContent = "The price-list cards. Add or remove cards, and add or remove price rows within each card.";
    container.appendChild(hint);

    sectionHead(container, "services", "Services");

    const list = el("div");
    container.appendChild(list);

    function renderCards() {
      list.innerHTML = "";
      content.services.cards.forEach((card, i) => {
        const item = el("div", "repeat-item");
        const head = el("div", "repeat-item-head");
        const strong = el("strong");
        strong.textContent = "Card " + (i + 1);
        head.appendChild(strong);
        const removeBtn = el("button", "btn-sm danger");
        removeBtn.type = "button";
        removeBtn.textContent = "Remove card";
        removeBtn.addEventListener("click", () => {
          if (!confirm("Remove this service card?")) return;
          content.services.cards.splice(i, 1);
          markDirty();
          renderCards();
        });
        head.appendChild(removeBtn);
        item.appendChild(head);

        imageField(item, { key: `services.cards.${i}.image`, label: "Photo" });

        const titleField = el("div", "mini-field");
        const titleLabel = el("label");
        titleLabel.textContent = "Card title";
        titleField.appendChild(titleLabel);
        const titleInput = el("input");
        titleInput.type = "text";
        titleInput.value = card.title;
        titleInput.addEventListener("input", () => {
          card.title = titleInput.value;
          markDirty();
        });
        titleField.appendChild(titleInput);
        item.appendChild(titleField);

        const pricesLabel = el("label", "field-label");
        pricesLabel.textContent = "Price list";
        pricesLabel.style.marginTop = "10px";
        item.appendChild(pricesLabel);

        const pricesWrap = el("div");
        item.appendChild(pricesWrap);

        function renderPrices() {
          pricesWrap.innerHTML = "";
          card.items.forEach((row, ri) => {
            const priceRow = el("div", "price-row");
            const nameInput = el("input");
            nameInput.type = "text";
            nameInput.value = row.name;
            nameInput.placeholder = "Service name";
            nameInput.addEventListener("input", () => {
              row.name = nameInput.value;
              markDirty();
            });
            const priceInput = el("input");
            priceInput.type = "text";
            priceInput.value = row.price;
            priceInput.placeholder = "Rs. 0";
            priceInput.addEventListener("input", () => {
              row.price = priceInput.value;
              markDirty();
            });
            const removeRow = el("button", "btn-sm danger");
            removeRow.type = "button";
            removeRow.textContent = "×";
            removeRow.addEventListener("click", () => {
              card.items.splice(ri, 1);
              markDirty();
              renderPrices();
            });
            priceRow.appendChild(nameInput);
            priceRow.appendChild(priceInput);
            priceRow.appendChild(removeRow);
            pricesWrap.appendChild(priceRow);
          });
        }
        renderPrices();

        const addPriceBtn = el("button", "add-btn");
        addPriceBtn.type = "button";
        addPriceBtn.textContent = "+ Add price row";
        addPriceBtn.addEventListener("click", () => {
          card.items.push({ name: "", price: "" });
          markDirty();
          renderPrices();
        });
        item.appendChild(addPriceBtn);

        const noteField = el("div", "mini-field");
        noteField.style.marginTop = "10px";
        const noteLabel = el("label");
        noteLabel.textContent = "Note (optional, small text under the price list)";
        noteField.appendChild(noteLabel);
        const noteInput = el("input");
        noteInput.type = "text";
        noteInput.value = card.note || "";
        noteInput.addEventListener("input", () => {
          card.note = noteInput.value;
          markDirty();
        });
        noteField.appendChild(noteInput);
        item.appendChild(noteField);

        const waField = el("div", "mini-field");
        const waLabel = el("label");
        waLabel.textContent = "WhatsApp message when 'Book on WhatsApp' is tapped on this card";
        waField.appendChild(waLabel);
        const waInput = el("input");
        waInput.type = "text";
        waInput.value = card.whatsappText || "";
        waInput.addEventListener("input", () => {
          card.whatsappText = waInput.value;
          markDirty();
        });
        waField.appendChild(waInput);
        item.appendChild(waField);

        list.appendChild(item);
      });
    }
    renderCards();

    const addCardBtn = el("button", "add-btn");
    addCardBtn.type = "button";
    addCardBtn.textContent = "+ Add service card";
    addCardBtn.addEventListener("click", () => {
      content.services.cards.push({
        image: "",
        imageAlt: "",
        title: "New Service",
        items: [{ name: "", price: "" }],
        note: "",
        whatsappText: "",
      });
      markDirty();
      renderCards();
    });
    container.appendChild(addCardBtn);
  }

  function renderTestimonialsTab(container) {
    const h = el("h2");
    h.textContent = "Testimonials";
    container.appendChild(h);
    const hint = el("p", "panel-hint");
    hint.textContent = "Client quotes that rotate on the site. Add or remove testimonials — three show at a time.";
    container.appendChild(hint);

    sectionHead(container, "testimonials", "What Our Brides Say");

    const list = el("div");
    container.appendChild(list);

    function renderItems() {
      list.innerHTML = "";
      content.testimonials.items.forEach((t, i) => {
        const item = el("div", "repeat-item");
        const head = el("div", "repeat-item-head");
        const strong = el("strong");
        strong.textContent = "Testimonial " + (i + 1);
        head.appendChild(strong);
        const removeBtn = el("button", "btn-sm danger");
        removeBtn.type = "button";
        removeBtn.textContent = "Remove";
        removeBtn.addEventListener("click", () => {
          if (!confirm("Remove this testimonial?")) return;
          content.testimonials.items.splice(i, 1);
          markDirty();
          renderItems();
        });
        head.appendChild(removeBtn);
        item.appendChild(head);

        [
          ["quote", "Quote"],
          ["name", "Name"],
          ["role", "Role (e.g. Bride, Client)"],
          ["initials", "Initials (shown in the avatar circle)"],
        ].forEach(([field, label]) => {
          const f = el("div", "mini-field");
          const l = el("label");
          l.textContent = label;
          f.appendChild(l);
          const input = el("input");
          input.type = "text";
          input.value = t[field] || "";
          input.addEventListener("input", () => {
            t[field] = input.value;
            markDirty();
          });
          f.appendChild(input);
          item.appendChild(f);
        });

        list.appendChild(item);
      });
    }
    renderItems();

    const addBtn = el("button", "add-btn");
    addBtn.type = "button";
    addBtn.textContent = "+ Add testimonial";
    addBtn.addEventListener("click", () => {
      content.testimonials.items.push({ initials: "", quote: "", name: "", role: "" });
      markDirty();
      renderItems();
    });
    container.appendChild(addBtn);
  }

  function renderInstagramTab(container) {
    const h = el("h2");
    h.textContent = "Instagram";
    container.appendChild(h);
    const hint = el("p", "panel-hint");
    hint.textContent = "Photos shown in the scrolling Instagram strip. Add or remove photos.";
    container.appendChild(hint);

    sectionHead(container, "instagram", "@makeup_by_laraib");

    const list = el("div");
    container.appendChild(list);

    function renderImages() {
      list.innerHTML = "";
      content.instagram.images.forEach((src, i) => {
        const item = el("div", "repeat-item");
        const head = el("div", "repeat-item-head");
        const strong = el("strong");
        strong.textContent = "Photo " + (i + 1);
        head.appendChild(strong);
        item.appendChild(head);

        imageField(item, {
          key: `instagram.images.${i}`,
          label: "Photo",
          removable: true,
          onRemove: () => {
            content.instagram.images.splice(i, 1);
            renderImages();
          },
        });

        list.appendChild(item);
      });
    }
    renderImages();

    const addBtn = el("button", "add-btn");
    addBtn.type = "button";
    addBtn.textContent = "+ Add photo";
    addBtn.addEventListener("click", () => {
      content.instagram.images.push("");
      markDirty();
      renderImages();
    });
    container.appendChild(addBtn);
  }

  function renderFooterTab(container) {
    const h = el("h2");
    h.textContent = "Footer";
    container.appendChild(h);
    const hint = el("p", "panel-hint");
    hint.textContent = "The bottom of the site — tagline, address, and hours.";
    container.appendChild(hint);

    textField(container, { key: "footer.tagline", label: "Tagline (under the logo)", styleable: true });
    textField(container, { key: "footer.address", label: "Address", styleable: true });
    textField(container, { key: "footer.hours", label: "Hours", styleable: true });
    textField(container, { key: "footer.appointmentNote", label: "Appointment note", styleable: true });
  }

  checkSession();
})();
