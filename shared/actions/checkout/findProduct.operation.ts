import { IExecuteFunctions, NodeApiError, IDataObject } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { API_VERSIONS } from '../../utils/constants';
import { validateEmail, validateRequiredField, validateAddressFields } from '../../utils/validation';
import { buildProductLocator } from '../../utils/locators';
import { OrderCreateRequest, ApiResponse } from '../../transport/types';

export async function findProduct(
	context: IExecuteFunctions,
	api: CrossmintApi,
	itemIndex: number,
): Promise<ApiResponse> {
	const platform = context.getNodeParameter('platform', itemIndex) as string;
	const recipientEmail = context.getNodeParameter('recipientEmail', itemIndex) as string;

	validateEmail(recipientEmail, context, itemIndex);

	// For customMerch, use hardcoded product URL; otherwise get from parameters
	let productIdentifier: string;
	if (platform === 'customMerch') {
		productIdentifier = 'www.worldstore.ai/design/tshirt';
	} else {
		productIdentifier = context.getNodeParameter('productIdentifier', itemIndex) as string;
		validateRequiredField(productIdentifier, 'Product identifier', context, itemIndex);
	}

	const productLocator = buildProductLocator(platform, productIdentifier);

	const recipientName = context.getNodeParameter('recipientName', itemIndex) as string;
	const addressLine1 = context.getNodeParameter('addressLine1', itemIndex) as string;
	const addressLine2 = context.getNodeParameter('addressLine2', itemIndex) as string;
	const city = context.getNodeParameter('city', itemIndex) as string;
	const state = context.getNodeParameter('state', itemIndex) as string;
	const postalCode = context.getNodeParameter('postalCode', itemIndex) as string;
	const country = context.getNodeParameter('country', itemIndex) as string;

	validateAddressFields({
		recipientName,
		addressLine1,
		city,
		postalCode,
	}, context, itemIndex);

	const paymentMethod = context.getNodeParameter('paymentMethod', itemIndex) as string;
	let paymentReceiptEmail = recipientEmail;

	if (platform === 'customMerch') {
		const customReceiptEmail = context.getNodeParameter('paymentReceiptEmail', itemIndex) as string;
		if (customReceiptEmail) {
			paymentReceiptEmail = customReceiptEmail;
		}
	}

	const physicalAddress: OrderCreateRequest['recipient']['physicalAddress'] = {
		name: recipientName,
		line1: addressLine1,
		city: city,
		postalCode: postalCode,
		country: country,
	};

	if (addressLine2) {
		physicalAddress.line2 = addressLine2;
	}
	if (state) {
		physicalAddress.state = state;
	}

	const payment: OrderCreateRequest['payment'] = {
		receiptEmail: paymentReceiptEmail,
		method: paymentMethod,
	};

	if (paymentMethod === 'solana') {
		const paymentCurrency = context.getNodeParameter('paymentCurrency', itemIndex) as string;
		payment.currency = paymentCurrency;

		const payerAddress = context.getNodeParameter('payerAddress', itemIndex) as string;
		if (payerAddress) {
			payment.payerAddress = payerAddress;
		}
	}

	const lineItem: OrderCreateRequest['lineItems'][number] = {
		productLocator: productLocator,
	};

	if (platform === 'customMerch') {
		const variantSize = context.getNodeParameter('variantSize', itemIndex) as string;
		const variantColor = context.getNodeParameter('variantColor', itemIndex) as string;
		const designUrl = context.getNodeParameter('designUrl', itemIndex) as string;

		validateRequiredField(variantSize, 'Variant size', context, itemIndex);
		validateRequiredField(variantColor, 'Variant color', context, itemIndex);
		validateRequiredField(designUrl, 'Design URL', context, itemIndex);

		lineItem.experimental_variantAttributesDetails = [
			{ propertyName: 'size', value: variantSize },
			{ propertyName: 'color', value: variantColor },
			{ propertyName: 'designUrl', value: designUrl },
		];
	}

	const requestBody: OrderCreateRequest = {
		recipient: {
			email: recipientEmail,
			physicalAddress: physicalAddress,
		},
		payment: payment,
		lineItems: [lineItem],
	};

	try {
		return await api.post('orders', requestBody as unknown as IDataObject, API_VERSIONS.ORDERS);
	} catch (error: unknown) {
		// Pass through the original Crossmint API error exactly as received
		throw new NodeApiError(context.getNode(), error as object & { message?: string });
	}
}
