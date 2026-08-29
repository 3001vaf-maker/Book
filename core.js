/* Book Core — единый центр навигации и команд приложения. */
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

  function render(route) {
    if (route === "settings") {
      window.BookSettings.action("open");
    } else {
      BookUI.renderScreen(app, ROUTES[route]);
    }

    navItems.forEach((item) => {
      const active = item.dataset.route === route;
      item.classList.toggle("is-active", active);
      if (active) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
  }

  function navigate(route) {
    if (!Object.hasOwn(ROUTES, route)) return;
    state.route = route;
    render(route);
  }

  navItems.forEach((item) => {
    item.addEventListener("click", () => navigate(item.dataset.route));
  });

  window.Book = Object.freeze({
    navigate,
    routes: ROUTES,
    get currentRoute() {
      return state.route;
    }
  });

  render(state.route);
})();
