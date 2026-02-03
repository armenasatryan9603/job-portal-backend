import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { AddCardDto } from './dto/add-card.dto';
import { PrismaService } from '../prisma.service';

@Injectable()
export class CardsService {
  constructor(private prisma: PrismaService) {}

  async addCard(userId: number, dto: AddCardDto) {
    const paymentMethodId = `pm_local_${userId}_${Date.now()}`;
    const existingCount = await this.prisma.card.count({
      where: { userId, isActive: true },
    });
    const isDefault = existingCount === 0;

    const card = await this.prisma.card.create({
      data: {
        userId,
        paymentMethodId,
        brand: dto.brand,
        last4: dto.last4,
        expMonth: dto.expMonth,
        expYear: dto.expYear,
        holderName: dto.holderName ?? null,
        isDefault,
        isActive: true,
        // bindingId and cardHolderId will be null by default (nullable fields)
      },
    });

    return this.toResponse(card);
  }

  async listCards(userId: number) {
    try {
      const cards = await this.prisma.card.findMany({
        where: { userId, isActive: true },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });
      
      console.log(`[CardsService] Found ${cards.length} cards for user ${userId}`);
      
      const result = cards.map((c: any) => {
        try {
          return this.toResponse(c);
        } catch (mapError: any) {
          console.error(`[CardsService] Error mapping card ${c?.id}:`, mapError);
          console.error(`[CardsService] Card data:`, JSON.stringify(c, null, 2));
          throw new Error(`Failed to map card ${c?.id}: ${mapError.message}`);
        }
      });
      
      return result;
    } catch (error: any) {
      console.error('[CardsService] Error in listCards:', error);
      console.error('[CardsService] Error name:', error?.name);
      console.error('[CardsService] Error message:', error?.message);
      console.error('[CardsService] Error stack:', error?.stack);
      console.error('[CardsService] Error code:', error?.code);
      
      // Re-throw with more context
      const errorMessage = error?.message || 'Unknown error occurred';
      const enhancedError = new Error(`Failed to list cards: ${errorMessage}`);
      (enhancedError as any).originalError = error;
      throw enhancedError;
    }
  }

  async removeCard(userId: number, cardId: number) {
    const card = await this.prisma.card.findFirst({
      where: { id: cardId, userId },
    });
    if (!card) {
      throw new NotFoundException('Card not found');
    }
    await this.prisma.card.update({
      where: { id: cardId },
      data: { isActive: false },
    });
    const wasDefault = card.isDefault;
    if (wasDefault) {
      const next = await this.prisma.card.findFirst({
        where: { userId, isActive: true, id: { not: cardId } },
      });
      if (next) {
        await this.prisma.card.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }
    return { success: true };
  }

  async setDefaultCard(userId: number, cardId: number) {
    const card = await this.prisma.card.findFirst({
      where: { id: cardId, userId, isActive: true },
    });
    if (!card) {
      throw new NotFoundException('Card not found');
    }
    await this.prisma.$transaction([
      this.prisma.card.updateMany({
        where: { userId },
        data: { isDefault: false },
      }),
      this.prisma.card.update({
        where: { id: cardId },
        data: { isDefault: true },
      }),
    ]);
    return this.toResponse({ ...card, isDefault: true });
  }

  private toResponse(card: any) {
    if (!card) {
      throw new Error('Card data is null or undefined');
    }
    
    try {
      // Safely extract bindingId with fallback
      const bindingId = card.bindingId;
      const hasValidBindingId = bindingId && typeof bindingId === 'string' && bindingId.trim().length > 0;
      
      return {
        id: String(card.id),
        paymentMethodId: card.paymentMethodId || '',
        cardNumber: `****${card.last4 || ''}`,
        last4: card.last4 || '',
        brand: card.brand || 'unknown',
        expMonth: card.expMonth || 0,
        expYear: card.expYear || 0,
        expiryMonth: String(card.expMonth || 0).padStart(2, '0'),
        expiryYear: String(card.expYear || 0),
        cardholderName: card.holderName ?? '',
        cardType: card.brand || 'unknown',
        // Return bindingId as-is if it exists and is a non-empty string, otherwise undefined
        bindingId: hasValidBindingId ? bindingId : undefined,
        isDefault: card.isDefault ?? false,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
      };
    } catch (error: any) {
      console.error('[CardsService] Error in toResponse:', error);
      console.error('[CardsService] Card object:', JSON.stringify(card, null, 2));
      throw new Error(`Failed to convert card to response: ${error.message}`);
    }
  }
}
