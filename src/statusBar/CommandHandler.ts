import * as vscode from 'vscode';
import { config } from '../config';
import { mainParser } from "../parser/MainParser";
import { atExitTotalTiming } from '../totalTiming/AtExitTotalTiming';
import { defaultTotalTiming } from '../totalTiming/DefaultTotalTiming';
import { executionFlowTotalTiming } from '../totalTiming/ExecutionFlowTotalTiming';
import { TotalTimingMeterable } from '../totalTiming/TotalTiming';
import { formatTiming, humanReadableTiming } from '../utils/TimingUtils';
import { readFromSelection } from '../utils/EditorUtils';

export class CopyToClipboardCommandHandler implements vscode.Command {

    readonly title = "Z80 Assembly Meter: copy to clipboard";

    readonly command = "z80-asm-meter.copyToClipboard";

    onExecute() {

        // Reads and parses the source code
        const sourceCode = readFromSelection();
        if (!sourceCode) {
            return;
        }
        const metered = mainParser.parse(sourceCode);
        if (!metered) {
            return;
        }

        // Prepares the total timing
        const defaultTiming = defaultTotalTiming.applyTo(metered);
        const flowTiming = executionFlowTotalTiming.applyTo(metered);
        const atExitTiming = atExitTotalTiming.applyTo(metered);

        // Builds the text to copy to clipboard
        const textToCopy = this.buildTextToCopy(defaultTiming, flowTiming, atExitTiming);
        if (!textToCopy) {
            // (should never happen)
            return;
        }

        // Copies to clipboard and notifies the user
        vscode.env.clipboard.writeText(textToCopy);
        vscode.window.showInformationMessage(`"${textToCopy}" copied to clipboard`);

        // Returns the focus to the editor
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            vscode.window.showTextDocument(editor.document);
        }
    }

    buildTextToCopy(
        defaultTiming: TotalTimingMeterable,
        flowTiming: TotalTimingMeterable | undefined,
        atExitTiming: TotalTimingMeterable | undefined): string | undefined {

        const timing = config.statusBar.totalTimingsEnabled
            ? atExitTiming || flowTiming || defaultTiming
            : defaultTiming;

        // Human readable
        if (!config.statusBar.copyTimingsAsHints) {
            let text = humanReadableTiming(timing) || "";
            if (text) {
                const timingSuffix = config.platform === "cpc" ? "NOPs" : "clock cycles";
                text += ` ${timingSuffix}`;
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
}
