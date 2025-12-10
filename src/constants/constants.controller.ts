import { Controller, Get, Query } from "@nestjs/common";
import { ConstantsService } from "./constants.service";

@Controller("constants")
export class ConstantsController {
  constructor(private readonly constantsService: ConstantsService) {}

  /**
   * Get rate unit options
   * GET /constants/rate-units
   */
  @Get("rate-units")
  getRateUnits() {
    const rateUnits = this.constantsService.getRateUnits();
    return {
      success: true,
      rateUnits,
    };
  }

  /**
   * Get rate unit label in a specific language
   * GET /constants/rate-unit-label?value=per_project&language=en
   */
  @Get("rate-unit-label")
  getRateUnitLabel(
    @Query("value") value: string,
    @Query("language") language: "en" | "ru" | "hy" = "en"
  ) {
    const label = this.constantsService.getRateUnitLabel(value, language);
    return {
      success: true,
      value,
      language,
      label,
    };
  }
}
