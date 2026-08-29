/* Book UI — единый источник визуальных компонентов. */
(() => {
  function renderFolderList(container, folders, onSelect) {
    container.innerHTML = `
      <div class="ui-folder-list">
        ${folders.map(({ id, label, description = "" }) => `
          <button class="ui-folder" type="button" data-folder-id="${id}">
            <span class="ui-folder-content">
              <span class="ui-folder-title">${label}</span>
              ${description ? `<span class="ui-folder-description">${description}</span>` : ""}
            </span>
            <span class="ui-folder-arrow" aria-hidden="true">›</span>
          </button>
        `).join("")}
      </div>
    `;

    if (typeof onSelect === "function") {
      container.querySelectorAll("[data-folder-id]").forEach((item) => {
        item.addEventListener("click", () => onSelect(item.dataset.folderId));
      });
    }
  }

  function renderScreen(app, title, content = "") {
    app.innerHTML = `
      <section class="screen">
        <header class="page-header">
          <h1>${title}</h1>
        </header>
        ${content}
      </section>
    `;
  }

  function renderAccordion(sections) {
    return `
      <div class="ui-accordion">
        ${sections.map(({ id, label, content = "" }) => `
          <section class="ui-accordion-item">
            <button
              class="ui-accordion-trigger"
              type="button"
              aria-expanded="false"
              aria-controls="accordion-${id}"
              data-accordion-target="${id}"
            >
              <span class="ui-accordion-title">${label}</span>
              <span class="ui-accordion-icon" aria-hidden="true">⌄</span>
            </button>
            <div class="ui-accordion-panel" id="accordion-${id}" hidden>
              ${content}
            </div>
          </section>
        `).join("")}
      </div>
    `;
  }

  function renderButton(label, variant = "primary", action = "") {
    const actionAttribute = action ? ` data-action="${action}"` : "";
    return `<button class="ui-button ui-button-${variant}" type="button"${actionAttribute}>${label}</button>`;
  }

  function renderBackButton(label = "Назад", action = "") {
    const actionAttribute = action ? ` data-action="${action}"` : "";
    return `<button class="ui-back" type="button"${actionAttribute}>${label}</button>`;
  }

  function bindAccordion(container) {
    container.querySelectorAll("[data-accordion-target]").forEach((trigger) => {
      trigger.addEventListener("click", () => {
        const targetId = trigger.dataset.accordionTarget;
        const panel = container.querySelector(`#accordion-${targetId}`);
        if (!panel) return;

        const expanded = trigger.getAttribute("aria-expanded") === "true";
        trigger.setAttribute("aria-expanded", String(!expanded));
        panel.hidden = expanded;
      });
    });
  }

  const originalRenderScreen = renderScreen;

  function renderScreenWithAccordion(app, title, content = "") {
    originalRenderScreen(app, title, content);
    bindAccordion(app);
  }

  window.BookUI = Object.freeze({
    renderFolderList,
    renderScreen: renderScreenWithAccordion,
    renderAccordion,
    renderButton,
    renderBackButton
  });
})();
