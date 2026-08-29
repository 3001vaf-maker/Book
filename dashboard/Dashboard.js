/* Book Dashboard — владелец функциональных папок Dashboard. */
(() => {
  function open() {
    const app = document.getElementById("app");
    const clients = window.BookClients.count();
    BookUI.renderScreen(app, "Дашборд", `
      ${BookUI.renderFolderList([
        { id: "clients", label: "Клиенты", description: String(clients), variant: "feature" }
      ], (id) => {
        if (id === "clients") window.Book.openChild("clients");
      })}
    `);
  }
  window.BookDashboard = Object.freeze({ action: open });
})();
