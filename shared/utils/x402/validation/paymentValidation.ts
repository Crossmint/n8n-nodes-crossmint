import type { IPaymentPayload } from '../../../transport/types';

export function parseXPaymentHeader(xPaymentHeader: string): IPaymentPayload {
	const decoded = Buffer.from(xPaymentHeader, 'base64').toString('utf-8');
	return JSON.parse(decoded) as IPaymentPayload;
}

export function validateXPayment(payment: IPaymentPayload): string {
	if (typeof payment !== 'object' || payment == null) {
		return 'Invalid payment payload';
	}

	if (typeof payment.scheme !== 'string' || payment.scheme.length === 0) {
		return 'Missing or invalid scheme';
	}
	if (typeof payment.network !== 'string' || payment.network.length === 0) {
		return 'Missing or invalid network';
	}
	if (typeof payment.payload !== 'object' || payment.payload === null) {
		return 'Missing payload';
	}

	return 'valid';
}
