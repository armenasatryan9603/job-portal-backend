/**
 * User preferences stored in User.preferences JSON field
 */
export interface UserPreferences {
  language?: "en" | "ru" | "hy";
  theme?: "light" | "dark" | "auto";
  timezone?: string;
  dateFormat?: string;
  // Add more preferences as needed in the future
}

/**
 * Default user preferences
 */
export const DEFAULT_PREFERENCES: UserPreferences = {
  language: "en",
  theme: "auto",
};

