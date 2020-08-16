import { commands, Disposable, env, StatusBarItem, TextEditor, window, workspace } from 'vscode';
import { Z80Block } from './z80Block';

export class Z80MeterController {

    private static commandId = "z80AsmMeter.copyToClipboard";

    private _statusBarItem: StatusBarItem | undefined;
    private _disposable: Disposable;

    constructor() {

        this._onEvent();

        // subscribe to selection change and editor activation events
        let subscriptions: Disposable[] = [];
        window.onDidChangeTextEditorSelection(this._onEvent, this, subscriptions);
        window.onDidChangeActiveTextEditor(this._onEvent, this, subscriptions);

        // create a command to copy timing and size to clipboard
        let command = commands.registerCommand(Z80MeterController.commandId, this._onCommand, this);

        // create a combined disposable from both event subscriptions
        this._disposable = Disposable.from(...subscriptions, command);
    }

    private _onEvent() {

        // Reads the Z80 block
        const editor = window.activeTextEditor;
        if ((!editor)
                || (!this.isEnabledFor(editor.document.languageId))) {
            this.hideStatusBar();
            return;
        }
        const z80Block = this.getSelectedZ80Block(editor);
        if (z80Block.loc === 0) {
            this.hideStatusBar();
            return;
        }

        // Reads relevant configuration
        const configuration = workspace.getConfiguration("z80-asm-meter");
        const viewOpcodeConfiguration = configuration.get("viewOpcode") || false;
        const viewInstructionConfiguration = configuration.get("viewInstruction") || false;

        // Builds the text
        const timing = z80Block.getTimingInformation();
        const size = z80Block.getSizeInformation();
        let text = `$(watch) ${timing} $(file-binary) ${size}`;
        if (viewOpcodeConfiguration) {
            const opcode = z80Block.getOpcodeInformation();
            text += ` (${opcode})`;
        }
        if (viewInstructionConfiguration) {
            const instruction = z80Block.getInstructionInformation();
            text += ` $(code) ${instruction}`;
        }

        // Builds the tooltip
        const detailedTiming = z80Block.getDetailedTimingInformation();
        const detailedInstructionAndOpcode = z80Block.getDetailedInstructionAndOpcodeInformation();
        let tooltip = `${detailedTiming}\n${size}:\n${detailedInstructionAndOpcode}`;

        // Builds the status bar item
        if (!this._statusBarItem) {
            this._statusBarItem = window.createStatusBarItem();
        }
        this._statusBarItem.text = text;
        this._statusBarItem.tooltip = tooltip;
        this._statusBarItem.command = Z80MeterController.commandId;
        this._statusBarItem.show();
    }

    private _onCommand() {

        const editor = window.activeTextEditor;
        if ((!editor)
                || (!this.isEnabledFor(editor.document.languageId))) {
            // (should never happen)
            return;
        }

        const z80Block = this.getSelectedZ80Block(editor);
        const timing = z80Block.getLongTimingInformation();
        const size = z80Block.getSizeInformation();
        const text = `${timing}, ${size}`;

        // copies to clipboard and notifies the user
        env.clipboard.writeText(text);
        window.showInformationMessage(`"${text}" copied to clipboard`);

        // returns the focus to the editor
        window.showTextDocument(editor.document);

        return;
    }

    private getSelectedZ80Block(editor: TextEditor): Z80Block {

        const sourceCode = editor.selection.isEmpty
            ? editor.document.lineAt(editor.selection.active.line).text
            : editor.document.getText(editor.selection);
        return new Z80Block(sourceCode);
    }

    private isEnabledFor(languageId: string): boolean {

        // Enabled if it is a Z80 assembly file
        if (languageId === "z80-asm-meter") {
            return true;
        }
        const languageIds: string[] = workspace.getConfiguration("z80-asm-meter").get("languageIds", []);
        return languageIds.indexOf(languageId) !== -1;
    }

    private hideStatusBar() {
        if (this._statusBarItem) {
            this._statusBarItem.hide();
        }
    }

    dispose() {
        if (this._statusBarItem) {
            this._statusBarItem.dispose();
            this._statusBarItem = undefined;
        }
        this._disposable.dispose();
    }
}
