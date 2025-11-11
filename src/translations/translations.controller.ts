import { Controller, Get, Param, BadRequestException } from '@nestjs/common';
import { TranslationsService } from './translations.service';

@Controller('translations')
export class TranslationsController {
  constructor(private readonly translationsService: TranslationsService) {}

  /**
   * Get translations for a specific language
   * GET /translations/:language
   */
  @Get(':language')
  async getTranslations(@Param('language') language: string) {
    console.log(`🌐 [BACKEND] GET /translations/${language} - Request received`);
    
    if (!this.translationsService.isLanguageSupported(language)) {
      console.error(`❌ [BACKEND] Invalid language requested: ${language}`);
      throw new BadRequestException(`Language ${language} is not supported`);
    }

    try {
      const startTime = Date.now();
      const translations = await this.translationsService.getTranslations(language);
      const duration = Date.now() - startTime;
      const keyCount = Object.keys(translations).length;
      
      console.log(`✅ [BACKEND] GET /translations/${language} - Served ${keyCount} translations in ${duration}ms`);
      
      return {
        success: true,
        language,
        translations,
      };
    } catch (error) {
      console.error(`❌ [BACKEND] GET /translations/${language} - Error:`, error);
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to load translations'
      );
    }
  }

  /**
   * Get available languages
   * GET /translations
   */
  @Get()
  getAvailableLanguages() {
    console.log(`🌐 [BACKEND] GET /translations - Available languages requested`);
    const languages = this.translationsService.getAvailableLanguages();
    console.log(`✅ [BACKEND] GET /translations - Returning languages: ${languages.join(', ')}`);
    return {
      success: true,
      languages,
    };
  }
}

