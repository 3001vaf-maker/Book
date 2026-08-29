/* Book UI — единый источник визуальных компонентов. */
(() => {
  function renderFolderList(container, folders) {
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

  window.BookUI = Object.freeze({
    renderFolderList,
    renderScreen
  });
})();
