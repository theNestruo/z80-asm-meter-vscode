import { config } from "../config";
import { Meterable } from "../model/Meterables";
import { TotalTimingMeterable } from "../model/TotalTimingMeterable";

export function parseTimingsLenient(...array: unknown[]): number[] | undefined {

    for (const o of array) {
        const t = parseTimingLenient(o);
        if (t !== undefined) {
            return t;
        }
    }
    return undefined;
}

export function parseTimingLenient(o: unknown): number[] | undefined {

    return (typeof o === "number") ? [o, o]
        : (typeof o === "string") ? parseTiming(o)
            : undefined;
}

export function parseTiming(s: string): number[] {

    const ss = s.split("/");
    const t0 = parseInt(ss[0], 10);
    return ss.length === 1 ? [t0, t0] : [t0, parseInt(ss[1], 10)];
}

export function formatTiming(t: number[]): string {
    return t[0] === t[1] ? t[0].toString() : t[0] + "/" + t[1];
}

export function printHumanReadableTimings(
    totalTimings: (TotalTimingMeterable | undefined)[],
    combined: boolean = false): string {

    let text = "";

    let previousIcon = "";
    let previousValue = "";
    totalTimings.forEach(totalTiming => {
        if (!totalTiming) {
            return;
        }
        const icon = totalTiming.statusBarIcon;
        const value = printHumanReadableTiming(totalTiming) || "0";

        // Combines when the previous timing when they have the same values
        if (!combined) {
            text += `${icon}${value} `;

        } else {
            // Same as previous timing?
            if (value === previousValue) {
                // Combines the decoration
                previousIcon += icon;

            } else {
                // Preserves the previous timing entry
                if (previousIcon || previousValue) {
                    text += `${previousIcon}${previousValue} `;
                }
                // Aggregates a new timing entry
                previousIcon = icon;
                previousValue = value;
            }
        }
    });
    if (combined) {
        text += `${previousIcon}${previousValue} `;
    }
    return text.trim();
}

export function printHumanReadableTiming(meterable: Meterable): string | undefined {

    // timing depending on the platform
    const timing =
        config.platform === "msx" ? meterable.msxTiming
        : config.platform === "cpc" ? meterable.cpcTiming
        : meterable.z80Timing;

    // (no data)
    if (!timing) {
        return undefined;
    }

    // As text
    const text = formatTiming(timing);
    if (!text) {
        return undefined;
    }

    if (config.platform !== "pc8000") {
        return text;
    }

    // Special case: NEC PC-8000 series dual timing
    const m1Text = formatTiming(meterable.msxTiming);
    return `${text} (${m1Text})`;
}
