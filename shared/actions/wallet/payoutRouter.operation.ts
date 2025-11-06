import { IExecuteFunctions, NodeOperationError, IDataObject } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { validateAmount, validateRequiredField } from '../../utils/validation';
import { buildWalletLocator, buildRecipientLocator } from '../../utils/locators';
import { WalletLocatorData } from '../../transport/types';
import { getWalletBalance } from './getBalance.operation';
import { sendToken } from '../../utils/sendToken';
import { deriveKeyPair } from '../../utils/blockchain';

interface PayoutRecipient {
	wallet: WalletLocatorData;
	amount?: string;
	percentage?: number;
}

interface TransferResult {
	recipient: string;
	amount: string;
	transactionId?: string;
	status?: string;
	error?: string;
}

interface DestinationInput {
	wallet: WalletLocatorData;
	quantity?: string;
	percentage?: number;
}

interface PayoutConfig {
	mode: string;
	sourceWallet: WalletLocatorData;
	blockchainType: string;
	tknChain: string;
	tknName: string;
	totalQuantity?: string;
}

function parseDestinationToRecipient(
	dest: DestinationInput,
	mode: string,
	index: number,
	context: IExecuteFunctions,
	itemIndex: number,
): PayoutRecipient {
	if (!dest.wallet || !dest.wallet.value) {
		throw new NodeOperationError(
			context.getNode(),
			`Wallet not specified for destination ${index + 1}`,
			{ itemIndex }
		);
	}

	const recipient: PayoutRecipient = { wallet: dest.wallet };

	if (mode === 'quantity') {
		// In quantity mode, we expect a quantity field (percentage field will be undefined)
		if (!dest.quantity || dest.quantity.trim() === '') {
			throw new NodeOperationError(
				context.getNode(),
				`Quantity not specified for destination ${index + 1}`,
				{ itemIndex }
			);
		}
		recipient.amount = dest.quantity.trim();
		validateAmount(recipient.amount, context, itemIndex);
	} else if (mode === 'percentage') {
		// In percentage mode, we expect a percentage field (quantity field will be undefined)
		if (dest.percentage === undefined || dest.percentage === null) {
			throw new NodeOperationError(
				context.getNode(),
				`Percentage not specified for destination ${index + 1}`,
				{ itemIndex }
			);
		}
		if (isNaN(dest.percentage) || dest.percentage <= 0 || dest.percentage > 100) {
			throw new NodeOperationError(
				context.getNode(),
				`Invalid percentage for destination ${index + 1}: ${dest.percentage}. Must be between 0 and 100`,
				{ itemIndex }
			);
		}
		recipient.percentage = dest.percentage;
	} else {
		throw new NodeOperationError(
			context.getNode(),
			`Unknown payout mode: ${mode}`,
			{ itemIndex }
		);
	}

	return recipient;
}

function parseRecipients(
	destinations: DestinationInput[],
	mode: string,
	context: IExecuteFunctions,
	itemIndex: number,
): PayoutRecipient[] {
	if (destinations.length === 0) {
		throw new NodeOperationError(
			context.getNode(),
			'At least one destination wallet must be configured',
			{ itemIndex }
		);
	}

	return destinations.map((dest, index) =>
		parseDestinationToRecipient(dest, mode, index, context, itemIndex)
	);
}

async function checkBalance(
	api: CrossmintApi,
	sourceWalletLocator: string,
	tknChain: string,
	tknName: string,
	requiredAmount: number,
	tokenLocator: string,
	context: IExecuteFunctions,
	itemIndex: number,
): Promise<void> {
	try {
		const balanceResponse = await getWalletBalance(api, sourceWalletLocator, tknChain, tknName) as IDataObject;

		// Check if balances is at the root level or in a different structure
		let balances = balanceResponse.balances as IDataObject[] | undefined;
		
		// If balances is not found, check if the response itself is an array
		if (!balances && Array.isArray(balanceResponse)) {
			balances = balanceResponse;
		}
		
		// If still not found, check for other possible field names
		if (!balances) {
			balances = balanceResponse.data as IDataObject[] | undefined;
		}
		if (!balances) {
			balances = balanceResponse.items as IDataObject[] | undefined;
		}

		if (!balances || balances.length === 0) {
			throw new NodeOperationError(
				context.getNode(),
				`No balance found for token ${tokenLocator} in source wallet. Response structure: ${JSON.stringify(Object.keys(balanceResponse))}`,
				{ itemIndex }
			);
		}

		const balance = balances[0] as IDataObject;
		const availableBalance = parseFloat(String(balance.balance || balance.amount || 0));

		if (availableBalance < requiredAmount) {
			throw new NodeOperationError(
				context.getNode(),
				`Insufficient balance. Available: ${availableBalance}, Required: ${requiredAmount}`,
				{ itemIndex }
			);
		}
	} catch (error: unknown) {
		if (error instanceof NodeOperationError) {
			throw error;
		}
		throw new NodeOperationError(
			context.getNode(),
			`Failed to check balance: ${(error as Error).message}`,
			{ itemIndex }
		);
	}
}

function validatePercentages(recipients: PayoutRecipient[], context: IExecuteFunctions, itemIndex: number): void {
	const totalPercentage = recipients.reduce((sum, r) => sum + (r.percentage || 0), 0);
	if (Math.abs(totalPercentage - 100) > 0.01) {
		throw new NodeOperationError(
			context.getNode(),
			`Percentages must sum to 100%. Current sum: ${totalPercentage}%`,
			{ itemIndex }
		);
	}
}

function calculateAmountsForQuantityMode(
	recipients: PayoutRecipient[],
): { totalAmount: number; calculatedAmounts: Map<number, string> } {
	const calculatedAmounts = new Map<number, string>();
	let totalAmount = 0;

	recipients.forEach((recipient, index) => {
		const amount = parseFloat(recipient.amount!);
		totalAmount += amount;
		calculatedAmounts.set(index, recipient.amount!);
	});

	return { totalAmount, calculatedAmounts };
}

function calculateAmountsForPercentageMode(
	recipients: PayoutRecipient[],
	totalQuantity: string,
	context: IExecuteFunctions,
	itemIndex: number,
): { totalAmount: number; calculatedAmounts: Map<number, string> } {
	validateAmount(totalQuantity, context, itemIndex);
	const totalAmount = parseFloat(totalQuantity);
	const calculatedAmounts = new Map<number, string>();

	recipients.forEach((recipient, index) => {
		const percentage = recipient.percentage!;
		const amount = (totalAmount * percentage) / 100;
		// Remove trailing zeros
		calculatedAmounts.set(index, amount.toFixed(9).replace(/\.?0+$/, ''));
	});

	return { totalAmount, calculatedAmounts };
}

async function executeSingleTransfer(
	api: CrossmintApi,
	sourceWalletLocator: string,
	tokenLocator: string,
	recipient: PayoutRecipient,
	amount: string,
	tknChain: string,
	privateKey: string,
	signerAddress: string,
	index: number,
	context: IExecuteFunctions,
	itemIndex: number,
): Promise<TransferResult> {
	const recipientLocator = buildRecipientLocator(recipient.wallet, tknChain, context, index);

	try {
		const sendResult = await sendToken({
			api,
			sourceWalletLocator,
			tokenLocator,
			recipientLocator,
			amount,
			privateKey,
			signerAddress,
			chain: tknChain,
			waitForCompletion: false,
			context,
			itemIndex,
		});

		const simplifiedOutput = sendResult['simplified-output'];
		return {
			recipient: recipientLocator,
			amount: amount,
			transactionId: simplifiedOutput.id,
			status: simplifiedOutput.status,
		};
	} catch (error: unknown) {
		const errorMessage = (error as { message?: string })?.message || 'Unknown error';
		return {
			recipient: recipientLocator,
			amount: amount,
			error: errorMessage,
		};
	}
}

async function executeTransfers(
	api: CrossmintApi,
	sourceWalletLocator: string,
	tokenLocator: string,
	recipients: PayoutRecipient[],
	calculatedAmounts: Map<number, string>,
	tknChain: string,
	privateKey: string,
	signerAddress: string,
	context: IExecuteFunctions,
	itemIndex: number,
): Promise<TransferResult[]> {
	const transferResults: TransferResult[] = [];

	for (let i = 0; i < recipients.length; i++) {
		const recipient = recipients[i];
		const amount = calculatedAmounts.get(i)!;
		const result = await executeSingleTransfer(
			api,
			sourceWalletLocator,
			tokenLocator,
			recipient,
			amount,
			tknChain,
			privateKey,
			signerAddress,
			i,
			context,
			itemIndex,
		);
		transferResults.push(result);
	}

	return transferResults;
}

function buildResponse(
	mode: string,
	sourceWalletLocator: string,
	tokenLocator: string,
	totalAmount: number,
	recipients: PayoutRecipient[],
	calculatedAmounts: Map<number, string>,
	transferResults: TransferResult[],
): IDataObject {
	const successfulTransfers = transferResults.filter(r => !r.error).length;
	const failedTransfers = transferResults.filter(r => r.error).length;

	return {
		'simplified-output': {
			mode,
			sourceWallet: sourceWalletLocator,
			token: tokenLocator,
			totalAmount: totalAmount.toString(),
			totalRecipients: recipients.length,
			successfulTransfers,
			failedTransfers,
			transfers: transferResults,
		},
		raw: {
			mode,
			sourceWallet: sourceWalletLocator,
			token: tokenLocator,
			totalAmount: totalAmount.toString(),
			recipients: recipients.map((r, i) => ({
				wallet: r.wallet,
				amount: calculatedAmounts.get(i),
				percentage: r.percentage,
				result: transferResults[i],
			})),
		},
	};
}

export async function payoutRouter(
	context: IExecuteFunctions,
	api: CrossmintApi,
	itemIndex: number,
): Promise<IDataObject> {
	const mode = context.getNodeParameter('payoutMode', itemIndex) as string;
	const sourceWallet = context.getNodeParameter('sourceWallet', itemIndex) as WalletLocatorData;
	const blockchainType = context.getNodeParameter('payoutBlockchainType', itemIndex) as string;
	const tknChain = context.getNodeParameter('payoutTknChain', itemIndex) as string;
	const tknName = context.getNodeParameter('payoutTknName', itemIndex) as string;

	// Validate required fields
	validateRequiredField(mode, 'Payout mode', context, itemIndex);
	validateRequiredField(blockchainType, 'Blockchain type', context, itemIndex);
	validateRequiredField(tknChain, 'Token chain', context, itemIndex);
	validateRequiredField(tknName, 'Token name', context, itemIndex);

	if (!sourceWallet || !sourceWallet.value) {
		throw new NodeOperationError(
			context.getNode(),
			'Source wallet is required',
			{ itemIndex }
		);
	}

	const config: PayoutConfig = {
		mode,
		sourceWallet,
		blockchainType,
		tknChain,
		tknName,
	};

	const tokenLocator = `${config.tknChain}:${config.tknName}`;
	const sourceWalletLocator = buildWalletLocator(config.sourceWallet, config.blockchainType, context, itemIndex);

	// Get source wallet private key and derive signer address
	const sourcePrivateKey = context.getNodeParameter('sourcePrivateKey', itemIndex) as string;
	if (!sourcePrivateKey) {
		throw new NodeOperationError(
			context.getNode(),
			'Source wallet private key is required',
			{ itemIndex }
		);
	}

	const keyPair = deriveKeyPair(sourcePrivateKey, context, itemIndex);
	const signerAddress = keyPair.address;

	// Get destinations from fixedCollection parameter
	const payoutDestinations = context.getNodeParameter('payoutDestinations', itemIndex) as {
		destinationValues?: DestinationInput[];
	};
	const destinations = payoutDestinations?.destinationValues || [];

	// Parse destinations into validated recipients
	const recipients = parseRecipients(destinations, config.mode, context, itemIndex);

	// Calculate amounts based on mode
	let totalAmount: number;
	let calculatedAmounts: Map<number, string>;

	if (config.mode === 'quantity') {
		const result = calculateAmountsForQuantityMode(recipients);
		totalAmount = result.totalAmount;
		calculatedAmounts = result.calculatedAmounts;

		// Check balance before proceeding
		await checkBalance(
			api,
			sourceWalletLocator,
			config.tknChain,
			config.tknName,
			totalAmount,
			tokenLocator,
			context,
			itemIndex,
		);
	} else if (config.mode === 'percentage') {
		validatePercentages(recipients, context, itemIndex);

		config.totalQuantity = context.getNodeParameter('payoutTotalQuantity', itemIndex) as string;
		validateAmount(config.totalQuantity, context, itemIndex);
		const totalQuantityAmount = parseFloat(config.totalQuantity);

		// Check balance before proceeding
		await checkBalance(
			api,
			sourceWalletLocator,
			config.tknChain,
			config.tknName,
			totalQuantityAmount,
			tokenLocator,
			context,
			itemIndex,
		);

		const result = calculateAmountsForPercentageMode(recipients, config.totalQuantity, context, itemIndex);
		totalAmount = result.totalAmount;
		calculatedAmounts = result.calculatedAmounts;
	} else {
		throw new NodeOperationError(
			context.getNode(),
			`Unknown payout mode: ${config.mode}`,
			{ itemIndex }
		);
	}

	// Execute all transfers
	const transferResults = await executeTransfers(
		api,
		sourceWalletLocator,
		tokenLocator,
		recipients,
		calculatedAmounts,
		config.tknChain,
		sourcePrivateKey,
		signerAddress,
		context,
		itemIndex,
	);

	// Check for failures
	const errors: string[] = [];
	transferResults.forEach((result, index) => {
		if (result.error) {
			errors.push(`Recipient ${index + 1} (${result.recipient}): ${result.error}`);
		}
	});

	if (errors.length > 0 && !context.continueOnFail()) {
		throw new NodeOperationError(
			context.getNode(),
			`Failed to complete all transfers:\n${errors.join('\n')}`,
			{ itemIndex }
		);
	}

	return buildResponse(
		config.mode,
		sourceWalletLocator,
		tokenLocator,
		totalAmount,
		recipients,
		calculatedAmounts,
		transferResults,
	);
}

