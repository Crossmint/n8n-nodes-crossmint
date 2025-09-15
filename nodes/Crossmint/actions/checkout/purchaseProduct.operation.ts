import { IExecuteFunctions, NodeOperationError } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { API_VERSIONS } from '../../utils/constants';
import { validateRequiredField } from '../../utils/validation';
import { signMessage } from '../../utils/blockchain';
import { TransactionCreateRequest, ApprovalRequest } from '../../transport/types';

export async function purchaseProduct(
	context: IExecuteFunctions,
	api: CrossmintApi,
	itemIndex: number,
): Promise<any> {
	const serializedTransaction = context.getNodeParameter('serializedTransaction', itemIndex) as string;
	const payerAddress = context.getNodeParameter('payerAddress', itemIndex) as string;
	const chain = context.getNodeParameter('paymentMethod', itemIndex) as string;
	const privateKey = context.getNodeParameter('purchasePrivateKey', itemIndex) as string;

	validateRequiredField(serializedTransaction, 'Serialized transaction', context, itemIndex);
	validateRequiredField(payerAddress, 'Payer address', context, itemIndex);
	validateRequiredField(chain, 'Chain', context, itemIndex);
	validateRequiredField(privateKey, 'Private key', context, itemIndex);
	
	let requestBody: TransactionCreateRequest;
	if (chain.includes('solana')) {
		requestBody = {
			params: {
				transaction: serializedTransaction
			}
		};
	} else {
		requestBody = {
			params: {
				calls: [{
					transaction: serializedTransaction
				}],
				chain: chain
			}
		};
	}
	
	const endpoint = `wallets/${encodeURIComponent(payerAddress)}/transactions`;
	const transactionResponse = await api.post(endpoint, requestBody, API_VERSIONS.WALLETS);
	const transactionId = transactionResponse.id;
	
	if (!transactionResponse.approvals || !transactionResponse.approvals.pending || !transactionResponse.approvals.pending[0]) {
		throw new NodeOperationError(context.getNode(), 'No pending approval found in transaction response', {
			itemIndex,
		});
	}
	
	const messageToSign = transactionResponse.approvals.pending[0].message;
	const signerAddress = transactionResponse.approvals.pending[0].signer.address || transactionResponse.approvals.pending[0].signer.locator.split(':')[1];
	
	const chainType = chain.includes('solana') ? 'solana' : 'evm';
	const signature = await signMessage(messageToSign, privateKey, chainType, context, itemIndex);

	const signingDetails = {
		signature,
		messageToSign,
		signerAddress,
		chainType,
		chain
	};

	const approvalRequestBody: ApprovalRequest = {
		approvals: [{
			signer: `external-wallet:${signerAddress}`,
			signature: signature,
		}]
	};

	const approvalEndpoint = `wallets/${encodeURIComponent(payerAddress)}/transactions/${encodeURIComponent(transactionId)}/approvals`;
	const approvalResponse = await api.post(approvalEndpoint, approvalRequestBody, API_VERSIONS.WALLETS);
	
	return {
		transaction: transactionResponse,
		approval: approvalResponse,
		signingDetails
	};
}
