import { IExecuteFunctions, NodeOperationError, NodeApiError, IDataObject } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { API_VERSIONS } from '../../utils/constants';
import { validateRequiredField, validatePrivateKey } from '../../utils/validation';
import { ApiResponse } from '../../transport/types';
import { VersionedTransaction, Keypair } from '@solana/web3.js';
import * as base58 from '../../utils/base58';

async function signVersionedTransaction(
	serializedTransaction: string,
	privateKey: string,
	context: IExecuteFunctions,
	itemIndex: number,
): Promise<{ signedTransaction: string; signature: string }> {
	try {
		// Handle both base64 and hex (0x...) formats
		let txBuffer: Uint8Array;
		if (serializedTransaction.startsWith('0x')) {
			// Hex format - remove 0x prefix and convert
			const hexString = serializedTransaction.substring(2);
			const buffer = Buffer.from(hexString, 'hex');
			txBuffer = new Uint8Array(buffer);
		} else {
			// Base64 format - convert to Uint8Array (VersionedTransaction.deserialize expects Uint8Array)
			try {
				const buffer = Buffer.from(serializedTransaction, 'base64');
				txBuffer = new Uint8Array(buffer);
			} catch (base64Error) {
				throw new NodeOperationError(
					context.getNode(),
					`Failed to decode base64 transaction: ${(base64Error as Error).message}`,
					{ itemIndex }
				);
			}
		}

		if (txBuffer.length === 0) {
			throw new NodeOperationError(
				context.getNode(),
				'Serialized transaction is empty',
				{ itemIndex }
			);
		}

		// Check minimum transaction size (VersionedTransaction needs at least a few bytes)
		if (txBuffer.length < 3) {
			throw new NodeOperationError(
				context.getNode(),
				`Serialized transaction buffer too short: ${txBuffer.length} bytes (minimum 3 required)`,
				{ itemIndex }
			);
		}
		
		let transaction: VersionedTransaction;
		try {
			// VersionedTransaction.deserialize expects Uint8Array, not Buffer
			transaction = VersionedTransaction.deserialize(txBuffer);
		} catch (deserializeError) {
			throw deserializeError;
		}

		// Decode the private key (base58, 64 bytes: seed || public key)
		const secretKeyBytes = base58.decode(privateKey);
		if (secretKeyBytes.length !== 64) {
			throw new NodeOperationError(
				context.getNode(),
				'Invalid Solana private key: must decode to 64 bytes',
				{ itemIndex }
			);
		}

		// Create Keypair from the private key
		// Solana Keypair expects the full 64-byte secret key
		const keypair = Keypair.fromSecretKey(secretKeyBytes);

		// Sign the transaction
		transaction.sign([keypair]);

		// Serialize the signed transaction
		const signedTxBuffer = transaction.serialize();
		const signedTransaction = Buffer.from(signedTxBuffer).toString('base64');

		// Extract the signature (first signature in the transaction)
		const signatures = transaction.signatures;
		if (!signatures || signatures.length === 0) {
			throw new NodeOperationError(
				context.getNode(),
				'Failed to extract signature from signed transaction',
				{ itemIndex }
			);
		}

		// Convert signature to base58 string (this is the txId)
		const signature = base58.encode(signatures[0]);

		return {
			signedTransaction,
			signature,
		};
	} catch (error: unknown) {
		throw new NodeOperationError(
			context.getNode(),
			`Failed to sign transaction: ${(error as Error).message}`,
			{ 
				itemIndex,
				description: `Transaction deserialization failed. Serialized transaction length: ${serializedTransaction?.length}, format: ${serializedTransaction?.startsWith('0x') ? 'hex' : 'base64'}`,
			}
		);
	}
}

export async function signAndSubmitTransaction(
	context: IExecuteFunctions,
	api: CrossmintApi,
	itemIndex: number,
): Promise<IDataObject> {
	const orderId = context.getNodeParameter('orderId', itemIndex) as string;
	const serializedTransaction = context.getNodeParameter('serializedTransaction', itemIndex) as string;
	const privateKey = context.getNodeParameter('privateKey', itemIndex) as string;

	validateRequiredField(orderId, 'Order ID', context, itemIndex);
	validateRequiredField(serializedTransaction, 'Serialized transaction', context, itemIndex);
	validatePrivateKey(privateKey, context, itemIndex);

	// Sign the transaction and get the signature (txId)
	const { signedTransaction, signature: txId } = await signVersionedTransaction(
		serializedTransaction,
		privateKey,
		context,
		itemIndex
	);

	// Submit the transaction to Crossmint
	const endpoint = `orders/${encodeURIComponent(orderId)}/payments/crypto`;
	const requestBody = {
		txId: txId,
	};

	let submitResponse: ApiResponse;
	try {
		submitResponse = await api.post(endpoint, requestBody as unknown as IDataObject, API_VERSIONS.ORDERS);
	} catch (error: unknown) {
		throw new NodeApiError(context.getNode(), error as object & { message?: string });
	}

	return {
		orderId: orderId,
		txId: txId,
		signedTransaction: signedTransaction,
		submitResponse: submitResponse,
	};
}

