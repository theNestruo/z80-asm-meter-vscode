import { commands, ConfigurationChangeEvent, Disposable, env, MarkdownString, StatusBarItem, window, workspace } from "vscode";
import Meterable from "./model/Meterable";
import MacroParser from "./parser/macro/MacroParser";
import MainParser from "./parser/MainParser";
import AtExitDecorator from "./timing/modes/AtExitTimingDecorator";
import FlowDecorator from "./timing/modes/ExecutionFlowTimingDecorator";
import { hashCode } from "./utils/SourceCodeUtils";
import { viewBytes, viewStatusBarSize, viewTooptipSize } from "./viewer/ViewBytesUtils";
import { viewInstructions } from "./viewer/ViewInstructionsUtils";
import { viewStatusBarTimings, viewTimingsToCopy, viewTimingsToCopyAsHints, viewTooltipTimings } from "./viewer/ViewTimingsUtils";

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

        // subscribe to configuration change event
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

    private onConfigurationChange(e: ConfigurationChangeEvent) {

        // Reloads caches for "heavy" configurations
        if (e.affectsConfiguration("z80-asm-meter.macros")) {
            MacroParser.instance.reload();
        }
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
        const metering = this.meterFromSourceCode(sourceCode);
        if (!metering) {
            this.previousHashCode = undefined;
            this.hideStatusBar();
            return;
        }

        // Builds the statur bar text
        const text = this.buildStatusBarText(this.decorateForStatusBar(metering))
            .replace(/\s+/, " ")
            .trim();

        // Builds the tooltip text
        const tooltip = this.buildTooltipMarkdown(this.decorateForTooltip(metering));

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
        const metering = this.meterFromSourceCode(sourceCode);
        if (!metering) {
            // (should never happen)
            return;
        }

        // Builds the text to copy to clipboard
        const textToCopy = this.buildCommandText(this.decorateForCommand(metering));
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
        const metering = new MainParser().parse(sourceCode);
        return metering.isEmpty() ? undefined : metering;
    }

    private decorateForStatusBar(metering: Meterable): Meterable[] {

        // Applies special timing modes
        switch (this.timingMode()) {
            case "default":
            default:
                return [metering];
            case "best":
                return this.applyBestDecoration(metering);
            case "smart":
                return this.applySmartDecorations(metering);
            case "all":
                return this.applyAllDecorations(metering);
        }
    }

    private decorateForTooltip(metering: Meterable): Meterable[] {

        // Applies special timing modes
        switch (this.timingMode()) {
            case "default":
            default:
                return [metering];
            case "best":
            case "smart":
            case "all":
                return this.applyAllDecorations(metering);
        }
    }

    private decorateForCommand(metering: Meterable): Meterable[] {

        // Applies special timing modes
        switch (this.timingMode()) {
            case "default":
            default:
                return [metering];
            case "best":
            case "smart":
            case "all":
                return this.applyBestDecoration(metering);
        }
    }

    private timingMode(): string {

        // Reads relevant configuration
        const configuration = workspace.getConfiguration("z80-asm-meter");
        return configuration.get("timings.mode",
            configuration.get("timings.atExit", false) ? "best" : "default");
    }

    private applyBestDecoration(metering: Meterable): Meterable[] {

        if (AtExitDecorator.canDecorate(metering)) {
            return [AtExitDecorator.of(metering)];
        }

        if (FlowDecorator.canDecorate(metering)) {
            return [FlowDecorator.of(metering)];
        }

        return [metering];
    }

    private applySmartDecorations(metering: Meterable): Meterable[] {

        const canDecorateFlow = FlowDecorator.canDecorate(metering);
        const canDecorateAtExit = AtExitDecorator.canDecorate(metering);
        if (canDecorateFlow) {
            return canDecorateAtExit
                ? [FlowDecorator.of(metering), AtExitDecorator.of(metering)]
                : [FlowDecorator.of(metering)];
        } else {
            return canDecorateAtExit
                ? [AtExitDecorator.of(metering)]
                : [metering];
        }
    }

    private applyAllDecorations(metering: Meterable): Meterable[] {

        const decoratedMeterings: Meterable[] = [metering];
        if (FlowDecorator.canDecorate(metering)) {
            decoratedMeterings.push(FlowDecorator.of(metering));
        }
        if (AtExitDecorator.canDecorate(metering)) {
            decoratedMeterings.push(AtExitDecorator.of(metering));
        }
        return decoratedMeterings;
    }

    private buildStatusBarText(meterings: Meterable[]): string {

        // Reads relevant configuration
        const configuration = workspace.getConfiguration("z80-asm-meter");
        const viewInstructionConfiguration = configuration.get("viewInstruction") || false;
        const viewBytesConfiguration = configuration.get("viewBytes") || false;

        // Builds the statur bar text
        const metering = meterings[0];
        let text = "";

        if (viewInstructionConfiguration) {
            const instruction = viewInstructions(metering);
            if (instruction) {
                text += `$(code) ${instruction}`;
            }
        }

        const timings = viewStatusBarTimings(meterings);
        if (timings) {
            text += ` $(watch) ${timings}`;
        }

        const size = viewStatusBarSize(metering);
        if (size !== undefined) {
            text += `$(file-binary) ${size} `;
            if (viewBytesConfiguration) {
                const bytes = viewBytes(metering);
                if (bytes) {
                    text += `(${bytes}) `;
                }
            }
        }

        return text;
    }

    private buildTooltipMarkdown(meterings: Meterable[]): MarkdownString {

        // Builds the tooltip text
        const metering = meterings[0];
        const command = this.buildCommandText(meterings);
        return new MarkdownString()
            .appendMarkdown(viewTooltipTimings(meterings))
            .appendMarkdown("\n---\n\n")
            .appendMarkdown(viewTooptipSize(metering))
            .appendMarkdown("\n---\n\n")
            .appendMarkdown(`Copy "${command}" to clipboard\n`);
    }

    private buildCommandText(meterings: Meterable[]): string | undefined {

        // Reads relevant configuration
        const configuration = workspace.getConfiguration("z80-asm-meter");
        const timingsHintsConfiguration: string = configuration.get("timings.hints", "none");
        const isTimingsHintsEnabled = ["subroutines", "any"].indexOf(timingsHintsConfiguration) !== -1;

        // (prefers most specific algorithm)
        const metering = meterings[meterings.length - 1];

        // Builds the command text
        if (isTimingsHintsEnabled) {
            return viewTimingsToCopyAsHints(metering);
        }

        const timing = viewTimingsToCopy(metering);
        const size = viewStatusBarSize(metering);

        return timing
            ? (size
                ? `${timing}, ${size}`
                : `${timing}`)
            : (size
                ? `${size}`
                : undefined);
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
