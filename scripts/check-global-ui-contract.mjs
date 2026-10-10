import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const alphabet = read('UI_ALPHABET.md');
const shell = read('ui/v2/shell.js');
const header = read('ui/v2/header.js');
const menuHeader = read('ui/v2/header-state.js');
const v2Index = read('ui/v2/index.js');
const zLayout = read('ui/v2/z-layout.js');
const zStack = read('ui/v2/z-stack.js');
const zAffordance = read('ui/v2/z-affordance.js');
const modalPortal = read('ui/v2/modal-portal.js');
const modals = read('ui/modals/index.js');
const selectors = read('ui/selectors/selectors.css');
const info = read('ui/info/info.css');
const time = read('ui/time/index.js');
const accountShell = read('online-booking/account-shell.js');

const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

expect(alphabet.includes('Контракт одинаков для профессионального интерфейса и интерфейса конечного пользователя'), 'UI alphabet must state one global contract for both application interfaces.');
expect(alphabet.includes('B показывает только присвоенный текущему контексту заголовок'), 'UI alphabet must keep B contextual and allow an unassigned title to stay empty.');
expect(alphabet.includes('C существует только когда прямо сейчас существует реальное контекстное действие'), 'UI alphabet must forbid placeholder C.');
expect(alphabet.includes('D всегда кликабелен'), 'UI alphabet must keep D interactive.');
expect(alphabet.includes('Информационный control `I`') && alphabet.includes('всегда находится в правой зоне `Z Header`'), 'UI alphabet must keep I on the right side of the surface header.');
expect(alphabet.includes('S — только информационное/техническое сообщение'), 'UI alphabet must keep S informational only.');
expect(alphabet.includes('Текущее выбранное значение в закрытом select всегда визуально центрировано'), 'UI alphabet must keep selector values centered.');

expect(shell.includes('data-v2-app style="--v2-base:#000000"'), 'Shared H owner must keep the application background black.');
expect(menuHeader.includes("state.title.textContent = 'Меню'"), 'Shared H owner must set B to Menu while the deck is open.');
expect(menuHeader.includes('state.cSlot.hidden = true') && menuHeader.includes("header.classList.remove('has-c')"), 'Shared H owner must remove C from menu state.');
expect(menuHeader.includes('state.aControl.disabled = true'), 'Shared H owner must keep A inactive in menu state.');
expect(menuHeader.includes('state.dControl.disabled = false'), 'Shared H owner must keep D interactive in menu state.');

expect(header.includes("if (!slot || slot.hidden) return '';"), 'Shared Header must not render empty action placeholders.');
expect(header.includes('const cVisible = Boolean(c && !c.hidden);'), 'Shared Header must derive C geometry from a real visible action.');
expect(!header.includes('v2-header__slot is-empty'), 'Shared Header must not reserve visual space with empty slots.');

expect(zLayout.includes("return `${v2QHeader(header)}${v2QBody(content)}`;"), 'Every Q must keep the same Shared Header + Body frame as Z.');
expect(zLayout.includes('bindV2ZHeaderOwner(root)') && zLayout.includes('root.replaceChildren = (...children) => {') && zLayout.includes('clearV2ZHeaderRows(root);'), 'Screen-scoped Z Header rows must be cleared when their owner surface is replaced.');
expect(zAffordance.includes('drop-shadow('), 'Shared Z/Q dismiss affordance must remain visibly separated from the surface.');
expect(zAffordance.includes('[data-v2-q-header] > [data-v2-z-dismiss]'), 'Shared dismiss affordance must work in Q as well as Z.');
expect(zStack.includes('export function bindV2StableZFrame'), 'Shared Z owner must protect Header + Body geometry while body content changes.');
expect(v2Index.includes('bindV2StableZFrame') && !v2Index.includes('ensureRootZFrame'), 'Root Z must bind the stable Shared frame instead of repairing it after destruction.');
expect(accountShell.includes('if (!canReuseScene) {') && accountShell.includes('root.innerHTML = v2Shell({'), 'End-user surfaces must keep the persistent Shared FEZ scene.');

expect(modalPortal.includes('.v2-header__slot--c .v2-header__control, [data-v2-header] .v2-header__slot--d .v2-header__control'), 'Q veil must leave both Header C and D interactive.');
expect(modalPortal.includes("if (qLayer && event.target.closest('[data-v2-z-dismiss]')) node.v2Close?.();"), 'Q Shared dismiss affordance must close only the active Q layer.');
expect(modals.includes('S_INTERACTIVE_CONTENT') && modals.includes('S modal is informational only'), 'Shared S owner must reject buttons/forms/editors/pickers.');
expect(time.includes("variant:'x'") && time.includes("variant: 'x'"), 'Shared time pickers must be X work modals.');

expect(selectors.includes('.ui-select__control{') && selectors.includes('justify-content:center'), 'Closed Shared Select value must be centered.');
expect(selectors.includes('.ui-selector__option{justify-content:center'), 'Open Shared Selector values must be centered.');
expect(info.includes('[data-v2-z-header-content] [data-info-ui]') && info.includes('align-self:flex-end;margin-left:auto'), 'Shared I must stay on the right side of Z/Q Header.');

if (failures.length) {
  failures.forEach((message) => console.error(`global UI contract: ${message}`));
  process.exit(1);
}

console.log('global UI contract check: OK');
