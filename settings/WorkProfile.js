/* Рабочий профиль — дочерняя ветка сущности Профиль. */

function workProfileAction(action) {
  if (action !== "open") return;

  const app = document.getElementById("app");
  BookUI.renderScreen(
    app,
    "Рабочий профиль",
    `
      <div class="profile-branch-list">
        <button class="ui-folder" type="button" data-action="open-workplaces">
          <span class="ui-folder-content"><span class="ui-folder-title">Места работы</span></span>
          <span class="ui-folder-arrow" aria-hidden="true">›</span>
        </button>
      </div>
      ${BookUI.renderBackButton("Назад", "work-profile-back")}
    `
  );

  BookUI.bindActions(app, (actionName) => {
    if (actionName === "open-workplaces") window.Book.openChild("workplaces");
    if (actionName === "work-profile-back") window.Book.back();
  });
}

window.BookWorkProfile = Object.freeze({ action: workProfileAction });
