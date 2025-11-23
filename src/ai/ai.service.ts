import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import OpenAI from "openai";

export interface EnhancedOrderText {
  titleEn: string;
  titleRu: string;
  titleHy: string;
  descriptionEn: string;
  descriptionRu: string;
  descriptionHy: string;
  detectedLanguage: string;
}

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private openai: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      this.logger.warn(
        "OPENAI_API_KEY not found in environment variables. AI enhancement will not work."
      );
    } else {
      this.openai = new OpenAI({
        apiKey: apiKey,
      });
    }
  }

  /**
   * Enhance order text with AI: detect language, fix transliteration, translate, and improve
   */
  async enhanceOrderText(
    title: string,
    description: string
  ): Promise<EnhancedOrderText> {
    if (!this.openai) {
      throw new BadRequestException(
        "AI service is not configured. Please set OPENAI_API_KEY environment variable."
      );
    }

    if (!title || !title.trim()) {
      throw new BadRequestException("Title is required for AI enhancement");
    }

    if (!description || !description.trim()) {
      throw new BadRequestException(
        "Description is required for AI enhancement"
      );
    }

    try {
      const systemPrompt = `You are a professional multilingual text enhancement assistant specializing in Armenian, Russian, and English. Your task is to:

1. ANALYZE the input text carefully:
   - If the text contains mixed languages (e.g., Armenian transliteration + English), identify the PRIMARY language
   - If English translation/explanation is provided alongside transliteration, use it to understand the context
   - Detect transliteration patterns (Armenian words written in Latin or Cyrillic characters)

2. ENHANCE the text:
   - Convert Armenian transliteration to proper Armenian script (e.g., "ktrvac chaynik" → "կոտրված չայնիկ", "dran ruchkan" → "դրան ռուչկան")
   - Fix grammar and spelling errors in all languages
   - If English is mixed in, integrate it naturally or use it to clarify meaning
   - Make the text professional, clear, and natural-sounding

3. TRANSLATE to all three languages:
   - English (en): Professional, clear English
   - Russian (ru): Proper Cyrillic script, natural Russian
   - Armenian (hy): Proper Armenian script (not transliterated)

CRITICAL RULES:
- If input contains both transliteration and English explanation, use the English to understand context but prioritize the transliterated text as the source
- Preserve the exact meaning - do not add information not present in the original
- For Armenian: ALWAYS use proper Armenian script (կ, ր, ա, etc.) - NEVER use transliteration
- For Russian: ALWAYS use proper Cyrillic script
- Fix obvious typos (e.g., "borken" → "broken", "dont" → "doesn't")
- Keep technical terms, brand names, and proper nouns as appropriate
- Ensure translations are natural and contextually appropriate

EXAMPLES:
Input: "ktrvac chaynik - borken kettle"
- Detected: hy (Armenian transliteration with English clarification)
- Enhanced Armenian: "կոտրված չայնիկ"
- English: "Broken kettle"
- Russian: "Сломанный чайник"

Input: "dran ruchkan pchacela. chi bacvum - the door handle is not working"
- Detected: hy (Armenian transliteration with English clarification)
- Note: "ruchka" means handle/knob, English clarifies it's a door handle
- Enhanced Armenian: "դրան ռուչկան պճածելա։ չի բացվում"
- English: "The door handle is broken. It doesn't open."
- Russian: "Ручка двери сломана. Она не открывается."

Return your response as a JSON object with this exact structure:
{
  "detectedLanguage": "en" | "ru" | "hy",
  "titleEn": "English title",
  "titleRu": "Russian title",
  "titleHy": "Armenian title",
  "descriptionEn": "English description",
  "descriptionRu": "Russian description",
  "descriptionHy": "Armenian description"
}`;

      const userPrompt = `Analyze, enhance, and translate this order text:

Title: ${title}

Description: ${description}

Carefully identify if this is:
- Pure Armenian transliteration (convert to Armenian script)
- Mixed Armenian transliteration + English (use English for context, convert transliteration to Armenian script)
- Pure English, Russian, or Armenian

Then provide enhanced versions in all three languages.`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error("No response from OpenAI");
      }

      const result = JSON.parse(responseContent) as EnhancedOrderText;

      // Validate the response structure
      if (
        !result.titleEn ||
        !result.titleRu ||
        !result.titleHy ||
        !result.descriptionEn ||
        !result.descriptionRu ||
        !result.descriptionHy
      ) {
        throw new Error("Invalid response structure from OpenAI");
      }

      this.logger.log(
        `Successfully enhanced order text. Detected language: ${result.detectedLanguage}`
      );

      return result;
    } catch (error) {
      this.logger.error("Error enhancing order text with AI:", error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to enhance order text: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Check if AI service is available
   */
  isAvailable(): boolean {
    return !!this.openai && !!process.env.OPENAI_API_KEY;
  }
}
