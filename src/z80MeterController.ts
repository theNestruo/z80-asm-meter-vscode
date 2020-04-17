import { Disposable, StatusBarItem, TextEditor, window, workspace } from 'vscode';
import { Z80Block } from './z80Block';

export class Z80MeterController {

    private _timingStatusBarItem: StatusBarItem | undefined;
    private _instructionStatusBarItem: StatusBarItem | undefined;
    private _opcodeStatusBarItem: StatusBarItem | undefined;
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
                || (!this.isEnabledFor(editor.document.languageId))) {
            this.hideTimingStatusBarItem();
            this.hideInstructionStatusBarItem();
            this.hideOpcodeStatusBarItem();
            return;
        }

        const sourceCode = editor.selection.isEmpty
            ? editor.document.lineAt(editor.selection.active.line).text
            : editor.document.getText(editor.selection);
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

        const instruction = z80Block.getInstructionInformation();
        if (!instruction) {
            this.hideInstructionStatusBarItem();

        } else {
            if (!this._instructionStatusBarItem) {
                this._instructionStatusBarItem = window.createStatusBarItem();
            }
            this._instructionStatusBarItem.text = "$(code) " + instruction["text"];
            this._instructionStatusBarItem.tooltip = instruction["tooltip"];
            this._instructionStatusBarItem.show();
        }

        const opcode = z80Block.getOpcodeAndSizeInformation();
        if (!opcode) {
            this.hideOpcodeStatusBarItem();

        } else {
            if (!this._opcodeStatusBarItem) {
                this._opcodeStatusBarItem = window.createStatusBarItem();
            }
            this._opcodeStatusBarItem.text = "$(file-binary) " + opcode["text"];
            this._opcodeStatusBarItem.tooltip = opcode["tooltip"];
            this._opcodeStatusBarItem.show();
        }
    }

    private hideTimingStatusBarItem() {
        if (this._timingStatusBarItem) {
            this._timingStatusBarItem.hide();
        }
    }

    private hideInstructionStatusBarItem() {
        if (this._instructionStatusBarItem) {
            this._instructionStatusBarItem.hide();
        }
    }

    private hideOpcodeStatusBarItem() {
        if (this._opcodeStatusBarItem) {
            this._opcodeStatusBarItem.hide();
        }
    }

	dispose() {
		this._disposable.dispose();
        if (this._timingStatusBarItem) {
            this._timingStatusBarItem.dispose();
            this._timingStatusBarItem = undefined;
        }
        if (this._instructionStatusBarItem) {
            this._instructionStatusBarItem.dispose();
            this._instructionStatusBarItem = undefined;
        }
        if (this._opcodeStatusBarItem) {
            this._opcodeStatusBarItem.dispose();
            this._opcodeStatusBarItem = undefined;
        }
	}
}
