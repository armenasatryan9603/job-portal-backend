import { IsNumber, IsOptional, IsBoolean } from "class-validator";

export class PurchaseSubscriptionDto {
  @IsNumber()
  planId: number;
  
  // Note: autoRenew is deprecated - subscriptions require manual renewal
  // Kept for backward compatibility but ignored
  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;
}

export class CancelSubscriptionDto {
  @IsNumber()
  subscriptionId: number;
}
