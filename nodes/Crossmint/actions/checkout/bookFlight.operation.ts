import { IExecuteFunctions, NodeApiError } from 'n8n-workflow';
import { CrossmintApi } from '../../transport/CrossmintApi';
import { validateEmail, validateRequiredField } from '../../utils/validation';

export async function bookFlight(
	context: IExecuteFunctions,
	api: CrossmintApi,
	itemIndex: number,
): Promise<any> {
	// Flight search parameters
	const originIATA = context.getNodeParameter('originIATA', itemIndex) as string;
	const destinationIATA = context.getNodeParameter('destinationIATA', itemIndex) as string;
	const departureDate = context.getNodeParameter('departureDate', itemIndex) as string;
	const cabinClass = context.getNodeParameter('cabinClass', itemIndex) as string;
	const passengerCount = context.getNodeParameter('passengerCount', itemIndex) as number;
	const flightIds = context.getNodeParameter('flightIds', itemIndex) as string;

	// Passenger details
	const passengerTitle = context.getNodeParameter('passengerTitle', itemIndex) as string;
	const passengerFirstName = context.getNodeParameter('passengerFirstName', itemIndex) as string;
	const passengerLastName = context.getNodeParameter('passengerLastName', itemIndex) as string;
	const passengerBirthDate = context.getNodeParameter('passengerBirthDate', itemIndex) as string;
	const passengerGender = context.getNodeParameter('passengerGender', itemIndex) as string;
	const passengerEmail = context.getNodeParameter('recipientEmail', itemIndex) as string;
	const passengerPhone = context.getNodeParameter('passengerPhone', itemIndex) as string;

	// Passport details
	const passportNumber = context.getNodeParameter('passportNumber', itemIndex) as string;
	const passportCountry = context.getNodeParameter('passportCountry', itemIndex) as string;
	const passportExpiry = context.getNodeParameter('passportExpiry', itemIndex) as string;

	// Payment details
	const paymentMethod = context.getNodeParameter('paymentMethod', itemIndex) as string;
	const paymentCurrency = context.getNodeParameter('paymentCurrency', itemIndex) as string;
	const payerAddress = context.getNodeParameter('payerAddress', itemIndex) as string;

	// Validation
	validateRequiredField(originIATA, 'Origin IATA', context, itemIndex);
	validateRequiredField(destinationIATA, 'Destination IATA', context, itemIndex);
	validateRequiredField(departureDate, 'Departure Date', context, itemIndex);
	validateRequiredField(passengerFirstName, 'Passenger First Name', context, itemIndex);
	validateRequiredField(passengerLastName, 'Passenger Last Name', context, itemIndex);
	validateEmail(passengerEmail, context, itemIndex);
	validateRequiredField(passportNumber, 'Passport Number', context, itemIndex);

	try {
		// Step 1: Search for flights using Worldstore Search API
		const flightIdsArray = flightIds.split(',').map(id => id.trim());

		const searchBody = {
			uid: {
				originIATA: originIATA,
				destinationIATA: destinationIATA,
				cabinClass: cabinClass,
				passenger_number: passengerCount,
				departureFlightDetails: {
					departureDate,
					flightIds: flightIdsArray,
				},
			},
		};

		const searchResponse = await api.post('ws/search', searchBody, 'unstable');
		const { listings } = searchResponse;

		if (!listings || listings.length === 0) {
			throw new Error('No flights found for the specified criteria');
		}

		// Use the first available listing
		const selectedListing = listings[0];

		// Step 2: Create Worldstore order with passenger details
		const passengers = [{
			title: passengerTitle,
			given_name: passengerFirstName,
			family_name: passengerLastName,
			born_on: passengerBirthDate,
			gender: passengerGender,
			email: passengerEmail,
			phone_number: passengerPhone,
			identity_documents: [{
				type: 'passport',
				unique_identifier: passportNumber,
				issuing_country_code: passportCountry,
				expires_on: passportExpiry,
			}],
		}];

		const wsOrderBody = {
			sellerId: '1',
			items: [{
				listingId: selectedListing.id,
				listingParameters: {
					passengers,
				},
			}],
			orderParameters: {},
		};

		const wsOrderResponse = await api.post('ws/orders', wsOrderBody, 'unstable');
		const { order } = wsOrderResponse;

		// Step 3: Create Crossmint payment order
		const payment: any = {
			receiptEmail: passengerEmail,
			method: paymentMethod,
			currency: paymentCurrency,
		};

		if (payerAddress) {
			payment.payerAddress = payerAddress;
		}

		const crossmintOrderBody = {
			recipient: {
				email: passengerEmail,
			},
			locale: 'en-US',
			payment,
			externalOrder: order,
		};

		const crossmintOrderResponse = await api.post('orders', crossmintOrderBody, '2022-06-09');

		return {
			flightSearch: searchResponse,
			worldstoreOrder: wsOrderResponse,
			crossmintOrder: crossmintOrderResponse,
			selectedFlight: selectedListing,
		};
	} catch (error: any) {
		throw new NodeApiError(context.getNode(), error);
	}
}