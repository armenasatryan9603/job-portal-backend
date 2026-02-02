import { IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

import { Type } from 'class-transformer';

export class AddCardDto {
  @IsString()
  @Length(4, 4, { message: 'last4 must be exactly 4 digits' })
  @Matches(/^\d{4}$/, { message: 'last4 must be 4 digits' })
  last4: string;

  @IsString()
  @Matches(/^(visa|mastercard|amex|discover|unknown)$/, {
    message: 'brand must be visa, mastercard, amex, discover, or unknown',
  })
  brand: string;

  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'expMonth must be between 1 and 12' })
  @Max(12, { message: 'expMonth must be between 1 and 12' })
  expMonth: number;

  @Type(() => Number)
  @IsInt()
  @Min(2020, { message: 'expYear must be a valid year' })
  @Max(2100, { message: 'expYear must be a valid year' })
  expYear: number;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  holderName?: string;
}
