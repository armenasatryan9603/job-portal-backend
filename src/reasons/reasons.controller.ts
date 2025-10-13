import { Controller, Get, Param } from '@nestjs/common';
import { ReasonsService } from './reasons.service';

@Controller('reasons')
export class ReasonsController {
  constructor(private readonly reasonsService: ReasonsService) {}

  @Get()
  async findAll() {
    return this.reasonsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.reasonsService.findOne(+id);
  }

  @Get('code/:code')
  async findByCode(@Param('code') code: string) {
    return this.reasonsService.findByCode(code);
  }
}
