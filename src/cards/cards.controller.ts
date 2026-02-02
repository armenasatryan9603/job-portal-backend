import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  Param,
  Request,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CardsService } from './cards.service';
import { AddCardDto } from './dto/add-card.dto';

@Controller('cards')
@UseGuards(JwtAuthGuard)
export class CardsController {
  constructor(private cardsService: CardsService) {}

  @Post()
  async addCard(@Request() req: { user: { userId: number } }, @Body() body: AddCardDto) {
    return this.cardsService.addCard(req.user.userId, body);
  }

  @Get()
  async listCards(@Request() req: { user: { userId: number } }) {
    return this.cardsService.listCards(req.user.userId);
  }

  @Delete(':id')
  async removeCard(
    @Request() req: { user: { userId: number } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.cardsService.removeCard(req.user.userId, id);
  }

  @Patch(':id/default')
  async setDefaultCard(
    @Request() req: { user: { userId: number } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.cardsService.setDefaultCard(req.user.userId, id);
  }
}
