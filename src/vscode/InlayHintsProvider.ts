import * as vscode from 'vscode';
import { config } from '../config';
import { mainParser } from '../parser/MainParser';
import { TotalTimingMeterable } from '../totalTiming/TotalTimingMeterable';
import { TotalTimings } from '../totalTiming/TotalTimings';
import { Meterable, SourceCode } from '../types';
import { extractMnemonicOf, extractOperandsOf, isAnyCondition, isJrCondition, isUnconditionalJumpOrRetInstruction } from '../utils/AssemblyUtils';
import { hrMarkdown, printableTimingSuffix, printMarkdownTotalTimings, printRange, printTiming } from '../utils/FormatterUtils';
import { lineToSourceCode } from '../utils/SourceCodeUtils';
import { positionFromEnd, positionFromEndAndSkipWhitespaceBefore, positionFromStartAndSkipWhitespaceAfter, positionFromStart, removeSuffix } from '../utils/TextUtils';
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
		return this.locateInlayHintCandidates(document, range)
			.map(candidate => candidate.provide());
	}

	resolveInlayHint(hint: vscode.InlayHint, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.InlayHint> {

		// Resolves the inlay hints
		return (hint instanceof InlayHint)
				? hint.resolve()
				: undefined;
	}

	private locateInlayHintCandidates(document: vscode.TextDocument, range: vscode.Range): InlayHintCandidate[] {

		// (for performance reasons)
		const lineSeparatorCharacter = config.syntax.lineSeparatorCharacter;
		const subroutinesPosition = config.inlayHints.subroutinesPosition;
		const unlabelledSubroutines = config.inlayHints.unlabelledSubroutines;
		const fallthroughSubroutines = config.inlayHints.fallthroughSubroutines;
		const exitPointPosition = config.inlayHints.exitPointPosition;

		const candidates: InlayHintCandidate[] = [];

		let ongoingCandidates: OngoingInlayHintCandidate[] = [];
		let didContainCode: boolean = false;
		for (let i = 0, n = document.lineCount; i < n; i++) {
			const line = document.lineAt(i);

			// Stops looking for candidates after the range
			const isAfterRange = line.range.start.isAfter(range.end);
			if (isAfterRange && !ongoingCandidates.length) {
				break;
			}

			const sourceCodes = lineToSourceCode(line.text, lineSeparatorCharacter);
			if (!sourceCodes.length || !sourceCodes[0]) {
				continue; // (ignore empty line)
			}
			const sourceCode = sourceCodes[0];

			// (saves source code on each previously found candidate)
			ongoingCandidates.forEach(candidateBuilder => {
				candidateBuilder.sourceCode.push(...sourceCodes);
			});

			// Checks labels for subroutine starts (if not after the range)
			if (!isAfterRange && this.isValidLabel(sourceCode, ongoingCandidates)) {
				if (!didContainCode) {
					// Discards any previous candidates (labels) because they did not contain code
					ongoingCandidates = [ new OngoingInlayHintCandidate(line, sourceCodes) ];

				} else if (fallthroughSubroutines) {
					// Creates a new candidate on "falls through" labels
					ongoingCandidates.push(new OngoingInlayHintCandidate(line, sourceCodes));
				}
			}

			// Checks source code
			const metered = mainParser.parseInstruction(sourceCode);
			if (!metered || !this.isCode(metered)) {
				continue; // (ignore unparseable source code or no-code (data?) lines)
			}

			// Creates a new candidate on unlabelled code
			if (!didContainCode && !ongoingCandidates.length && unlabelledSubroutines) {
				ongoingCandidates = [ new OngoingInlayHintCandidate(line, sourceCodes) ];
			}

			didContainCode = true;

			const isBeforeRange = line.range.start.isBefore(range.start);

			// Checks subroutine ends
			if (isUnconditionalJumpOrRetInstruction(metered.instruction)) {
				// Ends all incomplete subroutines (if not before the range)
				if (!isBeforeRange) {
					candidates.push(
						...this.withUnconditionalJumpOrRetInstruction(ongoingCandidates, line, subroutinesPosition));
				}

				// (restarts subroutine lookup)
				ongoingCandidates = [];
				didContainCode = false;

			// Checks subroutine conditional exit point (if not before the range)
			} else if (!isBeforeRange && this.isValidConditionalExitPoint(metered.instruction)) {
				candidates.push(
					...this.withConditionalExitPoint(ongoingCandidates, line, exitPointPosition));
			}
		}

		// Completes trailing code as subroutine
		if (ongoingCandidates.length && didContainCode) {
			const line = document.lineAt(document.lineCount - 1);
			candidates.push(
				...this.withUnconditionalJumpOrRetInstruction(ongoingCandidates, line, subroutinesPosition));
		}

		return candidates;
	}

	private isValidLabel(sourceCode: SourceCode, incompleteSubroutines: OngoingInlayHintCandidate[]): boolean {

		// (sanity checks)
		if (!sourceCode.label) {
			return false; // (no label)
		}
		if (!sourceCode.label.startsWith(".") && !sourceCode.label.startsWith("@@")) {
			return true; // (non-nested label)
		}

		switch (config.inlayHints.nestedSubroutines) {
			case 'disabled':
				return false;

			case 'enabled':
				return true;

			case 'entryPoint':
				// If there is no ongoing subroutines, it is an entry point
				return incompleteSubroutines.length == 0;
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
		ongoingCandidates: OngoingInlayHintCandidate[], endLine: vscode.TextLine,
		positionType: "lineStart" | "afterLabel" | "beforeCode" | "afterCode" | "beforeComment" | "insideComment" | "lineEnd"):
		InlayHintCandidate[] {

		// (sanity check)
		if (!ongoingCandidates.length) {
			return [];
		}

		return ongoingCandidates.map(ongoingCandidate =>
			ongoingCandidate.withUnconditionalJumpOrRetInstruction(endLine, positionType));
	}

	/**
	 * Materializes the possible InlayHint candidate
	 * @returns the InlayHint candidate, before the comment of the last line
	 */
	private withConditionalExitPoint(
		ongoingCandidates: OngoingInlayHintCandidate[], endLine: vscode.TextLine,
		positionType: "lineStart" | "afterLabel" | "beforeCode" | "afterCode" | "beforeComment" | "insideComment" | "lineEnd"):
		InlayHintCandidate[] {

		// (sanity checks)
		if (!ongoingCandidates.length) {
			return [];
		}

		return [
			ongoingCandidates[config.inlayHints.exitPointLabel === "first" ? 0 : ongoingCandidates.length - 1]
			.withConditionalExitPoint(endLine, positionType)
		];
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
class OngoingInlayHintCandidate {

	readonly startLine: vscode.TextLine;

	readonly sourceCode: SourceCode[];

	constructor(startLine: vscode.TextLine, sourceCode: SourceCode[]) {
		this.startLine = startLine;
		this.sourceCode = sourceCode;
	}

	/**
	 * Materializes the InlayHint candidate
	 * @returns the InlayHint candidate
	 */
	withUnconditionalJumpOrRetInstruction(
		endLine: vscode.TextLine,
		positionType: "lineStart" | "afterLabel" | "beforeCode" | "afterCode" | "beforeComment" | "insideComment" | "lineEnd"):
		InlayHintCandidate {

		// Computes the InlayHint position before the comment of the first line
		const [ position, paddingLeft, paddingRight ] =
			this.computePosition(this.startLine, this.sourceCode[0], positionType);

		return new InlayHintCandidate(
			position,
			paddingLeft,
			paddingRight,
			new vscode.Range(this.startLine.range.start, endLine.range.end),
			[...this.sourceCode]);
	}

	/**
	 * Materializes the InlayHint candidate
	 * @returns the InlayHint candidate
	 */
	withConditionalExitPoint(
		endLine: vscode.TextLine,
		positionType: "lineStart" | "afterLabel" | "beforeCode" | "afterCode" | "beforeComment" | "insideComment" | "lineEnd"):
		InlayHintCandidate {

		// Computes the InlayHint position before the comment of the last line
		const [ position, paddingLeft, paddingRight ] =
			this.computePosition(endLine, this.sourceCode[this.sourceCode.length - 1], positionType);

		return new InlayHintCandidate(
			position,
			paddingLeft,
			paddingRight,
			new vscode.Range(this.startLine.range.start, endLine.range.end),
			[...this.sourceCode]);
	}

	private computePosition(
		line: vscode.TextLine, sourceCode: SourceCode,
		positionType: "lineStart" | "afterLabel" | "beforeCode" | "afterCode" | "beforeComment" | "insideComment" | "lineEnd"):
		[ vscode.Position, boolean, boolean ] {

		switch (positionType) {
			case 'lineStart':
				return [ line.range.start, false, true ];

			case 'afterLabel':
				return [
					line.range.start.with(undefined, positionFromStart(line.text, sourceCode.afterLabelPosition)),
					!!sourceCode.afterLabelPosition, false
				];

			case 'beforeCode':
				return [
					line.range.start.with(undefined, positionFromStartAndSkipWhitespaceAfter(line.text, sourceCode.afterLabelPosition)),
					true, true
				];

			case 'afterCode':
				return [
					line.range.start.with(undefined, positionFromEndAndSkipWhitespaceBefore(line.text, sourceCode.beforeLineCommentPosition)),
					true, true
				];

			case 'beforeComment':
				return [
					line.range.start.with(undefined, positionFromEnd(line.text, sourceCode.beforeLineCommentPosition)),
					true, !!sourceCode.beforeLineCommentPosition
				];

			case 'insideComment':
				return [
					line.range.start.with(undefined, positionFromEnd(line.text, sourceCode.afterLineCommentPosition)),
					true, !!sourceCode.afterLineCommentPosition
				];

			case 'lineEnd':
				return [ line.range.end, true, false ];
		}
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
		const label = `${timing} ${timingSuffix}`;

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
		const header = removeSuffix(this.sourceCodeWithLabel.label, ":");
		const timingText = `**${this.timing}** ${this.timingSuffix}`;
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
