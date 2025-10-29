import { ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';
import { listContractMethods } from './ContractMethods';
import { listContractEvents } from './ContractEvents';
import { listChains } from './Chains';
import { getX402Supported } from './x402';

export async function loadChainOptions(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const options: INodePropertyOptions[] = [];

	const chains = await listChains(
		this,
		1, // page
		1000, // pageSize
	);

	for (const chain of chains.response) {
		options.push({
			name: chain.name,
			value: chain.chainId,
			description: `${chain.name} (${chain.chainId}-${chain.type})`,
		});
	}

	return options;
}

export async function loadChainOptionsWithAll(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const options: INodePropertyOptions[] = [];

	const chains = await listChains(
		this,
		1, // page
		1000, // pageSize
	);

	options.push({
		name: 'All',
		value: 'all',
		description: 'All chains',
	});

	for (const chain of chains.response) {
		options.push({
			name: chain.name,
			value: chain.chainId,
			description: `${chain.name} (${chain.chainId}-${chain.type})`,
		});
	}

	return options;
}

export async function loadContractMethodExecutionOptions(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	return loadContractMethodOptions(this, 'write');
}

export async function loadContractMethodReadOptions(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	return loadContractMethodOptions(this, 'read');
}

export async function loadContractMethodAllOptions(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	return loadContractMethodOptions(this, undefined);
}

async function loadContractMethodOptions(
	loadOptionsFunctions: ILoadOptionsFunctions,
	methodType?: 'read' | 'write',
): Promise<INodePropertyOptions[]> {
	const options: INodePropertyOptions[] = [];

	const contractMethods = await listContractMethods(
		loadOptionsFunctions,
		undefined,
		1, // page
		1000, // pageSize
		undefined, // chainId
		undefined, // contractId
		undefined, // contractMethodId
		undefined, // promptId
		methodType, // methodType
	);

	for (const contractMethod of contractMethods.response) {
		options.push({
			name: `${contractMethod.name} (${contractMethod.chainId})`,
			value: contractMethod.id,
			description: contractMethod.description || '',
		});
	}

	return options;
}

export async function loadContractEventOptions(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const options: INodePropertyOptions[] = [];

	const contractEvents = await listContractEvents(
		this,
		undefined, // chainId
		1, // page
		1000, // pageSize
		undefined, // name
		undefined, // status
		undefined, // contractAddress
		undefined, // eventName
	);

	for (const contractEvent of contractEvents.response) {
		options.push({
			name: `${contractEvent.name} (${contractEvent.chainId})`,
			value: contractEvent.id,
			description: contractEvent.description || '',
		});
	}

	return options;
}

export async function loadX402TokenOptions(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	// For now, only Solana chain with USDC and SOL tokens are supported
	const options: INodePropertyOptions[] = [
		{
			name: 'USDC (Solana)',
			value: 'solana:usdc',
			description: 'USDC on Solana',
		},
		{
			name: 'SOL (Solana)',
			value: 'solana:sol',
			description: 'SOL on Solana',
		},
	];

	return options;
}
