import { renderInventory } from './inventory.js';

const INVENTORY_NAVIGATION = [
  { id: 'stock', label: 'Остатки' },
  { id: 'movements', label: 'Движения' },
  { id: 'orders', label: 'Заказ' },
  { id: 'counts', label: 'Инвентаризация' },
];

export function inventoryNavigationItems() {
  return INVENTORY_NAVIGATION.map((item) => ({ ...item }));
}

export function renderInventorySection(root, section = 'stock') {
  const target = INVENTORY_NAVIGATION.some((item) => item.id === section) ? section : 'stock';
  return renderInventory(root, target);
}
