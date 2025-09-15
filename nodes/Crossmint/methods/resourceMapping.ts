import { IDataObject, ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';

export async function walletSearch(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	const results: IDataObject[] = [];
	
	if (filter) {
		if (filter.includes('@')) {
			results.push({
				name: `Email: ${filter}`,
				value: `email:${filter}`,
				url: '',
			});
		}
		
		if (filter.startsWith('0x') || filter.length > 30) {
			results.push({
				name: `Address: ${filter}`,
				value: filter,
				url: '',
			});
		}
		
		if (filter.startsWith('+') || /^\d+$/.test(filter)) {
			results.push({
				name: `Phone: ${filter}`,
				value: `phone:${filter}`,
				url: '',
			});
		}
	}

	return {
		results,
	};
}

export async function productSearch(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	const results: IDataObject[] = [];
	
	if (filter) {
		if (filter.includes('amazon.com')) {
			results.push({
				name: `Amazon Product: ${filter}`,
				value: `amazon:${filter}`,
				url: filter,
			});
		}
		
		if (filter.includes('shopify') || filter.includes('.myshopify.com')) {
			results.push({
				name: `Shopify Product: ${filter}`,
				value: `shopify:${filter}`,
				url: filter,
			});
		}
		
		if (filter.startsWith('http')) {
			results.push({
				name: `URL Product: ${filter}`,
				value: `url:${filter}`,
				url: filter,
			});
		}
	}

	return {
		results,
	};
}
