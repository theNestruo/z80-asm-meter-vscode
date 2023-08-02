import { commands, Disposable, env, StatusBarItem, window, workspace } from "vscode";
import Meterable from "./model/Meterable";
import MainParser from "./parser/MainParser";
import AtExitDecorator from "./timing/AtExitDecorator";
import { hashCode } from "./utils/utils";
import MeterableViewer from "./viewer/MeterableViewer";

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

        // Reads the source code
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

        // Parses the source code
        const metered = this.meterFromSourceCode(sourceCode);
        if (!metered) {
            this.previousHashCode = undefined;
            this.hideStatusBar();
            return;
        }

        // Reads relevant configuration
        const configuration = workspace.getConfiguration("z80-asm-meter");
        const viewBytesConfiguration = configuration.get("viewBytes") || false;
        const viewInstructionConfiguration = configuration.get("viewInstruction") || false;

        // Builds the statur bar text
        const viewer = new MeterableViewer(metered);
        let text = "";
        if (viewInstructionConfiguration) {
            const instruction = viewer.getStatusBarInstructions();
            if (instruction) {
                text += `$(code) ${instruction} `;
            }
        }
        const timing = viewer.getStatusBarTiming() || "0";
        const decoration = metered instanceof AtExitDecorator ? " $(debug-step-into)" : "";
        text += `$(watch)${decoration} ${timing}`;
        const size = viewer.getStatusBarSize();
        if (size !== undefined) {
            text += ` $(file-binary) ${size}`;
            if (viewBytesConfiguration) {
                const bytes = viewer.getStatusBarBytes();
                if (bytes) {
                    text += ` (${bytes})`;
                }
            }
        }

        // Builds the tooltip text
        const tooltip = viewer.getTooltip();

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

        // Reads the source code
        const sourceCode = this.readFromSelection();
        if (!sourceCode) {
            // (should never happen)
            return;
        }

        // Parses the source code
        const metered = this.meterFromSourceCode(sourceCode);
        if (!metered) {
            // (should never happen)
            return;
        }

        // Builds the text to copy to clipboard
        const textToCopy = new MeterableViewer(metered).getCommand();
        if (!textToCopy) {
            // (should never happen)
            return;
        }

        // Copies to clipboard and notifies the user
        env.clipboard.writeText(textToCopy);
        window.showInformationMessage(`"${textToCopy}" copied to clipboard`);

        // Returns the focus to the editor
        const editor = window.activeTextEditor;
        if (editor) {
            window.showTextDocument(editor.document);
        }
    }

    private readFromSelection(): string | undefined {

        const editor = window.activeTextEditor;
        if ((!editor)
            || (!this.isEnabledFor(editor.document.languageId))) {
            return undefined;
        }
        return editor.selection.isEmpty
            ? editor.document.lineAt(editor.selection.active.line).text
            : editor.document.getText(editor.selection);
    }

    private isEnabledFor(languageId: string): boolean {

        // Enabled if it is a Z80 assembly file
        if (languageId === "z80-asm-meter") {
            return true;
        }
        const languageIds: string[] =
            workspace.getConfiguration("z80-asm-meter").get("languageIds", []);
        return languageIds.indexOf(languageId) !== -1;
    }

    private meterFromSourceCode(sourceCode: string): Meterable | undefined {

        // Parses the source code
        const metered = new MainParser().parse(sourceCode);
        if (metered.isEmpty()) {
            return undefined;
        }

        // Optionally applies "timings at exit"
        const isTimingsAtExit =
            workspace.getConfiguration("z80-asm-meter").get("timings.atExit", false);
        return isTimingsAtExit
            ? AtExitDecorator.of(metered)
            : metered;
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
