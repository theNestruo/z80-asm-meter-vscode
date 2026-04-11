
// (used instead of /\s/ for performance reasons)
export const whitespaceCharacters = "\f\n\r\t\v\u0020\u00a0\u1680"
	+ "\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a"
	+ "\u2028\u2029\u202f\u205f\u3000\ufeff";

export function isEmptyOrBlank(s: string | undefined): boolean {

	if (!s) {
		return true;
	}

	const n = s.length;
	for (let i = 0; i < n; i++) {
		if (!whitespaceCharacters.includes(s[i])) {
			return false;
		}
	}
	return true;
}

export function splitNormalizeQuotesAware(s: string, separator: string | undefined): string[] {

	const fragments: string[] = [];

	const n = s.length;
	for (let i = 0; i < n; i++) {

		// For every part
		let currentPart = "";
		let quoted = undefined;
		let whitespace = -1;
		for (; i < n; i++) {
			const c = s[i];

			// Inside quotes
			if (quoted) {
				currentPart += c;
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
			if (whitespaceCharacters.includes(c)) {
				whitespace = whitespace < 0 ? -1 : 1;
				continue;
			}

			// Not whitespace
			if (whitespace > 0) {
				currentPart += " ";
			}
			whitespace = 0;

			// Quote?
			quoted = isQuote(c, currentPart);

			currentPart += c.toUpperCase();
		}

		fragments.push(currentPart.trim());
	}

	return fragments;
}

// (precompiled RegExp for performance reasons)
const exAfAfRegexp = /^ex af ?, ?af$/i;

export function isQuote(c: string, currentPart: string): string | undefined {

	return (c === "\"") ? c
		// Prevents considering "'" as a quote
		// when parsing the instruction "ex af,af'"
		: ((c === "'")
			&& ((currentPart.length < 8) // (too short; shortest is "ex af,af")
				|| (currentPart.length > 10) // (too long; longest is "ex af , af")
				|| (!exAfAfRegexp.test(currentPart)))) ? c
			: undefined;
}
