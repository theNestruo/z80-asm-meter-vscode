import * as vscode from 'vscode';
import { config } from '../config';
import { mainParser } from "../parser/MainParser";
import { TotalTimings } from '../totalTiming/TotalTimings';
import { SourceCode } from '../types';
import { formatTiming, printableTimingSuffix, printTiming } from '../utils/FormatterUtils';
import { readSourceCodeFromActiveTextEditorSelecion } from './SourceCodeReader';

export interface CopyToClipboardCommand extends vscode.Command {

    buildDescription(totalTimings: TotalTimings): string | undefined;
}

abstract class AbstractCopyToClipboardCommand implements CopyToClipboardCommand {

    abstract title: string;

    abstract command: string;

    protected doCopyToClipboard(sourceCode: SourceCode[]) {

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

export class FromActiveTextEditorSelecionCopyToClipboardCommand extends AbstractCopyToClipboardCommand implements vscode.Disposable {

    override readonly title = "Z80 Assembly Meter: copy to clipboard";

    override readonly command = "z80-asm-meter.copyToClipboard";

    private readonly _disposable: vscode.Disposable;

    constructor() {
        super();

        this._disposable =
            // Registers as a command
            vscode.commands.registerCommand(this.command, this.onExecute, this);
    }

    dispose() {
        this._disposable.dispose();
    }

    onExecute(): void {

        // Reads and parses the source code
        this.doCopyToClipboard(readSourceCodeFromActiveTextEditorSelecion());
    }
}
