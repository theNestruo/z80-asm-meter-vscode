import * as vscode from 'vscode';
import { config } from '../config';
import { mainParser } from '../parser/MainParser';
import { TotalTimings } from '../totalTiming/TotalTimings';
import { Meterable, SourceCode } from '../types';
import { extractMnemonicOf, extractOperandsOf, isAnyCondition, isJrCondition, isUnconditionalJumpOrRetInstruction } from '../utils/AssemblyUtils';
import { hrMarkdown, printableTimingSuffix, printRange, printTiming, printTooltipMarkdown } from '../utils/FormatterUtils';
import { lineToSourceCode } from '../utils/SourceCodeUtils';
import { removeEnd } from '../utils/TextUtils';
import { isExtensionEnabledFor } from './SourceCodeReader';
import { TotalTimingMeterable } from '../totalTiming/TotalTimingMeterable';

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

		// Builds the inlay hints
		return this.locateInlayHintCandidates(document)
				.filter(candidate => range.intersection(candidate.range))
				.map(candidate => candidate.provide());
	}

	resolveInlayHint(hint: vscode.InlayHint, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.InlayHint> {

		return (hint instanceof UnresolvedInlayHint)
				? hint.resolve()
				: undefined;
	}

	private locateInlayHintCandidates(document: vscode.TextDocument): InlayHintCandidate[] {

		// const start = performance.now();

		const candidates: InlayHintCandidate[] = [];

		let ongoingCandidates: OngoingInlayHintCandidate[] = [];
		let containsCode: boolean = false;
		for (let i = 0, n = document.lineCount; i < n; i++) {
			const line = document.lineAt(i);
			const sourceCodes = lineToSourceCode(line.text);
			if (!sourceCodes.length || !sourceCodes[0]) {
				continue; // (ignore empty lines)
			}

			// (saves source code on each previously found candidate)
			ongoingCandidates.forEach(candidateBuilder => {
				candidateBuilder.sourceCode.push(...sourceCodes);
			});

			// Checks labels (for subroutine starts)
			const sourceCode = sourceCodes[0];
			if (this.isValidLabel(sourceCode, ongoingCandidates)) {
				if (!containsCode) {
					// Discards any previous candidates (labels) because they did not contain code
					ongoingCandidates = [ new OngoingInlayHintCandidate(line, sourceCodes) ];

				} else if (config.inlayHints.fallthroughSubroutines) {
					// Creates a new candidate on "falls through" labels
					ongoingCandidates.push(new OngoingInlayHintCandidate(line, sourceCodes));
				}
			}

			// Checks source code
			const metered = mainParser.parseInstruction(sourceCode);
			if (!metered) {
				// (nothing else to do on unparseable source code)
				continue;
			}

			// Checks code
			if (!this.isCode(metered)) {
				// Checks data
				if (!containsCode && metered.size) {
					// Discards previous candidate (label) because it contains data
					ongoingCandidates.pop();
				}
				// (nothing else to do on no-code lines)
				continue;
			}

			// Creates a new candidate on unlabelled code
			if (!containsCode && !ongoingCandidates.length && config.inlayHints.unlabelledSubroutines) {
				ongoingCandidates = [ new OngoingInlayHintCandidate(line, sourceCodes) ];
			}
			containsCode = true;

			// Checks subroutine end
			if (isUnconditionalJumpOrRetInstruction(metered.instruction)) {
				// Ends all incomplete subroutines
				candidates.push(...this.withUnconditionalJumpOrRetInstruction(ongoingCandidates, line));

				// (restarts sections)
				ongoingCandidates = [];
				containsCode = false;

			// Checks subroutine conditional exit point
			} else if (this.isValidConditionalExitPoint(metered.instruction)) {
				// Subroutine conditional exit point
				candidates.push(...this.withConditionalExitPoint(ongoingCandidates, line));
			}
		}

		// Completes trailing code as subroutine
		if (ongoingCandidates.length && containsCode) {
			const line = document.lineAt(document.lineCount - 1);
			candidates.push(...this.withUnconditionalJumpOrRetInstruction(ongoingCandidates, line));
		}

		// const elapsed = performance.now() - start;
		// console.log(`${document.lineCount} lines: ${candidates.length} InlayHint candidates in ${elapsed} ms`);

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

	private withUnconditionalJumpOrRetInstruction(ongoingCandidates: OngoingInlayHintCandidate[], endLine: vscode.TextLine): InlayHintCandidate[] {

		return ongoingCandidates.map(ongingCandidate =>
			ongingCandidate.withUnconditionalJumpOrRetInstruction(endLine));
	}

	private withConditionalExitPoint(ongoingCandidates: OngoingInlayHintCandidate[], endLine: vscode.TextLine): InlayHintCandidate[] {

		// (sanity check)
		if (!ongoingCandidates.length) {
			return [];
		}

		const ongoingCandidate = config.inlayHints.exitPointLabel === "first"
				? ongoingCandidates[0]
				: ongoingCandidates[ongoingCandidates.length - 1];
		return [ ongoingCandidate.withConditionalExitPoint(endLine) ];
	}
}

function documentSelector(): readonly vscode.DocumentFilter[] {

	return [
		...config.languageIds.map(languageId => { return { language: languageId }; }),
		// Always enabled if it is a Z80 assembly file
		{ language: "z80-asm-meter" }
	];
}

class OngoingInlayHintCandidate {

	private readonly startLine: vscode.TextLine;

	readonly sourceCode: SourceCode[];

	constructor(startLine: vscode.TextLine, sourceCode: SourceCode[]) {
		this.startLine = startLine;
		this.sourceCode = sourceCode;
	}

	withUnconditionalJumpOrRetInstruction(endLine: vscode.TextLine): InlayHintCandidate {

		// Computes the InlayHint position before the comment of the first line
		const lineCommentPosition = this.sourceCode[0].beforeLineCommentPosition;
		const hasLineComment = lineCommentPosition >= 0;
		const positionCharacter = hasLineComment
				? this.startLine.text.substring(0, lineCommentPosition).trimEnd().length
				: this.startLine.text.trimEnd().length;
		const inlayHintPosition = this.startLine.range.end.with(undefined, positionCharacter);

		return new InlayHintCandidate(inlayHintPosition,
			this.startLine, endLine, this.sourceCode, hasLineComment);
	}

	withConditionalExitPoint(endLine: vscode.TextLine): InlayHintCandidate {

		// Computes the InlayHint position before the comment of the last line
		const lineCommentPosition = this.sourceCode[this.sourceCode.length - 1].beforeLineCommentPosition;
		const hasLineComment = lineCommentPosition >= 0;
		const positionCharacter = hasLineComment
				? endLine.text.substring(0, lineCommentPosition).trimEnd().length
				: endLine.text.trimEnd().length;
		const inlayHintPosition = endLine.range.end.with(undefined, positionCharacter);

		return new InlayHintCandidate(inlayHintPosition,
			this.startLine, endLine, this.sourceCode, hasLineComment);
	}
}

class InlayHintCandidate {

	private readonly position: vscode.Position;
	private readonly sourceCode: SourceCode[];
	readonly range: vscode.Range;
	private readonly hasLineComment: boolean;

	constructor(position: vscode.Position,
		startLine: vscode.TextLine, endLine: vscode.TextLine, sourceCode: SourceCode[], hasLineComment: boolean) {

		this.position = position;
		this.sourceCode = sourceCode;
		this.range = new vscode.Range(startLine.range.start, endLine.range.end);
		this.hasLineComment = hasLineComment;
	}

	provide(): vscode.InlayHint {

		// Computes the actual data
		const totalTimings = new TotalTimings(mainParser.parse(this.sourceCode)!);
		const totalTiming = totalTimings.best();
		const timing = printTiming(totalTiming) || "0";
		const timingSuffix = printableTimingSuffix();

		// Computes the InlayHint label
		const label = `${timing}${timingSuffix}`;
		const paddingRight = this.hasLineComment; // (only if there are line comments);

		return new UnresolvedInlayHint(this.position, label, paddingRight,
			totalTimings, totalTiming, timing, timingSuffix,
			this.sourceCode[0], this.range);
	}
}

class UnresolvedInlayHint extends vscode.InlayHint {

	private readonly timing: string;
	private readonly timingSuffix: string;
	private readonly totalTimings: TotalTimings;
	private readonly totalTiming: TotalTimingMeterable;
	private readonly sourceCodeForLabel: SourceCode;
	private readonly range: vscode.Range;

	constructor(position: vscode.Position, label: string, paddingRight: boolean,
		totalTimings: TotalTimings, totalTiming: TotalTimingMeterable, timing: string, timingSuffix: string,
		sourceCodeForLabel: SourceCode, range: vscode.Range) {

		super(position, label);
		this.paddingLeft = true;
		this.paddingRight = paddingRight;

		this.totalTimings = totalTimings;
		this.totalTiming = totalTiming;
		this.timing = timing;
		this.timingSuffix = timingSuffix;
		this.sourceCodeForLabel = sourceCodeForLabel;
		this.range = range;
	}

	resolve(): vscode.InlayHint {

		const label = removeEnd(this.sourceCodeForLabel.label, ":");

		// Computes the InlayHint tooltip
		const timingText = `**${this.timing}**${this.timingSuffix}`;
		const rangeText = printRange(this.range);
		this.tooltip = new vscode.MarkdownString("", true)
			.appendMarkdown(label ? `### ${label}\n\n`: "")
			.appendMarkdown(`_${rangeText}_\n\n`)
			.appendMarkdown(`${this.totalTiming.statusBarIcon} ${this.totalTiming.name}: ${timingText}\n`)
			.appendMarkdown(hrMarkdown)
			.appendMarkdown(printTooltipMarkdown(this.totalTimings).join("\n"));

		return this;
	}
}
