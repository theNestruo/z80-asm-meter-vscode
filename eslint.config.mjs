import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
	baseDirectory: __dirname,
	recommendedConfig: js.configs.recommended,
	allConfig: js.configs.all
});

export default [
	...compat.extends(
		"eslint:recommended",
		"plugin:@typescript-eslint/strict-type-checked",
		"plugin:@typescript-eslint/stylistic-type-checked"),
	{
		plugins: {
			"@typescript-eslint": typescriptEslint,
		},

		languageOptions: {
			parser: tsParser,
			parserOptions: {
				projectService: true,
				tsconfigRootDir: __dirname,
			},
		},

		rules: {
			semi: [2, "always"],
			//
			// @typescript-eslint/recommended --:
			"@typescript-eslint/no-unused-vars": [
				"warn",
				{
					"argsIgnorePattern": "_\\w*",
					"caughtErrorsIgnorePattern": "_\\w*"
				}
			],
			//
			// @typescript-eslint/recommended-type-checked --:
			"@typescript-eslint/no-unnecessary-type-assertion": "warn",
			"@typescript-eslint/no-unsafe-argument": "warn",
			"@typescript-eslint/no-unsafe-return": "warn",
			"@typescript-eslint/restrict-template-expressions": "warn",
			"@typescript-eslint/unbound-method": "warn",
			//
			// @typescript-eslint/strict --:
			"@typescript-eslint/no-non-null-assertion": "warn",
			//
			// @typescript-eslint/strict-type-checked --:
			"@typescript-eslint/no-unnecessary-condition": "warn",
			"@typescript-eslint/no-unnecessary-type-parameters": "off",
			//
			// @typescript-eslint/stylistic --:
			"@typescript-eslint/class-literal-property-style": "warn",
			"@typescript-eslint/no-empty-function": "warn",
			//
			// @typescript-eslint/stylistic-type-checked --:
			"@typescript-eslint/prefer-string-starts-ends-with": "warn",
			"@typescript-eslint/prefer-nullish-coalescing": "warn",
			"@typescript-eslint/prefer-optional-chain": "warn",
			//
			// ++:
			"@typescript-eslint/consistent-type-exports": "warn",
			"@typescript-eslint/consistent-type-imports": "warn",
			"@typescript-eslint/explicit-function-return-type": "warn",
			"@typescript-eslint/no-unnecessary-parameter-property-assignment": "error",
			"@typescript-eslint/no-useless-empty-export": "error",
			"@typescript-eslint/prefer-readonly": "warn",
		},
	},
];
