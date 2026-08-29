/*
 * Book Core — единый центр управления приложением.
 * Модули получают доступ к Core, но не становятся его владельцами.
 */
(() => {
  const START_ROUTE = "journal";

  const ROUTES = Object.freeze({
    journal: "Журнал",
    schedule: "График",
    dashboard: "Главная",
    chat: "Чат",
    settings: "Настройки"
  });

  const state = { route: START_ROUTE };
  const app = document.getElementById("app");
  const navItems = [...document.querySelectorAll(".nav-item")];

  function renderSettings() {
    const folders = window.BookSettings?.folders ?? [];
    const items = folders
      .map(({ id, label }) => `<button class="folder" type="button" data-settings-folder="${id}">${label}</button>`)
      .join("");

    app.innerHTML = `<section class="screen"><h1>Настройки</h1><div class="folder-list">${items}</div></section>`;
  }

  function render() {
    if (state.route === "settings") {
      renderSettings();
    } else {
      const title = ROUTES[state.route];
      app.innerHTML = `<section class="screen"><h1>${title}</h1></section>`;
    }

    navItems.forEach((item) => {
      const active = item.dataset.route === state.route;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-current", active ? "page" : "false");
    });
  }

  function navigate(route) {
    if (!Object.hasOwn(ROUTES, route)) return;
    state.route = route;
    render();
  }

  navItems.forEach((item) => {
    item.addEventListener("click", () => navigate(item.dataset.route));
  });

  window.Book = Object.freeze({
    navigate,
    routes: ROUTES,
    get currentRoute() { return state.route; }
  });

  render();
})();
