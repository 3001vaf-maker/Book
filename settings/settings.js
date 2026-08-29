/* Настройки — владелец только своего первого уровня. */

const SETTINGS_FOLDERS = Object.freeze([
  { id: "profile", label: "Профиль" },
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
  BookUI.renderScreen(app, "Настройки", `<div id="settings-folders"></div>`);
  BookUI.renderFolderList(
    document.getElementById("settings-folders"),
    SETTINGS_FOLDERS,
    (folderId) => {
      if (folderId === "profile") window.Book.openChild("profile");
    }
  );
}

window.BookSettings = Object.freeze({
  action: settingsAction
});
