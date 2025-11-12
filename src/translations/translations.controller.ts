import { Controller, Get, Param, BadRequestException } from "@nestjs/common";
import { TranslationsService } from "./translations.service";

@Controller("translations")
export class TranslationsController {
  constructor(private readonly translationsService: TranslationsService) {}

  /**
   * Get translations for a specific language
   * GET /translations/:language
   */
  @Get(":language")
  async getTranslations(@Param("language") language: string) {
    if (!this.translationsService.isLanguageSupported(language)) {
      console.error(`Invalid language requested: ${language}`);
      throw new BadRequestException(`Language ${language} is not supported`);
    }

    try {
      const translations =
        await this.translationsService.getTranslations(language);

      return {
        success: true,
        language,
        translations,
      };
    } catch (error) {
      console.error(`Error loading translations for ${language}:`, error);
      throw new BadRequestException(
        error instanceof Error ? error.message : "Failed to load translations"
      );
    }
  }

  /**
   * Get available languages
   * GET /translations
   */
  @Get()
  getAvailableLanguages() {
    const languages = this.translationsService.getAvailableLanguages();
    return {
      success: true,
      languages,
    };
  }
}
