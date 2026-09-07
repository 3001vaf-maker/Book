const STORAGE_KEY = 'book.tags';

function readTags() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function normalizeTag(tag = {}) {
  return {
    id: String(tag.id || ''),
    name: String(tag.name || ''),
    color: String(tag.color || '#3B302B'),
    createdAt: String(tag.createdAt || ''),
    updatedAt: String(tag.updatedAt || ''),
  };
}

export function getTags() {
  return readTags()
    .map(normalizeTag)
    .filter((tag) => tag.id && tag.name);
}

export function saveTags(tags = []) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tags.map(normalizeTag)));
}

export function createTag({ name, color }) {
  const now = new Date().toISOString();
  return normalizeTag({
    id: crypto.randomUUID(),
    name,
    color,
    createdAt: now,
    updatedAt: now,
  });
}
