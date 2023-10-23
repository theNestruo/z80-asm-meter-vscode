import * as vscode from 'vscode';
import { config } from '../config';

export abstract class AbstractHandler {

    protected readFromSelection(): string | undefined {

        const editor = vscode.window.activeTextEditor;
        if ((!editor)
            || (!this.isEnabledFor(editor.document.languageId))) {
            return undefined;
        }

        // No selection; uses cursor position
        if (editor.selection.isEmpty) {
            return editor.document.lineAt(editor.selection.active.line).text;
        }

        // Do not expand selection
        if (!config.expandSelectionToLine) {
            return editor.document.getText(editor.selection);
        }

        // Expand single line selection to line
        if (editor.selection.isSingleLine) {
            return editor.document.lineAt(editor.selection.start.line).text;
        }

        // Expand multiline selection
        return editor.document.getText(new vscode.Range(
            editor.selection.start.line, 0,
            editor.selection.end.character
                ? editor.selection.end.line + 1
                : editor.selection.end.line, 0));
    }

    private isEnabledFor(languageId: string): boolean {

        // Always enabled if it is a Z80 assembly file
        return (languageId === "z80-asm-meter")
            || (config.languageIds.indexOf(languageId) !== -1);
    }
}
