import * as vscode from 'vscode';
import { config } from "../../config";
import { SourceCode } from "../../types";
import { parseTimingsLenient } from '../../utils/ParserUtils';
import { TimingHintsParser } from "../Parsers";
import { TimingHints } from "../timingHints/TimingHints";
import { LazyOptionalSingleton } from '../../utils/Lifecycle';

class RegExpTimingHintsParserSingleton extends LazyOptionalSingleton<RegExpTimingHintsParser> {

	// Timing hints maps
	private regExpTimingHints: { regExp: RegExp, timingHints: TimingHints }[] = [];

	override activate(context: vscode.ExtensionContext): void {
		super.activate(context);

		context.subscriptions.push(
			// Subscribe to configuration change event
			vscode.workspace.onDidChangeConfiguration(this.onConfigurationChange, this)
		);

		// Initializes definitions
		this.regExpTimingHints = this.reloadDefinitions();
	}

	override dispose() {
        this.regExpTimingHints = [];
		super.dispose();
	}

	override onConfigurationChange(e: vscode.ConfigurationChangeEvent) {
		super.onConfigurationChange(e);

        // Re-initializes definitions
		if (e.affectsConfiguration("z80-asm-meter.timing.hints.regexps")) {
			this.regExpTimingHints = this.reloadDefinitions();
		}
	}

	protected override get enabled(): boolean {
		return this.regExpTimingHints.length !== 0;
	}

	protected override createInstance(): RegExpTimingHintsParser {
		return new RegExpTimingHintsParser(this.regExpTimingHints);
	}

	private readonly emptyRegExpSource = new RegExp("").source;

	private reloadDefinitions(): { regExp: RegExp, timingHints: TimingHints }[] {

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

		return array;
	}
}

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

export const regExpTimingHintsParser = new RegExpTimingHintsParserSingleton();
