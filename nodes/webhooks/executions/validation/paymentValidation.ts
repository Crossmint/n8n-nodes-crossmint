import type { IPaymentPayload, PaymentRequirements } from '../types/x402Types';

export function parseXPaymentHeader(xPaymentHeader: string): IPaymentPayload {
	const decoded = Buffer.from(xPaymentHeader, 'base64').toString('utf-8');
	return JSON.parse(decoded) as IPaymentPayload;
}

export function validateXPayment(payment: IPaymentPayload): string {
	// Define the expected structure for EVM exact scheme (EIP-3009)
	const requiredShape = {
		x402Version: 'number',
		scheme: 'string',
		network: 'string',
		payload: {
			signature: 'string',
			authorization: {
				from: 'string',
				to: 'string',
				value: 'string',
				validAfter: 'string',
				validBefore: 'string',
				nonce: 'string',
			},
		},
	};

	const missing = checkShape(requiredShape, payment, '');

	if (missing.length > 0) {
		return missing.join('; ');
	}
	return 'valid';
}

export function checkShape(
	expected: Record<string, any>,
	actual: Record<string, any>,
	path: string,
): string[] {
	const missing = new Array<string>();
	for (const key in expected) {
		const currentPath = path ? path + '.' + key : key;

		if (!(key in actual)) {
			missing.push('Missing field: ' + currentPath);
		} else if (typeof expected[key] === 'object') {
			if (typeof actual[key] !== 'object' || actual[key] === null) {
				missing.push('Invalid type at ' + currentPath + ': expected object');
			} else {
				checkShape(expected[key], actual[key], currentPath);
			}
		} else {
			if (typeof actual[key] !== expected[key]) {
				missing.push(
					'Invalid type at ' +
						currentPath +
						': expected ' +
						expected[key] +
						', got ' +
						typeof actual[key],
				);
			}
		}
	}
	return missing;
}

/**
 * This function ensures the x-payment header is for one of our supported
 * networks, is for the correct amount, and pays the right address
 */
export function verifyPaymentDetails(
	header: IPaymentPayload,
	paymentRequirements: PaymentRequirements[],
): { valid: boolean; errors: string; paymentRequirements: PaymentRequirements | undefined } {
	const errors = [];

	// 1. Check that network exists in config
	const network = header.network;
	const configEntry = paymentRequirements.find(
		(pc) => pc.network.toLowerCase() == (network || '').toLowerCase(),
	);

	if (configEntry == null) {
		errors.push('Invalid or unsupported network: ' + network);
	}

	// 2. Check value >= maxAmountRequired
	if (configEntry) {
		try {
			const required = BigInt(configEntry.maxAmountRequired);
			const actual = BigInt(header.payload.authorization.value);
			if (typeof actual !== 'undefined' && actual < required) {
				errors.push(`Value too low: got ${actual}, requires at least ${required}`);
			}
		} catch (e) {
			errors.push('Invalid value: must be numeric string');
		}

		// 3. Check 'to' matches payTo (case-insensitive)
		const toAddr = header.payload?.authorization?.to;
		if (toAddr == null) {
			errors.push("Missing 'to' field in authorization");
		} else if (toAddr.toLowerCase() != configEntry.payTo.toLowerCase()) {
			errors.push(`Invalid 'to' address: expected ${configEntry.payTo}, got ${toAddr}`);
		}

		// 4. Check the validBefore and validAfter timestamps.
		const now = Math.floor(Date.now() / 1000);
		try {
			const validAfter = Number(header.payload.authorization.validAfter);
			const validBefore = Number(header.payload.authorization.validBefore);

			if (validAfter > now) {
				errors.push(
					`Payment has not activated, validAfter is ${validAfter} but the server time is ${now}`,
				);
			}
			if (validBefore < now) {
				errors.push(
					`Payment has expired, validBefore is ${validBefore} but the server time is ${now}`,
				);
			}
		} catch (e) {
			errors.push(`Invalid validAfter or validBefore timestamps`);
		}
	}

	return {
		valid: errors.length == 0,
		errors: errors.join('; '),
		paymentRequirements: configEntry,
	};
}

