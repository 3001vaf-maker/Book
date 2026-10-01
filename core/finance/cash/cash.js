import {
  button,
  emptyState,
  entityCardStack,
  entityVisualCard,
  escapeHtml,
  field,
  initPhotoField,
  modal,
  mountEntityCardConstructor,
  mountModal,
  mountV2ZLayer,
  openNotice,
  openSharedProfileSettingsMenu,
  page,
  readOnlyReceipt,
  photoField,
  shortDateTime,
  shortDateTimeParts,
  v2ListEntries,
  v2ListEntry,
  v2ZLayer,
  workspaceHeaderContext,
} from '../../../ui/ui.js';
import {
  canPermanentlyDeleteFinanceData,
  cancelFinanceOperation,
  hardDeleteFinanceWallet,
} from '../service.js';
import {
  deleteWallet as deleteWalletData,
  deleteWalletPermanently,
  getWalletBalance,
  getWalletHistory,
  getWallets,
  saveWallet as saveWalletData,
  updateWallet,
} from './data.js';
import { walletCardAppearance, walletCardFields } from './card-presentation.js';

const formatMoney = (value) => `${(Number(value) || 0).toLocaleString('ru-RU')} ₽`;

function operationMoment(item) {
  const raw = item?.occurredAt || item?.refundedAt || item?.paidAt || item?.createdAt || '';
  const fallback = `${item?.date || ''} ${item?.time || ''}`.trim();
  return shortDateTime(raw, fallback);
}

function operationName(item) {
  const direction = String(item?.direction || '');
  const economicType = String(item?.economicType || '');
  let title = direction === 'OUT' ? 'Расход' : 'Доход';
  if (economicType === 'SERVICE_REVENUE') title = 'Оплата услуги';
  else if (economicType === 'SERVICE_REFUND') title = 'Возврат услуги';
  else if (economicType === 'TIPS_REFUND') title = 'Возврат чаевых';
  else if (economicType === 'TIPS') title = 'Чаевые';
  else if (economicType === 'LOAN_RECEIVED') title = 'Получен займ';
  else if (economicType === 'LOAN_REPAYMENT') title = 'Возврат займа';
  else if (economicType === 'INVESTMENT_RECEIVED') title = 'Получена инвестиция';
  else if (economicType === 'INVESTMENT_RETURN') title = 'Возврат инвестиций';
  else if (economicType === 'TRANSFER') title = direction === 'OUT' ? 'Перевод · списание' : 'Перевод · зачисление';
  else if (item?.articleName) title = item.articleName;
  return title;
}

function personName(item) {
  return [item?.person?.name, item?.person?.surname].filter(Boolean).join(' ').trim();
}

function walletOperations(walletId) {
  const grouped = new Map();
  for (const entry of getWalletHistory(walletId)) {
    const operationId = String(entry?.operationId || '');
    if (!operationId) continue;
    if (entry?.operationKind === 'cancel' || entry?.operationStatus === 'cancelled' || entry?.economicType === 'REVERSAL') continue;
    const current = grouped.get(operationId) || { ...entry, operationId, total: 0, entries: [] };
    current.entries.push(entry);
    current.total += Number(entry?.total) || 0;
    if (!current.counterparty && entry?.counterparty) current.counterparty = entry.counterparty;
    if (!current.workplace && entry?.workplace) current.workplace = entry.workplace;
    if (!current.person && entry?.person) current.person = entry.person;
    grouped.set(operationId, current);
  }
  return [...grouped.values()]
    .sort((a, b) => String(b?.occurredAt || '').localeCompare(String(a?.occurredAt || '')));
}

function renderOperationRow(operation) {
  const name = personName(operation);
  const counterparty = String(operation?.counterparty || '').trim();
  const label = operationName(operation);
  const title = name || counterparty || label;
  const subtitle = String(operation?.workplace || '').trim()
    || (title !== label ? label : '');
  return v2ListEntry({
    overline: String(operation?.person?.uei || ''),
    title,
    subtitle,
    rightTop: formatMoney(operation.total),
    rightBottom: operationMoment(operation),
    initial: '',
    interactive: true,
    data: `data-wallet-operation="${escapeHtml(operation.operationId)}"`,
    aria: `Открыть операцию ${label}`,
  });
}

function cashContext() {
  return workspaceHeaderContext({
    title: 'Касса',
    a: {
      kind: 'settings',
      data: 'data-cash-settings',
      aria: 'Настройки кассы',
    },
  });
}

function walletContext(wallet, title = wallet?.name || 'Касса') {
  return workspaceHeaderContext({
    title,
    a: {
      kind: 'settings',
      data: 'data-wallet-settings',
      aria: `Настройки ${wallet?.name || 'кассы'}`,
    },
  });
}

function operationContext(operation) {
  return workspaceHeaderContext({
    title: operationName(operation),
    a: {
      kind: 'settings',
      data: 'data-wallet-operation-settings',
      aria: 'Настройки операции',
    },
  });
}

function addWalletSource() {
  return button('+', {
    className: 'v2-primary-source-only',
    data: 'data-add-wallet data-v2-primary-action data-v2-primary-label="+"',
    aria: 'Добавить кассу',
  });
}

function renderWalletCard(wallet) {
  const balance = getWalletBalance(wallet.id);
  return entityVisualCard({
    appearance: walletCardAppearance(wallet),
    fields: walletCardFields(wallet, balance),
    image: wallet.photo || '',
    interactive: true,
    data: `data-wallet="${escapeHtml(wallet.id)}"`,
    aria: `Открыть кассу ${wallet.name}`,
  });
}

function renderList(root) {
  const wallets = getWallets();
  const cards = wallets.map(renderWalletCard);
  root.innerHTML = page([
    cashContext(),
    cards.length ? entityCardStack(cards) : emptyState('Касс пока нет', 'Добавьте первую кассу кнопкой «+».'),
    addWalletSource(),
  ]);
  root.querySelector('[data-add-wallet]')?.addEventListener('click', () => openForm(root));
  root.querySelectorAll('[data-wallet]').forEach((element) => {
    element.addEventListener('click', () => openWalletZ2(root, element.dataset.wallet));
  });
}

function openForm(root, existing = null) {
  const wallet = existing || { photo: '', name: '', cardAppearance: {} };
  const html = `<form class="compact-form" data-wallet-form>
    <div class="modal-title"><h2>${existing ? 'Изменить кассу' : 'Новая касса'}</h2></div>
    ${photoField({ name: 'walletPhoto', value: wallet.photo || '' })}
    ${field({ label: 'Наименование кассы', name: 'walletName', value: wallet.name || '', placeholder: 'Наименование', required: true })}
    ${button('Сохранить', { type: 'submit' })}
  </form>`;
  const layer = mountModal(root, modal(html, { title: existing ? 'Изменить кассу' : 'Новая касса' }));
  if (!layer) return;
  initPhotoField(layer);
  layer.querySelector('[data-wallet-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = layer.querySelector('[data-wallet-form]');
    const data = new FormData(form);
    const name = String(data.get('walletName') || '').trim();
    if (!name) return;
    saveWalletData({
      id: existing?.id || crypto.randomUUID(),
      name,
      photo: String(data.get('walletPhoto') || ''),
      cardAppearance: existing?.cardAppearance || {},
      system: Boolean(existing?.system),
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    layer.v2Close?.();
    renderList(root);
  });
}

function renderWalletLayer(root, layer, walletId) {
  const wallet = getWallets().find((item) => String(item.id) === String(walletId));
  if (!wallet) {
    layer.v2Close?.();
    renderList(root);
    return;
  }
  const operations = walletOperations(wallet.id);
  layer.innerHTML = page([
    walletContext(wallet),
    operations.length
      ? v2ListEntries(operations.map(renderOperationRow))
      : emptyState('Операций пока нет', 'Движения по этой кассе появятся здесь.'),
  ]);
  layer.querySelector('[data-wallet-settings]')?.addEventListener('click', () => {
    void openWalletSettings(root, layer, wallet);
  });
  layer.querySelectorAll('[data-wallet-operation]').forEach((element) => {
    element.addEventListener('click', () => openWalletOperation(root, layer, wallet, element.dataset.walletOperation));
  });
}

function openWalletZ2(root, walletId) {
  const wallet = getWallets().find((item) => String(item.id) === String(walletId));
  if (!wallet) return;
  const layer = mountV2ZLayer(root, v2ZLayer(''), { stack: true });
  if (!layer) return;
  renderWalletLayer(root, layer, wallet.id);
}

function openWalletAppearance(root, walletLayer, walletId) {
  const wallet = getWallets().find((item) => String(item.id) === String(walletId));
  if (!wallet) return null;
  const layer = mountV2ZLayer(walletLayer, v2ZLayer(page([
    walletContext(wallet, 'Вид'),
    '<div data-wallet-card-constructor></div>',
  ])), { stack: true });
  const host = layer?.querySelector('[data-wallet-card-constructor]');
  if (!host) return layer;
  mountEntityCardConstructor(host, {
    appearance: walletCardAppearance(wallet),
    fields: walletCardFields(wallet, getWalletBalance(wallet.id)),
    photo: wallet.photo || '',
    onSave: async ({ appearance, photo }) => {
      updateWallet(wallet.id, { photo, cardAppearance: appearance });
      layer.v2Close?.();
      renderWalletLayer(root, walletLayer, wallet.id);
    },
  });
  return layer;
}

function confirmDeleteWallet(root, walletLayer, wallet) {
  if (Math.abs(getWalletBalance(wallet.id)) > 0.009) {
    openNotice({ message: 'Сначала переведите остаток из этой кассы.' });
    return;
  }
  openSharedProfileSettingsMenu({
    title: wallet.name,
    actions: [{
      id: 'confirm-delete',
      label: 'Удалить кассу',
      variant: 'danger',
      onSelect: () => {
        if (!deleteWalletData(wallet.id)) return;
        walletLayer.v2Close?.();
        renderList(root);
      },
    }],
  });
}

function confirmHardDeleteWallet(root, walletLayer, wallet) {
  openSharedProfileSettingsMenu({
    title: wallet.name,
    actions: [{
      id: 'confirm-hard-delete',
      label: 'Полное удаление',
      variant: 'danger',
      onSelect: async () => {
        try {
          await hardDeleteFinanceWallet(wallet.id);
          deleteWalletPermanently(wallet.id);
          walletLayer.v2Close?.();
          renderList(root);
        } catch (error) {
          openNotice({ message: String(error?.message || 'Не удалось полностью удалить кассу') });
        }
      },
    }],
  });
}

async function openWalletSettings(root, walletLayer, wallet) {
  const actions = [{
    id: 'appearance',
    label: 'Вид',
    onSelect: () => openWalletAppearance(root, walletLayer, wallet.id),
  }];

  if (!wallet.system) {
    actions.push({
      id: 'delete',
      label: 'Удалить кассу',
      variant: 'danger',
      onSelect: () => confirmDeleteWallet(root, walletLayer, wallet),
    });
    const isAdmin = await canPermanentlyDeleteFinanceData().catch(() => false);
    if (isAdmin && walletLayer.isConnected) {
      actions.push({
        id: 'hard-delete',
        label: 'Полное удаление',
        variant: 'danger',
        onSelect: () => confirmHardDeleteWallet(root, walletLayer, wallet),
      });
    }
  }

  if (!walletLayer.isConnected) return null;
  return openSharedProfileSettingsMenu({
    title: wallet.name,
    actions,
  });
}

function operationReceipt(operation) {
  const when = shortDateTimeParts(operation?.occurredAt || '');
  const fullName = [operation?.person?.name, operation?.person?.surname]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ');
  return readOnlyReceipt({
    items: [
      { label: String(operation?.workplace || '').trim(), value: '' },
      { label: when.date || '—', value: when.time || '—' },
      { label: String(operation?.person?.uei || '').trim(), value: '' },
      { label: fullName, value: '' },
    ].filter((item) => item.label || item.value),
    totals: [
      { label: '', value: formatMoney(operation?.total), strong: true },
    ],
  });
}

function openWalletOperation(root, walletLayer, wallet, operationId) {
  const operation = walletOperations(wallet.id)
    .find((item) => String(item.operationId) === String(operationId));
  if (!operation) return;
  const layer = mountV2ZLayer(walletLayer, v2ZLayer(page([
    operationContext(operation),
    operationReceipt(operation),
  ])), { stack: true });
  if (!layer) return;
  layer.querySelector('[data-wallet-operation-settings]')?.addEventListener('click', () => {
    openOperationSettings(root, walletLayer, layer, wallet, operation);
  });
}

function openOperationSettings(root, walletLayer, operationLayer, wallet, operation) {
  return openSharedProfileSettingsMenu({
    title: operationName(operation),
    actions: [{
      id: 'delete-operation',
      label: 'Удалить операцию',
      variant: 'danger',
      onSelect: async () => {
        try {
          await cancelFinanceOperation(operation.operationId, {
            reason: 'incorrect-entry',
            occurredAt: new Date(),
          });
          operationLayer.v2Close?.();
          renderWalletLayer(root, walletLayer, wallet.id);
        } catch (error) {
          openNotice({ message: String(error?.message || 'Не удалось удалить операцию') });
        }
      },
    }],
  });
}

export function renderWallets(root) {
  renderList(root);
}

export { renderWallets as render };
