import { Controller, Get, Query } from "@nestjs/common";
import { TopDataService } from "./top-data.service";

@Controller("top-data")
export class TopDataController {
  constructor(private readonly topDataService: TopDataService) {}

  @Get()
  findAll(@Query("country") country?: string) {
    return this.topDataService.findAll(country);
  }
}
