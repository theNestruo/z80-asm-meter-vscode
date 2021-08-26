
export function parseTimings(s: string): number[] {
    const ss = s.split("/");
    const t0 = parseInt(ss[0]);
    return ss.length === 1 ? [t0, t0] : [t0, parseInt(ss[1])];
}

export function formatTiming(t: number[]): string {
    return t[0] === t[1] ? t[0].toString() : t[0] + "/" + t[1];
}

export function extractRawInstructionsFrom(rawLine: string, labelRegExp: RegExp, commentRegExp: RegExp, lineSeparatorRegExp: RegExp | undefined): string[] | undefined {
    // Removes surrounding label, whitespace and/or comments
    const line = rawLine.replace(labelRegExp, "").replace(commentRegExp, "").trim();
    if (line.length === 0) {
        return undefined;
    }
    // For every part separated with : ...
    const rawInstructions: string[] = [];
    const rawParts = lineSeparatorRegExp ? line.split(lineSeparatorRegExp) : [line];
    rawParts.forEach(rawPart => {
        // Simplifies whitespace and converts to uppercase
        const rawInstruction = rawPart.replace(/\s+/, " ").toUpperCase();
        if (rawInstruction.length !== 0) {
            rawInstructions.push(rawInstruction);
        }
    });
    return rawInstructions.length === 0 ? undefined : rawInstructions;
}

export function extractMnemonicOf(s: string): string {
    const i = s.indexOf(" ");
    return i === -1 ? s : s.substring(0, i);
}

export function extractOperandsOf(s: string): string[] {
    const i = s.indexOf(" ");
    return i === -1 ? [] : s.substr(i + 1).split(/\s*,\s*/);
}

export function extractOperandsOfQuotesAware(s: string): string[] {
    const i = s.indexOf(" ");
    return i === -1 ? [] : s.substr(i + 1).split(/\s*,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)\s*/);
}

export function formatHexadecimalByte(n: number): string {
    const s = "00" + ((n & 0xff).toString(16).toUpperCase());
    return s.substring(s.length - 2);
}