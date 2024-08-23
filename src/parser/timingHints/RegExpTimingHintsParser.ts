import * as vscode from 'vscode';
import { config } from "../../config";
import { SourceCode } from "../../types";
import { TimingHints } from "../timingHints/TimingHints";
import { parseTimingsLenient } from '../../utils/ParserUtils';
import { TimingHintsParser } from "../Parsers";

const emptyRegExp = new RegExp("");

class RegExpTimingHintsParser implements TimingHintsParser {

    private readonly disposable: vscode.Disposable;

	// Timing hints maps
	private regExpTimingHints: { regExp: RegExp, timingHints: TimingHints }[];

	constructor() {

		// Subscribe to configuration change event
		this.disposable = vscode.workspace.onDidChangeConfiguration(this.onConfigurationChange, this);

        // Initializes definitions
		this.regExpTimingHints = this.reloadDefinitions();
	}

	dispose() {
        this.disposable.dispose();
	}

	onConfigurationChange(e: vscode.ConfigurationChangeEvent) {

        // Re-initializes definitions
		if (e.affectsConfiguration("z80-asm-meter.timing.hints.regexps")) {
			this.regExpTimingHints = this.reloadDefinitions();
		}
	}

	private reloadDefinitions(): { regExp: RegExp, timingHints: TimingHints }[] {

		// Initializes macro maps
		const array: { regExp: RegExp, timingHints: TimingHints }[] = [];

		// Locates macro definitions
		(config.timing.hints.regexps || []).forEach(source => {

			if (!source.pattern) {
				return;
			}
			let regExp: RegExp;
			try {
				regExp = new RegExp(source.pattern, source.flags);
			} catch (ignored) {
				return;
			}
			if (regExp.source === emptyRegExp.source) {
				return;
			}

			const z80Timing =
				parseTimingsLenient(source.z80, source.ts, source.t);
			const msxTiming = config.platform === "msx"
				? (parseTimingsLenient(source.msx, source.m1, source.ts, source.t))
				: (parseTimingsLenient(source.m1, source.msx, source.ts, source.t));
			const cpcTiming =
				parseTimingsLenient(source.cpc, source.ts, source.t);

			if (regExp && (z80Timing || msxTiming || cpcTiming)) {
				array.push({
					regExp: regExp,
					timingHints: new TimingHints(z80Timing, msxTiming, cpcTiming)
				});
			}
		});

		return array;
	}

	get isEnabled(): boolean {
		return this.regExpTimingHints.length !== 0;
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

export const regExpTimingHintsParser = new RegExpTimingHintsParser();
