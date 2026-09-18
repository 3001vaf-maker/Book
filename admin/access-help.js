function enhanceDrawer(drawer) {
  if (!drawer || drawer.dataset.accessHelpReady === 'true') return;
  drawer.dataset.accessHelpReady = 'true';
  const sections = [...drawer.querySelectorAll('.admin-section')];
  const statusSection = sections.find((section) => section.querySelector('[data-status]'));
  if (!statusSection) return;
  const help = document.createElement('p');
  help.className = 'admin-access-help';
  help.textContent = 'Статус «Активен» означает только, что рабочее пространство не отключено. Новые возможности применяются отдельно кнопкой «Сохранить доступы».';
  statusSection.querySelector('h4')?.insertAdjacentElement('afterend', help);
}

const observer = new MutationObserver(() => {
  document.querySelectorAll('.admin-drawer').forEach(enhanceDrawer);
});

observer.observe(document.body, { childList: true, subtree: true });
document.querySelectorAll('.admin-drawer').forEach(enhanceDrawer);
