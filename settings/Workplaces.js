/* Места работы — функциональная ветка Рабочего профиля. */

const WORK_CURRENCIES = Object.freeze(["₽", "€", "$", "₸", "BYN", "Другой"]);

function workplacesRead() {
  try {
    const profile = JSON.parse(localStorage.getItem("book_profile") || "{}");
    return Array.isArray(profile.workplaces) ? profile.workplaces : [];
  } catch {
    return [];
  }
}

function workplacesSave(workplaces) {
  try {
    const profile = JSON.parse(localStorage.getItem("book_profile") || "{}");
    profile.workplaces = workplaces;
    localStorage.setItem("book_profile", JSON.stringify(profile));
  } catch {
    /* Storage errors are intentionally not converted into new business logic. */
  }
}

function workplaceCard(workplace, index) {
  return `
    <article class="ui-card">
      <h2 class="ui-card-title">${BookUI.escapeHtml(workplace.name || `Рабочее место ${index + 1}`)}</h2>
      ${workplace.city ? `<p class="ui-card-text">${BookUI.escapeHtml(workplace.city)}</p>` : ""}
      ${workplace.address ? `<p class="ui-card-text">${BookUI.escapeHtml(workplace.address)}</p>` : ""}
      <button class="ui-button ui-button-secondary" type="button" data-action="edit-workplace" data-index="${index}">Открыть</button>
    </article>
  `;
}

function workplaceForm(workplace = {}) {
  return `
    <form data-workplace-form>
      ${BookUI.renderField({ label: "Название", name: "name", value: workplace.name, placeholder: "Название места работы" })}
      ${BookUI.renderField({ label: "Город", name: "city", value: workplace.city, placeholder: "Город" })}
      ${BookUI.renderField({ label: "Адрес", name: "address", value: workplace.address, placeholder: "Адрес" })}
      ${BookUI.renderField({ label: "Рабочий телефон", name: "phone", value: workplace.phone, placeholder: "Телефон", type: "tel" })}
      ${BookUI.renderSelect({ label: "Валюта", name: "currency", value: workplace.currency, options: WORK_CURRENCIES, placeholder: "Выберите валюту" })}
      ${BookUI.renderField({ label: "График работы", name: "schedule", value: workplace.schedule, placeholder: "Например, Пн–Пт 10:00–20:00" })}
      ${BookUI.renderField({ label: "Рабочие ссылки", name: "links", value: workplace.links, placeholder: "Ссылка на сайт или соцсети" })}
      ${BookUI.renderTextarea({ label: "О рабочем пространстве", name: "about", value: workplace.about, placeholder: "Расскажите о рабочем пространстве" })}
    </form>
  `;
}

function openWorkplaceModal(index = null) {
  const workplaces = workplacesRead();
  const workplace = index === null ? {} : (workplaces[index] || {});
  const title = index === null ? "Новое рабочее место" : "Рабочее место";

  BookUI.mountModal(BookUI.renderModal({
    title,
    content: workplaceForm(workplace),
    actions: `${BookUI.renderButton("Сохранить", "primary", "save-workplace-modal")}${BookUI.renderButton("Отмена", "secondary", "close-workplace-modal")}`
  }));

  const modal = document.querySelector("[data-modal]");
  modal.dataset.index = index === null ? "" : String(index);
  BookUI.bindActions(modal, (action) => {
    if (action === "close-workplace-modal") {
      BookUI.closeModal();
      return;
    }
    if (action !== "save-workplace-modal") return;
    const form = modal.querySelector("[data-workplace-form]");
    if (!form) return;
    const data = Object.fromEntries(new FormData(form).entries());
    const next = workplacesRead();
    const target = modal.dataset.index === "" ? null : Number(modal.dataset.index);
    if (target === null) next.push(data);
    else if (next[target]) next[target] = Object.assign({}, next[target], data);
    else next.push(data);
    workplacesSave(next);
    BookUI.closeModal();
    renderWorkplaces();
  });
}

function renderWorkplaces() {
  const workplaces = workplacesRead();
  const list = workplaces.map(workplaceCard).join("");

  const app = document.getElementById("app");
  BookUI.renderScreen(
    app,
    "Места работы",
    `
      <div class="ui-card-list">${list || `<div class="ui-empty-state">Нет добавленных рабочих мест</div>`}</div>
      <button class="ui-folder" type="button" data-action="add-workplace">
        <span class="ui-folder-content"><span class="ui-folder-title">Добавить рабочее место</span></span>
        <span class="ui-folder-arrow" aria-hidden="true">›</span>
      </button>
      ${BookUI.renderBackButton("Назад", "workplaces-back")}
    `
  );

  BookUI.bindActions(app, (action, event, element) => {
    if (action === "add-workplace") openWorkplaceModal();
    if (action === "edit-workplace") openWorkplaceModal(Number(element.dataset.index));
    if (action === "workplaces-back") window.Book.back();
  });
}

function workplacesAction(action) {
  if (action === "open") renderWorkplaces();
}

window.BookWorkplaces = Object.freeze({ action: workplacesAction });
