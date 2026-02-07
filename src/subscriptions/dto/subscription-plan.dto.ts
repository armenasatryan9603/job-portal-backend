import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsObject,
} from "class-validator";

export class CreateSubscriptionPlanDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsString()
  nameRu?: string;

  @IsOptional()
  @IsString()
  nameHy?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @IsOptional()
  @IsString()
  descriptionRu?: string;

  @IsOptional()
  @IsString()
  descriptionHy?: string;

  @IsNumber()
  price: number;

  @IsOptional()
  @IsNumber()
  oldPrice?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsNumber()
  durationDays: number;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsObject()
  features?: any;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSubscriptionPlanDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsString()
  nameRu?: string;

  @IsOptional()
  @IsString()
  nameHy?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @IsOptional()
  @IsString()
  descriptionRu?: string;

  @IsOptional()
  @IsString()
  descriptionHy?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsNumber()
  oldPrice?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsNumber()
  durationDays?: number;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsObject()
  features?: any;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
