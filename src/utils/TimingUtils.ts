import { config } from '../config';
import { Meterable } from '../types/Meterable';

/*
 * Print
 */

export function printableTimingSuffix() {

	return config.platform === "cpc" ? " NOPs" : "clock cycles";
}

export function printTiming(meterable: Meterable): string | undefined {

	// timing depending on the platform
	const timing = config.platform === "msx" ? meterable.msxTiming
		: config.platform === "cpc" ? meterable.cpcTiming
			: meterable.z80Timing;

	// (no data)
	if (!timing) {
		return undefined;
	}

	// As text
	const text = formatTiming(timing);

	// Special case: NEC PC-8000 series dual timing
	if (config.platform !== "pc8000") {
		return text;
	}
	const m1Text = formatTiming(meterable.msxTiming);
	return `${text} (${m1Text})`;
}

/*
 * Format
 */

export function formatTiming(t: number[]): string {

	return t[0] === t[1] ? t[0].toString() : t[0] + "/" + t[1];
}

/*
 * Parse
 */

export function parseTimingsLenient(...array: unknown[]): number[] | undefined {

    for (const o of array) {
        const t = parseTimingLenient(o);
        if (t !== undefined) {
            return t;
        }
    }
    return undefined;
}

export function parseTiming(s: string): number[] {

    const ss = s.split("/");
    const t0 = parseInt(ss[0], 10);
    return ss.length === 1 ? [t0, t0] : [t0, parseInt(ss[1], 10)];
}

export function parseTimingLenient(o: unknown): number[] | undefined {

    return (typeof o === "number") ? [o, o]
        : (typeof o === "string") ? parseTiming(o)
            : undefined;
}
