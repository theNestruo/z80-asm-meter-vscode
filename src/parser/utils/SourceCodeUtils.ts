import SourceCodeLine from "../model/SourceCodeLine";

export function extractRawInstruction(rawPart: string): string | undefined {

    return normalizeAndSplitQuotesAware(rawPart, undefined).getParts().shift()?.getPart();
}

export function normalizeAndSplitQuotesAware(s: string, separator: string | undefined): SourceCodeLine {

    var sourceCodeLine: SourceCodeLine = new SourceCodeLine();

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
                sourceCodeLine.addPart(currentPart);
                sourceCodeLine.setComment(s.substring(isCommentStart === ";" ? i + 1 : i + 2).trim());
                return sourceCodeLine;
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

        sourceCodeLine.addPart(currentPart);
    }

    return sourceCodeLine;
}
