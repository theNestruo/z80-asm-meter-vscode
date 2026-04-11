import { config } from "../config";
import type { SingletonRef } from "../types/References";
import { ConfigurableSingletonRefImpl } from "../types/References";
import { SourceCode } from "../types/SourceCode";
import { parseNumericExpression } from "../utils/NumberUtils";
import { isQuote } from "../utils/SourceCodeUtils";
import { isEmptyOrBlank, toUpperCaseCharacter, whitespaceCharacters } from "../utils/TextUtils";

/**
 * The source code parser/extractor/pre-processor
 */
export interface SourceCodeParser {

	linesToSourceCode(lines: string[]): SourceCode[];

	lineToSourceCode(line: string): SourceCode[];
}

class SourceCodeParserRef extends ConfigurableSingletonRefImpl<SourceCodeParser, SourceCodeParserImpl> {

	protected override createInstance(): SourceCodeParserImpl {
		return new SourceCodeParserImpl();
	}
}

export const sourceCodeParser: SingletonRef<SourceCodeParser> = new SourceCodeParserRef();

//

/**
 * Default implementation of the source code parser/extractor/pre-processor
 */
class SourceCodeParserImpl implements SourceCodeParser {

	// (for performance reasons)
	private readonly lineSeparatorCharacter = config.syntax.lineSeparatorCharacter;

	linesToSourceCode(lines: string[]): SourceCode[] {

		// (sanity checks)
		if (!lines.length) {
			return [];
		}
		if (!lines[lines.length - 1].trim().length) {
			// (removes possible spurious empty line at the end of the selection)
			lines.pop();
			if (!lines.length) {
				return [];
			}
		}

		// Splits the lines and extracts repetition counter and trailing comments
		return lines.flatMap(line => this.lineToSourceCode(line));
	}

	lineToSourceCode(originalLine: string): SourceCode[] {

		// (sanity check: ignore empty line)
		if (isEmptyOrBlank(originalLine)) {
			return [];
		}

		let line = originalLine;

		// Extracts and removes label
		const [label, afterLabelPosition, lineWithoutLabel] = this.extractLabel(line);
		line = lineWithoutLabel;

		// Extracts and removes repetitions
		const [repetitions, lineWithoutRepetitions] = this.extractRepetitions(line);
		line = lineWithoutRepetitions;

		// Extracts and removes trailing comments, splits
		const offset = originalLine.length - line.length;
		const [lineComment, beforeLineCommentPosition, afterLineCommentPosition, lineFragments] =
			this.extractLineCommentAndSplitNormalizeQuotesAware(line, offset);

		const n = lineFragments.length;
		if (!n) {
			// Attempts to preserve label, or line comment for timing hints)
			return (label || lineComment)
				? [new SourceCode("", label, afterLabelPosition, repetitions, beforeLineCommentPosition, afterLineCommentPosition, lineComment)]
				: [];
		}

		// Single fragment: will contain label, repetitions and trailing comments
		if (n === 1) {
			return [new SourceCode(lineFragments[0],
				label, afterLabelPosition, repetitions, beforeLineCommentPosition, afterLineCommentPosition, lineComment)];
		}

		// Multiple fragments: first will contain label and repetitions, last will contain trailing comments
		const sourceCodes: SourceCode[] = [new SourceCode(lineFragments[0], label, afterLabelPosition, repetitions)];
		for (let i = 1; i < n - 1; i++) {
			sourceCodes.push(new SourceCode(lineFragments[i]));
		}
		sourceCodes.push(new SourceCode(lineFragments[n - 1],
			undefined, undefined, undefined, beforeLineCommentPosition, afterLineCommentPosition, lineComment));
		return sourceCodes;
	}

	private extractLabel(line: string): [string | undefined, number | undefined, string] {

		// (sanity check for performance reasons on empty lines)
		if (isEmptyOrBlank(line)) {
			return [undefined, undefined, line];
		}

		// Extracts label
		const matches = config.syntax.labelRegExp.exec(line);
		if (!matches) {
			return [undefined, undefined, line.trimStart()];
		}


		// Returns and removes label
		const rawLabel = matches[1];
		return [rawLabel.trim(), rawLabel.length, line.substring(rawLabel.length).trimStart()];
	}

	private extractRepetitions(line: string): [number, string] {

		// (sanity check; also: perfromance reasons on empty lines)
		if (isEmptyOrBlank(line)) {
			return [1, line];
		}

		const matches = config.syntax.repeatRegExp?.exec(line);
		if (!matches || matches.length < 2 || !matches[1] || !matches[2]) {
			// (no repetitions)
			return [1, line];
		}

		// Extracts and removes repetitions
		const repetitions = parseNumericExpression(matches[1]) ?? 1;
		return [Math.min(1, repetitions), matches[2].trimStart()];
	}

	private extractLineCommentAndSplitNormalizeQuotesAware(s: string, offset: number | undefined): [string | undefined, number | undefined, number | undefined, string[]] {

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

				// Trailing line comments?
				const trailingCommentsDelimiterSize = this.isTrailingCommentsStart(c, s, i, n);
				if (trailingCommentsDelimiterSize) {
					const beforeLineCommentPosition = (offset ?? 0) + i;
					const afterLineCommentPosition = beforeLineCommentPosition + trailingCommentsDelimiterSize;
					fragments.push(currentPartBuilder.join("").trim());
					return [s.substring(afterLineCommentPosition).trim(),
						beforeLineCommentPosition, afterLineCommentPosition, fragments];
				}

				// Separator?
				if (c === this.lineSeparatorCharacter) {
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

		return [undefined, undefined, undefined, fragments];
	}

	private isTrailingCommentsStart(c: string, line: string, i: number, n: number): number {

		return (c === ";") ? 1
			: (c === "/") && (i + 1 < n) && (line[i + 1] === "/") ? 2
				: 0;
	}
}
