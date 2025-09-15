import { IExecuteFunctions } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { API_VERSIONS } from '../../utils/constants';
import { validateEmail, validateRequiredField, validateAddressFields } from '../../utils/validation';
import { buildProductLocator } from '../../utils/locators';
import { OrderCreateRequest } from '../../transport/types';

export async function findProduct(
	context: IExecuteFunctions,
	api: CrossmintApi,
	itemIndex: number,
): Promise<any> {
	const platform = context.getNodeParameter('platform', itemIndex) as string;
	const productIdentifier = context.getNodeParameter('productIdentifier', itemIndex) as string;
	const recipientEmail = context.getNodeParameter('recipientEmail', itemIndex) as string;

	validateRequiredField(productIdentifier, 'Product identifier', context, itemIndex);
	validateEmail(recipientEmail, context, itemIndex);

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

	const physicalAddress: any = {
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

	const payment: any = {
		receiptEmail: recipientEmail,
		method: paymentMethod,
	};

	const paymentCurrency = context.getNodeParameter('paymentCurrency', itemIndex) as string;
	payment.currency = paymentCurrency;

	const payerAddress = context.getNodeParameter('payerAddress', itemIndex) as string;
	if (payerAddress) {
		payment.payerAddress = payerAddress;
	}

	const requestBody: OrderCreateRequest = {
		recipient: {
			email: recipientEmail,
			physicalAddress: physicalAddress,
		},
		payment: payment,
		lineItems: [{
			productLocator: productLocator,
		}],
	};

	return await api.post('orders', requestBody, API_VERSIONS.ORDERS);
}
