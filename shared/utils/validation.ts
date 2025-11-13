import { NodeOperationError, INode } from 'n8n-workflow';
import { decode as base58Decode } from './base58';

export function validateEmail(email: string, context: unknown, itemIndex: number): void {
	if (!email || email.trim() === '') {
		throw new NodeOperationError((context as { getNode: () => INode }).getNode(), 'Email is required', {
			itemIndex,
		});
	}
	
	if (email.indexOf('@') === -1) {
		throw new NodeOperationError((context as { getNode: () => INode }).getNode(), 'Invalid email address', {
			description: `The email address '${email}' is not valid`,
			itemIndex,
		});
	}
}

export function validateAmount(amount: string, context: unknown, itemIndex: number): number {
	const amountStr = String(amount).trim();
	if (!amount || amountStr === '') {
		throw new NodeOperationError((context as { getNode: () => INode }).getNode(), 'Amount is required', {
			description: 'Please specify the amount of tokens to transfer',
			itemIndex,
		});
	}

	const numericAmount = parseFloat(amountStr);
	if (isNaN(numericAmount) || numericAmount <= 0) {
		throw new NodeOperationError((context as { getNode: () => INode }).getNode(), 'Invalid amount', {
			description: `The amount '${amountStr}' is not a valid positive number`,
			itemIndex,
		});
	}

	return numericAmount;
}

export function validateRequiredField(value: string, fieldName: string, context: unknown, itemIndex: number): void {
	if (!value || value.trim() === '') {
		throw new NodeOperationError((context as { getNode: () => INode }).getNode(), `${fieldName} is required`, {
			description: `Please specify the ${fieldName.toLowerCase()}`,
			itemIndex,
		});
	}
}

export function validatePrivateKey(privateKey: string, context: unknown, itemIndex: number): void {
	if (!privateKey || privateKey.trim() === '') {
		throw new NodeOperationError((context as { getNode: () => INode }).getNode(), 'Private key is required', {
			itemIndex,
		});
	}

	try {
		const decoded = base58Decode(privateKey);
		if (decoded.length !== 32 && decoded.length !== 64) {
			throw new Error('Invalid key length');
		}
	} catch {
		throw new NodeOperationError((context as { getNode: () => INode }).getNode(), 'Invalid base58 private key format', {
			itemIndex,
		});
	}
}

export function validateAddressFields(fields: {
	recipientName: string;
	addressLine1: string;
	city: string;
	postalCode: string;
}, context: unknown, itemIndex: number): void {
	if (!fields.recipientName || fields.recipientName.trim() === '') {
		throw new NodeOperationError((context as { getNode: () => INode }).getNode(), 'Recipient name is required', {
			description: 'Please provide the full name of the person receiving the product',
			itemIndex,
		});
	}

	if (!fields.addressLine1 || fields.addressLine1.trim() === '') {
		throw new NodeOperationError((context as { getNode: () => INode }).getNode(), 'Address line 1 is required', {
			description: 'Please provide the street address, P.O. box, or company name',
			itemIndex,
		});
	}

	if (!fields.city || fields.city.trim() === '') {
		throw new NodeOperationError((context as { getNode: () => INode }).getNode(), 'City is required', {
			description: 'Please provide the city, district, suburb, town, or village',
			itemIndex,
		});
	}

	if (!fields.postalCode || fields.postalCode.trim() === '') {
		throw new NodeOperationError((context as { getNode: () => INode }).getNode(), 'Postal code is required', {
			description: 'Please provide the ZIP or postal code',
			itemIndex,
		});
	}
}

export function validateCountryCode(country: string, context: unknown, itemIndex: number): void {
	if (!country || country.trim() === '') {
		throw new NodeOperationError((context as { getNode: () => INode }).getNode(), 'Country code is required', {
			description: 'Please provide a two-letter ISO 3166-1 alpha-2 country code (e.g., US, GB, FR)',
			itemIndex,
		});
	}

	// ISO 3166-1 alpha-2 codes are exactly 2 uppercase letters
	const countryCodePattern = /^[A-Z]{2}$/;
	if (!countryCodePattern.test(country.trim().toUpperCase())) {
		throw new NodeOperationError((context as { getNode: () => INode }).getNode(), 'Invalid country code', {
			description: `'${country}' is not a valid ISO 3166-1 alpha-2 country code. Please use a two-letter code (e.g., US, GB, FR, DE)`,
			itemIndex,
		});
	}
}
