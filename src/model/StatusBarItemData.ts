import * as vscode from 'vscode';

export class StatusBarItemData {

    readonly text: string;

    /** The optional line repetition count */
    readonly tooltip: vscode.MarkdownString;

    constructor(text: string, tooltip: vscode.MarkdownString) {
        this.text = text;
        this.tooltip = tooltip;
    }
}
