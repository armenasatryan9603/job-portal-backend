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
  InternalServerErrorException,
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
    try {
      return await this.cardsService.listCards(req.user.userId);
    } catch (error: any) {
      console.error('[CardsController] Error listing cards:', error);
      console.error('[CardsController] Error details:', {
        message: error?.message,
        stack: error?.stack,
        code: error?.code,
        originalError: error?.originalError,
      });
      
      // Return a more descriptive error
      const errorMessage = error?.message || 'Failed to retrieve cards';
      throw new InternalServerErrorException({
        message: errorMessage,
        error: 'CARDS_FETCH_ERROR',
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      });
    }
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
