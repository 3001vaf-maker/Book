import { actionBlock, button, costCardMeta, costListParts, durationText, emptyState, entityCard, escapeHtml, iconButton, listEntries, listEntry, mountModal, modal, page, pageHeader, workplaceCountText } from '../../../ui/ui.js';
import { getSettlementItemTotals } from '../../../core/finance/index.js';
import { getRecords } from '../../../core/record/index.js';
import { deleteProcedure as deleteProcedureData, getProcedures, reorderProcedures } from './data.js';
import { openProcedureForm } from './form.js';

const money = (value) => `${new Intl.NumberFormat('ru-RU').format(Number(value || 0))} ₽`;

function procedureMetrics(procedureId) {
  const id = String(procedureId || '');
  const records = getRecords().filter((record) => record?.status !== 'cancelled'
    && (record?.procedures || []).some((item) => String(item?.id || '') === id));
  const fact = getSettlementItemTotals('procedure', id);
  return { records: records.length, revenue: fact.factTotal };
}

function openProcedureOrder(root, navigateBack) {
  let items = getProcedures();
  const m = mountModal(root, modal('<div data-procedure-order></div>', { title: 'Порядок услуг', variant: 'medium' }));
  if (!m) return;

  const renderOrder = () => {
    const host = m.querySelector('[data-procedure-order]');
    host.innerHTML = `<div class="modal-title"><h2>Порядок услуг</h2><p>Переместите важные услуги выше. Этот порядок сохраняется.</p></div>
      <div class="form-grid">${items.map((item, index) => `
        <div class="action-block">
          <strong>${escapeHtml(item.name || 'Без названия')}</strong>
          <div class="modal-actions">
            ${button('↑', { variant: 'secondary', data: `data-order-up="${escapeHtml(item.id)}"`, disabled: index === 0 })}
            ${button('↓', { variant: 'secondary', data: `data-order-down="${escapeHtml(item.id)}"`, disabled: index === items.length - 1 })}
          </div>
        </div>`).join('')}</div>
      <div class="modal-actions">${button('Готово', { data: 'data-order-done' })}</div>`;

    const move = (id, delta) => {
      const index = items.findIndex((item) => String(item.id) === String(id));
      const next = index + delta;
      if (index < 0 || next < 0 || next >= items.length) return;
      [items[index], items[next]] = [items[next], items[index]];
      reorderProcedures(items.map((item) => item.id));
      renderOrder();
    };
    host.querySelectorAll('[data-order-up]').forEach((control) => control.addEventListener('click', () => move(control.dataset.orderUp, -1)));
    host.querySelectorAll('[data-order-down]').forEach((control) => control.addEventListener('click', () => move(control.dataset.orderDown, 1)));
    host.querySelector('[data-order-done]')?.addEventListener('click', () => {
      m.remove();
      renderList(root, navigateBack);
    });
  };
  renderOrder();
}

function renderList(root, navigateBack) {
  const items = getProcedures();
  root.innerHTML = `<div class="entity-page-header">${pageHeader('Процедуры')}<div class="page-header-action">${items.length > 1 ? iconButton('↕', { data: 'data-order-procedures', aria: 'Изменить порядок услуг' }) : ''}${iconButton('+', { className: 'icon-button--primary', data: 'data-add-procedure', aria: 'Добавить услугу' })}</div></div>${items.length ? listEntries(items.map(renderRow)) : emptyState('Процедур пока нет', 'Добавьте первую процедуру кнопкой «+».')}${actionBlock(button('Назад', { className: 'ui-button--secondary', data: 'data-back-procedures' }))}`;
  root.querySelector('[data-order-procedures]')?.addEventListener('click', () => openProcedureOrder(root, navigateBack));
  root.querySelector('[data-add-procedure]')?.addEventListener('click', () => openProcedureForm({ root, onSaved: () => renderList(root, navigateBack) }));
  root.querySelectorAll('[data-procedure]').forEach((element) => element.addEventListener('click', () => renderCard(root, element.dataset.procedure, navigateBack)));
  root.querySelectorAll('[data-delete-action]').forEach((element) => element.addEventListener('click', (event) => {
    event.stopPropagation();
    confirmDelete(root, element.dataset.deleteAction, navigateBack, () => renderList(root, navigateBack));
  }));
  root.querySelector('[data-back-procedures]')?.addEventListener('click', navigateBack);
}

function renderRow(procedure) {
  const price = costListParts(procedure.cost);
  const workplaceCount = (procedure.workplaces || []).length;
  return listEntry({
    title: procedure.name || '',
    subtitle: `${durationText(procedure.duration)} — ${workplaceCountText(workplaceCount)}`,
    image: procedure.photo || '',
    initial: (procedure.name || '?').slice(0, 1).toUpperCase(),
    rightTop: price.rightTop || '',
    rightBottom: price.rightBottom || '',
    interactive: true,
    data: `data-procedure="${escapeHtml(procedure.id)}"`,
    aria: `Открыть процедуру ${procedure.name || ''}`,
    deleteData: procedure.id,
    deleteAria: `Удалить процедуру ${procedure.name || ''}`,
  });
}

function renderCard(root, id, navigateBack) {
  const procedure = getProcedures().find((item) => item.id === id);
  if (!procedure) return renderList(root, navigateBack);
  const metrics = procedureMetrics(procedure.id);
  const workplaceNames = (procedure.workplaces || []).map((workplace) => workplace.name || workplace.workplaceId).filter(Boolean);
  const card = entityCard({
    title: procedure.name || '',
    subtitle: durationText(procedure.duration),
    image: procedure.photo || '',
    initial: (procedure.name || '?').slice(0, 1).toUpperCase(),
    topMeta: [{ value: workplaceCountText(workplaceNames.length) }],
    topRightMeta: costCardMeta(procedure.cost),
    meta: [
      { value: metrics.records, label: 'записей' },
      { value: money(metrics.revenue), label: 'сумма' },
    ],
    metricsLayout: 'grid',
    detailRows: workplaceNames.map((name) => ({ left: name })),
    className: 'entity-card--hero entity-card--top-dark',
  });
  root.innerHTML = page([
    card,
    actionBlock(`${button('Редактировать процедуру', { data: 'data-edit-procedure' })}${button('Назад', { className: 'ui-button--secondary', data: 'data-back-procedures-card' })}${button('Удалить', { variant: 'danger', data: 'data-delete-card' })}`),
  ]);
  root.querySelector('[data-edit-procedure]').onclick = () => openProcedureForm({
    root,
    existing: procedure,
    onSaved: (saved) => renderCard(root, saved.id, navigateBack),
  });
  root.querySelector('[data-delete-card]').onclick = () => confirmDelete(root, id, navigateBack, () => renderList(root, navigateBack));
  root.querySelector('[data-back-procedures-card]').onclick = () => renderList(root, navigateBack);
}

function confirmDelete(root, id, navigateBack, onDeleted) {
  const procedure = getProcedures().find((item) => item.id === id);
  if (!procedure) return;
  const m = mountModal(root, modal(`<div class="modal-title"><h2>Удалить?</h2><p>${escapeHtml(procedure.name || 'Процедура')} будет удалена.</p></div><div class="modal-actions">${button('Удалить', { variant: 'danger', data: 'data-confirm-delete' })}${button('Отмена', { className: 'ui-button--secondary', data: 'data-cancel-delete' })}</div>`, { variant: 'compact' }));
  if (!m) return;
  m.querySelector('[data-cancel-delete]').onclick = () => m.remove();
  m.querySelector('[data-confirm-delete]').onclick = () => {
    if (deleteProcedureData(id)) {
      m.remove();
      onDeleted?.();
    } else m.remove();
  };
}

export function renderProcedures(root, navigateBack = () => {}) {
  renderList(root, navigateBack);
}

export { renderProcedures as render };
