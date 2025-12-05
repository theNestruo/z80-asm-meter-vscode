import * as vscode from "vscode";
import { config } from "../config";
import type { SourceCode } from "../types/SourceCode";
import { linesToSourceCode } from "../utils/SourceCodeUtils";

export function readSourceCodeFromActiveTextEditorSelecion(): SourceCode[] {

	return linesToSourceCode(readLinesFromActiveTextEditorSelection());
}

export function readLinesFromActiveTextEditorSelection(): string[] {

	const editor = vscode.window.activeTextEditor;
	if ((!editor) || (!isExtensionEnabledFor(editor.document))) {
		return [];
	}

	// No selection; uses cursor position
	if (editor.selection.isEmpty) {
		return [editor.document.lineAt(editor.selection.active.line).text];
	}

	return readLinesFrom(editor.document, editor.selection, config.expandSelectionToLine);
}

export function isExtensionEnabledFor(document: vscode.TextDocument): boolean {

	const languageId = document.languageId;
	return config.languageIds.includes(languageId)
		// Always enabled if it is a Z80 assembly file
		|| (languageId === "z80-asm-meter");
}

function readLinesFrom(
	document: vscode.TextDocument,
	range: vscode.Range,
	expandRangeToLine = true): string[] {

	// Single line selection?
	if (range.isSingleLine) {
		// Expand single line selection to line?
		return [config.expandSelectionToLine ? document.lineAt(range.start).text : document.getText(range)];
	}

	const lines = [];
	if (expandRangeToLine) {
		// Expand multiline selection
		const m = range.end.character ? range.end.line : range.end.line - 1;
		for (let i = range.start.line; i <= m; i++) {
			lines.push(document.lineAt(i).text);
		}

	} else {
		// Do not expand multiline selection
		const n = range.start.line, m = range.end.line;
		for (let i = n; i <= m; i++) {
			const line = document.lineAt(i);
			lines.push(range.contains(line.range)
				? line.text
				: document.getText(range.intersection(line.range)));
		}
	}
	return lines;
}
