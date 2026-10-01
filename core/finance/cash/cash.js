import {
  button,
  actionBlock,
  emptyState,
  entityCardRail,
  entityVisualCard,
  escapeHtml,
  field,
  formValidationMessage,
  initPhotoField,
  modal,
  mountEntityCardConstructor,
  mountModal,
  mountV2ZLayer,
  openNotice,
  openSharedProfileSettingsMenu,
  page,
  photoField,
  shortDateTime,
  shortDateTimeParts,
  v2ListEntries,
  v2ListEntry,
  v2Section,
  v2ZLayer,
  workspaceHeaderContext,
} from '../../../ui/ui.js';
import { readOnlyReceipt } from '../../../ui/receipt/index.js';
import {
  canPermanentlyDeleteFinanceData,
  cancelFinanceOperation,
  hardDeleteFinanceWallet,
} from '../service.js';
import { financeOperationGroups, openFinanceOperation, openFinanceOperations } from '../operations/index.js';
import { getFinanceEntityBalance, getFinanceEntityMovements } from '../read.js';
import {
  deleteWallet as deleteWalletData,
  deleteWalletPermanently,
  getWalletBalance,
  getWalletHistory,
  getWallets,
  saveWallet as saveWalletData,
  updateWallet,
} from './data.js';
import { cashEntityCardAppearance, cashEntityCardFields, walletCardAppearance, walletCardFields } from './card-presentation.js';
import {
  getInvestmentEntities,
  getLoanEntities,
  saveInvestmentEntity,
  saveLoanEntity,
} from './entities.js';

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
  const workplace = String(operation?.workplace || '').trim();
  const label = operationName(operation);
  const source = [name || counterparty, workplace].filter(Boolean).join(' · ');
  return v2ListEntry({
    overline: String(operation?.person?.uei || ''),
    title: label,
    subtitle: source,
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
    c: {
      label: '+',
      data: 'data-cash-create',
      aria: 'Создать сущность кассы',
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

function renderWalletCard(wallet) {
  const balance = getWalletBalance(wallet.id);
  return entityVisualCard({
    appearance: walletCardAppearance(wallet),
    fields: walletCardFields(wallet, balance),
    image: wallet.photo || '',
    interactive: true,
    data: `data-wallet="${escapeHtml(wallet.id)}"`,
    aria: `Открыть кошелёк ${wallet.name}`,
  });
}

function renderCashEntityCard(entity, kind) {
  const label = kind === 'investment' ? 'инвестицию' : 'займ';
  const balance = getFinanceEntityBalance(kind, entity.id);
  return entityVisualCard({
    appearance: cashEntityCardAppearance(entity),
    fields: cashEntityCardFields(entity, balance),
    image: entity.photo || '',
    interactive: true,
    data: `data-finance-entity-type="${escapeHtml(kind)}" data-finance-entity-id="${escapeHtml(entity.id)}"`,
    aria: `Открыть ${label} ${entity.name}`,
  });
}

function horizontalCards(cards = []) {
  const values = (Array.isArray(cards) ? cards : []).filter(Boolean);
  return values.length ? entityCardRail(values) : '';
}

function openCashCreateMenu(root) {
  const content = actionBlock([
    button('+ Добавить кошелек', { variant: 'secondary', data: 'data-cash-create-wallet' }),
    button('+ Добавить инвестицию', { variant: 'secondary', data: 'data-cash-create-investment' }),
    button('+ Добавить займ', { variant: 'secondary', data: 'data-cash-create-loan' }),
  ].join(''));
  const layer = mountModal(document.body, modal(content, {
    title: 'Добавить',
    variant: 'quick',
    surface: 'app',
  }));
  if (!layer) return null;

  layer.querySelector('[data-cash-create-wallet]')?.addEventListener('click', () => {
    layer.v2Close?.();
    openWalletForm(root);
  });
  layer.querySelector('[data-cash-create-investment]')?.addEventListener('click', () => {
    layer.v2Close?.();
    openCashEntityForm(root, 'investment');
  });
  layer.querySelector('[data-cash-create-loan]')?.addEventListener('click', () => {
    layer.v2Close?.();
    openCashEntityForm(root, 'loan');
  });
  return layer;
}

function openCashSettings(root) {
  const groups = ['income-expense', 'transfer'];
  const actions = financeOperationGroups({ groups }).length
    ? [{
        id: 'financial-operations',
        label: 'Финансовые операции',
        onSelect: () => openFinanceOperations(root, {
          groups,
          onSaved: () => renderList(root),
        }),
      }]
    : [];
  if (!actions.length) return null;
  return openSharedProfileSettingsMenu({
    title: 'Касса',
    actions,
  });
}

function renderList(root) {
  const wallets = getWallets();
  const investments = getInvestmentEntities();
  const loans = getLoanEntities();
  root.innerHTML = page([
    cashContext(),
    v2Section('Кошельки', horizontalCards(wallets.map(renderWalletCard))),
    v2Section('Инвестиции', horizontalCards(investments.map((item) => renderCashEntityCard(item, 'investment')))),
    v2Section('Займ', horizontalCards(loans.map((item) => renderCashEntityCard(item, 'loan')))),
  ]);

  root.querySelector('[data-cash-settings]')?.addEventListener('click', () => openCashSettings(root));
  root.querySelector('[data-cash-create]')?.addEventListener('click', () => openCashCreateMenu(root));
  root.querySelectorAll('[data-wallet]').forEach((element) => {
    element.addEventListener('click', () => openWalletZ2(root, element.dataset.wallet));
  });
  root.querySelectorAll('[data-finance-entity-type][data-finance-entity-id]').forEach((element) => {
    element.addEventListener('click', () => {
      openFinanceEntityZ2(root, element.dataset.financeEntityType, element.dataset.financeEntityId);
    });
  });
}

function openWalletForm(root, existing = null) {
  const wallet = existing || { photo: '', name: '', cardAppearance: {} };
  const html = `<form class="compact-form" data-wallet-form novalidate>
    <div class="modal-title"><h2>${existing ? 'Изменить кошелёк' : 'Новый кошелёк'}</h2></div>
    ${photoField({ name: 'walletPhoto', value: wallet.photo || '' })}
    ${field({ label: 'Наименование кошелька', name: 'walletName', value: wallet.name || '', placeholder: 'Наименование', required: true })}
    ${button('Сохранить', { type: 'submit' })}
  </form>`;
  const layer = mountModal(root, modal(html, { title: existing ? 'Изменить кошелёк' : 'Новый кошелёк' }));
  if (!layer) return;
  initPhotoField(layer);
  layer.querySelector('[data-wallet-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = layer.querySelector('[data-wallet-form]');
    const validation = formValidationMessage(form);
    if (validation) {
      openNotice({ message: validation });
      return;
    }
    const data = new FormData(form);
    const name = String(data.get('walletName') || '').trim();
    if (!name) {
      openNotice({ message: 'Укажите наименование кошелька.' });
      return;
    }
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

function openCashEntityForm(root, kind) {
  const investment = kind === 'investment';
  const title = investment ? 'Новая инвестиция' : 'Новый займ';
  const fieldLabel = investment ? 'Наименование инвестиции' : 'Наименование займа';
  const dataName = investment ? 'investmentName' : 'loanName';
  const photoName = investment ? 'investmentPhoto' : 'loanPhoto';
  const formData = investment ? 'data-investment-form' : 'data-loan-form';
  const html = `<form class="compact-form" ${formData} novalidate>
    <div class="modal-title"><h2>${title}</h2></div>
    ${photoField({ name: photoName, value: '' })}
    ${field({ label: fieldLabel, name: dataName, value: '', placeholder: 'Наименование', required: true })}
    ${button('Сохранить', { type: 'submit' })}
  </form>`;
  const layer = mountModal(root, modal(html, { title }));
  if (!layer) return;
  initPhotoField(layer);
  const form = layer.querySelector(`[${formData}]`);
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const validation = formValidationMessage(form);
    if (validation) {
      openNotice({ message: validation });
      return;
    }
    const data = new FormData(form);
    const name = String(data.get(dataName) || '').trim();
    if (!name) {
      openNotice({ message: `Укажите ${fieldLabel.toLocaleLowerCase('ru-RU')}.` });
      return;
    }
    const entity = {
      id: crypto.randomUUID(),
      name,
      photo: String(data.get(photoName) || ''),
      cardAppearance: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (investment) saveInvestmentEntity(entity);
    else saveLoanEntity(entity);
    layer.v2Close?.();
    renderList(root);
  });
}

function financeEntityById(type, id) {
  const values = type === 'loan' ? getLoanEntities() : getInvestmentEntities();
  return values.find((item) => String(item?.id || '') === String(id || '')) || null;
}

function financeEntityContext(entity, type) {
  const fallback = type === 'loan' ? 'Займ' : 'Инвестиция';
  return workspaceHeaderContext({
    title: entity?.name || fallback,
    a: {
      kind: 'settings',
      data: 'data-finance-entity-settings',
      aria: `Настройки ${entity?.name || fallback}`,
    },
  });
}

function financeEntityOperations(type, id) {
  const grouped = new Map();
  for (const entry of getFinanceEntityMovements(type, id)) {
    const operationId = String(entry?.operationId || '');
    if (!operationId) continue;
    if (entry?.operationKind === 'cancel' || entry?.operationStatus === 'cancelled' || entry?.economicType === 'REVERSAL') continue;
    const current = grouped.get(operationId) || { ...entry, operationId, total: 0, entries: [] };
    current.entries.push(entry);
    current.total += Number(entry?.total) || 0;
    grouped.set(operationId, current);
  }
  return [...grouped.values()]
    .sort((a, b) => String(b?.occurredAt || '').localeCompare(String(a?.occurredAt || '')));
}

function renderFinanceEntityOperationRow(operation, type, entityId) {
  const label = operationName(operation);
  return v2ListEntry({
    title: label,
    subtitle: String(operation?.walletName || ''),
    rightTop: formatMoney(operation.total),
    rightBottom: operationMoment(operation),
    initial: '',
    interactive: true,
    data: `data-finance-entity-operation="${escapeHtml(operation.operationId)}" data-finance-entity-type="${escapeHtml(type)}" data-finance-entity-id="${escapeHtml(entityId)}"`,
    aria: `Открыть операцию ${label}`,
  });
}

function renderFinanceEntityLayer(root, layer, type, id) {
  const entity = financeEntityById(type, id);
  if (!entity) {
    layer.v2Close?.();
    renderList(root);
    return;
  }
  const operations = financeEntityOperations(type, entity.id);
  layer.innerHTML = page([
    financeEntityContext(entity, type),
    operations.length
      ? v2ListEntries(operations.map((operation) => renderFinanceEntityOperationRow(operation, type, entity.id)))
      : emptyState('Операций пока нет', type === 'loan'
        ? 'Получение и возврат займа появятся здесь.'
        : 'Получение и возврат инвестиции появятся здесь.'),
  ]);

  layer.querySelector('[data-finance-entity-settings]')?.addEventListener('click', () => {
    openFinanceEntitySettings(root, layer, type, entity);
  });
  layer.querySelectorAll('[data-finance-entity-operation]').forEach((element) => {
    element.addEventListener('click', () => {
      openFinanceEntityOperation(root, layer, type, entity, element.dataset.financeEntityOperation);
    });
  });
}

function openFinanceEntityZ2(root, type, id) {
  const entity = financeEntityById(type, id);
  if (!entity) return null;
  const layer = mountV2ZLayer(root, v2ZLayer(''), { stack: true });
  if (!layer) return null;
  renderFinanceEntityLayer(root, layer, type, entity.id);
  return layer;
}

function openFinanceEntityAppearance(root, entityLayer, type, entity) {
  const layer = mountV2ZLayer(entityLayer, v2ZLayer(page([
    financeEntityContext(entity, type),
    '<div data-finance-entity-card-constructor></div>',
  ])), { stack: true });
  const host = layer?.querySelector('[data-finance-entity-card-constructor]');
  if (!host) return layer;
  mountEntityCardConstructor(host, {
    appearance: cashEntityCardAppearance(entity),
    fields: cashEntityCardFields(entity, getFinanceEntityBalance(type, entity.id)),
    photo: entity.photo || '',
    onSave: async ({ appearance, photo }) => {
      const next = {
        ...entity,
        photo,
        cardAppearance: appearance,
        updatedAt: new Date().toISOString(),
      };
      if (type === 'loan') saveLoanEntity(next);
      else saveInvestmentEntity(next);
      layer.v2Close?.();
      renderFinanceEntityLayer(root, entityLayer, type, entity.id);
      renderList(root);
    },
  });
  return layer;
}

function openFinanceEntitySettings(root, entityLayer, type, entity) {
  const financeEntity = { type, id: entity.id, name: entity.name };
  const receivedAction = type === 'loan' ? 'loan-received' : 'investment-received';
  const returnAction = type === 'loan' ? 'loan-repayment' : 'investment-return';
  const receivedLabel = type === 'loan' ? 'Получение займа' : 'Получение инвестиции';
  const returnLabel = type === 'loan' ? 'Возврат займа' : 'Возврат инвестиции';
  const saved = () => {
    renderFinanceEntityLayer(root, entityLayer, type, entity.id);
    renderList(root);
  };

  return openSharedProfileSettingsMenu({
    title: entity.name,
    actions: [
      {
        id: 'appearance',
        label: 'Вид',
        onSelect: () => openFinanceEntityAppearance(root, entityLayer, type, entity),
      },
      {
        id: 'receive',
        label: receivedLabel,
        onSelect: () => openFinanceOperation(entityLayer, receivedAction, {
          financeEntity,
          onSaved: saved,
        }),
      },
      {
        id: 'return',
        label: returnLabel,
        onSelect: () => openFinanceOperation(entityLayer, returnAction, {
          financeEntity,
          onSaved: saved,
        }),
      },
    ],
  });
}

function openFinanceEntityOperation(root, entityLayer, type, entity, operationId) {
  const operation = financeEntityOperations(type, entity.id)
    .find((item) => String(item?.operationId || '') === String(operationId || ''));
  if (!operation) return null;
  const layer = mountV2ZLayer(entityLayer, v2ZLayer(page([
    operationContext(operation),
    operationReceipt(operation),
  ])), { stack: true });
  if (!layer) return null;
  layer.querySelector('[data-wallet-operation-settings]')?.addEventListener('click', () => {
    openSharedProfileSettingsMenu({
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
            layer.v2Close?.();
            renderFinanceEntityLayer(root, entityLayer, type, entity.id);
            renderList(root);
          } catch (error) {
            openNotice({ message: String(error?.message || 'Не удалось удалить операцию') });
          }
        },
      }],
    });
  });
  return layer;
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
    title: operationName(operation),
    date: when.date || '—',
    time: when.time || '—',
    items: [
      { label: String(operation?.workplace || '').trim(), value: '' },
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
