export function parteIntLenient(o: unknown): number {

    return (typeof o === "number") ? o
        : (typeof o === "string") ? parseInt(o, 10)
            : NaN;
}

export function undefinedIfNaN(n: number): number | undefined {

    return isNaN(n) ? undefined : n;
}

export function parseTimingsLenient(o: unknown): number[] | undefined {

    return (typeof o === "number") ? [o, o]
        : (typeof o === "string") ? parseTimings(o)
            : undefined;
}

export function parseTimings(s: string): number[] {

    const ss = s.split("/");
    const t0 = parseInt(ss[0], 10);
    return ss.length === 1 ? [t0, t0] : [t0, parseInt(ss[1], 10)];
}

export function formatTiming(t: number[]): string {
    return t[0] === t[1] ? t[0].toString() : t[0] + "/" + t[1];
}

export function formatHexadecimalByte(n: number): string {

    const s = "00" + ((n & 0xff).toString(16).toUpperCase());
    return s.substring(s.length - 2);
}
