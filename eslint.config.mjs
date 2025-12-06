// reference: https://typescript-eslint.io/getting-started

import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(

	// eslint"s recommended config
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
				// ask TypeScript"s type checking service for each source file"s type information
				projectService: true,
			},
		},

		rules: {
			semi: ["error", "always"],

			// additional "warn"
			"@typescript-eslint/consistent-type-exports": "warn",
			"@typescript-eslint/consistent-type-imports": "warn",
			"@typescript-eslint/explicit-function-return-type": "warn",
			"@typescript-eslint/explicit-member-accessibility": [
				"warn",
				{
					// - require an accessor except when public
					"accessibility": "no-public"
				}
			],
			"@typescript-eslint/explicit-module-boundary-types": "warn",
			"@typescript-eslint/no-unnecessary-parameter-property-assignment": "warn",
			"@typescript-eslint/no-useless-empty-export": "warn",
			"@typescript-eslint/prefer-readonly": "warn",

			// recommended-type-checked: uses "warn" instead of "error"
			"@typescript-eslint/await-thenable": "warn",
			"@typescript-eslint/ban-ts-comment": "warn",
			"@typescript-eslint/no-array-constructor": "warn",
			"@typescript-eslint/no-array-delete": "warn",
			"@typescript-eslint/no-base-to-string": "warn",
			"@typescript-eslint/no-duplicate-enum-values": "warn",
			"@typescript-eslint/no-duplicate-type-constituents": "warn",
			"@typescript-eslint/no-empty-object-type": "warn",
			"@typescript-eslint/no-explicit-any": "warn",
			"@typescript-eslint/no-extra-non-null-assertion": "warn",
			"@typescript-eslint/no-floating-promises": "warn",
			"@typescript-eslint/no-for-in-array": "warn",
			"@typescript-eslint/no-implied-eval": "warn",
			"@typescript-eslint/no-misused-new": "warn",
			"@typescript-eslint/no-misused-promises": "warn",
			"@typescript-eslint/no-namespace": "warn",
			"@typescript-eslint/no-non-null-asserted-optional-chain": "warn",
			"@typescript-eslint/no-redundant-type-constituents": "warn",
			"@typescript-eslint/no-require-imports": "warn",
			"@typescript-eslint/no-this-alias": "warn",
			"@typescript-eslint/no-unnecessary-type-assertion": "warn",
			"@typescript-eslint/no-unnecessary-type-constraint": "warn",
			"@typescript-eslint/no-unsafe-argument": "warn",
			"@typescript-eslint/no-unsafe-assignment": "warn",
			"@typescript-eslint/no-unsafe-call": "warn",
			"@typescript-eslint/no-unsafe-declaration-merging": "warn",
			"@typescript-eslint/no-unsafe-enum-comparison": "warn",
			"@typescript-eslint/no-unsafe-function-type": "warn",
			"@typescript-eslint/no-unsafe-member-access": "warn",
			"@typescript-eslint/no-unsafe-return": "warn",
			"@typescript-eslint/no-unsafe-unary-minus": "warn",
			"@typescript-eslint/no-unused-expressions": "warn",
			"@typescript-eslint/no-unused-vars": [
				"warn",
				{
					// - emulate the TypeScript style of exempting names starting with _
					"args": "all",
					"argsIgnorePattern": "^_",
					"caughtErrors": "all",
					"caughtErrorsIgnorePattern": "^_"
				}
			],
			"@typescript-eslint/no-wrapper-object-types": "warn",
			"@typescript-eslint/only-throw-error": "warn",
			"@typescript-eslint/prefer-as-const": "warn",
			"@typescript-eslint/prefer-namespace-keyword": "warn",
			"@typescript-eslint/prefer-promise-reject-errors": "warn",
			"@typescript-eslint/require-await": "warn",
			"@typescript-eslint/restrict-plus-operands": "warn",
			"@typescript-eslint/restrict-template-expressions": "warn",
			"@typescript-eslint/triple-slash-reference": "warn",
			"@typescript-eslint/unbound-method": "warn",

			// strict-type-checked:
			// - allow explicit ! non-null assertion operator
			"@typescript-eslint/no-non-null-assertion": "off",

			// stylistic-type-checked: uses "warn" instead of "error"
			"@typescript-eslint/adjacent-overload-signatures": "warn",
			"@typescript-eslint/array-type": "warn",
			"@typescript-eslint/ban-tslint-comment": "warn",
			"@typescript-eslint/class-literal-property-style": "warn",
			"@typescript-eslint/consistent-generic-constructors": "warn",
			"@typescript-eslint/consistent-indexed-object-style": "warn",
			"@typescript-eslint/consistent-type-assertions": "warn",
			"@typescript-eslint/consistent-type-definitions": "warn",
			"@typescript-eslint/dot-notation": "warn",
			"@typescript-eslint/no-confusing-non-null-assertion": "warn",
			"@typescript-eslint/no-empty-function": "warn",
			"@typescript-eslint/no-inferrable-types": "warn",
			"@typescript-eslint/non-nullable-type-assertion-style": "warn",
			"@typescript-eslint/prefer-find": "warn",
			"@typescript-eslint/prefer-for-of": "warn",
			"@typescript-eslint/prefer-function-type": "warn",
			"@typescript-eslint/prefer-includes": "warn",
			"@typescript-eslint/prefer-nullish-coalescing": "warn",
			"@typescript-eslint/prefer-optional-chain": "warn",
			"@typescript-eslint/prefer-regexp-exec": "warn",
			"@typescript-eslint/prefer-string-starts-ends-with": "warn",
		}
	}
);
