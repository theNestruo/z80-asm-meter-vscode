import { commands, Disposable, env, StatusBarItem, window, workspace } from "vscode";
import Meterable from "./model/Meterable";
import MainParser from "./parser/MainParser";
import AtExitDecorator from "./timing/AtExitDecorator";
import { hashCode } from "./utils/utils";
import MeterableViewer from "./viewer/MeterableViewer";
import MacroParser from "./parser/macro/MacroParser";

export default class ExtensionController {

    private static commandId = "z80AsmMeter.copyToClipboard";

    private disposable: Disposable;

    private isLeadingEvent: boolean = true;
    private previousEventTimestamp: number | undefined = undefined;
    private previousHashCode: number | undefined = undefined;
    private updateStatusBarTimeout: NodeJS.Timeout | undefined;

    private statusBarItem: StatusBarItem | undefined;

    constructor() {

        // subscribe to selection change and editor activation events
        const subscriptions: Disposable[] = [];
        window.onDidChangeTextEditorSelection(this.onEvent, this, subscriptions);
        window.onDidChangeActiveTextEditor(this.onEvent, this, subscriptions);
        workspace.onDidChangeTextDocument(this.onEvent, this, subscriptions);
        workspace.onDidChangeConfiguration(this.onConfigurationChange, this, subscriptions);

        // create a command to copy timing and size to clipboard
        const command = commands.registerCommand(ExtensionController.commandId, this.onCommand, this);

        // create a combined disposable from event subscriptions and command
        this.disposable = Disposable.from(...subscriptions, command);

        // First execution
        this.onEvent();
    }

    private onEvent() {

        // Checks debounce configuration
        const configuration = workspace.getConfiguration("z80-asm-meter");
        const debounce = configuration.get("debounce", 100);
        if (debounce <= 0) {
            // No debounce: immediate execution
            this.updateStatusBar();
            return;
        }

        // Cancels any pending execution
        clearTimeout(this.updateStatusBarTimeout);

        // Detect leading events
        if (!this.isLeadingEvent
            && this.previousEventTimestamp
            && (this.previousEventTimestamp + debounce < new Date().getTime())) {
            this.isLeadingEvent = true;
        }
        this.previousEventTimestamp = new Date().getTime();

        // Leading event?
        if (this.isLeadingEvent) {
            // Immediate execution
            this.updateStatusBar();
            this.isLeadingEvent = false;
            return;
        }

        // Debounced execution
        this.updateStatusBarTimeout = setTimeout(() => {
            this.updateStatusBar();
            this.isLeadingEvent = true;
        }, debounce);
    }

    private onConfigurationChange() {

        // Reloads caches for "heavy" configurations
        MacroParser.instance.reload();
    }

    private onCommand() {

        this.copyToClipboard();
    }

    private updateStatusBar() {

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
        if (!this.statusBarItem) {
            this.statusBarItem = window.createStatusBarItem();
        }
        this.statusBarItem.text = text;
        this.statusBarItem.tooltip = tooltip;
        this.statusBarItem.command = ExtensionController.commandId;
        this.statusBarItem.show();
    }

    private copyToClipboard() {

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

        if (this.statusBarItem) {
            this.statusBarItem.hide();
        }
    }

    dispose() {

        if (this.statusBarItem) {
            this.statusBarItem.dispose();
            this.statusBarItem = undefined;
        }
        this.disposable.dispose();
    }
}
