import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class TranslationsService {
  private readonly localesPath = path.join(process.cwd(), 'locales');

  /**
   * Get translations for a specific language
   */
  async getTranslations(language: string): Promise<Record<string, string>> {
    const supportedLanguages = ['en', 'ru', 'hy'];
    
    console.log(`📥 [BACKEND] Translation request received for language: ${language}`);
    
    if (!supportedLanguages.includes(language)) {
      console.error(`❌ [BACKEND] Unsupported language requested: ${language}`);
      throw new Error(`Language ${language} is not supported`);
    }

    const filePath = path.join(this.localesPath, `${language}.json`);
    console.log(`📂 [BACKEND] Reading translation file: ${filePath}`);

    try {
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ [BACKEND] Translation file not found: ${filePath}`);
        return {};
      }

      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const translations = JSON.parse(fileContent);
      const keyCount = Object.keys(translations).length;
      
      console.log(`✅ [BACKEND] Successfully loaded ${keyCount} translations for ${language} from ${filePath}`);
      
      return translations;
    } catch (error) {
      console.error(`❌ [BACKEND] Error loading translations for ${language}:`, error);
      throw new Error(`Failed to load translations for ${language}`);
    }
  }

  /**
   * Get available languages
   */
  getAvailableLanguages(): string[] {
    return ['en', 'ru', 'hy'];
  }

  /**
   * Check if a language is supported
   */
  isLanguageSupported(language: string): boolean {
    return this.getAvailableLanguages().includes(language);
  }
}

