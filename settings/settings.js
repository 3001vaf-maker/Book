/* Настройки — владелец только своего первого уровня. */

const SETTINGS_FOLDERS = Object.freeze([
  { id: "profile", label: "Профиль пользователя" },
  { id: "service", label: "Сервис" },
  { id: "work-materials", label: "Рабочие материалы" },
  { id: "documents", label: "Документы" },
  { id: "loyalty", label: "Лояльность" },
  { id: "tags", label: "Ярлыки" },
  { id: "wallets", label: "Кошельки" }
]);

function settingsAction(action) {
  if (action !== "open") return;

  const app = document.getElementById("app");
  app.innerHTML = `
    <section class="screen screen--settings">
      <h1>Настройки</h1>
      <div class="folder-list">
        ${SETTINGS_FOLDERS.map(({ id, label }) => `
          <button class="folder" type="button" data-settings-folder="${id}">
            <span>${label}</span>
            <span aria-hidden="true">›</span>
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

window.BookSettings = Object.freeze({
  action: settingsAction
});
