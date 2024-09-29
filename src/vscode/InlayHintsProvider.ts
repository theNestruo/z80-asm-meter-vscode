import * as vscode from 'vscode';
import { config, InlayHintPositionType } from '../config';
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

		if (e.affectsConfiguration("z80-asm-meter.inlayHints")) {
			if (e.affectsConfiguration("z80-asm-meter.inlayHints.exitPoint")) {
				this.conditionalExitPointMnemonics = this.initalizeConditionalExitPointMnemonics();
			}
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
		return this
			.findInlayHintCandidates(document, range)
			.map(candidate => candidate.provide());
	}

	resolveInlayHint(hint: vscode.InlayHint, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.InlayHint> {

		// Resolves the inlay hints
		return (hint instanceof InlayHint)
				? hint.resolve()
				: undefined;
	}

	private findInlayHintCandidates(document: vscode.TextDocument, range: vscode.Range): InlayHintProvider[] {

		// (for performance reasons)
		const lineSeparatorCharacter = config.syntax.lineSeparatorCharacter;

		const sourceCodes: SourceCode[] = [];
		const candidates: InlayHintCandidate[] = [];
		let didContainCode = false;

		const providers: InlayHintProvider[] = [];
		for (let i = 0, n = document.lineCount; i < n; i++) {
			const line = document.lineAt(i);

			// Stops looking for inlay hints after the range
			const isAfterRange = line.range.start.isAfter(range.end);
			if (isAfterRange && !candidates.length) {
				break;
			}

			// Extracts the source code
			const lineSourceCodes = lineToSourceCode(line.text, lineSeparatorCharacter);
			if (!lineSourceCodes.length || !lineSourceCodes[0]) {
				continue; // (ignore empty line)
			}
			const sourceCode = lineSourceCodes[0];
			const startSourcesIndex = sourceCodes.length;
			sourceCodes.push(...lineSourceCodes);

			// Checks labels for subroutine starts (if not after the range)
			if (!isAfterRange && this.isValidLabel(sourceCode, candidates)) {
				this.handleValidLabel(candidates, didContainCode, line, startSourcesIndex);
			}

			// Checks source code
			const metered = mainParser.parseInstruction(sourceCode);
			if (!metered || !this.isCode(metered)) {
				continue; // (ignore unparseable source code or no-code (data?) lines)
			}

			// Creates a new candidate on unlabelled code
			if (!didContainCode) {
				this.handleFirstSourceCode(candidates, line, startSourcesIndex);
			}

			didContainCode = true;

			const isBeforeRange = line.range.start.isBefore(range.start);

			// Ends all incomplete subroutines
			if (isUnconditionalJumpOrRetInstruction(metered.instruction)) {

				// Ends all incomplete subroutines
				if (!isBeforeRange) {
					providers.push(...this.handleUnconditionalJumpOrRetInstruction(sourceCodes, candidates, line));
				}

				// (restarts subroutine lookup)
				candidates.length = 0;
				didContainCode = false;

			// Checks subroutine conditional exit point
			} else if (!isBeforeRange && this.isValidConditionalExitPoint(metered.instruction)) {

				providers.push(...this.handleValidConditionalExitPoint(sourceCodes, candidates, line));
			}
		}

		// Completes trailing code as subroutine
		if (candidates.length && didContainCode) {
			const endLine = document.lineAt(document.lineCount - 1);
			providers.push(...this.handleUnconditionalJumpOrRetInstruction(sourceCodes, candidates, endLine));
		}

		return providers;
	}

	private isValidLabel(sourceCode: SourceCode, existingCandidates: InlayHintCandidate[]): boolean {

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
				return existingCandidates.length == 0;
		}
	}

	private handleValidLabel(candidates: InlayHintCandidate[], didContainCode: boolean, line: vscode.TextLine, startSourcesIndex: number) {

		if (!didContainCode) {
			// Discards any previous candidates (labels) because they did not contain code
			candidates.length = 0;
			candidates.push(new InlayHintCandidate(line, startSourcesIndex));
			return;
		}

		if (config.inlayHints.fallthroughSubroutines) {
			// Creates a new candidate on "falls through" labels
			candidates.push(new InlayHintCandidate(line, startSourcesIndex));
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

	private handleFirstSourceCode(candidates: InlayHintCandidate[], line: vscode.TextLine, startSourcesIndex: number) {

		// Creates a new candidate on unlabelled code
		if (!candidates.length && config.inlayHints.unlabelledSubroutines) {
			candidates.length = 0;
			candidates.push(new InlayHintCandidate(line, startSourcesIndex));
		}
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


	private handleUnconditionalJumpOrRetInstruction(
		sourceCodes: SourceCode[], candidates: InlayHintCandidate[], endLine: vscode.TextLine): InlayHintProvider[] {

		return candidates.map(candidate => {

			// Computes the InlayHint position before the comment of the first line
			const [ position, paddingLeft, paddingRight ] = this.computePosition(
				candidate.startLine,
				sourceCodes[candidate.startSourcesIndex],
				config.inlayHints.subroutinesPosition);

			return new InlayHintProvider(
				position,
				paddingLeft,
				paddingRight,
				new vscode.Range(candidate.startLine.range.start, endLine.range.end),
				sourceCodes.slice(candidate.startSourcesIndex, undefined));
		});
	}

	private handleValidConditionalExitPoint(
		sourceCodes: SourceCode[], candidates: InlayHintCandidate[], endLine: vscode.TextLine): InlayHintProvider[] {

		if (!candidates.length) {
			return [];
		}

		// Determines the start of the subroutine
		const candidate = candidates[
			config.inlayHints.exitPointLabel === "first" ? 0 : candidates.length - 1];

		// Computes the InlayHint position before the comment of the last line
		const [ position, paddingLeft, paddingRight ] = this.computePosition(
			endLine,
			sourceCodes[sourceCodes.length - 1],
			config.inlayHints.exitPointPosition);

		return [ new InlayHintProvider(
				position,
				paddingLeft,
				paddingRight,
				new vscode.Range(candidate.startLine.range.start, endLine.range.end),
				sourceCodes.slice(candidate.startSourcesIndex, undefined)) ];
	}

	private computePosition(
		line: vscode.TextLine, source: SourceCode,
		positionType: InlayHintPositionType):
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
class InlayHintCandidate {

	constructor(
		readonly startLine: vscode.TextLine,
		readonly startSourcesIndex: number) {
	}
}

/**
 * An InlayHint candidate; a provider for a single InlayHint
 */
class InlayHintProvider {

	private readonly position: vscode.Position;
	private readonly paddingLeft: boolean;
	private readonly paddingRight: boolean;
	private readonly range: vscode.Range;
	private readonly sourceCode: SourceCode[];

	constructor(position: vscode.Position, paddingLeft: boolean, paddingRight: boolean,
		range: vscode.Range, sourceCode: SourceCode[]) {

		this.position = position;
		this.paddingLeft = paddingLeft;
		this.paddingRight = paddingRight;
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
