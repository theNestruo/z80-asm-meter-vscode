import { config } from "../../config";
import { SourceCode } from "../../model/SourceCode";
import { TimingHints } from "../../model/TimingHints";
import { parseTimingLenient } from "../../utils/TimingUtils";
import { TimingHintsParser } from "../Parsers";

export class DefaultTimingHintsParser implements TimingHintsParser {

	// Singleton
	static instance = new DefaultTimingHintsParser();

	get isEnabled(): boolean {
		return config.timing.hints.enabled;
	}

	/**
	 * FIXME DESCRIPTION
	 * Conditionaly builds an instance of a repetition of Meterables
	 * @param meterable The meterable instance
	 * @param rawComment The line comment; can contain timing hints
	 * @return The meterable instance, or a hinted meterable instance,
	 * depending on the contents of the line comment
	 */
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
		var z80TimingHint: number[] | undefined;
		var msxTimingHint: number[] | undefined;
		var cpcTimingHint: number[] | undefined;
		var timingHint: number[] | undefined;
		for (const match of matches) {
			const parsedTimingHint = parseTimingLenient(match[2]);
			if (!parsedTimingHint) {
				continue;
			}

			switch (match[1]) {
				case "z80":
					z80TimingHint = parsedTimingHint;
					break;
				case "msx":
				case "m1":
					msxTimingHint = parsedTimingHint;
					break;
				case "cpc":
					cpcTimingHint = parsedTimingHint;
					break;
				case "t":
				case "ts":
					timingHint = parsedTimingHint;
					break;
			}
		}

		// Validates timing hint comment
		if (!z80TimingHint && !msxTimingHint && !cpcTimingHint && !timingHint) {
			return undefined;
		}

		return new TimingHints(z80TimingHint, msxTimingHint, cpcTimingHint, timingHint);
	}
}
