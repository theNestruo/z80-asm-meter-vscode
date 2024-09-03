import * as vscode from 'vscode';
import { config } from '../config';
import { mainParser } from '../parser/MainParser';
import { TotalTimings } from '../totalTiming/TotalTimings';
import { Meterable, SourceCode } from '../types';
import { extractMnemonicOf, extractOperandsOf, isAnyCondition, isJrCondition, isUnconditionalJumpOrRetInstruction } from '../utils/AssemblyUtils';
import { hrMarkdown, printableTimingSuffix, printTiming, printTooltipMarkdown } from '../utils/FormatterUtils';
import { removeEnd } from '../utils/TextUtils';
import { isExtensionEnabledFor } from './SourceCodeReader';
import { lineToSourceCode } from '../utils/SourceCodeUtils';

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
		const ret = config.inlayHints.exitPointRet;
		const jp = config.inlayHints.exitPointJp;
		const jr = config.inlayHints.exitPointJr;
		const djnz = config.inlayHints.exitPointDjnz;

		// Builds the inlay hints
		const inlayHints: vscode.InlayHint[] = [];

		let subroutines: Subroutine[] = [];
		let codeFound: boolean = false;
		for (let n = range.start.line, m = range.end.line, i = n; i < m; i++) {
			const line = document.lineAt(i);
			const sourceCodes = lineToSourceCode(line.text);
			if (!sourceCodes.length || !sourceCodes[0]) {
				// (ignore empty lines)
				continue;
			}
			const sourceCode = sourceCodes[0];

			// (saves source code on each subroutine found)
			subroutines.forEach(subroutine => { subroutine.sourceCode.push(...sourceCodes); });

			const metered = mainParser.parseInstruction(sourceCode);

			// Checks labels (for section starts)
			if (this.isValidLabel(sourceCode)) {
				if (codeFound) {
					if (config.inlayHints.fallthroughSubroutines) {
						// "Falls through" label: appends a new section start
						subroutines.push(new Subroutine(line, sourceCodes));
					}
				} else {
					// Previous labels did not contain code: discards previous labels
					subroutines = [ new Subroutine(line, sourceCodes) ];
				}
			}

			// Checks source code (ignore unparseable lines)
			if (!metered) {
				continue;
			}

			// Checks no-code (ignore no-code lines)
			if (!this.isCode(metered)) {
				// Checks data
				if (metered.size && !codeFound) {
					// Latest label did only contain data: discards previous label
					subroutines.pop();
				}
				continue;
			}

			// Starts a new section on unlabelled code
			if (!codeFound && !subroutines.length && config.inlayHints.unlabelledSubroutines) {
				subroutines = [ new Subroutine(line, sourceCodes) ];
			}
			codeFound = true;

			// Checks section end
			if (isUnconditionalJumpOrRetInstruction(metered.instruction)) {
				subroutines.forEach(subroutine => { subroutine.endLine = line; });

				inlayHints.push(...this.buildSubroutineInlayHints(subroutines));

				// (restarts sections)
				subroutines = [];
				codeFound = false;

			} else if (this.isValidConditionalExitPoint(metered.instruction, ret, jp, jr, djnz)) {
				subroutines.forEach(subroutine => { subroutine.endLine = line; });
				inlayHints.push(...this.buildExitPointsInlayHints(subroutines));
			}
		}

		// Appends trailing code section
		if (subroutines.length && codeFound) {
			const line = document.lineAt(document.lineCount - 1);
			subroutines.forEach(subroutine => { subroutine.endLine = line; });
			inlayHints.push(...this.buildSubroutineInlayHints(subroutines));
		}

		return inlayHints;
	}

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

	private buildSubroutineInlayHints(subroutines: Subroutine[]): vscode.InlayHint[] {

		return subroutines.map(subroutine => this.buildInlayHint(subroutine.endOfStartLine, subroutine) );
	}

	private buildExitPointsInlayHints(subroutines: Subroutine[]): vscode.InlayHint[] {

		const subroutine = config.inlayHints.exitPointLabel === "first" ? subroutines[0] : subroutines[subroutines.length - 1];
		return [ this.buildInlayHint(subroutine.endOfEndLine, subroutine) ];
	}

	private buildInlayHint(position: vscode.Position, subroutine: Subroutine): vscode.InlayHint {

		const totalTimings = new TotalTimings(mainParser.parse(subroutine.sourceCode)!);
		const totalTiming = totalTimings.best();
		const timing = printTiming(totalTiming) || "0";
		const timingSuffix = printableTimingSuffix();

		const label = `${timing}${timingSuffix}`;

		const rangeText = subroutine.range.isSingleLine
			? `Line #${subroutine.range.start.line + 1}`
			: `Lines #${subroutine.range.start.line + 1} - #${subroutine.range.end.line + 1}`;
		const tooltip = new vscode.MarkdownString(`${rangeText}\n\n`, true)
			.appendMarkdown(hrMarkdown);

		const sourceCodeLabel = removeEnd(subroutine.sourceCode[0].label, ":");
		if (sourceCodeLabel) {
			tooltip.appendMarkdown(`## ${sourceCodeLabel}\n\n`);
		}

		tooltip.appendMarkdown(`${totalTiming.name} (line #${subroutine.range.end.line + 1}): ${totalTiming.statusBarIcon} ${label}\n`)
			.appendMarkdown(hrMarkdown)
			.appendMarkdown(printTooltipMarkdown(totalTimings).value);

		return {
			position: position,
			label: label,
			tooltip: tooltip,
			paddingLeft: true,
			paddingRight: true
		};
	}
}

function documentSelector(): readonly vscode.DocumentFilter[] {

	return [
		...config.languageIds.map(languageId => { return { language: languageId }; }),
		// Always enabled if it is a Z80 assembly file
		{ language: "z80-asm-meter" }
	];
}

class Subroutine {

	readonly startLine: vscode.TextLine;

	readonly sourceCode: SourceCode[];

	endLine: vscode.TextLine | undefined;

	constructor(startLine: vscode.TextLine, sourceCode: SourceCode[]) {
		this.startLine = startLine;
		this.sourceCode = sourceCode;
		this.endLine = undefined;
	}

	get endOfStartLine(): vscode.Position {

		const lineCommentPosition = this.sourceCode[0].lineCommentPosition;
		return lineCommentPosition < 0
				? this.startLine.range.end
				: this.startLine.range.end.with(undefined, lineCommentPosition);
	}

	get endOfEndLine(): vscode.Position {

		const lineCommentPosition = this.sourceCode[this.sourceCode.length - 1].lineCommentPosition || -1;
		return lineCommentPosition < 0
				? this.endLine!.range.end
				: this.endLine!.range.end.with(undefined, lineCommentPosition);
	}

	get range(): vscode.Range {

		return new vscode.Range(this.startLine.range.start, this.endLine!.range.end);
	}
}
