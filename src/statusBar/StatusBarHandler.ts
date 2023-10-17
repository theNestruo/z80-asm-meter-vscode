import * as vscode from 'vscode';
import { config } from "../config";
import { mainParser } from "../parser/MainParser";
import { atExitTotalTiming } from '../totalTiming/AtExitTotalTiming';
import { defaultTotalTiming } from '../totalTiming/DefaultTotalTiming';
import { executionFlowTotalTiming } from '../totalTiming/ExecutionFlowTotalTiming';
import { TotalTimingMeterable } from '../totalTiming/TotalTiming';
import { humanReadableBytes, humanReadableSize } from '../utils/ByteUtils';
import { humanReadableInstructions } from "../utils/InstructionUtils";
import { hashCode } from "../utils/TextUtils";
import { humanReadableTimings } from '../utils/TimingUtils';
import { AbstractHandler } from "./AbstractHandler";
import { CommandHandler } from "./CommandHandler";

export class DebouncedStatusBarHandler {

    private readonly delegate: StatusBarHandler;

    private isLeadingEvent: boolean = true;
    private previousEventTimestamp: number | undefined = undefined;
    private updateStatusBarTimeout: NodeJS.Timeout | undefined;

    constructor(statusBarHandler: StatusBarHandler) {
        this.delegate = statusBarHandler;
    }

    update() {

        // Checks debounce configuration
        const debounce = config.statusBar.debounce;
        if (debounce <= 0) {
            // No debounce: immediate execution
            this.delegate.update();
            return;
        }

        // Cancels any pending execution
        clearTimeout(this.updateStatusBarTimeout);

        // Detect leading events
        const now = new Date().getTime();
        if (!this.isLeadingEvent
            && this.previousEventTimestamp
            && (this.previousEventTimestamp + debounce < now)) {
            this.isLeadingEvent = true;
        }
        this.previousEventTimestamp = now;

        // Leading event?
        if (this.isLeadingEvent) {
            // Immediate execution
            this.delegate.update();
            this.isLeadingEvent = false;
            return;
        }

        // Debounced execution
        this.updateStatusBarTimeout = setTimeout(() => {
            this.delegate.update();
            this.isLeadingEvent = true;
        }, debounce);
    }
}

export class StatusBarHandler extends AbstractHandler {

    private readonly commandHandler: CommandHandler;

    private previousHashCode: number | undefined = undefined;

    private statusBarItem: vscode.StatusBarItem | undefined;

    constructor(commandHandler: CommandHandler) {
        super();

        this.commandHandler = commandHandler;
        this.create();
    }

    dispose() {
        this.destroy();
    }

    onConfigurationChange(e: vscode.ConfigurationChangeEvent) {

        // Reloads caches for "heavy" configurations
        if (e.affectsConfiguration("z80-asm-meter.statusBar.alignment")) {
            this.destroy();
            this.create();
        }
    }

    private create() {

        if (this.statusBarItem) {
            return;
        }

        const alignment = config.statusBar.alignment;
        this.statusBarItem = vscode.window.createStatusBarItem(
            ["leftmost", "left"].indexOf(alignment) !== -1
                ? vscode.StatusBarAlignment.Left
                : vscode.StatusBarAlignment.Right,
            ["leftmost", "right"].indexOf(alignment) !== -1
                ? Number.MAX_SAFE_INTEGER
                : Number.MIN_SAFE_INTEGER);
    }

    private destroy() {

        if (!this.statusBarItem) {
            return;
        }

        this.statusBarItem.dispose();
        this.statusBarItem = undefined;
    }

    update() {

        // Reads the source code
        const sourceCode = this.readFromSelection();
        if (!sourceCode) {
            this.previousHashCode = undefined;
            this.hide();
            return;
        }
        const currentHashCode = hashCode(sourceCode);
        if (currentHashCode === this.previousHashCode) {
            // (no changes)
            return;
        }
        this.previousHashCode = currentHashCode;

        // Parses the source code
        const metering = mainParser.parse(sourceCode);
        if (!metering) {
            this.previousHashCode = undefined;
            this.hide();
            return;
        }

        // Prepares the total timing
        const defaultMetering = defaultTotalTiming.applyTo(metering);
        const flowMetering = executionFlowTotalTiming.applyTo(metering);
        const atExitMetering = atExitTotalTiming.applyTo(metering);

        // Builds the statur bar text
        const text = this.buildText(defaultMetering, flowMetering, atExitMetering);

        // // Builds the tooltip text
        // const tooltip = this.buildTooltipMarkdown(this.decorateForTooltip(metering));

        // Builds the status bar item
        this.create();
        this.statusBarItem!.text = text;
        // this.statusBarItem!.tooltip = tooltip;
        this.statusBarItem!.command = this.commandHandler;
        this.statusBarItem!.show();
    }

    private hide() {

        if (this.statusBarItem) {
            this.statusBarItem.hide();
        }
    }

    private buildText(
        defaultMetering: TotalTimingMeterable,
        flowMetering: TotalTimingMeterable | undefined,
        atExitMetering: TotalTimingMeterable | undefined): string {

        // Builds the statur bar text
        let text = "";

        if (config.statusBar.showInstruction) {
            const instruction = humanReadableInstructions(defaultMetering);
            if (instruction) {
                text += `$(code) ${instruction} `;
            }
        }

        const timing = this.buidTimingsText(defaultMetering, flowMetering, atExitMetering);
        if (timing) {
            text += `$(watch) ${timing}`;
        }

        const size = humanReadableSize(defaultMetering);
        if (size !== undefined) {
            text += ` $(file-binary) ${size}`;
            if (config.statusBar.showBytes) {
                const bytes = humanReadableBytes(defaultMetering);
                if (bytes) {
                    text += ` (${bytes})`;
                }
            }
        }

        return text
            // .replace(/\s+/, " ")
            // .trim()
            ;
    }

    private buidTimingsText(
        defaultMetering: TotalTimingMeterable,
        flowMetering: TotalTimingMeterable | undefined,
        atExitMetering: TotalTimingMeterable | undefined): string | undefined {

        switch (config.statusBar.totalTimings) {
            case true:
            case "combine":
                return humanReadableTimings(
                    [defaultMetering, flowMetering, atExitMetering],
                    config.statusBar.totalTimingsCombined);

            case false:
                return humanReadableTimings([defaultMetering]);

            case "best":
                return humanReadableTimings(
                    [atExitMetering || flowMetering || defaultMetering]);

            case "smart":
            case "combineSmart":
                return humanReadableTimings(
                    [atExitMetering || flowMetering ? undefined : defaultMetering, flowMetering, atExitMetering],
                    config.statusBar.totalTimingsCombined);
        }
    }

    // private buildTooltipMarkdown(meterings: Meterable[]): vscode.MarkdownString {

    //     // Builds the tooltip text
    //     const metering = meterings[0];
    //     const command = this.commandHandler.buildCommandText(meterings);
    //     return new vscode.MarkdownString()
    //         .appendMarkdown(viewTooltipTimings(meterings))
    //         .appendMarkdown("\n---\n\n")
    //         // .appendMarkdown(viewTooptipSize(metering))
    //         // .appendMarkdown("\n---\n\n")
    //         .appendMarkdown(`Copy "${command}" to clipboard\n`);
    // }

    // private function viewTooptipSize(meterable: Meterable): string {

    //     const size = viewStatusBarSize(meterable);
    //     return size
    //             ? `|||\n|:---|:---:|\n|Size|**${size}**|\n`
    //             : "";
    // }

}
