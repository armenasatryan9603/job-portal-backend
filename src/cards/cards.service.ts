import { Injectable, NotFoundException } from '@nestjs/common';

import { AddCardDto } from './dto/add-card.dto';
import { PrismaService } from '../prisma.service';
import { FastBankPaymentProvider } from '../payments/payment.provider';

@Injectable()
export class CardsService {
  private readonly paymentProvider: FastBankPaymentProvider;

  constructor(private prisma: PrismaService) {
    this.paymentProvider = new FastBankPaymentProvider();
  }

  async addCard(userId: number, dto: AddCardDto) {
    const paymentMethodId = `pm_local_${userId}_${Date.now()}`;
    const existingCount = await this.prisma.card.count({
      where: { userId, isActive: true },
    });
    const isDefault = existingCount === 0;

    // Default values from DTO
    let last4 = dto.last4;
    let expMonth = dto.expMonth;
    let expYear = dto.expYear;
    let bindingId: string | undefined;
    let cardHolderId: string | undefined;

    // If full card details are provided, attempt to create a binding with FastBank first.
    if (dto.cardNumber && dto.cvv) {
      const cleanNumber = dto.cardNumber.replace(/\s/g, '');
      if (cleanNumber.length >= 4) {
        last4 = cleanNumber.slice(-4);
      }

      try {
        const bindingResult =
          await this.paymentProvider.createCardBindingFromDetails({
            userId,
            cardNumber: cleanNumber,
            expMonth: dto.expMonth,
            expYear: dto.expYear,
            cvv: dto.cvv,
          });

        bindingId = bindingResult.bindingId;
        cardHolderId = bindingResult.cardHolderId;

        if (bindingResult.maskedPan && bindingResult.maskedPan.length >= 4) {
          last4 = bindingResult.maskedPan.slice(-4);
        }

        if (bindingResult.expDate) {
          const clean = bindingResult.expDate.replace(/\//g, '');
          if (clean.length >= 4) {
            const month = parseInt(clean.slice(0, 2), 10);
            const yearPart = parseInt(clean.slice(2, 4), 10);
            const currentYear = new Date().getFullYear();
            const currentCentury = Math.floor(currentYear / 100) * 100;
            let fullYear = yearPart + currentCentury;
            if (fullYear < currentYear) fullYear += 100;
            if (!Number.isNaN(month)) {
              expMonth = month;
            }
            if (!Number.isNaN(fullYear)) {
              expYear = fullYear;
            }
          }
        }
      } catch (error: any) {
        // If binding fails when full card details are supplied, do NOT
        // create the card in DB. Surface an error to the caller instead.
        console.error(
          '[CardsService] Failed to create FastBank binding:',
          error?.message || error,
        );
        throw new Error(
          'Failed to bind card with FastBank. Card was not saved.',
        );
      }
    }

    const card = await this.prisma.card.create({
      data: {
        userId,
        paymentMethodId,
        brand: dto.brand,
        last4,
        expMonth,
        expYear,
        holderName: dto.holderName ?? null,
        isDefault,
        isActive: true,
        bindingId,
        cardHolderId,
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
