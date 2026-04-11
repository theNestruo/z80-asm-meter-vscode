import { toUpperCaseCharacter, whitespaceCharacters } from "./TextUtils";

export function splitNormalizeQuotesAware(s: string, separator: string | undefined): string[] {

	const fragments: string[] = [];

	const n = s.length;
	for (let i = 0; i < n; i++) {

		// For every part
		const currentPartBuilder: string[] = []; // (avoids string concatenation for performance reasons)
		let quoted = undefined;
		let whitespace = -1;
		for (; i < n; i++) {
			const c = s[i];

			// Inside quotes
			if (quoted) {
				currentPartBuilder.push(c);
				if (c === quoted) {
					quoted = undefined;
				}
				continue;
			}

			// Separator?
			if (c === separator) {
				break;
			}

			// Whitespace?
			if (whitespaceCharacters.has(c)) {
				whitespace = whitespace < 0 ? -1 : 1;
				continue;
			}

			// Not whitespace
			if (whitespace > 0) {
				currentPartBuilder.push(" ");
			}
			whitespace = 0;

			// Quote?
			quoted = isQuote(c, currentPartBuilder);

			currentPartBuilder.push(toUpperCaseCharacter(c));
		}

		fragments.push(currentPartBuilder.join("").trim());
	}

	return fragments;
}

// (precompiled RegExp for performance reasons)
const exAfAfRegexp = /^ex af ?, ?af$/i;

export function isQuote(c: string, currentPartBuilder: string[]): string | undefined {

	return (c === "\"") ? c
		// Prevents considering "'" as a quote
		// when parsing the instruction "ex af,af'"
		: ((c === "'")
			&& ((currentPartBuilder.length < 8) // (too short; shortest is "ex af,af")
				|| (currentPartBuilder.length > 10) // (too long; longest is "ex af , af")
				|| (!exAfAfRegexp.test(currentPartBuilder.join(""))))) ? c
			: undefined;
}
