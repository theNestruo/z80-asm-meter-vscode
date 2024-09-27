import * as vscode from 'vscode';
import { config } from '../config';
import { mainParser } from '../parser/MainParser';
import { TotalTimingMeterable } from '../totalTiming/TotalTimingMeterable';
import { TotalTimings } from '../totalTiming/TotalTimings';
import { Meterable, SourceCode } from '../types';
import { extractMnemonicOf, extractOperandsOf, isAnyCondition, isJrCondition, isUnconditionalJumpOrRetInstruction } from '../utils/AssemblyUtils';
import { hrMarkdown, printableTimingSuffix, printMarkdownTotalTimings, printRange, printTiming } from '../utils/FormatterUtils';
import { lineToSourceCode } from '../utils/SourceCodeUtils';
import { removeEnd, skipEnd, skipStart } from '../utils/TextUtils';
import { isExtensionEnabledFor } from './SourceCodeReader';

/**
 * InlayHintsProvider that shows timing of the execution flow of subroutines
 */
export class InlayHintsProvider implements vscode.InlayHintsProvider {

	private readonly onDidChangeInlayHintsEmitter = new vscode.EventEmitter<void>();

	private readonly disposable: vscode.Disposable;

	// (for performance reasons)
	private conditionalExitPointMnemonics: string[];

	constructor() {

		this.disposable = vscode.Disposable.from(

			// Registers as a inlay hints provider
			vscode.languages.registerInlayHintsProvider(documentSelector(), this),

			// Subscribe to configuration change event
			vscode.workspace.onDidChangeConfiguration(this.onConfigurationChange, this),

			this.onDidChangeInlayHintsEmitter
		);

		this.conditionalExitPointMnemonics = this.initalizeConditionalExitPointMnemonics();
	}

	dispose() {
        this.disposable.dispose();
	}

	onConfigurationChange(e: vscode.ConfigurationChangeEvent) {

		if (e.affectsConfiguration("z80-asm-meter.inlayHints.exitPoint")) {
			this.conditionalExitPointMnemonics = this.initalizeConditionalExitPointMnemonics();
		}
	}

	private initalizeConditionalExitPointMnemonics() {

		const mnemonics = [];
		if (config.inlayHints.exitPointRet) {
			mnemonics.push("RET");
		}
		if (config.inlayHints.exitPointJp) {
			mnemonics.push("JP");
		}
		if (config.inlayHints.exitPointJr) {
			mnemonics.push("JR");
		}
		if (config.inlayHints.exitPointDjnz) {
			mnemonics.push("DJNZ");
		}
		return mnemonics;
	}

	readonly onDidChangeInlayHints: vscode.Event<void> = this.onDidChangeInlayHintsEmitter.event;

	provideInlayHints(document: vscode.TextDocument, range: vscode.Range, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.InlayHint[]> {

		if (!config.inlayHints.enabled || !isExtensionEnabledFor(document)) {
			return undefined;
		}

		// Locates the inlay hints candidates within the requested range and provides the inlay hints
		return new InlayHintCandidateFinder(this.conditionalExitPointMnemonics)
			.findInlayHintCandidates(document, range)
			.map(candidate => candidate.provide());
	}

	resolveInlayHint(hint: vscode.InlayHint, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.InlayHint> {

		// Resolves the inlay hints
		return (hint instanceof InlayHint)
				? hint.resolve()
				: undefined;
	}

}

function documentSelector(): readonly vscode.DocumentFilter[] {

	return [
		...config.languageIds.map(languageId => { return { language: languageId }; }),
		// Always enabled if it is a Z80 assembly file
		{ language: "z80-asm-meter" }
	];
}

/**
 * A possible InlayHint candidate; temporary container
 * while the source code is being parsed and the exit point is yet to be found
 */
class InlayHintCandidateFinder {

	// (for performance reasons)
	private readonly conditionalExitPointMnemonics: string[];
	private readonly lineSeparatorCharacter: string | undefined;
	private readonly subroutinesPosition: "lineStart" | "afterLabel" | "beforeCode" | "afterCode" | "beforeComment" | "lineEnd";
	private readonly unlabelledSubroutines: boolean;
	private readonly fallthroughSubroutines: boolean;
	private readonly exitPointPosition: "lineStart" | "afterLabel" | "beforeCode" | "afterCode" | "beforeComment" | "lineEnd";

	constructor(conditionalExitPointMnemonics: string[]) {

		this.conditionalExitPointMnemonics = conditionalExitPointMnemonics;

		this.lineSeparatorCharacter = config.syntax.lineSeparatorCharacter;
		this.subroutinesPosition = config.inlayHints.subroutinesPosition;
		this.unlabelledSubroutines = config.inlayHints.unlabelledSubroutines;
		this.fallthroughSubroutines = config.inlayHints.fallthroughSubroutines;
		this.exitPointPosition = config.inlayHints.exitPointPosition;
	}

	private ongoingCandidates: OngoingInlayHintCandidate[] = [];
	private didContainCode: boolean = false;
	private sources: SourceCode[] = [];

	findInlayHintCandidates(document: vscode.TextDocument, range: vscode.Range): InlayHintCandidate[] {

		this.ongoingCandidates = [];
		this.didContainCode = false;
		this.sources = [];

		const candidates: InlayHintCandidate[] = [];
		for (let i = 0, n = document.lineCount; i < n; i++) {
			const line = document.lineAt(i);

			// Stops looking for candidates after the range
			const isAfterRange = line.range.start.isAfter(range.end);
			if (isAfterRange && !this.ongoingCandidates.length) {
				break;
			}

			// Extracts the source code
			const lineSources = lineToSourceCode(line.text, this.lineSeparatorCharacter);
			if (!lineSources.length || !lineSources[0]) {
				continue; // (ignore empty line)
			}
			const lineSource = lineSources[0];

			// (saves source code on each previously found candidate)
			const startSourcesIndex = this.sources.length;
			this.sources.push(...lineSources);
			const endSourcesIndex = this.sources.length;

			// Checks labels for subroutine starts (if not after the range)
			if (!isAfterRange && this.isValidLabel(lineSource)) {
				if (!this.didContainCode) {
					// Discards any previous candidates (labels) because they did not contain code
					this.ongoingCandidates = [ new OngoingInlayHintCandidate(line, startSourcesIndex) ];

				} else if (this.fallthroughSubroutines) {
					// Creates a new candidate on "falls through" labels
					this.ongoingCandidates.push(new OngoingInlayHintCandidate(line, startSourcesIndex));
				}
			}

			// Checks source code
			const metered = mainParser.parseInstruction(lineSource);
			if (!metered || !this.isCode(metered)) {
				continue; // (ignore unparseable source code or no-code (data?) lines)
			}

			// Creates a new candidate on unlabelled code
			if (!this.didContainCode && !this.ongoingCandidates.length && this.unlabelledSubroutines) {
				this.ongoingCandidates = [ new OngoingInlayHintCandidate(line, startSourcesIndex) ];
			}

			this.didContainCode = true;

			const isBeforeRange = line.range.start.isBefore(range.start);

			// Checks subroutine ends
			if (isUnconditionalJumpOrRetInstruction(metered.instruction)) {
				// Ends all incomplete subroutines (if not before the range)
				if (!isBeforeRange) {
					candidates.push(
						...this.withUnconditionalJumpOrRetInstruction(line, endSourcesIndex));
				}

				// (restarts subroutine lookup)
				this.ongoingCandidates = [];
				this.didContainCode = false;

			// Checks subroutine conditional exit point (if not before the range)
			} else if (!isBeforeRange && this.isValidConditionalExitPoint(metered.instruction)) {
				candidates.push(
					...this.withConditionalExitPoint(line, endSourcesIndex));
			}
		}

		// Completes trailing code as subroutine
		if (this.ongoingCandidates.length && this.didContainCode) {
			const line = document.lineAt(document.lineCount - 1);
			const endSourcesIndex = this.sources.length;
			candidates.push(
				...this.withUnconditionalJumpOrRetInstruction(line, endSourcesIndex));
		}

		return candidates;
	}

	private isValidLabel(sourceCode: SourceCode): boolean {

		// (sanity checks)
		if (!sourceCode.label) {
			return false; // (no label)
		}
		if (!sourceCode.label.startsWith(".") && !sourceCode.label.startsWith("@@")) {
			return true; // (non-nested label)
		}

		switch (config.inlayHints.nestedSubroutines) {
			case "disabled":
				return false;

			case "enabled":
				return true;

			case "entryPoint":
				// If there is no ongoing subroutines, it is an entry point
				return this.ongoingCandidates.length == 0;
		}
	}

	private isCode(meterable: Meterable): boolean {

		// timing depending on the platform
		const timing =
			config.platform === "msx" ? meterable.msxTiming
			: config.platform === "cpc" ? meterable.cpcTiming
			: meterable.z80Timing;

		return timing && !!timing[0];
	}

	private isValidConditionalExitPoint(instruction: string): boolean {

		const mnemonic = extractMnemonicOf(instruction);
		if (!this.conditionalExitPointMnemonics.includes(mnemonic)) {
			return false;
		}

		const operands = extractOperandsOf(instruction);

		switch (mnemonic) {
		case "RET":
			return (operands.length === 1) && isAnyCondition(operands[0]);
		case "JP":
			return (operands.length === 2) && isAnyCondition(operands[0]);
		case "JR":
			return (operands.length === 2) && isJrCondition(operands[0]);
		case "DJNZ":
			return (operands.length === 1);
		default:
			// (should never happen)
			return false;
		}
	}

	/**
	 * Materializes the possible InlayHint candidates
	 * @returns the InlayHint candidates, before the comment of the first line
	 */
	private withUnconditionalJumpOrRetInstruction(
		endLine: vscode.TextLine, endSourcesIndex: number): InlayHintCandidate[] {

		// (sanity check)
		if (!this.ongoingCandidates.length) {
			return [];
		}

		return this.ongoingCandidates.map(ongoingCandidate => {

			// Computes the InlayHint position before the comment of the first line
			const [ position, paddingLeft, paddingRight ] = this.computePosition(
				ongoingCandidate.startLine,
				this.sources[ongoingCandidate.startSourcesIndex],
				this.subroutinesPosition);

			return new InlayHintCandidate(
				position,
				paddingLeft,
				paddingRight,
				new vscode.Range(ongoingCandidate.startLine.range.start, endLine.range.end),
				this.sources.slice(ongoingCandidate.startSourcesIndex, endSourcesIndex));
		});
	}

	/**
	 * Materializes the possible InlayHint candidate
	 * @returns the InlayHint candidate, before the comment of the last line
	 */
	private withConditionalExitPoint(
		endLine: vscode.TextLine, endSourcesIndex: number): InlayHintCandidate[] {

		// (sanity checks)
		if (!this.ongoingCandidates.length) {
			return [];
		}

		const candidate = this.ongoingCandidates[
			config.inlayHints.exitPointLabel === "first" ? 0 : this.ongoingCandidates.length - 1];

		// Computes the InlayHint position before the comment of the last line
		const [ position, paddingLeft, paddingRight ] = this.computePosition(
			endLine,
			this.sources[endSourcesIndex - 1],
			this.exitPointPosition);

		return [
			new InlayHintCandidate(
				position,
				paddingLeft,
				paddingRight,
				new vscode.Range(candidate.startLine.range.start, endLine.range.end),
				this.sources.slice(candidate.startSourcesIndex, endSourcesIndex))
		];
	}

	private computePosition(
		line: vscode.TextLine, source: SourceCode,
		positionType: "lineStart" | "afterLabel" | "beforeCode" | "afterCode" | "beforeComment" | "lineEnd"):
		[ vscode.Position, boolean, boolean ] {

		switch (positionType) {
			case "lineStart":
				return [ line.range.start, false, true ];

			case "afterLabel":
				return [
					line.range.start.with(undefined, skipStart(line.text, source.afterLabelPosition, false)),
					!!source.afterLabelPosition, false
				];

			case "beforeCode":
				return [
					line.range.start.with(undefined, skipStart(line.text, source.afterLabelPosition, true)),
					true, true
				];

			case "afterCode":
				return [
					line.range.start.with(undefined, skipEnd(line.text, source.beforeLineCommentPosition, true)),
					true, true
				];

			case "beforeComment":
				return [
					line.range.start.with(undefined, skipEnd(line.text, source.beforeLineCommentPosition, false)),
					true, !!source.beforeLineCommentPosition
				];

			case "lineEnd":
				return [ line.range.end, true, false ];
		}
	}
}

/**
 * A possible InlayHint candidate; temporary container
 * while the source code is being parsed and the exit point is yet to be found
 */
class OngoingInlayHintCandidate {

	constructor(
		readonly startLine: vscode.TextLine,
		readonly startSourcesIndex: number) {
	}
}

/**
 * An InlayHint candidate
 */
class InlayHintCandidate {

	private readonly position: vscode.Position;
	private readonly paddingLeft: boolean;
	private readonly paddingRight: boolean;
	private readonly range: vscode.Range;
	private readonly sourceCode: SourceCode[];

	constructor(position: vscode.Position, paddingLeft: boolean, paddingRight: boolean,
		range: vscode.Range, sourceCode: SourceCode[]) {

		this.position = position;
		this.paddingRight = paddingRight;
		this.paddingLeft = paddingLeft;
		this.range = range;
		this.sourceCode = sourceCode;
	}

	/**
	 * @returns the actual InlayHint
	 */
	provide(): vscode.InlayHint {

		// Computes the actual data
		const totalTimings = new TotalTimings(mainParser.parse(this.sourceCode)!);
		const totalTiming = totalTimings.best();
		const timing = printTiming(totalTiming) ?? "0";
		const timingSuffix = printableTimingSuffix();

		// Computes the InlayHint label
		const label = `${timing}${timingSuffix}`;

		return new InlayHint(this.position, label, this.paddingLeft, this.paddingRight,
			this.range, totalTimings, totalTiming, timing, timingSuffix, this.sourceCode[0]);
	}
}

/**
 * An InlayHint that has been provided and can be resolved
 */
class InlayHint extends vscode.InlayHint {

	private readonly range: vscode.Range;

	private readonly timing: string;
	private readonly timingSuffix: string;
	private readonly totalTimings: TotalTimings;
	private readonly totalTiming: TotalTimingMeterable;

	private readonly sourceCodeWithLabel: SourceCode;

	constructor(position: vscode.Position, label: string, paddingLeft: boolean, paddingRight: boolean,
		range: vscode.Range,
		totalTimings: TotalTimings, totalTiming: TotalTimingMeterable, timing: string, timingSuffix: string,
		sourceCodeWithLabel: SourceCode) {

		super(position, label);
		this.paddingLeft = paddingLeft;
		this.paddingRight = paddingRight;

		this.range = range;

		this.totalTimings = totalTimings;
		this.totalTiming = totalTiming;
		this.timing = timing;
		this.timingSuffix = timingSuffix;
		this.sourceCodeWithLabel = sourceCodeWithLabel;
	}

	resolve(): vscode.InlayHint {

		// (sanity check)
		if (this.tooltip) {
			return this;
		}

		// Computes the InlayHint tooltip
		const header = removeEnd(this.sourceCodeWithLabel.label, ":");
		const timingText = `**${this.timing}**${this.timingSuffix}`;
		const rangeText = printRange(this.range);
		this.tooltip = new vscode.MarkdownString([
			"|||",
			"|:-:|---|",
			header ? `||**${header}**|\n||_${rangeText}_|` : "||_${rangeText}_|",
			`|${this.totalTiming.statusBarIcon}|${this.totalTiming.name}: ${timingText}|`,
			hrMarkdown,
			...printMarkdownTotalTimings(this.totalTimings)
		].join("\n"), true);

		return this;
	}
}
