import * as vscode from 'vscode';
import { config } from '../config';
import { mainParser } from '../parser/MainParser';
import { TotalTimings } from '../totalTiming/TotalTimings';
import { Meterable, SourceCode } from '../types';
import { extractMnemonicOf, extractOperandsOf, isAnyCondition, isJrCondition, isUnconditionalJumpOrRetInstruction } from '../utils/AssemblyUtils';
import { formatTiming, hrMarkdown, printableTimingSuffix, printRange, printTiming } from '../utils/FormatterUtils';
import { lineToSourceCode } from '../utils/SourceCodeUtils';
import { positionFromEnd, positionFromEndAndSkipWhitespaceBefore, positionFromStart, positionFromStartAndSkipWhitespaceAfter, removeSuffix, validateCodicon } from '../utils/TextUtils';
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

	provideInlayHints(document: vscode.TextDocument, range: vscode.Range, _token: vscode.CancellationToken):
			vscode.ProviderResult<vscode.InlayHint[]> {

		if (!config.inlayHints.enabled || !isExtensionEnabledFor(document)) {
			return undefined;
		}

		const inlayHints: vscode.InlayHint[] = [];

		// (for performance reasons)
		const subroutinesPosition = config.inlayHints.subroutinesPosition;
		// const exitPointPosition = config.inlayHints.exitPointPosition;

		// Locates the inlay hints candidates within the requested range
		const candidates = this.locateInlayHintCandidates(document, range);

		// Provides the subroutine inlay hints
		new Set(candidates.map(candidate => candidate.startLine)).forEach(startLine => {
			inlayHints.push(this.provideSubroutineInlayHint(
				candidates.filter(candidate => candidate.startLine === startLine),
				subroutinesPosition));
		});

		// Provides the exit point inlay hints
		// new Set(candidates.map(candidate => candidate.endLine)).forEach(endLine => {
		// 	inlayHints.push(this.provideExitPointInlayHint(
		// 		candidates.filter(candidate => candidate.endLine === endLine),
		// 		exitPointPosition));
		// });

		return inlayHints;
	}

	resolveInlayHint(hint: vscode.InlayHint, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.InlayHint> {

		// Resolves the inlay hints
		return (hint instanceof ResolvableInlayHint)
				? hint.resolve()
				: undefined;
	}

	private locateInlayHintCandidates(document: vscode.TextDocument, range: vscode.Range): InlayHintCandidate[] {

		// (for performance reasons)
		const lineSeparatorCharacter = config.syntax.lineSeparatorCharacter;
		const unlabelledSubroutines = config.inlayHints.unlabelledSubroutines;
		const fallthroughSubroutines = config.inlayHints.fallthroughSubroutines;

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
					ongoingCandidates.forEach(ongoingCandidate => candidates.push(ongoingCandidate.withEndLine(line)));
				}

				// (restarts subroutine lookup)
				ongoingCandidates = [];
				didContainCode = false;

			// Checks subroutine conditional exit point (if not before the range)
			} else if (!isBeforeRange && this.isValidConditionalExitPoint(metered.instruction)) {
				ongoingCandidates.forEach(ongoingCandidate => candidates.push(ongoingCandidate.withEndLine(line)));
			}
		}

		// Completes trailing code as subroutine
		if (ongoingCandidates.length && didContainCode) {
			const line = document.lineAt(document.lineCount - 1);
			ongoingCandidates.forEach(ongoingCandidate => candidates.push(ongoingCandidate.withEndLine(line)));
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
			case "disabled":
				return false;

			case "enabled":
				return true;

			case "entryPoint":
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

	private provideSubroutineInlayHint(
			candidates: InlayHintCandidate[],
			positionType: "lineStart" | "afterLabel" | "beforeCode" | "afterCode" | "beforeComment" | "insideComment" | "lineEnd"):
			vscode.InlayHint {

		// (convenience local variables)
		const referenceCandidate = candidates[candidates.length - 1];
		const sourceCodeWithLabel = referenceCandidate.sourceCodeWithLabel;

		// Computes the InlayHint position in the first line
		const [ position, paddingLeft, paddingRight ] =
			this.computePosition(referenceCandidate.startLine, sourceCodeWithLabel, positionType);

		return new ResolvableSubroutineInlayHint(referenceCandidate, position, paddingLeft, paddingRight, candidates);
	}

	// private provideExitPointInlayHint(
	// 		candidates: InlayHintCandidate[],
	// 		positionType: "lineStart" | "afterLabel" | "beforeCode" | "afterCode" | "beforeComment" | "insideComment" | "lineEnd"):
	// 		vscode.InlayHint {

	// 	// Computes the InlayHint position in the last line
	// 	const firstCandidate = candidates[0];
	// 	const [ position, paddingLeft, paddingRight ] =
	// 		this.computePosition(firstCandidate.endLine, firstCandidate.sourceCode[firstCandidate.sourceCode.length - 1], positionType);

	// 	const range = new vscode.Range(firstCandidate.startLine.range.start, firstCandidate.endLine.range.end),

	// // 		ongoingCandidates[config.inlayHints.exitPointLabel === "first" ? 0 : ongoingCandidates.length - 1]
	// 	// throw new Error('Function not implemented.');
	// 	return undefined;
	// }

	private computePosition(
		line: vscode.TextLine, sourceCode: SourceCode,
		positionType: "lineStart" | "afterLabel" | "beforeCode" | "afterCode" | "beforeComment" | "insideComment" | "lineEnd"):
		[ vscode.Position, boolean, boolean ] {

		switch (positionType) {
			case "lineStart":
				return [ line.range.start, false, true ];

			case "afterLabel":
				return [
					line.range.start.with(undefined, positionFromStart(line.text, sourceCode.afterLabelPosition)),
					!!sourceCode.afterLabelPosition, false
				];

			case "beforeCode":
				return [
					line.range.start.with(undefined, positionFromStartAndSkipWhitespaceAfter(line.text, sourceCode.afterLabelPosition)),
					true, true
				];

			case "afterCode":
				return [
					line.range.start.with(undefined, positionFromEndAndSkipWhitespaceBefore(line.text, sourceCode.beforeLineCommentPosition)),
					true, true
				];

			case "beforeComment":
				return [
					line.range.start.with(undefined, positionFromEnd(line.text, sourceCode.beforeLineCommentPosition)),
					true, !!sourceCode.beforeLineCommentPosition
				];

			case "insideComment":
				return [
					line.range.start.with(undefined, positionFromEnd(line.text, sourceCode.afterLineCommentPosition)),
					true, !!sourceCode.afterLineCommentPosition
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
class OngoingInlayHintCandidate {

	readonly startLine: vscode.TextLine;

	readonly sourceCode: SourceCode[];

	constructor(startLine: vscode.TextLine, sourceCode: SourceCode[]) {
		this.startLine = startLine;
		this.sourceCode = sourceCode;
	}

	withEndLine(endLine: vscode.TextLine) {
		return new InlayHintCandidate(this.startLine, endLine, this.sourceCode);
	}
}

/**
 * An InlayHint candidate
 */
class InlayHintCandidate extends OngoingInlayHintCandidate {

	readonly endLine: vscode.TextLine;

	// Derived information (will be cached for performance reasons)
	private cachedTotalTimings?: TotalTimings;
	private cachedInlayHintLabel?: string;

	constructor(startLine: vscode.TextLine, endLine: vscode.TextLine, sourceCode: SourceCode[]) {
		super(startLine, [...sourceCode]);
		this.endLine = endLine;
	}

	get sourceCodeWithLabel(): SourceCode {

		return this.sourceCode[0];
	}

	get totalTimings(): TotalTimings {

		if (!this.cachedTotalTimings) {
			this.cachedTotalTimings = new TotalTimings(mainParser.parse(this.sourceCode)!);
		}
		return this.cachedTotalTimings;
	}

	get inlayHintLabel(): string {

		if (!this.cachedInlayHintLabel) {
			const totalTiming = this.totalTimings.best();
			const timing = printTiming(totalTiming) ?? "0";
			const timingSuffix = printableTimingSuffix();

			this.cachedInlayHintLabel = `${timing} ${timingSuffix}`;
		}
		return this.cachedInlayHintLabel;
	}
}

/**
 * An InlayHint that can be resolved
 */
abstract class ResolvableInlayHint extends vscode.InlayHint {

	constructor(position: vscode.Position, label: string, paddingLeft: boolean, paddingRight: boolean) {

		super(position, label);
		this.paddingLeft = paddingLeft;
		this.paddingRight = paddingRight;
	}

	abstract resolve(): vscode.InlayHint;
}

/**
 * A subroutine InlayHint
 */
class ResolvableSubroutineInlayHint extends ResolvableInlayHint {

	protected referenceCandidate: InlayHintCandidate;
	protected candidates: InlayHintCandidate[];

	constructor(referenceCandidate: InlayHintCandidate,
		position: vscode.Position, paddingLeft: boolean, paddingRight: boolean,
		candidates: InlayHintCandidate[]) {

		super(position, referenceCandidate.inlayHintLabel, paddingLeft, paddingRight);

		this.referenceCandidate = referenceCandidate;
		this.candidates = candidates;
	}

	resolve(): vscode.InlayHint {

		// (sanity check)
		if (!this.tooltip) {
			this.tooltip = new vscode.MarkdownString(
					(this.candidates.length == 1
						? this.buildSingleCandidateToolip()
						: this.buildMultipleCandidateTooltip())
					.join("\n"), true);
		}

		return this;

	}

	private buildSingleCandidateToolip(): string[] {

		// Computes the InlayHint tooltip
		return this.printMarkdownHeader();
	}

	private buildMultipleCandidateTooltip(): string[] {

		// Computes the InlayHint tooltip
		return [
			...this.printMarkdownHeader(),
			hrMarkdown,
			...this.printMultipleCandidateMarkdownTotalTimings()
		];
	}

	private printMarkdownHeader(): string[] {

		const label = removeSuffix(this.referenceCandidate.sourceCodeWithLabel.label, ":");

		const range = new vscode.Range(
			this.referenceCandidate.startLine.range.start,
			this.referenceCandidate.endLine.range.end);
		const rangeText = printRange(range);

		const totalTimings = this.referenceCandidate.totalTimings;
		const totalTiming = totalTimings.best();
		const timingIcon = totalTiming.statusBarIcon || validateCodicon(config.statusBar.timingsIcon, "$(watch)");
		const timing = printTiming(totalTiming) ?? "0";
		const timingSuffix = printableTimingSuffix();
		const timingText = `**${timing}** ${timingSuffix}`;

		return [
			"|   |   |",
			"|:-:|---|",
			label
				? `||**${label}**|\n||_${rangeText}_|`
				: "||_${rangeText}_|",
			`|${timingIcon}|${totalTiming.name}: ${timingText}|`
		];
	}

	private printMultipleCandidateMarkdownTotalTimings(): string[] {

		const platform = config.platform;
		const hasM1 = platform === "msx" || platform === "msxz80" || platform === "pc8000";
		const timingSuffix = printableTimingSuffix();

		const table =
			platform === "msx" ? [
				"|   |   |   |MSX|   |",
				"|:-:|---|--:|--:|---|"
			]
			: platform === "msxz80" ? [
				"|   |   |   |       |   |   |",
				"|:-:|---|--:|------:|--:|---|",
				"|   |   |   |**MSX**|Z80|   |"
			]
			: platform === "pc8000" ? [
				"|   |   |   |       |      |   |",
				"|:-:|---|--:|------:|-----:|---|",
				"|   |   |   |**Z80**|Z80+M1|   |"
			]
			: [
				"|   |   |   |Z80|   |",
				"|:-:|---|--:|--:|---|"
			];

		this.candidates.forEach(candidate => {
			const totalTiming = candidate.totalTimings.best();
			if (!totalTiming) {
				return;
			}

			const range = `&nbsp;_(&hellip;&nbsp;#${candidate.endLine.lineNumber + 1})_`;

			const timingIcon = totalTiming.statusBarIcon || validateCodicon(config.statusBar.timingsIcon, "$(watch)");
			const value = formatTiming(totalTiming.z80Timing);
			const m1Value = formatTiming(totalTiming.msxTiming);
			if (!value && (!hasM1 || !m1Value)) {
				return;
			}

			switch (platform) {
				case "msx":
					table.push(`|${timingIcon}|${totalTiming.name}|${range}|**${m1Value}**|${timingSuffix}|`);
					break;
				case "msxz80":
					table.push(`|${timingIcon}|${totalTiming.name}|${range}|**${m1Value}**|${value}|${timingSuffix}|`);
					break;
				case "pc8000":
					table.push(`|${timingIcon}|${totalTiming.name}|${range}|**${value}**|${m1Value}|${timingSuffix}|`);
					break;
				default:
					table.push(`|${timingIcon}|${totalTiming.name}|${range}|**${value}**|${timingSuffix}|`);
					break;
			}
		});

		return table;
	}
}
