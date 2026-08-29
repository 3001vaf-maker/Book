/* Book Core — the only navigation/render source for the application shell. */
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

  function render() {
    const title = ROUTES[state.route];
    app.innerHTML = `<section class="screen"><h1>${title}</h1></section>`;

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
