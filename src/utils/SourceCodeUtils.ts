import { config } from '../config';
import { SourceCode } from "../types/SourceCode";
import { parseNumericExpression } from './NumberUtils';

// (used instead of /\s/ for performance reasons)
const whitespaceCharacters = "\f\n\r\t\v\u0020\u00a0\u1680"
		+ "\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a"
		+ "\u2028\u2029\u202f\u205f\u3000\ufeff";

export function linesToSourceCode(lines: string[]): SourceCode[] {

	// (sanity checks)
	if (!lines.length) {
		return [];
	}
	if (lines[lines.length - 1].trim() === "") {
		// (removes possible spurious empty line at the end of the selection)
		lines.pop();
		if (!lines.length) {
			return [];
		}
	}

	// Splits the lines and extracts repetition counter and trailing comments
	const lineSeparatorCharacter = config.syntax.lineSeparatorCharacter;
	return lines.flatMap(line => lineToSourceCode(line, lineSeparatorCharacter));
}

export function lineToSourceCode(originalLine: string, lineSeparatorCharacter: string | undefined): SourceCode[] {

	let line = originalLine;

	// Extracts trailing comments
	const [ beforeLineCommentPosition, afterLineCommentPosition ] = indexOfTrailingCommentsQuotesAware(line, lineSeparatorCharacter);
	const lineComment = afterLineCommentPosition !== undefined
			? line.substring(afterLineCommentPosition).trim()
			: undefined;

	// Removes trailing comments
	if (beforeLineCommentPosition !== undefined) {
		line = line.substring(0, beforeLineCommentPosition).trimEnd();
	}

	// Extracts and removes label
	let label: string | undefined = undefined;
	let afterLabelPosition: number | undefined = undefined;
	[ label, afterLabelPosition, line ] = extractLabel(line);

	// Extracts and removes repetitions
	let repetitions: number = 1;
	[ repetitions, line ] = extractRepetitions(line);

	// Splits
	const lineFragments = splitNormalizeQuotesAware(line, lineSeparatorCharacter);

	const n = lineFragments.length;
	if (!n) {
		// Attempts to preserve label, or line comment for timing hints)
		return (label || lineComment)
				? [ new SourceCode("", label, afterLabelPosition, repetitions, beforeLineCommentPosition, afterLineCommentPosition, lineComment) ]
				: [];
	}

	// Single fragment: will contain label, repetitions and trailing comments
	if (n === 1) {
		return [ new SourceCode(lineFragments[0],
			label, afterLabelPosition, repetitions, beforeLineCommentPosition, afterLineCommentPosition, lineComment) ];
	}

	// Multiple fragments: first will contain label and repetitions, last will contain trailing comments
	const sourceCodes: SourceCode[] = [ new SourceCode(lineFragments[0], label, afterLabelPosition, repetitions) ];
	for (let i = 1; i < n - 1; i++) {
		sourceCodes.push(new SourceCode(lineFragments[i]));
	}
	sourceCodes.push(new SourceCode(lineFragments[n - 1],
		undefined, undefined, undefined, beforeLineCommentPosition, afterLineCommentPosition, lineComment));
	return sourceCodes;
}

function indexOfTrailingCommentsQuotesAware(s: string, lineSeparatorCharacter: string | undefined): [ number | undefined, number | undefined ] {

	// (for performance reasons)
	const n = s.length;

	for (let i = 0; i < n; i++) {

		// For every part
		let currentPart = ""; // (required for isQuote(c, currentPart))
		let quoted = undefined;
		let whitespace = -1; // (required for isQuote(c, currentPart))
		for (; i < n; i++) {
			const c = s.charAt(i);

			// Inside quotes
			if (quoted) {
				currentPart += c;
				if (c === quoted) {
					quoted = undefined;
				}
				continue;
			}

			// Trailing line comments?
			const trailingCommentsDelimiterSize = isTrailingCommentsStart(c, s, i, n);
			if (trailingCommentsDelimiterSize) {
				return [ i, i + trailingCommentsDelimiterSize ];
			}

			// Separator?
			if (c === lineSeparatorCharacter) {
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
	}

	return [ undefined, undefined ];
}

function isTrailingCommentsStart(c: string, line: string, i: number, n: number): number {

	return (c === ";") ? 1
		: (c === "/") && (i + 1 < n) && (line.charAt(i + 1) === "/") ? 2
		: 0;
}

function extractLabel(line: string): [ string | undefined, number | undefined, string ] {

	// (sanity check for performance reasons on empty lines)
	if (!line) {
		return [ undefined, undefined, line ];
	}

	// Extracts label
	const matches = config.syntax.labelRegExp.exec(line);
	if (!matches) {
		return [ undefined, undefined, line.trimStart() ];
	}


	// Returns and removes label
	const rawLabel = matches[1];
	return [ rawLabel.trim(), rawLabel.length, line.substring(rawLabel.length).trimStart() ];
}

function extractRepetitions(line: string): [ number, string ] {

	// (sanity check; also: perfromance reasons on empty lines)
	if (!line) {
		return [ 1, line ];
	}

	const matches = config.syntax.repeatRegExp?.exec(line);
	if (!matches || matches.length < 2 || !matches[1] || !matches[2]) {
		// (no repetitions)
		return [ 1, line ];
	}

	// Extracts and removes repetitions
	const repetitions = parseNumericExpression(matches[1]) ?? 1;
	return [ Math.min(1, repetitions), matches[2].trimStart() ];
}

export function splitNormalizeQuotesAware(s: string, lineSeparatorCharacter: string | undefined): string[] {

	const fragments: string[] = [];

	const n = s.length;
	for (let i = 0; i < n; i++) {

		// For every part
		let currentPart = "";
		let quoted = undefined;
		let whitespace = -1;
		for (; i < n; i++) {
			const c = s.charAt(i);

			// Inside quotes
			if (quoted) {
				currentPart += c;
				if (c === quoted) {
					quoted = undefined;
				}
				continue;
			}

			// Separator?
			if (c === lineSeparatorCharacter) {
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

function isQuote(c: string, currentPart: string): string | undefined {

	return (c === "\"") ? c
		// Prevents considering "'" as a quote
		// when parsing the instruction "ex af,af'"
		: ((c === "'") && (!exAfAfRegexp.test(currentPart))) ? c
		: undefined;
}
