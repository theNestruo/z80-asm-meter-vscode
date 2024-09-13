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

export function removeEnd(s: string | undefined, suffix: string): string | undefined {

    return s && s.endsWith(suffix)
            ? s.substring(0, s.length - suffix.length)
            : s;
}

export function skipStart(s: string, start?: number, trimStart?: boolean): number {

    const substring = (start === undefined) || (start < 0) ? s : s.substring(start);
    return s.length - (trimStart ? substring.trimStart().length : substring.length);
}

export function skipEnd(s: string, end?: number, trimEnd?: boolean): number {

    const substring = (end === undefined) || (end < 0) ? s : s.substring(0, end);
    return trimEnd ? substring.trimEnd().length : substring.length;
}

export function validateCodicon(ps: string | undefined, defaultCodicon: string): string {

    const s = ps?.trim();
    return (s && s?.startsWith("$(") && s?.endsWith(")")) ? s : defaultCodicon;
}
