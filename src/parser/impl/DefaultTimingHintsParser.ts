import { config } from "../../config";
import { SourceCode } from "../../model/SourceCode";
import { TimingHints } from "../../model/TimingHints";
import { parseTimingLenient } from "../../utils/TimingUtils";
import { TimingHintsParser } from "../Parsers";

class DefaultTimingHintsParser implements TimingHintsParser {

	get isEnabled(): boolean {
		return config.timing.hintsEnabled;
	}

	parse(s: SourceCode): TimingHints | undefined {

		const rawComment = s.lineComment;

		// (sanity check)
		if (!rawComment) {
			return undefined;
		}

		// Checks timing hint comment
		const matches = rawComment?.matchAll(/\[(ts?|z80|cpc|msx|m1)\s*=\s*((?:\-\s*)?\d+(?:\/(?:\-\s*)?\d+)?)\]/g);
		if (!matches) {
			return undefined;
		}

		// Parses timing hint comment
		const timingHints = new Map<string, number[]>;
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

		const z80TimingHint =
			timingHints.get("z80")
			|| timingHints.get("ts")
			|| timingHints.get("t");
		const msxTimingHint = config.platform === "msx"
			? (timingHints.get("msx")
				|| timingHints.get("m1")
				|| timingHints.get("ts")
				|| timingHints.get("t"))
			: (timingHints.get("m1")
				|| timingHints.get("msx")
				|| timingHints.get("ts")
				|| timingHints.get("t"));
		const cpcTimingHint =
			timingHints.get("cpc")
			|| timingHints.get("ts")
			|| timingHints.get("t");

		return new TimingHints(z80TimingHint, msxTimingHint, cpcTimingHint);
	}
}

export const defaultTimingHintsParser = new DefaultTimingHintsParser();
