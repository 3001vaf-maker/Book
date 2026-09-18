// Company-side history belongs to Admin/Documents only.
// It must never include the user's operational history with their own customers.
// Persistence and event semantics will be connected as a separate layer later.

let companyDocumentHistory = [];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function hydrateCompanyDocumentHistory(items = []) {
  companyDocumentHistory = Array.isArray(items) ? clone(items) : [];
  return getCompanyDocumentHistory();
}

export function getCompanyDocumentHistory() {
  return clone(companyDocumentHistory);
}
