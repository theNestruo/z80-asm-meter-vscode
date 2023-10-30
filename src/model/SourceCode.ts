import { parseNumericExpression } from "../utils/NumberUtils";

export function extractFirstInstruction(s: string): string | undefined {

    return extractSourceCode(s).shift()?.instruction;
}

export function extractSourceCode(rawLine: string, separator?: string,
    labelRegExp?: RegExp, repeatRegExp?: RegExp | undefined): SourceCode[] {

    // Removes surrounding label, parses and removes repeat pseudo-op
    let [ repetitions, s ] = removeSurroundingLabelAndRepetitions(
        rawLine, labelRegExp, repeatRegExp);

    let fragments: SourceCode[] = [];
    const n = s.length;
    for (let i = 0; i < n; i++) {

        // For every part
        let currentPart = "";
        let quoted = null;
        let whitespace = -1;
        for (; i < n; i++) {
            const c = s.charAt(i);

            // Inside quotes
            if (quoted) {
                currentPart += c;
                if (c === quoted) {
                    quoted = null;
                }
                continue;
            }

            // Comment?
            const isCommentStart = (c === ";")
                || (c === "/") && (i + 1 < n) && (s.charAt(i + 1) === "/")
                ? c
                : undefined;
            if (isCommentStart) {
                const lineComment = s.substring(isCommentStart === ";" ? i + 1 : i + 2).trim();
                fragments.push(new SourceCode(currentPart, repetitions, lineComment));
                return fragments;
            }

            // Separator?
            if (separator && c === separator) {
                break;
            }

            // Whitespace?
            if (/\s/.test(c)) {
                whitespace = whitespace < 0 ? -1 : 1;
                continue;
            }

            // Not whitespace
            if (whitespace > 0) {
                currentPart += " ";
            }
            whitespace = 0;

            // Quote?
            if ((c === "\"")
                // Prevents considering "'" as a quote
                // when parsing the instruction "ex af,af'"
                || ((c === "'") && (!/^ex\s*af\s*,\s*af$/i.test(currentPart)))) {
                quoted = c;
            }

            currentPart += c.toUpperCase();
        }

        fragments.push(new SourceCode(currentPart, repetitions));
        repetitions = 1;
    }

    return fragments;
}

function removeSurroundingLabelAndRepetitions(
    line: string, labelRegExp?: RegExp, repeatRegExp?: RegExp): [number, string] {

    // Removes surrounding label
    let s = labelRegExp
        ? line.replace(labelRegExp, "").trim() // (trim after regexp!)
        : line.trim();

    // Parses and removes repeat pseudo-op
    let repetitions = 1;
    if (repeatRegExp) {
        const matches = repeatRegExp.exec(s);
        if (matches && matches.length >= 2 && matches[1] && matches[2]) {
            const parsedRepetitions = parseNumericExpression(matches[1]) || 1;
            if (parsedRepetitions && parsedRepetitions > 0) {
                repetitions = parsedRepetitions;
            }
            s = matches[2].trim();
        }
    }
    return [repetitions, s];
}

/**
 * A container for source code:
 * an instruction, and an optional trailing comment of the entire line
 */
export class SourceCode {

    /** The instruction (the actual source code) */
    readonly instruction: string;

    /** The optional line repetition count */
    readonly repetitions: number;

    /** The optional trailing comment of the entire line */
    readonly lineComment: string | undefined;

    constructor(instruction: string, repetitions?: number, lineComment?: string) {
        this.instruction = instruction;
        this.repetitions = repetitions || 1;
        this.lineComment = lineComment;
    }
}
