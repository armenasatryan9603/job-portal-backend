import { Injectable } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class TranslationsService {
  private readonly localesPath = path.join(process.cwd(), "locales");

  /**
   * Get translations for a specific language
   */
  async getTranslations(language: string): Promise<Record<string, string>> {
    const supportedLanguages = ["en", "ru", "hy"];

    if (!supportedLanguages.includes(language)) {
      console.error(`Unsupported language requested: ${language}`);
      throw new Error(`Language ${language} is not supported`);
    }

    const filePath = path.join(this.localesPath, `${language}.json`);

    try {
      if (!fs.existsSync(filePath)) {
        console.warn(`Translation file not found: ${filePath}`);
        return {};
      }

      const fileContent = fs.readFileSync(filePath, "utf-8");
      const translations = JSON.parse(fileContent);

      return translations;
    } catch (error) {
      console.error(`Error loading translations for ${language}:`, error);
      throw new Error(`Failed to load translations for ${language}`);
    }
  }

  /**
   * Get available languages
   */
  getAvailableLanguages(): string[] {
    return ["en", "ru", "hy"];
  }

  /**
   * Check if a language is supported
   */
  isLanguageSupported(language: string): boolean {
    return this.getAvailableLanguages().includes(language);
  }
}
