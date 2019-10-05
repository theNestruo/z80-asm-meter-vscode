import { Disposable, StatusBarItem, TextEditor, window, workspace } from 'vscode';
import { Z80Block } from './z80Block';

export class Z80MeterController {

    private _timingStatusBarItem: StatusBarItem | undefined;
    private _sizeStatusBarItem: StatusBarItem | undefined;
    private _disposable: Disposable;

	constructor() {
        this._onEvent();

        // subscribe to selection change and editor activation events
        let subscriptions: Disposable[] = [];
        window.onDidChangeTextEditorSelection(this._onEvent, this, subscriptions);
        window.onDidChangeActiveTextEditor(this._onEvent, this, subscriptions);

        // create a combined disposable from both event subscriptions
        this._disposable = Disposable.from(...subscriptions);
    }

    private _onEvent() {

        const editor = window.activeTextEditor;
        if ((!editor)
                || editor.selection.isEmpty
                || (!this.isEnabledFor(editor.document.languageId))) {
            this.hideSizeStatusBarItem();
            this.hideTimingStatusBarItem();
            return;
        }

        const sourceCode = editor.document.getText(editor.selection);
        const z80Block = new Z80Block(sourceCode);
        this.updateStatusBar(z80Block);
    }

    private isEnabledFor(languageId: string): boolean {

        // Enabled if it is a Z80 assembly file
        if (languageId === "z80-asm-meter") {
            return true;
        }
        const languageIds: string[] = workspace.getConfiguration("z80-asm-meter").get("languageIds", []);
        return languageIds.indexOf(languageId) !== -1;
    }

    private updateStatusBar(z80Block: Z80Block) {

        const size = z80Block.getSizeInformation();
        if (!size) {
            this.hideSizeStatusBarItem();

        } else {
            if (!this._sizeStatusBarItem) {
                this._sizeStatusBarItem = window.createStatusBarItem();
            }
            this._sizeStatusBarItem.text = "$(code) " + size["text"];
            this._sizeStatusBarItem.tooltip = size["tooltip"];
            this._sizeStatusBarItem.show();
        }

        const timing = z80Block.getTimingInformation();
        if (!timing) {
            this.hideTimingStatusBarItem();

        } else {
            if (!this._timingStatusBarItem) {
                this._timingStatusBarItem = window.createStatusBarItem();
            }
            this._timingStatusBarItem.text = "$(watch) " + timing["text"];
            this._timingStatusBarItem.tooltip = timing["tooltip"];
            this._timingStatusBarItem.show();
        }
    }

    private hideSizeStatusBarItem() {
        if (this._sizeStatusBarItem) {
            this._sizeStatusBarItem.hide();
        }
    }

    private hideTimingStatusBarItem() {
        if (this._timingStatusBarItem) {
            this._timingStatusBarItem.hide();
        }
    }

	dispose() {
		this._disposable.dispose();
        if (this._timingStatusBarItem) {
            this._timingStatusBarItem.dispose();
            this._timingStatusBarItem = undefined;
        }
        if (this._sizeStatusBarItem) {
            this._sizeStatusBarItem.dispose();
            this._sizeStatusBarItem = undefined;
        }
	}
}
