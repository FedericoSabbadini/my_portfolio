/* =========================================================================
   i18n.js — internationalisation module.
   Loads translation files, handles language switching, provides t() helper.
   ========================================================================= */

const I18N_BASE = 'data/i18n/';
const SUPPORTED_LOCALES = ['en', 'it'];
const DEFAULT_LOCALE = 'en';

const translationsCache = new Map();
let currentLocale = DEFAULT_LOCALE;
let listeners = [];

/**
 * Load translation file for a locale.
 * @param {string} locale - 'en' | 'it'
 * @returns {Promise<object>} translation object
 */
async function loadLocale(locale) {
  if (translationsCache.has(locale)) return translationsCache.get(locale);
  const res = await fetch(`${I18N_BASE}${locale}.json`);
  if (!res.ok) throw new Error(`Failed to load ${locale}.json`);
  const json = await res.json();
  console.log('[i18n] Loaded locale:', locale, Object.keys(json));
  translationsCache.set(locale, json);
  return json;
}

/**
 * Get current locale.
 * @returns {string}
 */
export function getLocale() {
  return currentLocale;
}

/**
 * Set locale, load translations, notify listeners.
 * @param {string} locale
 */
export async function setLocale(locale) {
  if (!SUPPORTED_LOCALES.includes(locale)) locale = DEFAULT_LOCALE;
  console.log('[i18n] setLocale called:', locale);
  currentLocale = locale;
  localStorage.setItem('locale', locale);
  document.documentElement.lang = locale;
  await loadLocale(locale);
  notifyListeners();
  console.log('[i18n] Locale changed to:', currentLocale);
}

/**
 * Initialize i18n from localStorage or browser language.
 */
export async function initI18n() {
  const saved = localStorage.getItem('locale');
  if (saved && SUPPORTED_LOCALES.includes(saved)) {
    currentLocale = saved;
  } else {
    const browserLang = navigator.language.slice(0, 2);
    if (SUPPORTED_LOCALES.includes(browserLang)) currentLocale = browserLang;
  }
  document.documentElement.lang = currentLocale;
  await loadLocale(currentLocale);
  notifyListeners();
}

/**
 * Translation helper with nested key support (e.g., 'header.tourLabel').
 * Falls back to key if translation missing.
 * @param {string} key
 * @param {object} [params] - optional interpolation params
 * @returns {string}
 */
export function t(key, params) {
  const dict = translationsCache.get(currentLocale) || {};
  let val = key.split('.').reduce((o, k) => (o || {})[k], dict);
  if (val === undefined) {
    // fallback to English
    const enDict = translationsCache.get('en') || {};
    val = key.split('.').reduce((o, k) => (o || {})[k], enDict);
  }
  if (val === undefined) return key;
  if (params) {
    return Object.entries(params).reduce((s, [k, v]) => s.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v), val);
  }
  return val;
}

/**
 * Subscribe to locale changes.
 * @param {Function} fn
 * @returns {Function} unsubscribe
 */
export function onLocaleChange(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter(l => l !== fn); };
}

function notifyListeners() {
  for (const fn of listeners) fn(currentLocale);
}

/**
 * Get localized value from data object (e.g., item.title vs item.title_it).
 * @param {object} obj
 * @param {string} key
 * @returns {string}
 */
export function localize(obj, key) {
  const suffix = currentLocale === 'it' ? '_it' : '';
  return obj[key + suffix] || obj[key] || '';
}

/**
 * Get localized array (tags, bio paragraphs, etc.)
 * @param {object} obj
 * @param {string} key
 * @returns {string[]}
 */
export function localizeArray(obj, key) {
  const suffix = currentLocale === 'it' ? '_it' : '';
  return obj[key + suffix] || obj[key] || [];
}