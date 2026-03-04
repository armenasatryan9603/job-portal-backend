import { Controller, Get } from "@nestjs/common";
import { TopDataService } from "./top-data.service";

@Controller("top-data")
export class TopDataController {
  constructor(private readonly topDataService: TopDataService) {}

  @Get()
  findAll() {
    return this.topDataService.findAll();
  }
}
