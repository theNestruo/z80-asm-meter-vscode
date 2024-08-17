import * as vscode from 'vscode';
import { config } from '../config';

export function readFromSelection(): string | undefined {

    const editor = vscode.window.activeTextEditor;
    if ((!editor)
        || (!isExtensionEnabledFor(editor.document.languageId))) {
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

function isExtensionEnabledFor(languageId: string): boolean {

    return config.languageIds.includes(languageId)
        // Always enabled if it is a Z80 assembly file
        || (languageId === "z80-asm-meter");
}
