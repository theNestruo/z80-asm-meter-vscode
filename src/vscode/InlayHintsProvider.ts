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

		// Locates the inlay hints candidates within the requested range
		const candidates = this.locateInlayHintCandidates(document, range);

		// Provides the subroutine inlay hints and the exit point inlay hints
		return [
			...this.provideSubroutineInlayHints(candidates),
			...this.provideExitPointInlayHints(candidates)
		];
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
			ongoingCandidates.forEach(ongoingCandidate => {
				ongoingCandidate.sourceCode.push(...sourceCodes);
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
					ongoingCandidates.forEach(ongoingCandidate => candidates.push(ongoingCandidate.withEndLine(line, false)));
				}

				// (restarts subroutine lookup)
				ongoingCandidates = [];
				didContainCode = false;

			// Checks subroutine conditional exit point (if not before the range)
			} else if (!isBeforeRange && this.isValidConditionalExitPoint(metered.instruction)) {
				ongoingCandidates.forEach(ongoingCandidate => candidates.push(ongoingCandidate.withEndLine(line, true)));
			}
		}

		// Completes trailing code as subroutine
		if (ongoingCandidates.length && didContainCode) {
			const line = document.lineAt(document.lineCount - 1);
			ongoingCandidates.forEach(ongoingCandidate => candidates.push(ongoingCandidate.withEndLine(line, false)));
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

	private provideSubroutineInlayHints(allCandidates: InlayHintCandidate[]): vscode.InlayHint[] {

		// (for performance reasons)
		const subroutinesPosition = config.inlayHints.subroutinesPosition;

		// Groups by start line
		const inlayHints: vscode.InlayHint[] = [];
		new Set(allCandidates.map(candidate => candidate.startLine)).forEach(startLine => {

			// (convenience local variables)
			const candidates = allCandidates.filter(candidate => candidate.startLine === startLine);
			const referenceCandidate = candidates[candidates.length - 1];

			// Computes the InlayHint position in the first line
			const [ position, paddingLeft, paddingRight ] = this.computePosition(
				referenceCandidate.startLine, referenceCandidate.sourceCodeWithLabel, subroutinesPosition);

			// Builds the InlayHint
			const inlayHint = new ResolvableSubroutineInlayHint(
				position, paddingLeft, paddingRight, referenceCandidate, candidates);

			inlayHints.push(inlayHint);
		});

		return inlayHints;
	}

	private provideExitPointInlayHints(allCandidates: InlayHintCandidate[]): vscode.InlayHint[]  {

		// (for performance reasons)
		const exitPointPosition = config.inlayHints.exitPointPosition;
		const exitPointSubroutinesThreshold = config.inlayHints.exitPointSubroutinesThreshold;
		const exitPointLinesThreshold = config.inlayHints.exitPointLinesThreshold;
		const exitPointSubroutinesCount = config.inlayHints.exitPointSubroutinesCount;
		const exitPointLabel = config.inlayHints.exitPointLabel;

		// Groups by end line
		const inlayHints: vscode.InlayHint[] = [];
		new Set(allCandidates.map(candidate => candidate.endLine)).forEach(endLine => {

			// (convenience local variables)
			const candidates = allCandidates.filter(candidate => candidate.endLine === endLine);
			const referenceCandidate = candidates[exitPointLabel == "first" ? 0 : candidates.length - 1];

			// Unconditional exit point inlay hint threshold conditions
			const visible =
				// Conditional...
				(referenceCandidate.conditional)
				// ...or belongs to more than one subroutine (and will show them in the tooltip)...
				|| ((candidates.length >= exitPointSubroutinesThreshold)
					&& (exitPointSubroutinesCount >= 2))
				// ...or is far enough from the subroutine label
				|| (this.lineCount(referenceCandidate) >= exitPointLinesThreshold);
			if (!visible) {
				return;
			}

			// Computes the InlayHint position in the last line
			const [ position, paddingLeft, paddingRight ] = this.computePosition(
				referenceCandidate.endLine, referenceCandidate.sourceCodeWithExitPoint, exitPointPosition);

			// Builds the InlayHint
			const inlayHint = new ResolvableExitPointInlayHint(
				position, paddingLeft, paddingRight, referenceCandidate, candidates);

			inlayHints.push(inlayHint);
		});

		return inlayHints;
	}

	private lineCount(candidate: InlayHintCandidate): number {

		return candidate.endLine.lineNumber - candidate.startLine.lineNumber + 1;
	}

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

	withEndLine(endLine: vscode.TextLine, conditional: boolean) {
		return new InlayHintCandidate(this.startLine, this.sourceCode, endLine, conditional);
	}
}

/**
 * An InlayHint candidate
 */
class InlayHintCandidate extends OngoingInlayHintCandidate {

	readonly endLine: vscode.TextLine;
	readonly conditional: boolean;

	// Derived information (will be cached for performance reasons)
	private cachedTotalTimings?: TotalTimings;
	private cachedInlayHintLabel?: string;

	constructor(startLine: vscode.TextLine, sourceCode: SourceCode[], endLine: vscode.TextLine, conditional: boolean) {
		super(startLine, [...sourceCode]);
		this.endLine = endLine;
		this.conditional = conditional;
	}

	get range(): vscode.Range {

		return new vscode.Range(this.startLine.range.start, this.endLine.range.end);
	}

	get sourceCodeWithLabel(): SourceCode {

		return this.sourceCode[0];
	}

	get sourceCodeWithExitPoint(): SourceCode {

		return this.sourceCode[this.sourceCode.length - 1];
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

	protected referenceCandidate: InlayHintCandidate;
	protected candidates: InlayHintCandidate[];
	protected displayLimit: number;

	// (for performance reasons)
	protected readonly platform: "z80" | "cpc" | "msx" | "msxz80" | "pc8000" | "z80n";
	protected readonly hasM1: boolean;
	protected readonly timingSuffix: string;

	constructor(
		position: vscode.Position, paddingLeft: boolean, paddingRight: boolean,
		referenceCandidate: InlayHintCandidate,
		candidates: InlayHintCandidate[], displayLimit: number) {

		super(position, referenceCandidate.inlayHintLabel);
		this.paddingLeft = paddingLeft;
		this.paddingRight = paddingRight;

		this.referenceCandidate = referenceCandidate;
		this.candidates = candidates;
		this.displayLimit = displayLimit;

		// (for performance reasons)
		this.platform = config.platform;
		this.hasM1 = this.platform === "msx" || this.platform === "msxz80" || this.platform === "pc8000";
		this.timingSuffix = printableTimingSuffix();
	}

	resolve(): vscode.InlayHint {

		// (sanity check)
		if (!this.tooltip) {
			this.tooltip = new vscode.MarkdownString(this.buildTooltip().join("\n"), true);
		}

		return this;
	}

	private buildTooltip(): string [] {

		if ((this.candidates.length == 1) || (this.displayLimit <= 1)) {
			return this.buildTooltipHeader(this.referenceCandidate);
		}

		return [
			...this.buildTooltipHeader(this.referenceCandidate),
			...this.buildTooltipTable()
		];
	}

	private buildTooltipHeader(candidate: InlayHintCandidate): string[] {

		const label = removeSuffix(candidate.sourceCodeWithLabel.label, ":");

		const range = new vscode.Range(
			candidate.startLine.range.start,
			candidate.endLine.range.end);
		const rangeText = printRange(range);

		const totalTimings = candidate.totalTimings;
		const totalTiming = totalTimings.best();
		const timingIcon = totalTiming.statusBarIcon || validateCodicon(config.statusBar.timingsIcon, "$(watch)");
		const timing = printTiming(totalTiming) ?? "0";
		const timingText = `**${timing}** ${this.timingSuffix}`;

		return [
			"|   |   |",
			"|:-:|---|",
			label
				? `||**${label}**|\n||_${rangeText}_|`
				: "||_${rangeText}_|",
			`|${timingIcon}|${totalTiming.name}: ${timingText}|`
		];
	}

	private buildTooltipTable(): string[] {

		const entries: string[] = [];
		this.candidates.forEach(candidate => {
			const entry = this.buildTooltipTableEntry(candidate);
			if (entry) {
				entries.push(entry);
			}
		});

		// (sanity check)
		if (entries.length <= 1) {
			return [];
		}

		// All entries
		if (entries.length <= this.displayLimit) {
			return [
				hrMarkdown,
				...this.buildTooltipTableHeader(),
				...entries
			];
		}

		// Exlcudes mid-list entries
		const firstEntries = Math.floor(this.displayLimit / 2.0);
		const lastEntries = this.displayLimit - firstEntries;
		return [
			hrMarkdown,
			...this.buildTooltipTableHeader(),
			...entries.slice(0, firstEntries),
			"||&hellip;||",
			...entries.slice(lastEntries)
		];
	}

	abstract buildTooltipTableHeader(): string[];

	abstract buildTooltipTableEntry(candidate: InlayHintCandidate): string | undefined;
}

/**
 * A subroutine InlayHint
 */
class ResolvableSubroutineInlayHint extends ResolvableInlayHint {

	constructor(position: vscode.Position, paddingLeft: boolean, paddingRight: boolean,
		referenceCandidate: InlayHintCandidate, candidates: InlayHintCandidate[]) {

		super(position, paddingLeft, paddingRight,
			referenceCandidate, candidates,
			config.inlayHints.subroutinesExitPointsCount);
	}

	buildTooltipTableHeader(): string[] {

		switch (this.platform) {
			case "msx":
				return [
					"|   |   |   |MSX|   |",
					"|--:|:-:|---|--:|---|"
				];
			case "msxz80":
				return [
					"|   |   |   |       |   |   |",
					"|--:|:-:|---|------:|--:|---|",
					"|   |   |   |**MSX**|Z80|   |"
				];
			case "pc8000":
				return [
					"|   |   |   |       |      |   |",
					"|--:|:-:|---|------:|-----:|---|",
					"|   |   |   |**Z80**|Z80+M1|   |"
				];
			default:
				return [
					"|   |   |   |Z80|   |",
					"|--:|:-:|---|--:|---|"
				];
		}
	}

	buildTooltipTableEntry(candidate: InlayHintCandidate): string | undefined {

		const totalTiming = candidate.totalTimings.best();
		if (!totalTiming) {
			return;
		}

		const range = `_&hellip;&nbsp;#${candidate.endLine.lineNumber + 1}_&nbsp;`;

		const timingIcon = totalTiming.statusBarIcon || validateCodicon(config.statusBar.timingsIcon, "$(watch)");
		const value = formatTiming(totalTiming.z80Timing);
		const m1Value = formatTiming(totalTiming.msxTiming);
		if (!value && (!this.hasM1 || !m1Value)) {
			return;
		}

		switch (this.platform) {
			case "msx":
				return `|${range}|${timingIcon}|${totalTiming.name}|**${m1Value}**|${this.timingSuffix}|`;
			case "msxz80":
				return `|${range}|${timingIcon}|${totalTiming.name}|**${m1Value}**|${value}|${this.timingSuffix}|`;
			case "pc8000":
				return `|${range}|${timingIcon}|${totalTiming.name}|**${value}**|${m1Value}|${this.timingSuffix}|`;
			default:
				return `|${range}|${timingIcon}|${totalTiming.name}|**${value}**|${this.timingSuffix}|`;
		}
	}
}

/**
 * An exit point InlayHint
 */
class ResolvableExitPointInlayHint extends ResolvableInlayHint {

	constructor(position: vscode.Position, paddingLeft: boolean, paddingRight: boolean,
		referenceCandidate: InlayHintCandidate, candidates: InlayHintCandidate[]) {

		super(position, paddingLeft, paddingRight,
			referenceCandidate, candidates,
			config.inlayHints.subroutinesExitPointsCount);
	}

	buildTooltipTableHeader(): string[] {

		switch (this.platform) {
			case "msx":
				return [
					"|   |   |MSX|   |",
					"|--:|---|--:|---|"
				];
			case "msxz80":
				return [
					"|   |   |       |   |   |",
					"|--:|---|------:|--:|---|",
					"|   |   |**MSX**|Z80|   |"
				];
			case "pc8000":
				return [
					"|   |   |       |      |   |",
					"|--:|---|------:|-----:|---|",
					"|   |   |**Z80**|Z80+M1|   |"
				];
			default:
				return [
					"|   |   |Z80|   |",
					"|--:|---|--:|---|"
				];
		}
	}

	buildTooltipTableEntry(candidate: InlayHintCandidate): string | undefined {

		const totalTiming = candidate.totalTimings.best();
		if (!totalTiming) {
			return;
		}

		const range = `_#${candidate.startLine.lineNumber + 1}&nbsp;&hellip;_&nbsp;`;
		const label = removeSuffix(candidate.sourceCodeWithLabel.label, ":") ?? '';

		const value = formatTiming(totalTiming.z80Timing);
		const m1Value = formatTiming(totalTiming.msxTiming);
		if (!value && (!this.hasM1 || !m1Value)) {
			return;
		}

		switch (this.platform) {
			case "msx":
				return `|${range}|${label}|**${m1Value}**|${this.timingSuffix}|`;
			case "msxz80":
				return `|${range}|${label}|**${m1Value}**|${value}|${this.timingSuffix}|`;
			case "pc8000":
				return `|${range}|${label}|**${value}**|${m1Value}|${this.timingSuffix}|`;
			default:
				return `|${range}|${label}|**${value}**|${this.timingSuffix}|`;
		}
	}
}
