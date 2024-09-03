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

		let incompleteSubroutines: IncompleteSubroutine[] = [];
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
			incompleteSubroutines.forEach(subroutine => { subroutine.sourceCode.push(...sourceCodes); });

			const metered = mainParser.parseInstruction(sourceCode);

			// Checks labels (for subroutine starts)
			if (this.isValidLabel(sourceCode)) {
				if (codeFound) {
					if (config.inlayHints.fallthroughSubroutines) {
						// "Falls through" label: appends a new subroutine start
						incompleteSubroutines.push(new IncompleteSubroutine(line, sourceCodes));
					}
				} else {
					// Previous labels did not contain code: discards previous labels
					incompleteSubroutines = [ new IncompleteSubroutine(line, sourceCodes) ];
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
					incompleteSubroutines.pop();
				}
				continue;
			}

			// Starts a new subroutine on unlabelled code
			if (!codeFound && !incompleteSubroutines.length && config.inlayHints.unlabelledSubroutines) {
				incompleteSubroutines = [ new IncompleteSubroutine(line, sourceCodes) ];
			}
			codeFound = true;

			// Checks subroutine end
			if (isUnconditionalJumpOrRetInstruction(metered.instruction)) {
				// Subroutine end
				const subroutines = incompleteSubroutines.map(incompleteSubroutine => incompleteSubroutine.completeTo(line));
				inlayHints.push(...this.buildSubroutineInlayHints(subroutines));

				// (restarts sections)
				incompleteSubroutines = [];
				codeFound = false;

			// Checks subroutine exit point
			} else if (this.isValidConditionalExitPoint(metered.instruction, ret, jp, jr, djnz)) {
				// Subroutine exit point
				const subroutines = incompleteSubroutines.map(incompleteSubroutine => incompleteSubroutine.completeToExitPoint(line));
				inlayHints.push(...this.buildExitPointsInlayHints(subroutines));
			}
		}

		// Completes trailing code as subroutine
		if (incompleteSubroutines.length && codeFound) {
			const line = document.lineAt(document.lineCount - 1);
			const subroutines = incompleteSubroutines.map(incompleteSubroutine => incompleteSubroutine.completeTo(line));
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

		return subroutines.map(subroutine => this.buildInlayHint(subroutine, true) );
	}

	private buildExitPointsInlayHints(subroutines: Subroutine[]): vscode.InlayHint[] {

		const subroutine = config.inlayHints.exitPointLabel === "first" ? subroutines[0] : subroutines[subroutines.length - 1];
		return [ this.buildInlayHint(subroutine, false) ];
	}

	private buildInlayHint(subroutine: Subroutine, isSubroutineInlayHint: boolean): vscode.InlayHint {

		// Computes the actual data
		const totalTimings = new TotalTimings(mainParser.parse(subroutine.sourceCode)!);
		const totalTiming = totalTimings.best();
		const timing = printTiming(totalTiming) || "0";
		const timingSuffix = printableTimingSuffix();

		// Computes the InlayHint position
		const positionLine = isSubroutineInlayHint ? subroutine.startLine : subroutine.endLine;
		const positionSourceCode = isSubroutineInlayHint ? subroutine.sourceCode[0] : subroutine.sourceCode[subroutine.sourceCode.length - 1];
		const lineCommentPosition = positionSourceCode.lineCommentPosition;
		const positionCharacter = positionLine.text.substring(0, lineCommentPosition >= 0 ? lineCommentPosition : undefined).trimEnd().length;
		const inlayHintPosition = positionLine.range.end.with(undefined, positionCharacter);

		// Computes the InlayHint label
		const inlayHintLabel = `${timing}${timingSuffix}`;

		// Computes the InlayHint tooltip
		const sourceCodeLabel = removeEnd(subroutine.sourceCode[0].label, ":");
		const rangeText = printRange(new vscode.Range(subroutine.startLine.range.start, subroutine.endLine.range.end));
		const timingText = `**${timing}**${timingSuffix}`;
		const inlayHintTooltip = new vscode.MarkdownString("", true)
			.appendMarkdown(sourceCodeLabel ? `### ${sourceCodeLabel}\n\n`: "")
			.appendMarkdown(`_${rangeText}_\n\n`)
			.appendMarkdown(`${totalTiming.statusBarIcon} ${totalTiming.name}: ${timingText}\n`)
			.appendMarkdown(hrMarkdown)
			.appendMarkdown(printTooltipMarkdown(totalTimings).join("\n"));

		// Computes the InlayHint paddingLeft
		const inlayHintPaddingLeft = true;

		// Computes the InlayHint paddingLeft
		const inlayHintPaddingRight = lineCommentPosition >= 0; // the line has trailing comment

		return {
			position: inlayHintPosition,
			label: inlayHintLabel,
			tooltip: inlayHintTooltip,
			paddingLeft: inlayHintPaddingLeft,
			paddingRight: inlayHintPaddingRight
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

class IncompleteSubroutine {

	readonly startLine: vscode.TextLine;

	readonly sourceCode: SourceCode[];

	constructor(startLine: vscode.TextLine, sourceCode: SourceCode[]) {
		this.startLine = startLine;
		this.sourceCode = sourceCode;
	}

	completeTo(endLine: vscode.TextLine): Subroutine {
		return new Subroutine(this.startLine, endLine, this.sourceCode);
	}

	completeToExitPoint(endLine: vscode.TextLine): Subroutine {
		return new Subroutine(this.startLine, endLine, this.sourceCode);
	}
}

class Subroutine extends IncompleteSubroutine {

	readonly endLine: vscode.TextLine;

	constructor(startLine: vscode.TextLine, endLine: vscode.TextLine, sourceCode: SourceCode[]) {
		super(startLine, sourceCode);

		this.endLine = endLine;
	}
}
