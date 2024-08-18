import { SourceCode } from "../model/SourceCode";
import { parseNumericExpression } from "./NumberUtils";

export function extractFirstInstruction(s: string): string | undefined {

    return extractSourceCode(s).shift()?.instruction;
}

export function extractSourceCode(rawLine: string,
    lineSeparatorCharacter?: string, labelRegExp?: RegExp, repeatRegExp?: RegExp | undefined):
    SourceCode[] {

    // (used instead of /\s/ for performance reasons)
    const whitespaceCharacters = "\f\n\r\t\v\u0020\u00a0\u1680"
        + "\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a"
        + "\u2028\u2029\u202f\u205f\u3000\ufeff";

    // Removes surrounding label, parses and removes repeat pseudo-op
    // eslint-disable-next-line prefer-const
    let [ repetitions, s ] = removeSurroundingLabelAndRepetitions(
        rawLine, labelRegExp, repeatRegExp);

    const fragments: SourceCode[] = [];
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

            // Comment?
            const lineComment = isLineCommentStart(c, s, i, n);
            if (lineComment !== undefined) {
                fragments.push(new SourceCode(currentPart, repetitions, lineComment));
                return fragments;
            }

            // Separator?
            if (lineSeparatorCharacter && c === lineSeparatorCharacter) {
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

function isLineCommentStart(
    c: string, line: string, i: number, n: number): string | undefined {

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
