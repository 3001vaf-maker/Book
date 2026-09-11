import { readFileSync, writeFileSync } from 'node:fs';

function edit(path, transform) {
  const source = readFileSync(path, 'utf8');
  const next = transform(source);
  if (next !== source) writeFileSync(path, next);
}

edit('journal/record.js', (source) => source.includes('discountPercent: Number(currentClient.discountPercent) || 0') ? source : source.replace(
  "          phone: currentClient.phones?.[0] || '',\n",
  "          phone: currentClient.phones?.[0] || '',\n          discountPercent: Number(currentClient.discountPercent) || 0,\n",
));

edit('journal/record-view.js', (source) => source.includes('discountPercent: Number(person.discountPercent) || 0') ? source : source.replace(
  'onSelected?.({ key: person.key, id: person.id, uei: display.uei, name: person.name, surname: person.surname, phone: display.phone });',
  'onSelected?.({ key: person.key, id: person.id, uei: display.uei, name: person.name, surname: person.surname, phone: display.phone, discountPercent: Number(person.discountPercent) || 0 });',
));

edit('tests/critical-record-flow.test.mjs', (source) => source.includes("phone: '+70000000000', discountPercent: 20") ? source : source.replace(
  "client: { key: 'client-1', name: 'Анна', surname: 'Тест', phone: '+70000000000' },",
  "client: { key: 'client-1', name: 'Анна', surname: 'Тест', phone: '+70000000000', discountPercent: 20 },",
));

console.log('client discount handoff: applied');
