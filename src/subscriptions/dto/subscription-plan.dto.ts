export class CreateSubscriptionPlanDto {
  name: string;
  nameEn?: string;
  nameRu?: string;
  nameHy?: string;
  description?: string;
  descriptionEn?: string;
  descriptionRu?: string;
  descriptionHy?: string;
  price: number;
  currency?: string;
  durationDays: number;
  isRecurring?: boolean;
  features?: any;
  isActive?: boolean;
}

export class UpdateSubscriptionPlanDto {
  name?: string;
  nameEn?: string;
  nameRu?: string;
  nameHy?: string;
  description?: string;
  descriptionEn?: string;
  descriptionRu?: string;
  descriptionHy?: string;
  price?: number;
  currency?: string;
  durationDays?: number;
  isRecurring?: boolean;
  features?: any;
  isActive?: boolean;
}
