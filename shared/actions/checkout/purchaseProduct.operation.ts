import { IExecuteFunctions, NodeOperationError, NodeApiError, IDataObject } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { API_VERSIONS } from '../../utils/constants';
import { validateRequiredField } from '../../utils/validation';
import { signMessage } from '../../utils/blockchain';
import { TransactionCreateRequest, ApprovalRequest, ApiResponse } from '../../transport/types';
import { CHAIN_FAMILIES } from '../../types/chains';

export async function purchaseProduct(
	context: IExecuteFunctions,
	api: CrossmintApi,
	itemIndex: number,
): Promise<IDataObject> {
	const serializedTransaction = context.getNodeParameter('serializedTransaction', itemIndex) as string;
	const payerAddress = context.getNodeParameter('payerAddress', itemIndex) as string;
	const chain = context.getNodeParameter('paymentMethod', itemIndex) as string;
	const privateKey = context.getNodeParameter('purchasePrivateKey', itemIndex) as string;

	validateRequiredField(serializedTransaction, 'Serialized transaction', context, itemIndex);
	validateRequiredField(payerAddress, 'Payer address', context, itemIndex);
	validateRequiredField(chain, 'Chain', context, itemIndex);
	validateRequiredField(privateKey, 'Private key', context, itemIndex);
	
	const requestBody: TransactionCreateRequest = {
		params: {
			transaction: serializedTransaction
		}
	};
	
	const endpoint = `wallets/${encodeURIComponent(payerAddress)}/transactions`;

	let transactionResponse: ApiResponse;
	try {
		transactionResponse = await api.post(endpoint, requestBody as unknown as IDataObject, API_VERSIONS.WALLETS);
	} catch (error: unknown) {
		// Pass through the original Crossmint API error exactly as received
		throw new NodeApiError(context.getNode(), error as object & { message?: string });
	}

	const transactionId = (transactionResponse as IDataObject).id; 
	
	const response = transactionResponse as IDataObject;
	const approvals = response.approvals as { pending?: Array<{ message: string; signer: { address?: string; locator?: string } }> };
	if (!approvals || !approvals.pending || !approvals.pending[0]) {
		throw new NodeOperationError(context.getNode(), 'No pending approval found in transaction response', {
			itemIndex,
		});
	}
	
	const messageToSign = approvals.pending[0].message;
	const signerAddress = approvals.pending[0].signer.address || (approvals.pending[0].signer.locator as string).split(':')[1];
	
	const signature = await signMessage(messageToSign, privateKey, context, itemIndex);

	const signingDetails = {
		signature,
		messageToSign,
		signerAddress,
		chainType: CHAIN_FAMILIES.SOLANA,
		chain
	};

	const approvalRequestBody: ApprovalRequest = {
		approvals: [{
			signer: `external-wallet:${signerAddress}`,
			signature: signature,
		}]
	};

	const approvalEndpoint = `wallets/${encodeURIComponent(payerAddress as string)}/transactions/${encodeURIComponent(transactionId as string)}/approvals`;

	let approvalResponse: ApiResponse;
	try {
		approvalResponse = await api.post(approvalEndpoint, approvalRequestBody as unknown as IDataObject, API_VERSIONS.WALLETS);
	} catch (error: unknown) {
		// Pass through the original Crossmint API error exactly as received
		throw new NodeApiError(context.getNode(), error as object & { message?: string });
	}
	
	return {
		transaction: transactionResponse,
		approval: approvalResponse,
		signingDetails
	};
}
