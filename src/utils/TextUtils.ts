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

export function removeStart(s: string | undefined, prefix: string): string | undefined {

    return s && s.startsWith(prefix)
            ? s.substring(prefix.length)
            : s;
}

export function removeEnd(s: string | undefined, suffix: string): string | undefined {

    return s && s.endsWith(suffix)
            ? s.substring(0, s.length - suffix.length)
            : s;
}

export function uncapitalize(s: string): string {

    if (!s || !s.length) {
        return "";
    }

    return s.charAt(0).toLowerCase() + s.substring(1);
}

export function indexOfNonWhitespace(s: string, position?: number): number {

    const ss = s.substring(position || 0);
    return ss.length - ss.trimStart().length;
}
