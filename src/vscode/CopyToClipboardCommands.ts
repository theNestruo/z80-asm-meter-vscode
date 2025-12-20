import * as vscode from "vscode";
import { config } from "../config";
import { mainParser } from "../parsers/parsers";
import { TotalTimings } from "../totalTimings/TotalTimings";
import type { SourceCode } from "../types/SourceCode";
import { formatTiming, printableTimingSuffix, printFullTiming } from "../utils/TimingUtils";
import { readSourceCodeFromActiveTextEditorSelecion } from "./SourceCodeReader";

/**
 * A "copy to clipboard" command
 */
export interface CopyToClipboardCommand extends vscode.Command {

	buildDescription(totalTimings: TotalTimings): string | undefined;
}

/**
 * Base class for "copy to clipboard" command implementations
 */
abstract class AbstractCopyToClipboardCommand implements CopyToClipboardCommand {

	abstract title: string;

	abstract command: string;

	protected doCopyToClipboard(sourceCode: SourceCode[]): void {

		// (sanity check)
		if (!sourceCode.length) {
			return;
		}

		// Parses the source code
		const metered = mainParser.instance.parse(sourceCode);
		if (!metered) {
			return;
		}

		// Prepares the total timings
		const totalTimings = new TotalTimings(metered);

		// Builds the text to copy to clipboard
		const textToCopy = this.buildTextToCopy(totalTimings);
		if (!textToCopy) {
			// (should never happen)
			return;
		}

		// Copies to clipboard and notifies the user
		vscode.env.clipboard.writeText(textToCopy);
		vscode.window.showInformationMessage(this.buildNotification(textToCopy));

		// Returns the focus to the editor
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			vscode.window.showTextDocument(editor.document);
		}
	}

	protected buildTextToCopy(totalTimings: TotalTimings): string | undefined {

		const timing = config.statusBar.totalTimingsEnabled
			? totalTimings.best()
			: totalTimings.defaultTotalTiming;

		// Human readable
		if (!config.statusBar.copyTimingsAsHints) {
			let text = printFullTiming(timing);
			if (text) {
				text += ` ${printableTimingSuffix()}`;
			} else {
				text = "";
			}
			const size = timing.size;
			if (size) {
				const sizeSuffix = (size === 1) ? "byte" : "bytes";
				if (text) {
					text += ", ";
				}
				text += `${String(size)} ${sizeSuffix}`;
			}
			return text;
		}

		// As timing hint
		switch (config.platform) {
			case "z80":
			case "z80n":
				return `[z80=${formatTiming(timing.z80Timing)}]`;
			case "msx":
				return `[msx=${formatTiming(timing.msxTiming)}]`;
			case "msxz80":
				return `[msx=${formatTiming(timing.msxTiming)}] [z80=${formatTiming(timing.z80Timing)}]`;
			case "pc8000":
				return `[z80=${formatTiming(timing.z80Timing)}] [m1=${formatTiming(timing.msxTiming)}]`;
			case "cpc":
				return `[cpc=${formatTiming(timing.cpcTiming)}]`;
		}
	}

	buildDescription(totalTimings: TotalTimings): string | undefined {

		const textToCopy = this.buildTextToCopy(totalTimings);
		if (!textToCopy) {
			return undefined;
		}
		return `Copy "${textToCopy}" to clipboard`;
	}

	protected buildNotification(textToCopy: string): string {

		return `"${textToCopy}" copied to clipboard`;
	}
}

/**
 * "Copy to clipboard" command that uses the active text editor selection
 */
export class FromActiveTextEditorSelecionCopyToClipboardCommand
	extends AbstractCopyToClipboardCommand implements vscode.Disposable {

	override readonly title = "Z80 Assembly Meter: copy to clipboard";

	override readonly command = "z80-asm-meter.copyToClipboard";

	private readonly disposable: vscode.Disposable;

	constructor() {
		super();

		this.disposable =
			// Registers as a command
			// eslint-disable-next-line @typescript-eslint/unbound-method
			vscode.commands.registerCommand(this.command, this.onExecute, this);
	}

	dispose(): void {
		this.disposable.dispose();
	}

	onExecute(): void {

		// Reads and parses the source code
		this.doCopyToClipboard(readSourceCodeFromActiveTextEditorSelecion());
	}
}
