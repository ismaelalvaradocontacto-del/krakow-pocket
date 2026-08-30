(() => {
  const pages = Array.isArray(window.POCKET_PAGES) ? [...window.POCKET_PAGES] : [];
  const list = document.getElementById("pageList");
  const count = document.getElementById("pageCount");
  const search = document.getElementById("pageSearch");
  const filters = document.getElementById("categoryFilters");
  const empty = document.getElementById("emptyState");

  const clean = value => String(value || "").trim();
  const normalize = value => clean(value).toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const safeDate = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date(0) : date;
  };

  pages.sort((a, b) => safeDate(b.createdAt) - safeDate(a.createdAt));

  const categories = [...new Set(pages.map(page => clean(page.category)).filter(Boolean))];
  let activeCategory = "Todo";

  const formatDate = value => {
    const date = safeDate(value);
    if (!date.getTime()) return "";
    return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" }).format(date);
  };

  const createFilter = label => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter-btn" + (label === activeCategory ? " active" : "");
    button.textContent = label;
    button.setAttribute("aria-pressed", label === activeCategory ? "true" : "false");
    button.addEventListener("click", () => {
      activeCategory = label;
      [...filters.querySelectorAll(".filter-btn")].forEach(item => {
        const selected = item.textContent === label;
        item.classList.toggle("active", selected);
        item.setAttribute("aria-pressed", selected ? "true" : "false");
      });
      render();
    });
    return button;
  };

  filters.appendChild(createFilter("Todo"));
  categories.forEach(category => filters.appendChild(createFilter(category)));
  if (categories.length < 2) filters.hidden = true;

  const render = () => {
    const query = normalize(search.value);
    const visible = pages.filter(page => {
      const categoryMatches = activeCategory === "Todo" || page.category === activeCategory;
      const haystack = normalize([page.title, page.description, page.category].join(" "));
      return categoryMatches && (!query || haystack.includes(query));
    });

    list.replaceChildren();
    visible.forEach((page, index) => {
      const card = document.createElement("a");
      card.className = "page-card";
      card.href = page.href;
      card.dataset.pageId = page.id;

      const icon = document.createElement("div");
      icon.className = "page-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = clean(page.icon) || "•";

      const copy = document.createElement("div");
      copy.className = "page-copy";

      const meta = document.createElement("div");
      meta.className = "page-meta";
      const category = document.createElement("span");
      category.className = "category";
      category.textContent = clean(page.category) || "Página";
      meta.appendChild(category);
      if (index === 0 && !query && activeCategory === "Todo") {
        const newest = document.createElement("span");
        newest.className = "newest";
        newest.textContent = "Última";
        meta.appendChild(newest);
      }

      const title = document.createElement("h3");
      title.className = "page-title";
      title.textContent = clean(page.title) || "Sin título";

      const description = document.createElement("p");
      description.className = "page-description";
      description.textContent = clean(page.description);

      const date = document.createElement("div");
      date.className = "page-date";
      date.textContent = formatDate(page.createdAt);

      copy.append(meta, title);
      if (description.textContent) copy.appendChild(description);
      if (date.textContent) copy.appendChild(date);

      const arrow = document.createElement("div");
      arrow.className = "page-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "›";

      card.append(icon, copy, arrow);
      list.appendChild(card);
    });

    count.textContent = `${visible.length} ${visible.length === 1 ? "página" : "páginas"}`;
    empty.hidden = visible.length !== 0;
  };

  search.addEventListener("input", render);
  render();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}), { once: true });
  }
})();
