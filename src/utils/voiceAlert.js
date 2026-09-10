/**
 * Voice Alert Utility — DISABLED
 *
 * Voice announcement was removed. All exports are no-ops so Collection.jsx
 * requires zero changes. Voice alert toggle in the UI still works and
 * persists the preference, it just has no effect.
 */

/** No-op: voice announcement disabled */
export async function speakCollectionSummary(_data, _rawLanguage = 'en') {
    return { usingFallback: false, effectiveLang: 'en-IN' };
}

/** Returns current voice-alert enabled state from localStorage (defaults true) */
export function isVoiceAlertEnabled() {
    const v = localStorage.getItem('voiceAlertEnabled');
    return v === null ? true : v === 'true';
}

/** Persists voice alert on/off preference */
export function setVoiceAlertEnabled(enabled) {
    localStorage.setItem('voiceAlertEnabled', String(enabled));
}

/** Returns empty list (no TTS engine active) */
export function getAvailableVoices() {
    return [];
}
