import { config } from '@n8n/node-cli/eslint';

export default [
	...config,
	{
		rules: {
			'n8n-nodes-base/node-param-type-options-password-missing': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'prefer-const': 'off',
		},
	},
];
