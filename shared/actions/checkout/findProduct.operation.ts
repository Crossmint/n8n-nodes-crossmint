import { IExecuteFunctions, NodeApiError, IDataObject } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { API_VERSIONS } from '../../utils/constants';
import { validateEmail, validateRequiredField, validateAddressFields, validateCountryCode } from '../../utils/validation';
import { buildProductLocator } from '../../utils/locators';
import { OrderCreateRequest, ApiResponse } from '../../transport/types';

function getProductIdentifier(
	context: IExecuteFunctions,
	platform: string,
	itemIndex: number,
): string {
	if (platform === 'customMerch') {
		return 'www.worldstore.ai/design/tshirt';
	}
	const productIdentifier = context.getNodeParameter('productIdentifier', itemIndex) as string;
	validateRequiredField(productIdentifier, 'Product identifier', context, itemIndex);
	return productIdentifier;
}

function getRecipientData(
	context: IExecuteFunctions,
	platform: string,
	itemIndex: number,
): { email: string; name: string; addressLine1: string; addressLine2: string; city: string; state: string; postalCode: string; country: string } {
	let recipientEmail: string;
	let recipientName: string;
	let addressLine1: string;
	let addressLine2: string;
	let city: string;
	let state: string;
	let postalCode: string;
	let country: string;

	if (platform === 'customMerch') {
		// Extract from fixedCollection structure
		const shippingAddressUi = context.getNodeParameter('shippingAddressUi', itemIndex, {}) as IDataObject;
		const shippingAddressValues = shippingAddressUi?.shippingAddressValues;
		
		// Handle both array (multipleValues: true) and single object (multipleValues: false) cases
		let address: {
			recipientEmail?: string;
			recipientName?: string;
			addressLine1?: string;
			addressLine2?: string;
			city?: string;
			state?: string;
			postalCode?: string;
			country?: string;
		} | undefined;

		if (Array.isArray(shippingAddressValues)) {
			address = shippingAddressValues[0];
		} else if (shippingAddressValues && typeof shippingAddressValues === 'object') {
			address = shippingAddressValues as typeof address;
		}

		if (!address) {
			throw new NodeApiError(context.getNode(), {
				message: 'Shipping address is required',
				description: 'Please provide shipping address details in the Shipping Address section',
			});
		}

		recipientEmail = address.recipientEmail || '';
		recipientName = address.recipientName || '';
		addressLine1 = address.addressLine1 || '';
		addressLine2 = address.addressLine2 || '';
		city = address.city || '';
		state = address.state || '';
		postalCode = address.postalCode || '';
		country = address.country || '';
	} else {
		// Extract from flat structure for Amazon/Shopify
		recipientEmail = context.getNodeParameter('recipientEmail', itemIndex) as string;
		recipientName = context.getNodeParameter('recipientName', itemIndex) as string;
		addressLine1 = context.getNodeParameter('addressLine1', itemIndex) as string;
		addressLine2 = context.getNodeParameter('addressLine2', itemIndex) as string;
		city = context.getNodeParameter('city', itemIndex) as string;
		state = context.getNodeParameter('state', itemIndex) as string;
		postalCode = context.getNodeParameter('postalCode', itemIndex) as string;
		country = context.getNodeParameter('country', itemIndex) as string;
	}

	validateEmail(recipientEmail, context, itemIndex);
	validateAddressFields({
		recipientName,
		addressLine1,
		city,
		postalCode,
	}, context, itemIndex);

	// Validate and normalize country code for Custom Merch (uppercase, 2 letters)
	if (platform === 'customMerch') {
		validateCountryCode(country, context, itemIndex);
		country = country.trim().toUpperCase();
	}

	return {
		email: recipientEmail,
		name: recipientName,
		addressLine1,
		addressLine2,
		city,
		state,
		postalCode,
		country,
	};
}

function buildPhysicalAddress(
	recipientData: { name: string; addressLine1: string; addressLine2: string; city: string; state: string; postalCode: string; country: string },
): OrderCreateRequest['recipient']['physicalAddress'] {
	// Build physical address in the exact order required by the API
	const physicalAddress: OrderCreateRequest['recipient']['physicalAddress'] = {
		name: recipientData.name,
		line1: recipientData.addressLine1,
		line2: recipientData.addressLine2 || '',
		city: recipientData.city,
		state: recipientData.state || '',
		postalCode: recipientData.postalCode,
		country: recipientData.country,
	};

	return physicalAddress;
}

function getPaymentReceiptEmail(
	context: IExecuteFunctions,
	platform: string,
	defaultEmail: string,
	itemIndex: number,
): string {
	if (platform === 'customMerch') {
		const paymentDetailsUi = context.getNodeParameter('paymentDetailsUi', itemIndex, {}) as IDataObject;
		const paymentDetailsValues = paymentDetailsUi?.paymentDetailsValues;
		
		// Handle both array (multipleValues: true) and single object (multipleValues: false) cases
		let payment: { paymentReceiptEmail?: string } | undefined;
		
		if (Array.isArray(paymentDetailsValues)) {
			payment = paymentDetailsValues[0];
		} else if (paymentDetailsValues && typeof paymentDetailsValues === 'object') {
			payment = paymentDetailsValues as typeof payment;
		}

		if (payment?.paymentReceiptEmail) {
			return payment.paymentReceiptEmail;
		}
	}
	return defaultEmail;
}

function buildPayment(
	context: IExecuteFunctions,
	platform: string,
	recipientEmail: string,
	itemIndex: number,
): OrderCreateRequest['payment'] {
	let paymentMethod: string;
	let paymentCurrency: string | undefined;
	let payerAddress: string | undefined;

	if (platform === 'customMerch') {
		// Extract from fixedCollection structure
		const paymentDetailsUi = context.getNodeParameter('paymentDetailsUi', itemIndex, {}) as IDataObject;
		const paymentDetailsValues = paymentDetailsUi?.paymentDetailsValues;
		
		// Handle both array (multipleValues: true) and single object (multipleValues: false) cases
		let payment: {
			paymentMethod?: string;
			paymentCurrency?: string;
			payerAddress?: string;
			environment?: string;
		} | undefined;

		if (Array.isArray(paymentDetailsValues)) {
			payment = paymentDetailsValues[0];
		} else if (paymentDetailsValues && typeof paymentDetailsValues === 'object') {
			payment = paymentDetailsValues as typeof payment;
		}

		if (!payment) {
			throw new NodeApiError(context.getNode(), {
				message: 'Payment details are required',
				description: 'Please provide payment method and wallet configuration in the Payment Details section',
			});
		}

		paymentMethod = payment.paymentMethod || '';
		paymentCurrency = payment.paymentCurrency;
		payerAddress = payment.payerAddress;
		// Note: environment is stored but not used in the payment object
		// It's only used for conditional UI display
	} else {
		// Extract from flat structure for Amazon/Shopify
		paymentMethod = context.getNodeParameter('paymentMethod', itemIndex) as string;
		if (paymentMethod === 'solana') {
			paymentCurrency = context.getNodeParameter('paymentCurrency', itemIndex) as string;
			payerAddress = context.getNodeParameter('payerAddress', itemIndex) as string;
		}
	}

	const paymentReceiptEmail = getPaymentReceiptEmail(context, platform, recipientEmail, itemIndex);

	const payment: OrderCreateRequest['payment'] = {
		receiptEmail: paymentReceiptEmail,
		method: paymentMethod,
	};

	if (paymentMethod === 'solana') {
		if (paymentCurrency) {
			payment.currency = paymentCurrency;
		}
		if (payerAddress) {
			payment.payerAddress = payerAddress;
		}
	}

	return payment;
}

function buildLineItem(
	context: IExecuteFunctions,
	platform: string,
	productLocator: string,
	itemIndex: number,
): OrderCreateRequest['lineItems'][number] {
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

	return lineItem;
}

function buildOrderRequest(
	recipientData: { email: string },
	physicalAddress: OrderCreateRequest['recipient']['physicalAddress'],
	payment: OrderCreateRequest['payment'],
	lineItem: OrderCreateRequest['lineItems'][number],
): OrderCreateRequest {
	return {
		recipient: {
			email: recipientData.email,
			physicalAddress: physicalAddress,
		},
		payment: payment,
		lineItems: [lineItem],
		locale: 'en-US',
	};
}

export async function findProduct(
	context: IExecuteFunctions,
	api: CrossmintApi,
	itemIndex: number,
): Promise<ApiResponse> {
	const platform = context.getNodeParameter('platform', itemIndex) as string;

	const productIdentifier = getProductIdentifier(context, platform, itemIndex);
	const productLocator = buildProductLocator(platform, productIdentifier);

	const recipientData = getRecipientData(context, platform, itemIndex);
	const physicalAddress = buildPhysicalAddress(recipientData);

	const payment = buildPayment(context, platform, recipientData.email, itemIndex);
	const lineItem = buildLineItem(context, platform, productLocator, itemIndex);

	const requestBody = buildOrderRequest(recipientData, physicalAddress, payment, lineItem);

	// Log the request details
	console.log('=== Order Create Request Details ===');
	console.log('Platform:', platform);
	console.log('Endpoint: orders');
	console.log('API Version:', API_VERSIONS.ORDERS);
	console.log('Base URL:', api.getBaseUrl());
	console.log('Full URL:', `${api.getBaseUrl()}/${API_VERSIONS.ORDERS}/orders`);
	console.log('Request Body:', JSON.stringify(requestBody, null, 2));
	console.log('===================================');

	try {
		const response = await api.post('orders', requestBody as unknown as IDataObject, API_VERSIONS.ORDERS);
		
		// Log the response from the API
		console.log('=== Order Create Response ===');
		console.log(JSON.stringify(response, null, 2));
		console.log('============================');
		
		return response;
	} catch (error: unknown) {
		// Log the error response from the API
		console.log('=== Order Create Error Response ===');
		console.log(JSON.stringify(error, null, 2));
		console.log('===================================');
		
		// Pass through the original Crossmint API error exactly as received
		throw new NodeApiError(context.getNode(), error as object & { message?: string });
	}
}
