import * as vscode from 'vscode';
import { config } from "../../config";
import { SourceCode } from "../../types/SourceCode";
import { TimingHints } from "../../types/TimingHintedMeterable";
import { OptionalSingletonHolderImpl } from '../../utils/Lifecycle';
import { parseTimingsLenient } from '../../utils/ParserUtils';
import { TimingHintsParser } from '../TimingHintsParser';

class RegExpTimingHintsParserHolder extends OptionalSingletonHolderImpl<RegExpTimingHintsParser> {

	// Timing hints maps
	private _regExpTimingHints?: { regExp: RegExp, timingHints: TimingHints }[] = undefined;

	override dispose() {
        this._regExpTimingHints = undefined;
		super.dispose();
	}

	override onConfigurationChange(e: vscode.ConfigurationChangeEvent) {
		super.onConfigurationChange(e);

        // Forces re-creation on RegExp-based timing hints definitions change
		if (e.affectsConfiguration("z80-asm-meter.timing.hints.regexps")) {
			this._instance = undefined;
			this._regExpTimingHints = undefined;
		}
	}

	protected override get enabled(): boolean {
		return config.timing.hints.enabled
				&& (this.regExpTimingHints?.length !== 0);
	}

	protected override createInstance(): RegExpTimingHintsParser {
		return new RegExpTimingHintsParser(this.regExpTimingHints);
	}

	private readonly emptyRegExpSource = new RegExp("").source;

	private get regExpTimingHints(): { regExp: RegExp, timingHints: TimingHints }[] {

		if (this._regExpTimingHints === undefined) {

			// Initializes macro maps
			const array: { regExp: RegExp, timingHints: TimingHints }[] = [];

			// Locates macro definitions
			config.timing.hints.regexps?.forEach(source => {

				if (!source.pattern) {
					return;
				}
				let regExp: RegExp;
				try {
					regExp = new RegExp(source.pattern, source.flags);
				} catch (ignored) {
					return;
				}
				if (regExp.source === this.emptyRegExpSource) {
					return;
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
			});

			this._regExpTimingHints = array;
		}

		return this._regExpTimingHints;
	}
}

export const regExpTimingHintsParser = new RegExpTimingHintsParserHolder();

/**
 * Actual implementation of the RegExp-based timing hints parser
 */
class RegExpTimingHintsParser implements TimingHintsParser {

	constructor(
		private readonly regExpTimingHints: { regExp: RegExp, timingHints: TimingHints }[]) {
	}

	parse(s: SourceCode): TimingHints | undefined {

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
