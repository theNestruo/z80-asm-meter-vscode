// reference: https://typescript-eslint.io/getting-started

import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(

	// eslint's recommended config
	eslint.configs.recommended,

	// recommended: recommended rules for code correctness
	// recommended-type-checked: recommended + additional recommended rules that require type information
	// strict: superset of recommended with more opinionated rules which may also catch bugs
	// strict-type-checked: strict + additional strict rules require type information
	tseslint.configs.strictTypeChecked,

	// stylistic: additional stylistic rules that enforce consistent styling
	// stylistic-type-checked: stylistic + additional stylistic rules that require type information
	tseslint.configs.stylisticTypeChecked,

	{
		languageOptions: {
			parserOptions: {
				// ask TypeScript's type checking service for each source file's type information
				projectService: true,
			},
		},

		rules: {
			semi: ["error", "always"],

			// lowers recommended "error" to "warn"
			"@typescript-eslint/no-unused-expressions": "warn",
			"@typescript-eslint/no-unused-vars": [
				"warn",
				{
					"args": "all",
					"argsIgnorePattern": "^_",
					"caughtErrors": "all",
					"caughtErrorsIgnorePattern": "^_"
				}
			],

			// lowers recommended-type-checked "error" to "warn"
			"@typescript-eslint/no-unnecessary-type-assertion": "warn",
			"@typescript-eslint/no-unsafe-argument": "warn",
			"@typescript-eslint/no-unsafe-return": "warn",
			"@typescript-eslint/restrict-template-expressions": "warn",
			"@typescript-eslint/unbound-method": "warn",

			// lowers strict "error" to "warn"
			"@typescript-eslint/no-non-null-assertion": "warn",

			// lowers strict-type-checked "error" to "warn" or "off"
			"@typescript-eslint/no-unnecessary-condition": "warn",
			"@typescript-eslint/no-unnecessary-type-parameters": "off",

			// lowers stylistic "error" to "warn"
			"@typescript-eslint/class-literal-property-style": "warn",
			"@typescript-eslint/no-empty-function": "warn",

			// lowers stylistic-type-checked "error" to "warn"
			"@typescript-eslint/prefer-string-starts-ends-with": "warn",
			"@typescript-eslint/prefer-nullish-coalescing": "warn",
			"@typescript-eslint/prefer-optional-chain": "warn",

			// additional "error"
			"@typescript-eslint/no-unnecessary-parameter-property-assignment": "error",
			"@typescript-eslint/no-useless-empty-export": "error",

			// additional "warn"
			"@typescript-eslint/consistent-type-exports": "warn",
			"@typescript-eslint/consistent-type-imports": "warn",
			"@typescript-eslint/explicit-function-return-type": "warn",
			"@typescript-eslint/no-unused-private-class-members": "warn",
			"@typescript-eslint/prefer-readonly": "warn",
		}
	}
);
