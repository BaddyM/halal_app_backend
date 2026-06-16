import { IsIn, IsOptional, IsString } from 'class-validator';

export type BillingProvider = 'stripe' | 'apple' | 'google' | 'manual';
const PROVIDERS = ['stripe', 'apple', 'google', 'manual'];

export class CheckoutDto {
  @IsString() planId!: string;
  @IsIn(PROVIDERS) provider!: BillingProvider;
}

export class VerifyReceiptDto {
  @IsIn(PROVIDERS) provider!: BillingProvider;
  @IsString() planId!: string;
  // Apple/Google receipt or Stripe session id to validate against the provider.
  @IsOptional() @IsString() receipt?: string;
}
