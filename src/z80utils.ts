
export function parseTimings(s: string): number[] {
    const ss = s.split("/");
    const t0 = parseInt(ss[0]);
    return ss.length === 1 ? [t0, t0] : [t0, parseInt(ss[1])];
}

export function formatTiming(t: number[]): string {
    return t[0] === t[1] ? t[0].toString() : t[0] + "/" + t[1];
}

export function extractInstructionsFrom(rawLine: string): string[] | undefined {
    // Removes surrounding label, whitespace and/or comments
    const line = rawLine.replace(/(^\s*\S+:)|((;|\/\/).*$)/, "").trim();
    if (line.length === 0) {
        return undefined;
    }
    // For every part separated with : ...
    const rawInstructions: string[] = [];
    line.split(/\s*:\s*/).forEach(rawPart => {
        // Simplifies whitespace and converts to uppercase
        const rawInstruction = rawPart.replace(/\s+/, " ").toUpperCase();
        if (rawInstruction.length !== 0) {
            rawInstructions.push(rawInstruction);
        }
    });
    console.log("line", line, "rawInstructions", rawInstructions);
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
