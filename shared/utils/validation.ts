import { NodeOperationError } from 'n8n-workflow';

export function validateEmail(email: string, context: any, itemIndex: number): void {
	if (!email || email.trim() === '') {
		throw new NodeOperationError(context.getNode(), 'Email is required', {
			itemIndex,
		});
	}
	
	if (email.indexOf('@') === -1) {
		throw new NodeOperationError(context.getNode(), 'Invalid email address', {
			description: `The email address '${email}' is not valid`,
			itemIndex,
		});
	}
}

export function validateAmount(amount: string, context: any, itemIndex: number): number {
	const amountStr = String(amount).trim();
	if (!amount || amountStr === '') {
		throw new NodeOperationError(context.getNode(), 'Amount is required', {
			description: 'Please specify the amount of tokens to transfer',
			itemIndex,
		});
	}

	const numericAmount = parseFloat(amountStr);
	if (isNaN(numericAmount) || numericAmount <= 0) {
		throw new NodeOperationError(context.getNode(), 'Invalid amount', {
			description: `The amount '${amountStr}' is not a valid positive number`,
			itemIndex,
		});
	}

	return numericAmount;
}

export function validateRequiredField(value: string, fieldName: string, context: any, itemIndex: number): void {
	if (!value || value.trim() === '') {
		throw new NodeOperationError(context.getNode(), `${fieldName} is required`, {
			description: `Please specify the ${fieldName.toLowerCase()}`,
			itemIndex,
		});
	}
}

export function validatePrivateKey(privateKey: string, chainType: string, context: any, itemIndex: number): void {
	if (!privateKey || privateKey.trim() === '') {
		throw new NodeOperationError(context.getNode(), 'Private key is required', {
			itemIndex,
		});
	}

	if (chainType === 'solana') {
		if (!(privateKey.length >= 80 && privateKey.length <= 90)) {
			throw new NodeOperationError(context.getNode(), 'Invalid Solana private key format. Use base58 encoded key', {
				itemIndex,
			});
		}
	} else {
		if (!(privateKey.startsWith('0x') || (privateKey.length === 64 && /^[a-fA-F0-9]+$/.test(privateKey)))) {
			throw new NodeOperationError(context.getNode(), 'Invalid EVM private key format. Use 32-byte hex string', {
				itemIndex,
			});
		}
	}
}

export function validateAddressFields(fields: {
	recipientName: string;
	addressLine1: string;
	city: string;
	postalCode: string;
}, context: any, itemIndex: number): void {
	if (!fields.recipientName || fields.recipientName.trim() === '') {
		throw new NodeOperationError(context.getNode(), 'Recipient name is required', {
			description: 'Please provide the full name of the person receiving the product',
			itemIndex,
		});
	}

	if (!fields.addressLine1 || fields.addressLine1.trim() === '') {
		throw new NodeOperationError(context.getNode(), 'Address line 1 is required', {
			description: 'Please provide the street address, P.O. box, or company name',
			itemIndex,
		});
	}

	if (!fields.city || fields.city.trim() === '') {
		throw new NodeOperationError(context.getNode(), 'City is required', {
			description: 'Please provide the city, district, suburb, town, or village',
			itemIndex,
		});
	}

	if (!fields.postalCode || fields.postalCode.trim() === '') {
		throw new NodeOperationError(context.getNode(), 'Postal code is required', {
			description: 'Please provide the ZIP or postal code',
			itemIndex,
		});
	}
}
