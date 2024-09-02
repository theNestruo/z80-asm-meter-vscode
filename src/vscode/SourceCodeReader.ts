import * as vscode from 'vscode';
import { config } from '../config';
import { SourceCode } from '../types';
import { parseNumericExpression } from '../utils/ParserUtils';

// (used instead of /\s/ for performance reasons)
const whitespaceCharacters = "\f\n\r\t\v\u0020\u00a0\u1680"
		+ "\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a"
		+ "\u2028\u2029\u202f\u205f\u3000\ufeff";

export function readSourceCodeFromActiveTextEditorSelecion(): SourceCode[] {

	return preprocessLinesAsSourceCode(readLinesFromActiveTextEditorSelection());
}

export function readLinesFromActiveTextEditorSelection(): string[] {

	const editor = vscode.window.activeTextEditor;
	if ((!editor) || (!isExtensionEnabledFor(editor.document))) {
		return [];
	}

	// No selection; uses cursor position
	if (editor.selection.isEmpty) {
		return [ editor.document.lineAt(editor.selection.active.line).text ];
	}

	return readLinesFrom(editor.document, editor.selection, config.expandSelectionToLine);
}

export function readSourceCodeFrom(
	document: vscode.TextDocument, range: vscode.Range, expandRangeToLine: boolean = true): SourceCode[] {

	return preprocessLinesAsSourceCode(readLinesFrom(document, range, expandRangeToLine));
}

export function readLinesFrom(
	document: vscode.TextDocument, range: vscode.Range, expandRangeToLine: boolean = true): string[] {

	// Single line selection?
	if (range.isSingleLine) {
		// Expand single line selection to line?
		return [ config.expandSelectionToLine ? document.lineAt(range.start).text : document.getText(range) ];
	}

	const lines = [];
	if (expandRangeToLine) {
		// Expand multiline selection
		const m = range.end.character ? range.end.line : range.end.line - 1;
		for (let i = range.start.line; i <= m; i++) {
			lines.push(document.lineAt(i).text);
		}

	} else {
		// Do not expand multiline selection
		const n = range.start.line, m = range.end.line;
		for (let i = n; i <= m; i++) {
			const line = document.lineAt(i);
			lines.push(range.contains(line.range)
				? line.text
				: document.getText(range.intersection(line.range)));
		}
	}
	return lines;
}

export function isExtensionEnabledFor(document: vscode.TextDocument): boolean {

	const languageId = document.languageId;
	return config.languageIds.includes(languageId)
		// Always enabled if it is a Z80 assembly file
		|| (languageId === "z80-asm-meter");
}

export function preprocessLinesAsSourceCode(lines: string[]): SourceCode[] {

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
	const sourceCode: SourceCode[] = [];
	lines.forEach(line => {
		sourceCode.push(...preprocessLineAsSourceCode(line));
	});
	return sourceCode;
}

export function preprocessLineAsSourceCode(line: string): SourceCode[] {

	const [ label, lineAfterLabel ] = extractLabel(line);
	const [ repetitions, lineAfterRepetitions ] = extractRepetitions(lineAfterLabel);
	const [ lineFragments, trailingComments ] = normalizeSplitAndExtractTrailingComments(lineAfterRepetitions);

	const n = lineFragments.length;
	if (!n) {
		// Attempts to preserve label, or line comment for timing hints)
		return (label || trailingComments)
				? [ new SourceCode(label, repetitions, "", trailingComments) ]
				: [];
	}

	// Single fragment: will contain label, repetitions and trailing comments
	if (n === 1) {
		return [ new SourceCode(label, repetitions, lineFragments[0], trailingComments) ];
	}

	// Multiple fragments: first will contain label and repetitions, last will contain trailing comments
	const sourceCodes: SourceCode[] = [ new SourceCode(label, repetitions, lineFragments[0], undefined) ];
	for (let i = 1; i < n - 1; i++) {
		sourceCodes.push(new SourceCode(undefined, 1, lineFragments[i], undefined));
	}
	sourceCodes.push(new SourceCode(undefined, 1, lineFragments[n - 1], trailingComments));
	return sourceCodes;
}

function extractLabel(line: string): [ string | undefined, string, number ] {

	const matches = config.syntax.labelRegExp.exec(line);
	if (!matches || !matches[1]) {
		// (no label)
		return [ undefined, line.trimStart(), 0 ];
	}

	// Extracts and removes label
	const label = matches[1];
	return [ label.trim(), line.substring(label.length).trimStart(), label.length ];
}

function extractRepetitions(line: string): [ number , string ] {

	const matches = config.syntax.repeatRegExp?.exec(line);
	if (!matches || matches.length < 2 || !matches[1] || !matches[2]) {
		// (no repetitions)
		return [ 1, line ];
	}

	const repetitions = parseNumericExpression(matches[1]) || 1;
	if (repetitions <= 0) {
		// (unparseable repetitions; removes repetitions)
		return [ 1, matches[2].trimStart() ];
	}

	// Extracts and removes repetitions
	return [ repetitions, matches[2].trimStart() ];
}

export function normalizeSplitQuotesAware(s: string, separator: string): string[] {

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

function normalizeSplitAndExtractTrailingComments(s: string): [ string[] , string | undefined ] {

	const lineFragments: string[] = [];

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

			// Trailing line comments?
			const trailingComments = isTrailingCommentsStart(c, s, i, n);
			if (trailingComments !== undefined) {
				lineFragments.push(currentPart.trim());
				return [ lineFragments, trailingComments ];
			}

			// Separator?
			if (c === config.syntax.lineSeparatorCharacter) {
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

		lineFragments.push(currentPart.trim());
	}

	return [ lineFragments, undefined ] ;
}

function isTrailingCommentsStart(c: string, line: string, i: number, n: number): string | undefined {

	return (c === ";") ? line.substring(i + 1).trim()
		: (c === "/") && (i + 1 < n) && (line.charAt(i + 1) === "/") ? line.substring(i + 2).trim()
		: undefined;
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
