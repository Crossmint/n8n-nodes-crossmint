import type { IPaymentPayload, PaymentRequirements } from '../../../transport/types';

export function parseXPaymentHeader(xPaymentHeader: string): IPaymentPayload {
	const decoded = Buffer.from(xPaymentHeader, 'base64').toString('utf-8');
	return JSON.parse(decoded) as IPaymentPayload;
}

export function validateXPayment(payment: IPaymentPayload): string {
	// Check if it's Solana (transaction format) or EVM (authorization format)
	const isSolana = payment.network?.toLowerCase().includes('solana');
	
	if (isSolana) {
		// Solana exact scheme: requires transaction field
		const requiredShape = {
			x402Version: 'number',
			scheme: 'string',
			network: 'string',
			payload: {
				transaction: 'string', // Base64-encoded partially-signed Solana transaction
			},
		};
		const missing = checkShape(requiredShape, payment as unknown as Record<string, unknown>, '');
		if (missing.length > 0) {
			return missing.join('; ');
		}
	} else {
		// EVM exact scheme: requires signature and authorization
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
		const missing = checkShape(requiredShape, payment as unknown as Record<string, unknown>, '');
		if (missing.length > 0) {
			return missing.join('; ');
		}
	}
	return 'valid';
}

type ExpectedShape =
	| string
	| {
			[key: string]: ExpectedShape;
	  };

export function checkShape(
	expected: Record<string, ExpectedShape>,
	actual: Record<string, unknown>,
	path: string,
): string[] {
	const missing = new Array<string>();
	for (const key in expected) {
		const currentPath = path ? path + '.' + key : key;

		if (!(key in actual)) {
			missing.push('Missing field: ' + currentPath);
		} else if (typeof expected[key] === 'object') {
			const nestedExpected = expected[key] as Record<string, ExpectedShape>;
			const nestedActual = actual[key] as Record<string, unknown> | null | undefined;

			if (typeof nestedActual !== 'object' || nestedActual === null) {
				missing.push('Invalid type at ' + currentPath + ': expected object');
			} else {
				checkShape(nestedExpected, nestedActual as Record<string, unknown>, currentPath);
			}
		} else {
			const expectedType = expected[key] as string;
			const actualValue = actual[key];

			if (typeof actualValue !== expectedType) {
				missing.push(
					'Invalid type at ' +
						currentPath +
						': expected ' +
						expectedType +
						', got ' +
						typeof actualValue,
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
	const errors: string[] = [];

	// 1. Check that network exists in config
	const network = header.network;
	console.log('[verifyPaymentDetails] Checking network:', network);
	console.log('[verifyPaymentDetails] Available networks:', paymentRequirements.map((r) => r.network));
	
	const configEntry = paymentRequirements.find(
		(pc) => pc.network.toLowerCase() == (network || '').toLowerCase(),
	);

	if (configEntry == null) {
		errors.push('Invalid or unsupported network: ' + network);
		console.log('[verifyPaymentDetails] ❌ Network not found');
	} else {
		console.log('[verifyPaymentDetails] ✅ Network found:', configEntry.network);
	}

	// 2. For Solana, transaction validation is done by facilitator
	// For EVM, validate authorization fields
	if (configEntry) {
		const isSolana = network?.toLowerCase().includes('solana');
		
		if (isSolana) {
			// For Solana, just verify transaction field exists
			// The facilitator will validate amount, destination, etc. during /settle
			const transaction = header.payload?.transaction;
			if (!transaction || typeof transaction !== 'string') {
				errors.push('Missing or invalid transaction field in payload');
				console.log('[verifyPaymentDetails] ❌ Missing transaction');
			} else {
				console.log('[verifyPaymentDetails] ✅ Transaction field present (length:', transaction.length, ')');
				console.log('[verifyPaymentDetails] Transaction validation will be done by facilitator');
			}
		} else {
			// EVM authorization-based validation
			try {
				const required = BigInt(configEntry.maxAmountRequired);
				const actual = BigInt(header.payload.authorization!.value);
				console.log('[verifyPaymentDetails] Amount check:', { required: required.toString(), actual: actual.toString() });
				if (typeof actual !== 'undefined' && actual < required) {
					errors.push(`Value too low: got ${actual}, requires at least ${required}`);
					console.log('[verifyPaymentDetails] ❌ Value too low');
				} else {
					console.log('[verifyPaymentDetails] ✅ Amount sufficient');
				}
			} catch {
				errors.push('Invalid value: must be numeric string');
				console.log('[verifyPaymentDetails] ❌ Invalid value format');
			}

			// 3. Check 'to' matches payTo (case-insensitive)
			const toAddr = header.payload?.authorization?.to;
			console.log('[verifyPaymentDetails] Address check:', { 
				expected: configEntry.payTo, 
				actual: toAddr 
			});
			if (toAddr == null) {
				errors.push("Missing 'to' field in authorization");
				console.log('[verifyPaymentDetails] ❌ Missing to address');
			} else if (toAddr.toLowerCase() != configEntry.payTo.toLowerCase()) {
				errors.push(`Invalid 'to' address: expected ${configEntry.payTo}, got ${toAddr}`);
				console.log('[verifyPaymentDetails] ❌ Address mismatch');
			} else {
				console.log('[verifyPaymentDetails] ✅ Address matches');
			}

			// 4. Check the validBefore and validAfter timestamps.
			const now = Math.floor(Date.now() / 1000);
			console.log('[verifyPaymentDetails] Timestamp check:', { now });
			try {
				const validAfter = Number(header.payload.authorization!.validAfter);
				const validBefore = Number(header.payload.authorization!.validBefore);
				console.log('[verifyPaymentDetails] Timestamps:', { validAfter, validBefore, now });

				if (validAfter > now) {
					errors.push(
						`Payment has not activated, validAfter is ${validAfter} but the server time is ${now}`,
					);
					console.log('[verifyPaymentDetails] ❌ Payment not yet valid');
				} else {
					console.log('[verifyPaymentDetails] ✅ Payment is valid (validAfter check)');
				}
				if (validBefore < now) {
					errors.push(
						`Payment has expired, validBefore is ${validBefore} but the server time is ${now}`,
					);
					console.log('[verifyPaymentDetails] ❌ Payment expired');
				} else {
					console.log('[verifyPaymentDetails] ✅ Payment not expired');
				}
			} catch {
				errors.push(`Invalid validAfter or validBefore timestamps`);
				console.log('[verifyPaymentDetails] ❌ Invalid timestamp format');
			}
		}
	}

	console.log('[verifyPaymentDetails] Final result:', { 
		valid: errors.length == 0, 
		errors: errors.length > 0 ? errors.join('; ') : 'none' 
	});

	return {
		valid: errors.length == 0,
		errors: errors.join('; '),
		paymentRequirements: configEntry,
	};
}

