const checks = [
  ['https://api.va-tools.ru/health', null],
  ['https://admin.va-tools.ru/admin/', 'Book Admin'],
  ['https://admin.va-tools.ru/admin/admin.js', 'document-registry/view.js'],
  ['https://book.va-tools.ru/', '<title>Book</title>'],
  ['https://book.va-tools.ru/core.js', 'app-content'],
  ['https://client.va-tools.ru/', '<title>Book</title>'],
  ['https://client.va-tools.ru/online-booking/booking.js', 'renderOnlineBooking'],
];

for (const [url, marker] of checks) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(url + ': HTTP ' + response.status);
  const body = await response.text();
  if (marker && !body.includes(marker)) throw new Error(url + ': missing marker ' + marker);
  console.log('OK', url, response.status);
}
