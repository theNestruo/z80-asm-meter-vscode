import { commands, Disposable, env, StatusBarItem, window, workspace } from "vscode";
import { Parser } from "./Parser_";
import { Z80Block } from "./Z80Block_";

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
        const z80Block = this.readZ80BlockFromSelection();
        if (!z80Block) {
            this.hideStatusBar();
            return;
        }

        // Reads relevant configuration
        const configuration = workspace.getConfiguration("z80-asm-meter");
        const viewBytesConfiguration = configuration.get("viewBytes") || false;
        const viewInstructionConfiguration = configuration.get("viewInstruction") || false;

        // Builds the text
        let text = "";
        if (viewInstructionConfiguration) {
            const instruction = z80Block.getInstructionText();
            text += `$(code) ${instruction} `;
        }
        const timing = z80Block.getTimingText(false);
        const size = z80Block.getSizeText();
        text += `$(watch) ${timing} $(file-binary) ${size}`;
        if (viewBytesConfiguration) {
            const bytes = z80Block.getBytesText();
            text += ` (${bytes})`;
        }

        // Builds the tooltip
        const tooltip = z80Block.getDetailedMarkdownString();

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

        const z80Block = this.readZ80BlockFromSelection();
        if (!z80Block) {
            // (should never happen)
            return;
        }

        // Builds the text to copy to clipbaord
        const timingText = z80Block.getTimingText(true);
        const sizeText = z80Block.getSizeText();
        const text = `${timingText}, ${sizeText}`;

        // Copies to clipboard and notifies the user
        env.clipboard.writeText(text);
        window.showInformationMessage(`"${text}" copied to clipboard`);

        // Returns the focus to the editor
        const editor = window.activeTextEditor;
        if (editor) {
            window.showTextDocument(editor.document);
        }
    }

    private readZ80BlockFromSelection(): Z80Block | undefined{

        // Reads the Z80 block
        const editor = window.activeTextEditor;
        if ((!editor)
                || (!this.isEnabledFor(editor.document.languageId))) {
            return undefined;
        }
        const sourceCode = editor.selection.isEmpty
            ? editor.document.lineAt(editor.selection.active.line).text
            : editor.document.getText(editor.selection);
        const z80Block = new Parser().parse(sourceCode);
        if (z80Block.loc === 0) {
            return undefined;
        }

        return z80Block;
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
