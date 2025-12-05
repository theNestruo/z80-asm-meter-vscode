import * as vscode from "vscode";
import type { platformType } from "../config";
import { config } from "../config";
import { mainParser } from "../parsers/parsers";
import { TotalTimings } from "../totalTimings/TotalTimings";
import type { Meterable } from "../types/Meterable";
import type { SourceCode } from "../types/SourceCode";
import { extractMnemonicOf, extractOperandsOf, isAnyCondition, isJrCondition, isUnconditionalJumpOrRetInstruction } from "../utils/AssemblyUtils";
import { printRange } from "../utils/PositionRangeUtils";
import { lineToSourceCode } from "../utils/SourceCodeUtils";
import { hrMarkdown, positionFromEnd, positionFromEndAndSkipWhitespaceBefore, positionFromStart, positionFromStartAndSkipWhitespaceAfter, removeSuffix, validateCodicon } from "../utils/TextUtils";
import { formatTiming, printableTimingSuffix, printTiming } from "../utils/TimingUtils";
import { isExtensionEnabledFor } from "./SourceCodeReader";
import type { inlayHintPositionType } from "./config/InlayHintsConfiguration";

/**
 * InlayHintsProvider that shows timing of the execution flow of subroutines
 */
export class InlayHintsProvider implements vscode.InlayHintsProvider, vscode.Disposable {

	private readonly candidatesLocator;
	private readonly candidatesResolver;

	private readonly onDidChangeInlayHintsEmitter = new vscode.EventEmitter<void>();
	readonly onDidChangeInlayHints: vscode.Event<void> = this.onDidChangeInlayHintsEmitter.event;

	private registerInlayHintsProviderDisposable: vscode.Disposable;
	private readonly _disposable: vscode.Disposable;

	constructor() {
		this.candidatesLocator = new InlayHintCandidatesLocator();
		this.candidatesResolver = new InlayHintsCandidatesResolver();

		this._disposable = vscode.Disposable.from(
			this.candidatesLocator,
			this.onDidChangeInlayHintsEmitter,

			// Subscribe to configuration change event
			// eslint-disable-next-line @typescript-eslint/unbound-method
			vscode.workspace.onDidChangeConfiguration(this.onConfigurationChange, this)
		);

		// Registers as a inlay hints provider
		this.registerInlayHintsProviderDisposable = this.registerInlayHintsProvider();
	}

	private registerInlayHintsProvider(): vscode.Disposable {
		return vscode.languages.registerInlayHintsProvider(this.documentSelector(), this);
	}

	private documentSelector(): readonly vscode.DocumentFilter[] {

		return [
			...config.languageIds.map(languageId => {
				return { language: languageId };
			}),
			// Always enabled if it is a Z80 assembly file
			{ language: "z80-asm-meter" }
		];
	}

	provideInlayHints(
		document: vscode.TextDocument,
		range: vscode.Range,
		_token: vscode.CancellationToken): vscode.ProviderResult<vscode.InlayHint[]> {

		if (!config.inlayHints.enabled || !isExtensionEnabledFor(document)) {
			return undefined;
		}

		// Locates the inlay hint candidates within the requested range
		const candidates = this.candidatesLocator.locateCandidates(document, range);

		// Resolves the inlay hint candidates as subroutine inlay hints and exit point inlay hints
		return [
			...this.candidatesResolver.resolveSubroutineInlayHints(candidates),
			...this.candidatesResolver.resolveExitPointInlayHints(candidates)
		];
	}

	resolveInlayHint(hint: vscode.InlayHint, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.InlayHint> {

		// Resolves the inlay hints
		return (hint instanceof ResolvableInlayHint)
			? hint.resolve()
			: undefined;
	}

	onConfigurationChange(e: vscode.ConfigurationChangeEvent): void {

		// Re-registers as a inlay hints provider
		if (e.affectsConfiguration("z80-asm-meter.languageIds")) {
			this.registerInlayHintsProviderDisposable.dispose();
			this.registerInlayHintsProviderDisposable = this.registerInlayHintsProvider();
		}
	}

	dispose(): void {
		this.registerInlayHintsProviderDisposable.dispose();
		this._disposable.dispose();
	}
}

class InlayHintCandidatesLocator implements vscode.Disposable {

	private readonly _disposable: vscode.Disposable;

	// (for performance reasons)
	private conditionalExitPointMnemonics: string[];

	constructor() {

		this._disposable =
			// Subscribe to configuration change event
			// eslint-disable-next-line @typescript-eslint/unbound-method
			vscode.workspace.onDidChangeConfiguration(this.onConfigurationChange, this);

		this.conditionalExitPointMnemonics = this.initalizeConditionalExitPointMnemonics();
	}

	private initalizeConditionalExitPointMnemonics(): string[] {

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

	locateCandidates(document: vscode.TextDocument, range: vscode.Range): InlayHintCandidate[] {

		// (for performance reasons)
		const lineSeparatorCharacter = config.syntax.lineSeparatorCharacter;
		const unlabelledSubroutines = config.inlayHints.unlabelledSubroutines;
		const fallthroughSubroutines = config.inlayHints.fallthroughSubroutines;

		const candidates: InlayHintCandidate[] = [];

		let ongoingCandidates: OngoingInlayHintCandidate[] = [];
		let didContainCode = false;
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
			for (const ongoingCandidate of ongoingCandidates) {
				ongoingCandidate.sourceCode.push(...sourceCodes);
			}

			// Checks labels for subroutine starts (if not after the range)
			if (!isAfterRange && this.isValidLabel(sourceCode, ongoingCandidates)) {
				if (!didContainCode) {
					// Discards any previous candidates (labels) because they did not contain code
					ongoingCandidates = [new OngoingInlayHintCandidate(line, sourceCodes)];

				} else if (fallthroughSubroutines) {
					// Creates a new candidate on "falls through" labels
					ongoingCandidates.push(new OngoingInlayHintCandidate(line, sourceCodes));
				}
			}

			// Checks source code
			const metered = mainParser.instance.parseInstruction(sourceCode);
			if (!metered || !this.isCode(metered)) {
				continue; // (ignore unparseable source code or no-code (data?) lines)
			}

			// Creates a new candidate on unlabelled code
			if (!didContainCode && !ongoingCandidates.length && unlabelledSubroutines) {
				ongoingCandidates = [new OngoingInlayHintCandidate(line, sourceCodes)];
			}

			didContainCode = true;

			const isBeforeRange = line.range.start.isBefore(range.start);

			// Checks subroutine ends
			if (isUnconditionalJumpOrRetInstruction(metered.instruction)) {
				// Ends all incomplete subroutines (if not before the range)
				if (!isBeforeRange) {
					for (const ongoingCandidate of ongoingCandidates) {
						candidates.push(ongoingCandidate.withEndLine(line, false));
					}
				}

				// (restarts subroutine lookup)
				ongoingCandidates = [];
				didContainCode = false;

				// Checks subroutine conditional exit point (if not before the range)
			} else if (!isBeforeRange && this.isValidConditionalExitPoint(metered.instruction)) {
				for (const ongoingCandidate of ongoingCandidates) {
					candidates.push(ongoingCandidate.withEndLine(line, true));
				}
			}
		}

		// Completes trailing code as subroutine
		if (ongoingCandidates.length && didContainCode) {
			const line = document.lineAt(document.lineCount - 1);
			for (const ongoingCandidate of ongoingCandidates) {
				candidates.push(ongoingCandidate.withEndLine(line, false));
			}
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

		return !!timing[0];
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

	onConfigurationChange(e: vscode.ConfigurationChangeEvent): void {

		if (e.affectsConfiguration("z80-asm-meter.inlayHints.exitPoint")) {
			this.conditionalExitPointMnemonics = this.initalizeConditionalExitPointMnemonics();
		}
	}

	dispose(): void {
		this._disposable.dispose();
	}
}

class InlayHintsCandidatesResolver {

	resolveSubroutineInlayHints(allCandidates: InlayHintCandidate[]): vscode.InlayHint[] {

		// (for performance reasons)
		const subroutinesPosition = config.inlayHints.subroutinesPosition;

		// Groups by start line
		const inlayHints: vscode.InlayHint[] = [];
		for (const startLine of new Set(allCandidates.map(candidate => candidate.startLine))) {

			// (convenience local variables)
			const candidates = allCandidates.filter(candidate => candidate.startLine === startLine);
			const referenceCandidate = candidates[candidates.length - 1];

			// Computes the InlayHint position in the first line
			const [position, paddingLeft, paddingRight] = this.computePosition(
				referenceCandidate.startLine, referenceCandidate.sourceCodeWithLabel, subroutinesPosition);

			// Builds the InlayHint
			const inlayHint = new ResolvableSubroutineInlayHint(
				position, paddingLeft, paddingRight, referenceCandidate, candidates);

			inlayHints.push(inlayHint);
		}

		return inlayHints;
	}

	resolveExitPointInlayHints(allCandidates: InlayHintCandidate[]): vscode.InlayHint[] {

		// (for performance reasons)
		const exitPointPosition = config.inlayHints.exitPointPosition;
		const exitPointSubroutinesThreshold = config.inlayHints.exitPointSubroutinesThreshold;
		const exitPointLinesThreshold = config.inlayHints.exitPointLinesThreshold;
		const exitPointSubroutinesCount = config.inlayHints.exitPointSubroutinesCount;
		const exitPointLabel = config.inlayHints.exitPointLabel;

		// Groups by end line
		const inlayHints: vscode.InlayHint[] = [];
		for (const endLine of new Set(allCandidates.map(candidate => candidate.endLine))) {

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
				continue;
			}

			// Computes the InlayHint position in the last line
			const [position, paddingLeft, paddingRight] = this.computePosition(
				referenceCandidate.endLine, referenceCandidate.sourceCodeWithExitPoint, exitPointPosition);

			// Builds the InlayHint
			const inlayHint = new ResolvableExitPointInlayHint(
				position, paddingLeft, paddingRight, referenceCandidate, candidates);

			inlayHints.push(inlayHint);
		}

		return inlayHints;
	}

	private lineCount(candidate: InlayHintCandidate): number {

		return candidate.endLine.lineNumber - candidate.startLine.lineNumber + 1;
	}

	private computePosition(
		line: vscode.TextLine,
		sourceCode: SourceCode,
		position: inlayHintPositionType)
		: [vscode.Position, boolean, boolean] {

		switch (position) {
			case "lineStart":
				return [line.range.start, false, true];

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
				return [line.range.end, true, false];
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
		readonly sourceCode: SourceCode[]) {
	}

	withEndLine(endLine: vscode.TextLine, conditional: boolean): InlayHintCandidate {
		return new InlayHintCandidate(this.startLine, this.sourceCode, endLine, conditional);
	}
}

/**
 * An InlayHint candidate
 */
class InlayHintCandidate extends OngoingInlayHintCandidate {

	// Derived information (will be cached for performance reasons)
	private cachedTotalTimings?: TotalTimings;

	constructor(
		startLine: vscode.TextLine,
		sourceCode: SourceCode[],
		readonly endLine: vscode.TextLine,
		readonly conditional: boolean) {
		super(startLine, [...sourceCode]);
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
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const meterable = mainParser.instance.parse(this.sourceCode)!;
		return this.cachedTotalTimings ??= new TotalTimings(meterable);
	}
}

/**
 * An InlayHint that can be resolved
 */
abstract class ResolvableInlayHint extends vscode.InlayHint {

	private static buildLabel(referenceCandidate: InlayHintCandidate, candidates: InlayHintCandidate[], displayLimit: number): string {

		const totalTiming = referenceCandidate.totalTimings.best();
		const timing = printTiming(totalTiming) ?? "0";
		const timingSuffix = printableTimingSuffix();
		const ellipsisSuffix = (candidates.length == 1) || (displayLimit <= 1) ? "" : " ...";

		return `${timing} ${timingSuffix}${ellipsisSuffix}`;
	}

	// (for performance reasons)
	protected readonly platform: platformType;
	protected readonly hasM1: boolean;
	protected readonly timingSuffix: string;

	constructor(
		position: vscode.Position, paddingLeft: boolean, paddingRight: boolean,
		protected readonly referenceCandidate: InlayHintCandidate,
		protected readonly candidates: InlayHintCandidate[],
		protected readonly displayLimit: number) {

		super(position, ResolvableInlayHint.buildLabel(referenceCandidate, candidates, displayLimit));
		this.paddingLeft = paddingLeft;
		this.paddingRight = paddingRight;

		// (for performance reasons)
		this.platform = config.platform;
		this.hasM1 = this.platform === "msx" || this.platform === "msxz80" || this.platform === "pc8000";
		this.timingSuffix = printableTimingSuffix();
	}

	resolve(): vscode.InlayHint {

		this.tooltip ??= new vscode.MarkdownString(this.buildTooltip().join("\n"), true);

		return this;
	}

	private buildTooltip(): string[] {

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
		const timingIcon = totalTiming.statusBarIcon || validateCodicon(config.statusBar.timingsIcon, "$(clock)");
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
		for (const candidate of this.candidates) {
			const entry = this.buildTooltipTableEntry(candidate);
			if (entry) {
				entries.push(entry);
			}
		}

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

		const range = `_&hellip;&nbsp;#${String(candidate.endLine.lineNumber + 1)}_&nbsp;`;

		const timingIcon = totalTiming.statusBarIcon || validateCodicon(config.statusBar.timingsIcon, "$(clock)");
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

		const range = `_#${String(candidate.startLine.lineNumber + 1)}&nbsp;&hellip;_&nbsp;`;
		const label = removeSuffix(candidate.sourceCodeWithLabel.label, ":") ?? "";

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
