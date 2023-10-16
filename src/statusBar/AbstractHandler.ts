import * as vscode from 'vscode';
import { config } from '../config';

export abstract class AbstractHandler {

    protected readFromSelection(): string | undefined {

        const editor = vscode.window.activeTextEditor;
        if ((!editor)
            || (!this.isEnabledFor(editor.document.languageId))) {
            return undefined;
        }
        return editor.selection.isEmpty
            ? editor.document.lineAt(editor.selection.active.line).text
            : editor.document.getText(editor.selection);
    }

    private isEnabledFor(languageId: string): boolean {

        // Always enabled if it is a Z80 assembly file
        return (languageId === "z80-asm-meter")
            || (config.languageIds.indexOf(languageId) !== -1);
    }
}
