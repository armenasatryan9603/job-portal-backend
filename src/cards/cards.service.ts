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
    const cards = await this.prisma.card.findMany({
      where: { userId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return cards.map((c) => this.toResponse(c));
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

  private toResponse(card: {
    id: number;
    userId: number;
    paymentMethodId: string;
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
    holderName: string | null;
    bindingId?: string | null;
    cardHolderId?: string | null;
    isDefault: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: String(card.id),
      paymentMethodId: card.paymentMethodId,
      cardNumber: `****${card.last4}`,
      last4: card.last4,
      brand: card.brand,
      expMonth: card.expMonth,
      expYear: card.expYear,
      expiryMonth: String(card.expMonth).padStart(2, '0'),
      expiryYear: String(card.expYear),
      cardholderName: card.holderName ?? '',
      cardType: card.brand,
      bindingId: (card.bindingId ?? null) || undefined,
      isDefault: card.isDefault,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
    };
  }
}
