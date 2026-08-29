/* Profile — владелец сущности «Профиль пользователя». */

const PROFILE_PROFESSIONS = Object.freeze([
  "Парикмахер", "Колорист", "Барбер", "Визажист", "Стилист", "Мастер маникюра",
  "Мастер педикюра", "Бровист", "Лэшмейкер", "Косметолог", "Массажист",
  "Мастер по наращиванию волос", "Мастер перманентного макияжа", "Другое"
]);

const PROFILE_EXPERIENCE = Object.freeze([
  "Без опыта", "До 1 года", "1–3 года", "3–5 лет", "5–10 лет", "10–15 лет", "15–20 лет", "Более 20 лет"
]);

const PROFILE_STORAGE_KEY = "book_profile";

function readProfile() {
  try {
    return Object.assign({ photo: "", name: "", phone: "", about: "", profession: "", experience: "", aboutProfession: "", workplaces: [] }, JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || "{}"));
  } catch {
    return { photo: "", name: "", phone: "", about: "", profession: "", experience: "", aboutProfession: "", workplaces: [] };
  }
}

function saveProfile(profile) {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

function renderProfile() {
  const profile = readProfile();
  const personal = [
    BookUI.renderField({ label: "Имя", name: "name", value: profile.name, placeholder: "Ваше имя", required: true }),
    BookUI.renderField({ label: "Телефон", name: "phone", value: profile.phone, placeholder: "Номер телефона", type: "tel", required: true }),
    BookUI.renderTextarea({ label: "О себе", name: "about", value: profile.about, placeholder: "Коротко о себе" })
  ].join("");
  const professional = [
    BookUI.renderSelect({ label: "Профессия", name: "profession", value: profile.profession, options: PROFILE_PROFESSIONS, placeholder: "Выберите профессию" }),
    BookUI.renderSelect({ label: "Опыт работы", name: "experience", value: profile.experience, options: PROFILE_EXPERIENCE, placeholder: "Выберите стаж" }),
    BookUI.renderTextarea({ label: "О профессии", name: "aboutProfession", value: profile.aboutProfession, placeholder: "Расскажите о своей профессии" })
  ].join("");

  const app = document.getElementById("app");
  BookUI.renderScreen(app, "Профиль", `
    ${BookUI.renderAvatar()}
    <form data-profile-form>
      ${BookUI.renderAccordion([
        { id: "personal", label: "Личные данные", content: personal },
        { id: "professional", label: "Профессиональные данные", content: professional }
      ], BookUI.renderButton("Сохранить", "primary", "profile-save"))}
    </form>
    <div class="profile-work-entry">
      <button class="ui-folder" type="button" data-action="open-work-profile">
        <span class="ui-folder-content"><span class="ui-folder-title">Рабочий профиль</span></span>
        <span class="ui-folder-arrow" aria-hidden="true">›</span>
      </button>
    </div>
    ${BookUI.renderBackButton("Назад", "profile-back")}
  `);

  BookUI.bindAccordion(app);
  BookUI.bindActions(app, (action) => {
    if (action === "profile-save") {
      const form = app.querySelector("[data-profile-form]");
      if (!form?.reportValidity()) return;
      const data = Object.fromEntries(new FormData(form).entries());
      saveProfile(Object.assign({}, readProfile(), data));
      renderProfile();
      return;
    }
    if (action === "open-work-profile") {
      window.Book.openChild("work-profile");
      return;
    }
    if (action === "profile-back") window.Book.back();
  });
}

function profileAction(action) {
  if (action === "open") renderProfile();
}

window.BookProfile = Object.freeze({ action: profileAction });
