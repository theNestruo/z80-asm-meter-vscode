import * as vscode from 'vscode';

/*
 * Print
 */

export function printPosition(position: vscode.Position): string {

	return `#${position.line + 1}`;
}

export function printRange(range: vscode.Range): string {

	return range.isSingleLine
		? printPosition(range.start)
		: `#${range.start.line + 1}&nbsp;&ndash;&nbsp;#${range.end.line + 1}`;
}
