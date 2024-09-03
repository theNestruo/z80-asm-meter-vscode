import * as vscode from 'vscode';
import { config } from '../config';
import { mainParser } from "../parser/MainParser";
import { readSourceCodeFromActiveTextEditorSelecion } from './SourceCodeReader';
import { TotalTimings } from '../totalTiming/TotalTimings';
import { formatTiming, printableTimingSuffix, printTiming } from '../utils/FormatterUtils';
import { SourceCode } from '../types';

export abstract class AbstractCopyToClipboardCommand implements vscode.Command {

    abstract title: string;

    abstract command: string;

    protected doCopyToClipboard(sourceCode: SourceCode[]) {

        // (sanity check)
        if (!sourceCode.length) {
            return;
        }

        // Parses the source code
        const metered = mainParser.parse(sourceCode);
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
            : totalTimings.default;

        // Human readable
        if (!config.statusBar.copyTimingsAsHints) {
            let text = printTiming(timing);
            if (text) {
                text += ` ${printableTimingSuffix()}`;
            }
            const size = timing.size;
            if (size) {
                const sizeSuffix = (size === 1) ? "byte" : "bytes";
                text += `, ${size} ${sizeSuffix}`;
            }
            return text;
        }

        // As timing hint
        if (config.platform === "cpc") {
            const cpcText = formatTiming(timing.cpcTiming);
            return `[cpc=${cpcText}]`;
        }
        if (config.platform === "msx") {
            const msxText = formatTiming(timing.msxTiming);
            return `[msx=${msxText}]`;
        }
        const z80text = formatTiming(timing.z80Timing);
        if (config.platform === "pc8000") {
            const m1Text = formatTiming(timing.msxTiming);
            return `[z80=${z80text}] [m1=${m1Text}]`;
        }
        return `[z80=${z80text}]`;
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

export class CopyFromActiveTextEditorSelecionToClipboardCommand extends AbstractCopyToClipboardCommand {

    override readonly title = "Z80 Assembly Meter: copy to clipboard";

    override readonly command = "z80-asm-meter.copyToClipboard";

    private readonly disposable: vscode.Disposable;

    constructor() {
        super();

        // Registers as a command
        this.disposable = vscode.commands.registerCommand(this.command, this.onExecute, this);
    }

    dispose() {
        this.disposable.dispose();
    }

    onExecute(): void {

        // Reads and parses the source code
        this.doCopyToClipboard(readSourceCodeFromActiveTextEditorSelecion());
    }
}
