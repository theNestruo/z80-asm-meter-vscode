import type * as vscode from "vscode";

/*
 * Print
 */

export function printPosition(position: vscode.Position): string {

	return `#${String(position.line + 1)}`;
}

export function printRange(range: vscode.Range): string {

	return range.isSingleLine
		? printPosition(range.start)
		: `#${String(range.start.line + 1)}&nbsp;&ndash;&nbsp;#${String(range.end.line + 1)}`;
}
