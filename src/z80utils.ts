
export function parseTimings(s: string): number[] {
    const ss = s.split("/");
    const t0 = parseInt(ss[0]);
    return ss.length === 1 ? [t0, t0] : [t0, parseInt(ss[1])];
}

export function formatTiming(t: number[]): string {
    return t[0] === t[1] ? t[0].toString() : t[0] + "/" + t[1];
}

export function extractInstructionFrom(rawLine: string): string | undefined {
    // Removes surrounding label, whitespace and/or comments
    const line = rawLine.replace(/(^\s*\S+:)|((;|\/\/).*$)/, "").trim();
    // Simplifies whitespace and converts to uppercase
    return line.length === 0 ? undefined : line.replace(/\s+/, " ").toUpperCase();
}

export function extractMnemonicOf(s: string): string {
    const i = s.indexOf(" ");
    return i === -1 ? s : s.substring(0, i);
}

export function extractOperandsOf(s: string): string[] {
    const i = s.indexOf(" ");
    return i === -1 ? [] : s.substr(i + 1).split(/\s*,\s*/);
}
