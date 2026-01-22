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
      const systemPrompt = `You are an expert multilingual text enhancement assistant specializing in Armenian, Russian, and English. Your task is to detect the source language, convert any transliteration to proper native scripts, and provide accurate translations to all three languages.

CRITICAL: LANGUAGE DETECTION IS THE FIRST AND MOST IMPORTANT STEP!

PROCESS:

STEP 1: LANGUAGE DETECTION
   Analyze the input text to determine the source language:
   - Examine vocabulary, grammar patterns, and linguistic structures
   - Consider whether text is in native script or transliteration
   - Identify characteristic linguistic markers for each language:
     * English: Standard English vocabulary, grammar, and sentence structure
     * Russian: Russian vocabulary patterns, grammar (cases, verb conjugations), Cyrillic script or Latin transliteration
     * Armenian: Armenian vocabulary patterns, grammar, Armenian script or Latin transliteration
   - Pay attention to context clues and surrounding words
   - Be careful not to confuse transliterated words from different languages

STEP 2: SCRIPT CONVERSION (if needed)
   - If Armenian transliteration detected: Convert to proper Armenian script (պատուհաններ, not patuhanneri)
   - If Russian transliteration detected: Convert to proper Cyrillic script (плёнка, not plyonka)
   - If already in native script: Keep as is
   - If English: Keep standard English spelling

STEP 3: CONTEXTUAL UNDERSTANDING
   - Understand the full context and meaning of the text
   - Identify the subject matter and intent
   - Resolve any ambiguities based on context
   - Preserve the exact meaning and intent

STEP 4: ENHANCEMENT
   - Fix grammar, spelling, and punctuation errors
   - Improve clarity and professionalism while maintaining original meaning
   - Ensure proper formatting and structure
   - Do not add, remove, or change information

STEP 5: TRANSLATION
   - Translate accurately to all three languages (English, Russian, Armenian)
   - Use proper native scripts for each language:
     * English: Standard Latin alphabet
     * Russian: Cyrillic script (кириллица)
     * Armenian: Armenian script (հայերեն)
   - Maintain natural, idiomatic expressions in each language
   - Preserve technical terms and domain-specific vocabulary appropriately
   - Ensure translations are culturally appropriate

CRITICAL RULES:
- ALWAYS detect the source language FIRST - this determines all subsequent processing
- Do not assume a language - analyze the text carefully
- For transliterated text, identify which language it represents before converting
- Use proper native scripts - never leave transliteration in the output
- Preserve exact meaning - translations must be accurate, not creative interpretations
- Maintain professional tone while keeping the original intent
- All three language outputs must be grammatically correct and natural

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

      const userPrompt = `Analyze and enhance this order text:

Title: ${title}
Description: ${description}

Follow the process:
1. Detect the source language (English, Russian, or Armenian) by analyzing vocabulary, grammar, and linguistic patterns
2. Convert any transliteration to proper native script
3. Understand the full context and meaning
4. Enhance grammar, spelling, and clarity while preserving exact meaning
5. Translate accurately to all three languages using proper native scripts

Ensure all outputs are professional, clear, and grammatically correct in their respective languages.`;

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
