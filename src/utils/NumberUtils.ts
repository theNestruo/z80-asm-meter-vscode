/*
 * Format
 */

import { moveToFirst } from "./ArrayUtils";

export function formatHexadecimalNumber(n: number): string {

	return n.toString(16).toUpperCase();
}

export function formatHexadecimalByte(n: number): string {

	const s = "00" + ((n & 0xff).toString(16).toUpperCase());
	return s.substring(s.length - 2);
}

/*
 * Parse
 */

class NumericExpressionParser {

	constructor(
		private readonly regexp: RegExp,
		private readonly radix: number) {
	}

	parseUnsigned(us: string): number | undefined {
		const matches = this.regexp.exec(us);
		return matches && matches.length >= 1
			? parseInt(matches[1], this.radix)
			: undefined;
	}
}

const numericParsers: NumericExpressionParser[] = [
	new NumericExpressionParser(/^0[Xx]([0-9A-Fa-f]+)$/, 16),
	new NumericExpressionParser(/^[#$&]([0-9A-Fa-f]+)$/, 16),
	new NumericExpressionParser(/^([0-9A-Fa-f]+)[Hh]$/, 16),
	new NumericExpressionParser(/^[0@]([0-7]+)$/, 8),
	new NumericExpressionParser(/^([0-7]+)[Oo]$/, 8),
	new NumericExpressionParser(/^%([01]+)$/, 2),
	new NumericExpressionParser(/^([01]+)[Bb]$/, 2),
	new NumericExpressionParser(/^([0-9]+)$/, 10)
];

const valid = /^0?[Xx#$&@%]?[0-9A-Fa-f]+[HhOoBb]?$/;

export function parseNumericExpression(s: string, includeNegatives = true): number | undefined {

	const negative = s.startsWith("-");
	if (negative && (!includeNegatives)) {
		return undefined;
	}

	const us = negative ? s.substring(1).trim() : s;

	// (quickly discard non-numeric inputs)
	if (!valid.test(us)) {
		return undefined;
	}

	const n = numericParsers.length;
	for (let i = 0; i < n; i++) {
		const numericParser = numericParsers[i];
		const value = numericParser.parseUnsigned(us);
		if ((value !== undefined) && (!isNaN(value))) {

			// (for performance reasons:
			// moves the numeric parser first, so frequent formats will be attempted first next time
			// and uncommon formats will be demoted to last positions of the array)
			moveToFirst(numericParsers, i);

			return negative ? -value : value;
		}
	}

	return undefined;
}

export function parteIntLenient(o: unknown): number | undefined {

	if (typeof o === "number") {
		return isNaN(o) ? undefined : o;
	}

	if (typeof o === "string") {
		return parseNumericExpression(o);
	}

	return undefined;
}
