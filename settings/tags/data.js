import { queueAuxiliaryDataset } from '../../core/business-persistence.js';

const STORAGE_KEY = 'book.tags';
let tagsState = null;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function readLegacyTags() {
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

function readTags() {
  const value = tagsState === null ? readLegacyTags() : tagsState;
  return Array.isArray(value) ? clone(value) : [];
}

export function readLegacyTagSnapshot() {
  return { present: localStorage.getItem(STORAGE_KEY) != null, tags: clone(readLegacyTags()) };
}

export function hydrateTagsFromServer(value = []) {
  tagsState = Array.isArray(value) ? value.map(normalizeTag) : [];
  return clone(tagsState);
}

export function getTags() {
  return readTags()
    .map(normalizeTag)
    .filter((tag) => tag.id && tag.name);
}

export function saveTags(tags = []) {
  const normalized = tags.map(normalizeTag);
  if (tagsState === null) localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  else {
    tagsState = clone(normalized);
    void queueAuxiliaryDataset('tags', tagsState);
  }
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
