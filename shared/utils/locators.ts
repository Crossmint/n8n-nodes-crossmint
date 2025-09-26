import { NodeOperationError } from 'n8n-workflow';

export interface WalletLocatorData {
	mode: string;
	value: string;
}

export function buildWalletLocator(
	walletResource: WalletLocatorData,
	chainType?: string,
	context?: any,
	itemIndex?: number
): string {
	const locatorMode = walletResource.mode;
	const locatorValue = walletResource.value;

	if (!locatorValue || locatorValue.trim() === '') {
		throw new NodeOperationError(context?.getNode(), 'Wallet identifier is required', {
			description: 'Please specify the wallet identifier',
			itemIndex,
		});
	}

	switch (locatorMode) {
		case 'address': {
			return locatorValue;
		}
		case 'email':
		case 'userId':
		case 'phoneNumber':
		case 'twitter':
		case 'x': {
			if (!chainType || chainType.trim() === '') {
				throw new NodeOperationError(context?.getNode(), 'Chain type is required for non-address wallet locators', {
					description: 'Please specify the blockchain type (Solana) for this wallet locator type',
					itemIndex,
				});
			}
			return `${locatorMode}:${locatorValue}:${chainType}:smart`;
		}
		default:
			throw new NodeOperationError(context?.getNode(), `Unsupported locator mode: ${locatorMode}`, {
				itemIndex,
			});
	}
}

export function buildRecipientLocator(
	recipientResource: WalletLocatorData,
	tokenChain?: string,
	context?: any,
	itemIndex?: number
): string {
	const recipientMode = recipientResource.mode;
	const recipientValue = recipientResource.value;

	if (!recipientValue || recipientValue.trim() === '') {
		throw new NodeOperationError(context?.getNode(), 'Recipient wallet value is required', {
			description: 'Please specify the recipient wallet identifier',
			itemIndex,
		});
	}

	switch (recipientMode) {
		case 'address': {
			return recipientValue;
		}
		case 'email':
		case 'userId':
		case 'phoneNumber':
		case 'twitter':
		case 'x': {
			return `${recipientMode}:${recipientValue}:${tokenChain}`;
		}
		default:
			throw new NodeOperationError(context?.getNode(), `Unsupported recipient wallet mode: ${recipientMode}`, {
				itemIndex,
			});
	}
}


export function buildProductLocator(platform: string, productIdentifier: string): string {
	if (platform === 'amazon') {
		return `amazon:${productIdentifier}`;
	} else if (platform === 'shopify') {
		if (productIdentifier.startsWith('http')) {
			return `shopify:${productIdentifier}:default`;
		} else {
			return `shopify:${productIdentifier}:default`;
		}
	} else {
		return `url:${productIdentifier}`;
	}
}