import * as vscode from 'vscode';
import { config } from '../config';
import { mainParser } from '../parser/MainParser';
import { TotalTimings } from '../totalTiming/TotalTimings';
import { Meterable, SourceCode } from '../types';
import { extractMnemonicOf, extractOperandsOf, isAnyCondition, isJrCondition, isUnconditionalJumpOrRetInstruction } from '../utils/AssemblyUtils';
import { hrMarkdown, printTiming, printTooltipMarkdown } from '../utils/FormatterUtils';
import { removeEnd, uncapitalize } from '../utils/TextUtils';
import { isExtensionEnabledFor, preprocessLineAsSourceCode, readSourceCodeFrom } from './SourceCodeReader';

function documentSelector(): readonly vscode.DocumentFilter[] {

	return [
		...config.languageIds.map(languageId => { return { language: languageId }; }),
		// Always enabled if it is a Z80 assembly file
		{ language: "z80-asm-meter" }
	];
}

export class InlayHintsProvider implements vscode.InlayHintsProvider {

	private readonly disposable: vscode.Disposable;

	constructor() {

		// Registers as a inlay hints provider
		this.disposable = vscode.languages.registerInlayHintsProvider(documentSelector(), this);
	}

	dispose() {
        this.disposable.dispose();
	}

	provideInlayHints(document: vscode.TextDocument, range: vscode.Range, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.InlayHint[]> {

		if (!config.inlayHints.enabled || !isExtensionEnabledFor(document)) {
			return undefined;
		}

		// (for performance reasons)
		const timingSuffix = config.platform === "cpc" ? " NOPs" : " clock cycles";
		const ret = config.inlayHints.exitPointRet;
		const jp = config.inlayHints.exitPointJp;
		const jr = config.inlayHints.exitPointJr;
		const djnz = config.inlayHints.exitPointDjnz;

		const inlayHints: vscode.InlayHint[] = [];
		let starts: vscode.Position[] = [];
		let sectionContainsCode: boolean = false;
		for (let n = range.start.line, m = range.end.line, i = n; i < m; i++) {
			const line = document.lineAt(i);
			const sourceCodes = preprocessLineAsSourceCode(line.text);
			if (!sourceCodes.length || !sourceCodes[0]) {
				// (ignore empty lines)
				continue;
			}
			const sourceCode = sourceCodes[0];
			const metered = mainParser.parseInstruction(sourceCode);

			// Checks labels (for section starts)
			if (this.isValidLabel(sourceCode)) {
				if (sectionContainsCode) {
					if (config.inlayHints.fallthroughSubroutines) {
						// "Falls through" label: appends a new start
						starts.push(line.range.start);
					}
				} else {
					// Previous labels did not contain code: discards previous labels
					starts = [ line.range.start ];
				}
			}

			// Checks source code
			if (!metered) {
				// (ignore unparseable lines)
				continue;
			}

			// Checks no-code
			if (!this.isCode(metered)) {
				// Checks data
				if (!sectionContainsCode && metered.size) {
					// Latest label did only contain data: discards previous label
					starts.pop();
				}
				// (ignore no-code lines)
				continue;
			}

			// Starts a new section on unlabelled code
			if (!sectionContainsCode && !starts.length && config.inlayHints.unlabelledSubroutines) {
				starts = [ line.range.start ];
			}
			sectionContainsCode = true;

			// Checks section end
			if (isUnconditionalJumpOrRetInstruction(metered.instruction)) {
				inlayHints.push(...this.buildSubroutineInlayHints(document, starts, line.range.end, timingSuffix));

				// (restarts sections)
				starts = [];
				sectionContainsCode = false;

			} else if (this.isValidConditionalExitPoint(metered.instruction, ret, jp, jr, djnz)) {
				inlayHints.push(...this.buildExitPointsInlayHints(document, starts, line.range.end, timingSuffix));
			}
		}

		// Appends trailing code section
		if (starts.length && sectionContainsCode) {
			const end = document.lineAt(document.lineCount - 1).range.end;
			inlayHints.push(...this.buildSubroutineInlayHints(document, starts, end, timingSuffix));
		}

		return inlayHints;
	}

	// resolveInlayHint(_hint: vscode.InlayHint, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.InlayHint> {

	// 	return undefined;
	// }

	private isValidLabel(sourceCode: SourceCode): boolean {

		return !!sourceCode.label
				&& (config.inlayHints.nestedSubroutines
					|| (!sourceCode.label.startsWith(".")
						&& !sourceCode.label.startsWith("@@")));
	}

	private isCode(meterable: Meterable): boolean {

		// timing depending on the platform
		const timing =
			config.platform === "msx" ? meterable.msxTiming
			: config.platform === "cpc" ? meterable.cpcTiming
			: meterable.z80Timing;

		return timing && !!timing[0];
	}

	private isValidConditionalExitPoint(instruction: string, ret: boolean, jp: boolean, jr: boolean, djnz: boolean): boolean {

		// (sanity check)
		if (!ret && !jp && !jr && !djnz) {
			return false;
		}

		const mnemonic = extractMnemonicOf(instruction);
		const operands = extractOperandsOf(instruction);

		switch (mnemonic) {
		case "RET":
			return ret && (operands.length === 1) && isAnyCondition(operands[0]);
		case "JP":
			return jp && (operands.length === 2) && isAnyCondition(operands[0]);
		case "JR":
			return jr && (operands.length === 2) && isJrCondition(operands[0]);
		case "DJNZ":
			return djnz && (operands.length === 1);
		default:
			return false;
		}
	}

	private buildSubroutineInlayHints(document: vscode.TextDocument,
			starts: vscode.Position[], end: vscode.Position, timingSuffix: string): vscode.InlayHint[] {

		return starts.map(start => this.buildSubroutineInlayHint(document, start, end, timingSuffix));
	}

	private buildSubroutineInlayHint(document: vscode.TextDocument,
			start: vscode.Position, end: vscode.Position, timingSuffix: string): vscode.InlayHint {

		const range = new vscode.Range(start, end);
		const sourceCode = readSourceCodeFrom(document, range);
		const totalTimings = new TotalTimings(mainParser.parse(sourceCode)!);

		const timing = printTiming(totalTimings.best()) || "0";

		return new SubroutineInlayHint(
			document.lineAt(start).range.end, `${timing}${timingSuffix}`,
			range, sourceCode, totalTimings);
	}

	private buildExitPointsInlayHints(document: vscode.TextDocument,
			starts: vscode.Position[], end: vscode.Position, timingSuffix: string): vscode.InlayHint[] {

		const start = config.inlayHints.exitPointLabel === "first" ? starts[0] : starts[starts.length - 1];
		return [ this.buildExitPointInlayHint(document, start, end, timingSuffix) ];
	}

	private buildExitPointInlayHint(document: vscode.TextDocument,
			start: vscode.Position, end: vscode.Position, timingSuffix: string): vscode.InlayHint {

		const range = new vscode.Range(start, end);
		const sourceCode = readSourceCodeFrom(document, range);
		const totalTimings = new TotalTimings(mainParser.parse(sourceCode)!);

		const timing = printTiming(totalTimings.best()) || "0";

		// const lastSourceCode = sourceCode[sourceCode.length - 1];
		// const lastLine = document.lineAt(end);
		// const position = lastSourceCode.lineComment
		// 		? new vscode.Position(end.line, lastLine.text.indexOf(lastSourceCode.lineComment) - 2)
		// 		: lastLine.range.end;

		return new SubroutineInlayHint(
			document.lineAt(end).range.end, `${timing}${timingSuffix}`,
			range, sourceCode, totalTimings);
	}

	resolveInlayHint(hint: vscode.InlayHint, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.InlayHint> {

		// (sanity check)
		if (!(hint instanceof SubroutineInlayHint)) {
			return undefined;
		}

		const sourceCodeLabel = removeEnd(hint.sourceCode[0].label, ":");
		const rangeText = hint.range.isSingleLine
				? `Line #${hint.range.start.line + 1}`
				: `Lines #${hint.range.start.line + 1} - #${hint.range.end.line + 1}`;
		const tooltipTitle = sourceCodeLabel
				? `## ${sourceCodeLabel}\n\n${rangeText}\n`
				: `### Code at ${uncapitalize(rangeText)}\n`;

		return {
			position: hint.position,
			label: hint.label,
			tooltip: new vscode.MarkdownString(`${tooltipTitle}`)
				.appendMarkdown(hrMarkdown)
				.appendMarkdown(printTooltipMarkdown(hint.totalTimings).value),
			paddingLeft: true
		};
	}
}

class SubroutineInlayHint extends vscode.InlayHint {

	readonly range: vscode.Range;

	readonly sourceCode: SourceCode[];

	readonly totalTimings: TotalTimings;

	constructor(position: vscode.Position, label: string,
			range: vscode.Range, sourceCode: SourceCode[], totalTimings: TotalTimings) {
		super(position, label);

		this.paddingLeft = true;
		this.paddingRight = false;

		this.range = range;
		this.sourceCode = sourceCode;
		this.totalTimings = totalTimings;
	}
}
