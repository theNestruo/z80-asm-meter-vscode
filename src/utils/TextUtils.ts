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

export function espaceIfNotInfix(s: string): string {

    return s.trim().indexOf(" ") === -1 ? ` ${s.trim()} ` : s;
}

export function pluralize(s: string, n: number): string {

    const split = s?.split("|", 2);
    if (!split || split.length === 1) {
        return s;
    }
    return (n === 1) || (n === -1) ? split[0] : split[1];
}
