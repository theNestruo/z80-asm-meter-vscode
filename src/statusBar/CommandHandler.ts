import * as vscode from 'vscode';
import { config } from '../config';
import { Meterable } from "../model/Meterable";
import { mainParser } from "../parser/MainParser";
import { humanReadableSize } from '../utils/ByteUtils';
import { AbstractHandler } from './AbstractHandler';
import { viewTimingToCopy, viewTimingToCopyAsHints } from "./DeprecatedViewTimingUtils";
import { defaultTotalTiming } from '../totalTiming/DefaultTotalTiming';

export class CommandHandler extends AbstractHandler implements vscode.Command {

    readonly title = "Z80 Assembly Meter: copy to clipboard";

    readonly command = "z80-asm-meter.copyToClipboard";

    copy() {

        // Reads the source code
        const sourceCode = this.readFromSelection();
        if (!sourceCode) {
            // (should never happen)
            return;
        }

        // Parses the source code
        const metering = mainParser.parse(sourceCode);
        if (!metering) {
            // (should never happen)
            return;
        }

        // Builds the text to copy to clipboard
        const textToCopy = this.buildCommandText(this.decorateForCommand(metering));
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

    private decorateForCommand(metering: Meterable): Meterable[] {

        return [defaultTotalTiming.applyTo(metering)];
        // // Applies special timing modes
        // switch (this.timingMode()) {
        //     case "default":
        //     default:
        //         return [metering];
        //     case "best":
        //     case "smart":
        //     case "all":
        //         return this.applyBestDecoration(metering);
        // }
    }

    buildCommandText(meterings: Meterable[]): string | undefined {

        // (prefers most specific algorithm)
        const metering = meterings[meterings.length - 1];

        // Builds the command text
        if (config.timing.hints.enabled) {
            return viewTimingToCopyAsHints(metering);
        }

        const timing = viewTimingToCopy(metering);
        const size = humanReadableSize(metering);

        return timing
            ? (size
                ? `${timing}, ${size}`
                : `${timing}`)
            : (size
                ? `${size}`
                : undefined);
    }
}
