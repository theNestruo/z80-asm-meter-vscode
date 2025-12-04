export function hashCode(s: string): number {

    if (!s || !s.length) {
        return 0;
    }

    const n = s.length;
    let hash = 0;
    for (let i = 0; i < n; i++) {
        hash = ((hash << 5) - hash) + s.charCodeAt(i);
        hash |= 0; // (as 32 bit integer)
    }
    return hash;
}

export function spaceIfNotInfix(s: string): string {

    return s.trim().includes(" ") ? s : ` ${s.trim()} `;
}

export function pluralize(s: string, n: number): string {

    const split = s?.split("|", 2);
    if (!split || split.length === 1) {
        return s;
    }
    return (n === 1) || (n === -1) ? split[0] : split[1];
}

export function removeSuffix(s: string | undefined, suffix: string): string | undefined {

    return s && s.endsWith(suffix)
            ? s.substring(0, s.length - suffix.length)
            : s;
}

export function positionFromStart(_s: string, start?: number): number {

    return (start === undefined) || (start < 0)
            ? 0
            : start;
}

export function positionFromStartAndSkipWhitespaceAfter(s: string, start?: number): number {

    const substring = (start === undefined) || (start < 0) ? s : s.substring(start);
    return s.length - substring.trimStart().length;
}

export function positionFromEnd(s: string, end?: number): number {

    return (end === undefined) || (end < 0)
            ? s.length
            : end;
}

export function positionFromEndAndSkipWhitespaceBefore(s: string, end?: number): number {

    const substring = (end === undefined) || (end < 0) ? s : s.substring(0, end);
    return substring.trimEnd().length;
}

export function validateCodicon(ps: string | undefined, defaultCodicon: string): string {

    const s = ps?.trim();
    return (s && s?.startsWith("$(") && s?.endsWith(")")) ? s : defaultCodicon;
}

export const hrMarkdown = "\n---\n\n";
