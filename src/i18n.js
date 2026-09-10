import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import hi from './locales/hi.json';
import mr from './locales/mr.json';

// Read the saved language from localStorage.
// 'app_language' is set explicitly by Settings.jsx changeLanguage().
// Fall back to 'i18nextLng' (LanguageDetector's key) for backward compat.
// Default to 'en' if nothing is saved.
const savedLang = (() => {
    try {
        return (
            localStorage.getItem('app_language') ||
            localStorage.getItem('i18nextLng') ||
            'en'
        );
    } catch (e) {
        return 'en';
    }
})();

i18n
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: en },
            hi: { translation: hi },
            mr: { translation: mr }
        },
        lng: savedLang,          // Explicit language — no LanguageDetector ambiguity
        fallbackLng: 'en',
        debug: false,

        interpolation: {
            escapeValue: false,  // Not needed — React escapes by default
        }
    });

export default i18n;
