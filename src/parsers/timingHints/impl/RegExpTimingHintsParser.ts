import type * as vscode from "vscode";
import { config } from "../../../config";
import { OptionalSingletonRefImpl } from "../../../types/References";
import type { SourceCode } from "../../../types/SourceCode";
import { parseTimingsLenient } from "../../../utils/TimingUtils";
import { TimingHints } from "../types/TimingHints";
import type { TimingHintsParser } from "../types/TimingHintsParser";

class RegExpTimingHintsParserRef extends OptionalSingletonRefImpl<TimingHintsParser, RegExpTimingHintsParser> {

	// Timing hints maps
	private theRegExpTimingHints?: { regExp: RegExp, timingHints: TimingHints }[] = undefined;

	protected override get enabled(): boolean {
		return config.timing.hints.enabled
			&& !!this.regExpTimingHints.length;
	}

	protected override createInstance(): RegExpTimingHintsParser {
		return new RegExpTimingHintsParser(this.regExpTimingHints);
	}

	private readonly emptyRegExpSource = new RegExp("").source;

	private get regExpTimingHints(): { regExp: RegExp, timingHints: TimingHints }[] {

		if (this.theRegExpTimingHints === undefined) {

			// Initializes macro maps
			const array: { regExp: RegExp, timingHints: TimingHints }[] = [];

			// Locates macro definitions
			for (const source of config.timing.hints.regexps) {

				if (!source.pattern) {
					continue;
				}
				let regExp: RegExp;
				try {
					regExp = new RegExp(source.pattern, source.flags);
				} catch (_) {
					continue;
				}
				if (regExp.source === this.emptyRegExpSource) {
					continue;
				}

				const z80Timing =
					parseTimingsLenient(source.z80, source.ts, source.t);
				const msxTiming = config.platform === "msx"
					? (parseTimingsLenient(source.msx, source.m1, source.ts, source.t))
					: (parseTimingsLenient(source.m1, source.msx, source.ts, source.t));
				const cpcTiming =
					parseTimingsLenient(source.cpc, source.ts, source.t);

				if (z80Timing || msxTiming || cpcTiming) {
					array.push({
						regExp: regExp,
						timingHints: new TimingHints(z80Timing, msxTiming, cpcTiming)
					});
				}
			}

			this.theRegExpTimingHints = array;
		}

		return this.theRegExpTimingHints;
	}

	protected override onConfigurationChange(e: vscode.ConfigurationChangeEvent): void {
		super.onConfigurationChange(e);

		// Forces re-creation on RegExp-based timing hints definitions change
		if (e.affectsConfiguration("z80-asm-meter.timing.hints.regexps")) {
			this.theInstance = undefined;
			this.theRegExpTimingHints = undefined;
		}
	}

	override dispose(): void {
		this.theRegExpTimingHints = undefined;
		super.dispose();
	}
}

export const regExpTimingHintsParser = new RegExpTimingHintsParserRef();

//

/**
 * Actual implementation of the RegExp-based timing hints parser
 */
class RegExpTimingHintsParser implements TimingHintsParser {

	constructor(
		private readonly regExpTimingHints: { regExp: RegExp, timingHints: TimingHints }[]) {
	}

	parseTimingHints(s: SourceCode): TimingHints | undefined {

		const rawComment = s.lineComment;

		// (sanity check)
		if (!rawComment) {
			return undefined;
		}

		for (const pair of this.regExpTimingHints) {
			if (pair.regExp.test(rawComment)) {
				return pair.timingHints;
			}
		}

		return undefined;
	}
}
