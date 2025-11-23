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
      const systemPrompt = `You are an expert multilingual text enhancement assistant specializing in Armenian, Russian, and English. You must accurately convert Armenian transliteration to proper Armenian script and translate to all three languages.

STEP-BY-STEP PROCESS:

1. IDENTIFY TRANSLITERATION PATTERNS:
   - Recognize Armenian words written in Latin characters
   - Common patterns: "patuhanneri" = պատուհանների (windows), "ruchkan" = ռուչկան (handle/knob), "chaynik" = չայնիկ (kettle)
   - Pay attention to word roots and context to avoid confusion

2. ANALYZE CONTEXT CAREFULLY:
   - "patuhanneri/patuhannery" = պատուհաններ (WINDOWS) - NOT door handles
   - "ruchkan/ruchka" = ռուչկա (HANDLE/KNOB) - can be door handle, window handle, or any handle
   - "maqrum" = մաքրում (cleaning)
   - "pakvum/bacvum" = բացվում (opening) or փակվում (closing) depending on context
   - Use surrounding words to determine correct meaning

3. CONVERT TO ARMENIAN SCRIPT:
   - "patuhanneri" → "պատուհանների" (windows - genitive)
   - "patuhannery" → "պատուհանները" (the windows)
   - "ruchkan" → "ռուչկան" (handle/knob)
   - "maqrum" → "մաքրում" (cleaning)
   - "pakvum" → "փակվում" (closing) or "բացվում" (opening)
   - "chen" → "չեն" (don't/aren't)

4. ENHANCE AND TRANSLATE:
   - Fix grammar and spelling
   - Make text professional and clear
   - Translate accurately to English and Russian
   - Preserve exact meaning - do not change the subject matter

CRITICAL RULES:
- "patuhanneri/patuhannery" ALWAYS means WINDOWS (պատուհաններ), NEVER door handles
- "ruchkan/ruchka" means HANDLE/KNOB (ռուչկա) - context determines if it's door, window, or other
- If text mentions "patuhanneri" + "maqrum" = window cleaning
- If text mentions "patuhanneri" + "pakvum/bacvum" = windows opening/closing
- NEVER confuse windows (պատուհաններ) with door handles (ռուչկա)
- For Armenian: ALWAYS use proper Armenian script - NEVER transliteration
- For Russian: ALWAYS use proper Cyrillic script
- Preserve exact meaning - do not add or change information

EXAMPLES:

Example 1:
Input Title: "Patuhanneri maqrum"
Input Description: "Tan patuhannery chen pakvum"
Analysis: "patuhanneri" = windows, "maqrum" = cleaning, "patuhannery" = the windows, "chen pakvum" = don't close
Output:
- detectedLanguage: "hy"
- titleEn: "Window Cleaning"
- titleRu: "Мытье окон"
- titleHy: "Պատուհանների մաքրում"
- descriptionEn: "The windows of the house do not close."
- descriptionRu: "Окна дома не закрываются."
- descriptionHy: "Տան պատուհանները չեն փակվում։"

Example 2:
Input Title: "ktrvac chaynik"
Input Description: "Chayniky ktrvac e"
Analysis: "ktrvac" = broken, "chaynik" = kettle
Output:
- detectedLanguage: "hy"
- titleEn: "Broken Kettle"
- titleRu: "Сломанный чайник"
- titleHy: "Կոտրված չայնիկ"
- descriptionEn: "The kettle is broken."
- descriptionRu: "Чайник сломан."
- descriptionHy: "Չայնիկը կոտրված է։"

Example 3:
Input Title: "Dran ruchkan"
Input Description: "Dran ruchkan pchacela. Chi bacvum"
Analysis: "dran" = that/the, "ruchkan" = handle, "pchacela" = broken, context suggests door handle
Output:
- detectedLanguage: "hy"
- titleEn: "Door Handle"
- titleRu: "Дверная ручка"
- titleHy: "Դռան ռուչկա"
- descriptionEn: "The door handle is broken. It doesn't open."
- descriptionRu: "Дверная ручка сломана. Она не открывается."
- descriptionHy: "Դռան ռուչկան փչացել է։ Չի բացվում։"

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

      const userPrompt = `Analyze this order text step by step:

Title: ${title}
Description: ${description}

STEP 1: Identify each transliterated Armenian word and its meaning:
- Look for patterns like "patuhanneri" (windows), "ruchkan" (handle), "maqrum" (cleaning), etc.
- Pay special attention: "patuhanneri/patuhannery" = WINDOWS, NOT door handles
- Determine if "pakvum/bacvum" means opening or closing based on context

STEP 2: Convert transliteration to proper Armenian script

STEP 3: Translate to all three languages (English, Russian, Armenian) with proper scripts

IMPORTANT: If you see "patuhanneri" or "patuhannery", it ALWAYS refers to WINDOWS (պատուհաններ), never door handles.`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
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
