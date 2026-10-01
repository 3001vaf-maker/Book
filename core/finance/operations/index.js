import {
  actionBlock,
  button,
  modal,
  mountModal,
  mountV2ZLayer,
  v2Section,
  v2ZLayer,
} from '../../../ui/ui.js';
import { canUseBookCapability } from '../../access.js';
import { renderIncomeExpenseOperation } from '../dds/income-expense.js';
import { SPECIAL_FINANCE_ACTIONS, renderSpecialFinanceOperation } from '../dds/special-operations.js';

export function financeOperationGroups() {
  const groups = [];
  if (canUseBookCapability('finance.income_expense.access')) {
    groups.push({
      title: 'Доход / Расход',
      items: [
        { id: 'manual-income', label: 'Доход' },
        { id: 'manual-expense', label: 'Расход' },
      ],
    });
  }
  if (canUseBookCapability('finance.special.access')) {
    groups.push({
      title: 'Займы',
      items: SPECIAL_FINANCE_ACTIONS.filter((item) => item.group === 'loan'),
    });
    groups.push({
      title: 'Инвестиции',
      items: SPECIAL_FINANCE_ACTIONS.filter((item) => item.group === 'investment'),
    });
    groups.push({
      title: 'Переводы',
      items: SPECIAL_FINANCE_ACTIONS.filter((item) => item.group === 'transfer'),
    });
  }
  return groups.filter((group) => group.items.length);
}

function openFinanceOperationForm(root, actionId, { onSaved = null } = {}) {
  const layer = mountV2ZLayer(root, v2ZLayer('', { className: 'finance-operation-z' }), { stack: true });
  if (!layer) return null;

  const saved = () => {
    layer.v2Close?.();
    onSaved?.();
  };

  let rendered = false;
  if (actionId === 'manual-income') rendered = renderIncomeExpenseOperation(layer, 'IN', { onSaved: saved });
  else if (actionId === 'manual-expense') rendered = renderIncomeExpenseOperation(layer, 'OUT', { onSaved: saved });
  else rendered = renderSpecialFinanceOperation(layer, actionId, { onSaved: saved });

  if (!rendered) {
    layer.v2Close?.();
    return null;
  }
  return layer;
}

export function openFinanceOperations(root, { onSaved = null } = {}) {
  const groups = financeOperationGroups();
  if (!groups.length) return null;

  const content = groups.map((group) => v2Section(
    group.title,
    actionBlock(group.items.map((item) => button(item.label, {
      variant: 'secondary',
      data: `data-finance-operation-action="${item.id}"`,
    })).join('')),
  )).join('');

  const picker = mountModal(root, modal(content, {
    title: 'Финансовые операции',
    variant: 'quick',
    surface: 'app',
  }));
  if (!picker) return null;

  picker.querySelectorAll('[data-finance-operation-action]').forEach((element) => {
    element.addEventListener('click', () => {
      const actionId = String(element.dataset.financeOperationAction || '');
      picker.v2Close?.();
      openFinanceOperationForm(root, actionId, { onSaved });
    });
  });
  return picker;
}
