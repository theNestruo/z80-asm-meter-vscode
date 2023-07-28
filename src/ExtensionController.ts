import { commands, Disposable, env, StatusBarItem, window, workspace } from "vscode";
import MeterableCollection from "./model/MeterableCollection";
import MainParser from "./parser/MainParser";
import { hashCode } from "./utils/utils";
import MeterableDecorator from "./viewer/MeterableDecorator";

export default class ExtensionController {

    private static commandId = "z80AsmMeter.copyToClipboard";

    private previousHashCode: number | undefined = undefined;
    private _statusBarItem: StatusBarItem | undefined;
    private _disposable: Disposable;

    constructor() {

        this._onEvent();

        // subscribe to selection change and editor activation events
        const subscriptions: Disposable[] = [];
        window.onDidChangeTextEditorSelection(this._onEvent, this, subscriptions);
        window.onDidChangeActiveTextEditor(this._onEvent, this, subscriptions);

        // create a command to copy timing and size to clipboard
        const command = commands.registerCommand(ExtensionController.commandId, this._onCommand, this);

        // create a combined disposable from both event subscriptions
        this._disposable = Disposable.from(...subscriptions, command);
    }

    private _onEvent() {

        // Reads the Z80 block
        const sourceCode = this.readFromSelection();
        if (!sourceCode) {
            this.previousHashCode = undefined;
            this.hideStatusBar();
            return;
        }
        const currentHashCode = hashCode(sourceCode);
        if (currentHashCode === this.previousHashCode) {
            // (no changes)
            return;
        }
        this.previousHashCode = currentHashCode;
        const metered = this.meterFromSourceCode(sourceCode);
        if (!metered) {
            this.previousHashCode = undefined;
            this.hideStatusBar();
            return;
        }

        const info = new MeterableDecorator(metered);

        // Reads relevant configuration
        const configuration = workspace.getConfiguration("z80-asm-meter");
        const viewBytesConfiguration = configuration.get("viewBytes") || false;
        const viewInstructionConfiguration = configuration.get("viewInstruction") || false;

        // Builds the text
        let text = "";
        if (viewInstructionConfiguration) {
            const instruction = info.getInstructionsAsText();
            text += `$(code) ${instruction} `;
        }
        const timing = info.getTimingAsText(false) || "0";
        const size = info.getSizeAsText();
        text += `$(watch) ${timing} $(file-binary) ${size}`;
        if (viewBytesConfiguration) {
            const bytes = info.getBytesAsText();
            text += ` (${bytes})`;
        }

        // Builds the tooltip
        const tooltip = info.getDetailedMarkdownString();

        // Builds the status bar item
        if (!this._statusBarItem) {
            this._statusBarItem = window.createStatusBarItem();
        }
        this._statusBarItem.text = text;
        this._statusBarItem.tooltip = tooltip;
        this._statusBarItem.command = ExtensionController.commandId;
        this._statusBarItem.show();
    }

    private _onCommand() {

        const z80Block = this.meterFromSourceCode(this.readFromSelection());
        if (!z80Block) {
            // (should never happen)
            return;
        }

        const info = new MeterableDecorator(z80Block);

        // Builds the text to copy to clipbaord
        const timingText = info.getTimingAsText(true);
        const sizeText = info.getSizeAsText();
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

    private readFromSelection(): string | undefined {

        // Reads the Z80 block
        const editor = window.activeTextEditor;
        if ((!editor)
            || (!this.isEnabledFor(editor.document.languageId))) {
            return undefined;
        }
        return editor.selection.isEmpty
            ? editor.document.lineAt(editor.selection.active.line).text
            : editor.document.getText(editor.selection);
    }

    private meterFromSourceCode(sourceCode: string | undefined): MeterableCollection | undefined {

        const metered = new MainParser().parse(sourceCode);
        return (metered.getSize() === 0)
                ? undefined
                : metered;
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
