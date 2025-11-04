import * as crypto from 'crypto';

interface CoinbaseCredentials {
	apiKey: string;
	privateKey: string;
}

interface BuildCdpJwtParams {
	apiKeyId: string;
	apiKeySecret: string;
	method: string;
	host: string;
	path: string;
}

function createCoinbaseJWT(credentials: CoinbaseCredentials, requestMethod: string, requestPath: string): string {
	const { apiKey, privateKey } = credentials;

	const pemKey = privateKey
		.replace(/\\n/g, '\n')
		.trim();

	const keyName = apiKey;

	const header = {
		alg: 'ES256',
		kid: keyName,
		typ: 'JWT',
		nonce: crypto.randomBytes(16).toString('hex')
	};

	const now = Math.floor(Date.now() / 1000);
	const payload = {
		sub: keyName,
		iss: 'coinbase-cloud',
		nbf: now,
		exp: now + 120, // 2 minutes expiration
		aud: ['cdp_service'],
		uri: `${requestMethod} api.cdp.coinbase.com${requestPath}`
	};

	const base64UrlEncode = (obj: any): string => {
		return Buffer.from(JSON.stringify(obj))
			.toString('base64')
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=/g, '');
	};

	const encodedHeader = base64UrlEncode(header);
	const encodedPayload = base64UrlEncode(payload);

	const message = `${encodedHeader}.${encodedPayload}`;

	const sign = crypto.createSign('SHA256');
	sign.update(message);
	sign.end();

	const signature = sign.sign(pemKey);

	const derSignature = signature;

	let offset = 0;

	if (derSignature[offset] === 0x30) {
		offset += 2;
	}

	if (derSignature[offset] === 0x02) {
		offset += 1;
		const rLength = derSignature[offset];
		offset += 1;
		const r = derSignature.slice(offset, offset + rLength);
		offset += rLength;

		if (derSignature[offset] === 0x02) {
			offset += 1;
			const sLength = derSignature[offset];
			offset += 1;
			const s = derSignature.slice(offset, offset + sLength);

			const rPadded = r.length > 32 ? r.slice(r.length - 32) : Buffer.concat([Buffer.alloc(32 - r.length), r]);
			const sPadded = s.length > 32 ? s.slice(s.length - 32) : Buffer.concat([Buffer.alloc(32 - s.length), s]);

			const rawSignature = Buffer.concat([rPadded, sPadded]);

			const encodedSignature = rawSignature
				.toString('base64')
				.replace(/\+/g, '-')
				.replace(/\//g, '_')
				.replace(/=/g, '');

			return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
		}
	}

	throw new Error('Failed to parse signature');
}

export async function buildCdpJwtAsync(params: BuildCdpJwtParams): Promise<string> {
	const { apiKeyId, apiKeySecret, method, path } = params;

	return createCoinbaseJWT(
		{ apiKey: apiKeyId, privateKey: apiKeySecret },
		method,
		path
	);
}
