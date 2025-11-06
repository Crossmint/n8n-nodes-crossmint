import type { IPaymentPayload, PaymentRequirements } from '../types/x402Types';

export interface IFacilitator {
	verifyPayment(
		paymentPayload: IPaymentPayload,
		paymentRequirements: PaymentRequirements,
	): Promise<{ isValid: boolean; invalidReason?: string }>;

	settlePayment(
		paymentPayload: IPaymentPayload,
		paymentRequirements: PaymentRequirements,
	): Promise<{ success: boolean; txHash?: string; error?: string }>;
}
