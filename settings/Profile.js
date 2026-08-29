/* Profile — владелец сущности «Профиль пользователя». */

const PROFILE_SECTIONS = Object.freeze([
  { id: "personal", label: "Личные данные", content: "" },
  { id: "professional", label: "Профессиональные данные", content: "" },
  { id: "work", label: "Рабочие данные", content: "" }
]);

function profileAction(action) {
  if (action !== "open") return;

  const app = document.getElementById("app");
  BookUI.renderScreen(
    app,
    "Профиль",
    `
      <div class="profile-content">
        ${BookUI.renderAccordion(PROFILE_SECTIONS)}
        <div class="profile-actions">
          ${BookUI.renderButton("Сохранить", "primary", "save-profile")}
          ${BookUI.renderBackButton("Назад", "profile-back")}
        </div>
      </div>
    `
  );

  app.querySelector('[data-action="profile-back"]')?.addEventListener("click", () => {
    window.Book.back();
  });
}

window.BookProfile = Object.freeze({
  action: profileAction
});
