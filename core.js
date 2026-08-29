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

  const state = { route: START_ROUTE, child: null };
  const app = document.getElementById("app");
  const navItems = [...document.querySelectorAll(".nav-item")];

  function render(route) {
    if (route === "settings") {
      if (state.child === "profile") {
        window.BookProfile.action("open");
      } else {
        window.BookSettings.action("open");
      }
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
    state.child = null;
    render(route);
  }

  function openChild(child) {
    if (state.route !== "settings" || child !== "profile") return;
    state.child = child;
    render("settings");
  }

  function back() {
    if (state.route === "settings" && state.child === "profile") {
      state.child = null;
      render("settings");
      return;
    }

    navigate("settings");
  }

  navItems.forEach((item) => {
    item.addEventListener("click", () => navigate(item.dataset.route));
  });

  window.Book = Object.freeze({
    navigate,
    openChild,
    back,
    routes: ROUTES,
    get currentRoute() {
      return state.route;
    }
  });

  render(state.route);
})();
