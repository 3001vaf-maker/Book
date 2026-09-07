const PROFILE_KEY = 'book.profile';
const CUSTOM_PROFESSIONS_KEY = 'book.profile.customProfessions';

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeProfile(profile = {}) {
  return {
    key: 'profile',
    name: String(profile.name || ''),
    surname: String(profile.surname || ''),
    phone: String(profile.phone || ''),
    about: String(profile.about || ''),
    photo: String(profile.photo || ''),
    profession: String(profile.profession || ''),
    experience: String(profile.experience || ''),
    professionAbout: String(profile.professionAbout || ''),
  };
}

export function getProfile() {
  return normalizeProfile(read(PROFILE_KEY, {}));
}

export function saveProfile(profile) {
  const normalized = normalizeProfile(profile);
  write(PROFILE_KEY, normalized);
  return normalized;
}

export function getCustomProfessions() {
  const values = read(CUSTOM_PROFESSIONS_KEY, []);
  return Array.isArray(values) ? values.map((value) => String(value || '').trim()).filter(Boolean) : [];
}

export function addCustomProfession(value) {
  const profession = String(value || '').trim();
  if (!profession) return getCustomProfessions();
  const values = getCustomProfessions();
  if (!values.includes(profession)) write(CUSTOM_PROFESSIONS_KEY, [...values, profession]);
  return getCustomProfessions();
}
