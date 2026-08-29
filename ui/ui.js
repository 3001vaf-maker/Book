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

  function renderField({ label, name, value = "", placeholder = "", type = "text", required = false }) {
    return `
      <label class="ui-field">
        <span class="ui-field-label">${label}${required ? " *" : ""}</span>
        <input class="ui-input" name="${name}" type="${type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"${required ? " required" : ""}>
      </label>
    `;
  }

  function renderTextarea({ label, name, value = "", placeholder = "" }) {
    return `
      <label class="ui-field">
        <span class="ui-field-label">${label}</span>
        <textarea class="ui-textarea" name="${name}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea>
      </label>
    `;
  }

  function renderSelect({ label, name, value = "", placeholder = "Выберите значение", options = [] }) {
    return `
      <label class="ui-field">
        <span class="ui-field-label">${label}</span>
        <select class="ui-select" name="${name}">
          <option value="">${escapeHtml(placeholder)}</option>
          ${options.map((option) => `<option value="${escapeHtml(option)}"${option === value ? " selected" : ""}>${escapeHtml(option)}</option>`).join("")}
        </select>
      </label>
    `;
  }

  function renderAccordion(sections, footer = "") {
    return `
      <div class="ui-accordion-block">
        <div class="ui-accordion">
          ${sections.map(({ id, label, content = "" }) => `
            <section class="ui-accordion-item">
              <button class="ui-accordion-trigger" type="button" aria-expanded="false" aria-controls="accordion-${id}" data-accordion-target="${id}">
                <span class="ui-accordion-title">${label}</span>
                <span class="ui-accordion-icon" aria-hidden="true">⌄</span>
              </button>
              <div class="ui-accordion-panel" id="accordion-${id}" hidden>${content}</div>
            </section>
          `).join("")}
        </div>
        ${footer ? `<div class="ui-accordion-footer">${footer}</div>` : ""}
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

  function renderAvatar(label = "Фото профиля") {
    return `
      <div class="ui-avatar-block">
        <div class="ui-avatar" aria-label="${escapeHtml(label)}">Фото</div>
      </div>
    `;
  }

  function renderModal({ title, content, actions = "" }) {
    return `
      <div class="ui-modal-layer" data-modal role="presentation">
        <div class="ui-modal" role="dialog" aria-modal="true" aria-labelledby="ui-modal-title">
          <div class="ui-modal-header">
            <h2 id="ui-modal-title">${title}</h2>
          </div>
          <div class="ui-modal-content">${content}</div>
          ${actions ? `<div class="ui-modal-actions">${actions}</div>` : ""}
        </div>
      </div>
    `;
  }

  function mountModal(html) {
    const layer = document.createElement("div");
    layer.innerHTML = html.trim();
    document.body.appendChild(layer.firstElementChild);
  }

  function closeModal() {
    document.querySelector("[data-modal]")?.remove();
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

  function bindActions(container, handler) {
    container.querySelectorAll("[data-action]").forEach((element) => {
      element.addEventListener("click", (event) => handler(element.dataset.action, event, element));
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");
  }

  window.BookUI = Object.freeze({
    renderFolderList,
    renderScreen,
    renderField,
    renderTextarea,
    renderSelect,
    renderAccordion,
    renderButton,
    renderBackButton,
    renderAvatar,
    renderModal,
    mountModal,
    closeModal,
    bindAccordion,
    bindActions,
    escapeHtml
  });
})();
