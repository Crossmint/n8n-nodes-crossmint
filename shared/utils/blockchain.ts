import { NodeOperationError, INode } from 'n8n-workflow';
import { ChainFactory } from '../chains/ChainFactory';

export interface KeyPairResult {
	address: string;
	publicKey: string;
	chainType: string;
}

export function deriveKeyPair(privateKeyStr: string, context: unknown, itemIndex: number, chainType: string = 'solana'): KeyPairResult {
	const provider = ChainFactory.createProvider(chainType);

	if (!provider) {
		throw new NodeOperationError(
			(context as { getNode: () => INode }).getNode(),
			`Unsupported chain type: ${chainType}`,
			{ itemIndex }
		);
	}

	// Validate private key using the chain provider
	const validation = provider.validatePrivateKey(privateKeyStr);
	if (!validation.valid) {
		throw new NodeOperationError(
			(context as { getNode: () => INode }).getNode(),
			validation.error || 'Invalid private key format',
			{ itemIndex }
		);
	}

	try {
		// Get address from private key using the chain provider
		const address = provider.getAddressFromPrivateKey(privateKeyStr);

		return {
			address,
			publicKey: address,
			chainType,
		};
	} catch (error: unknown) {
		throw new NodeOperationError(
			(context as { getNode: () => INode }).getNode(),
			`Failed to process private key: ${(error as Error).message}`,
			{ itemIndex }
		);
	}
}

export async function signMessage(
	message: string,
	privateKey: string,
	context: unknown,
	itemIndex: number,
	chainType: string = 'solana'
): Promise<string> {
	const provider = ChainFactory.createProvider(chainType);

	if (!provider) {
		throw new NodeOperationError(
			(context as { getNode: () => INode }).getNode(),
			`Unsupported chain type: ${chainType}`,
			{ itemIndex }
		);
	}

	try {
		const result = await provider.signTransaction({ message }, privateKey);
		return result.signature;
	} catch (error: unknown) {
		throw new NodeOperationError(
			(context as { getNode: () => INode }).getNode(),
			`Failed to sign message: ${(error as Error).message}`,
			{ itemIndex }
		);
	}
}
