/**
 * User language proficiency levels
 */
export enum LanguageProficiencyLevel {
  NATIVE = "native",
  FLUENT = "fluent",
  ADVANCED = "advanced",
  UPPER_INTERMEDIATE = "upper-intermediate",
  INTERMEDIATE = "intermediate",
  ELEMENTARY = "elementary",
  BEGINNER = "beginner",
}

/**
 * User language with proficiency level
 */
export interface UserLanguage {
  code: string; // ISO 639-1 language code (e.g., "en", "ru", "hy", "fr", "de")
  level: LanguageProficiencyLevel;
}

/**
 * Valid language codes (ISO 639-1)
 * Common languages for the job portal
 */
export const VALID_LANGUAGE_CODES = [
  "en", // English
  "ru", // Russian
  "hy", // Armenian
  "fr", // French
  "de", // German
  "es", // Spanish
  "it", // Italian
  "pt", // Portuguese
  "zh", // Chinese
  "ja", // Japanese
  "ko", // Korean
  "ar", // Arabic
  "tr", // Turkish
  "pl", // Polish
  "uk", // Ukrainian
  "he", // Hebrew
  "fa", // Persian
  "hi", // Hindi
] as const;

export type ValidLanguageCode = typeof VALID_LANGUAGE_CODES[number];

/**
 * Validate language code
 */
export function isValidLanguageCode(code: string): code is ValidLanguageCode {
  return VALID_LANGUAGE_CODES.includes(code as ValidLanguageCode);
}

/**
 * Validate proficiency level
 */
export function isValidProficiencyLevel(
  level: string
): level is LanguageProficiencyLevel {
  return Object.values(LanguageProficiencyLevel).includes(
    level as LanguageProficiencyLevel
  );
}

/**
 * Validate user language object
 */
export function isValidUserLanguage(
  lang: any
): lang is UserLanguage {
  return (
    lang &&
    typeof lang === "object" &&
    typeof lang.code === "string" &&
    typeof lang.level === "string" &&
    isValidLanguageCode(lang.code) &&
    isValidProficiencyLevel(lang.level)
  );
}

