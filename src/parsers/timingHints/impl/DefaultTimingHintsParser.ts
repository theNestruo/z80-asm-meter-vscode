import { config } from "../../../config";
import { OptionalSingletonRefImpl } from "../../../types/References";
import type { SourceCode } from "../../../types/SourceCode";
import { parseTimingLenient } from "../../../utils/TimingUtils";
import { TimingHints } from "../types/TimingHints";
import type { TimingHintsParser } from "../types/TimingHintsParser";

class DefaultTimingHintsParserRef extends OptionalSingletonRefImpl<TimingHintsParser, DefaultTimingHintsParser> {

	protected override get enabled(): boolean {
		return config.timing.hints.enabled;
	}

	protected override createInstance(): DefaultTimingHintsParser {
		return new DefaultTimingHintsParser();
	}
}

export const defaultTimingHintsParser = new DefaultTimingHintsParserRef();

//

/**
 * Actual implementation of the default timing hints parser
 */
class DefaultTimingHintsParser implements TimingHintsParser {

	// (precompiled RegExp for performance reasons)
	private readonly timingHintsRegexp = /\[(ts?|z80|cpc|msx|m1)\s*=\s*((?:-\s*)?\d+(?:\/(?:-\s*)?\d+)?)\]/g;

	parseTimingHints(s: SourceCode): TimingHints | undefined {

		// (sanity check)
		const rawComment = s.lineComment;
		if (!rawComment) {
			return undefined;
		}

		// Parses timing hint comment
		const matches = rawComment.matchAll(this.timingHintsRegexp);
		const timingHints = new Map<string, number[]>();
		for (const match of matches) {
			const parsedTimingHint = parseTimingLenient(match[2]);
			if (parsedTimingHint) {
				timingHints.set(match[1], parsedTimingHint);
			}
		}

		// Validates timing hint comment
		if (!timingHints.size) {
			return undefined;
		}

		const tTimingHint = timingHints.get("ts") ?? timingHints.get("t");
		const z80TimingHint = timingHints.get("z80") ?? tTimingHint;
		const msxTimingHint = (config.platform === "msx")
			? (timingHints.get("msx") ?? timingHints.get("m1") ?? tTimingHint)
			: (timingHints.get("m1") ?? timingHints.get("msx") ?? tTimingHint);
		const cpcTimingHint = timingHints.get("cpc") ?? tTimingHint;

		return new TimingHints(z80TimingHint, msxTimingHint, cpcTimingHint);
	}
}
