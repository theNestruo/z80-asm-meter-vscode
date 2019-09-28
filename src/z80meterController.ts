import { Disposable, StatusBarItem, window } from 'vscode';
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

        const sourceCode = this.getSelectedSourceCode();
        const z80Block = new Z80Block(sourceCode);
        this.updateStatusBar(z80Block);
    }

    private getSelectedSourceCode(): string | undefined {

        // Get the current text editor and selection
        const editor = window.activeTextEditor;
        if (!editor) {
            return undefined;
        }
        const editorSelection = editor.selection;
        if (editorSelection.isEmpty) {
            return undefined;
        }

        // Get selected source code only if it is a Z80 assembly file
        const editorDocument = editor.document;
        if ([
                "z80-asm-meter",
                "z80-macroasm",
                "z80-asm",
                "pasmo"
                ].indexOf(editorDocument.languageId) === -1) {
            return undefined;
        }
        return editorDocument.getText(editorSelection);
    }

    private updateStatusBar(z80Block: Z80Block) {

        const size = z80Block.getSizeInformation();
        if (!size) {
            if (this._sizeStatusBarItem) {
                this._sizeStatusBarItem.hide();
            }

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
            if (this._timingStatusBarItem) {
                this._timingStatusBarItem.hide();
            }

        } else {
            if (!this._timingStatusBarItem) {
                this._timingStatusBarItem = window.createStatusBarItem();
            }
            this._timingStatusBarItem.text = "$(watch) " + timing["text"];
            this._timingStatusBarItem.tooltip = timing["tooltip"];
            this._timingStatusBarItem.show();
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
