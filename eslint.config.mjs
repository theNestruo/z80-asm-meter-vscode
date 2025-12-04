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
    ...compat.extends("eslint:recommended", "plugin:@typescript-eslint/strict", "plugin:@typescript-eslint/stylistic"),
    {
        plugins: {
            "@typescript-eslint": typescriptEslint,
        },

        languageOptions: {
            parser: tsParser,
        },

        rules: {
            semi: [2, "always"],
            "@typescript-eslint/no-non-null-assertion": "off", // "plugin:@typescript-eslint/strict"
            "@typescript-eslint/no-unused-vars": [ // "plugin:@typescript-eslint/recommended"
                "warn",
                {
                    "argsIgnorePattern": "_\\w*",
                    "caughtErrorsIgnorePattern": "_\\w*"
                }
            ],
            "@typescript-eslint/class-literal-property-style": "off", // "plugin:@typescript-eslint/stylistic"
            "@typescript-eslint/no-empty-function": "warn", // "plugin:@typescript-eslint/stylistic"
        },
    },
];
