import * as vscode from 'vscode';
import { config } from "../config";
import { mainParser } from "../parser/MainParser";
import { atExitTotalTiming } from '../totalTiming/AtExitTotalTiming';
import { defaultTotalTiming } from '../totalTiming/DefaultTotalTiming';
import { executionFlowTotalTiming } from '../totalTiming/ExecutionFlowTotalTiming';
import { TotalTimingMeterable } from '../totalTiming/TotalTiming';
import { humanReadableBytes } from '../utils/ByteUtils';
import { humanReadableInstructions } from "../utils/InstructionUtils";
import { hashCode } from "../utils/TextUtils";
import { humanReadableTiming, humanReadableTimings } from '../utils/TimingUtils';
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
        const metered = mainParser.parse(sourceCode);
        if (!metered) {
            this.previousHashCode = undefined;
            this.hide();
            return;
        }

        // Prepares the total timings
        const defaultTiming = defaultTotalTiming.applyTo(metered);
        const flowTiming = executionFlowTotalTiming.applyTo(metered);
        const atExitTiming = atExitTotalTiming.applyTo(metered);

        // Builds the status bar item
        this.create();
        this.statusBarItem!.text = this.buildText(defaultTiming, flowTiming, atExitTiming);
        this.statusBarItem!.tooltip = this.buildTooltip(defaultTiming, flowTiming, atExitTiming);
        this.statusBarItem!.command = this.commandHandler;
        this.statusBarItem!.show();
    }

    private hide() {

        if (this.statusBarItem) {
            this.statusBarItem.hide();
        }
    }

    private buildText(
        defaultTiming: TotalTimingMeterable,
        flowTiming: TotalTimingMeterable | undefined,
        atExitTiming: TotalTimingMeterable | undefined): string {

        // Builds the statur bar text
        let text = "";

        if (config.statusBar.showInstruction) {
            const instructionIcon = config.statusBar.instructionIcon;
            const instruction = humanReadableInstructions(defaultTiming);
            if (instruction) {
                text += `${instructionIcon} ${instruction} `;
            }
        }

        const timing = this.buidTimingsText(defaultTiming, flowTiming, atExitTiming);
        if (timing) {
            const timingsIcon = config.statusBar.timingsIcon;
            text += `${timingsIcon} ${timing}`;
        }

        const size = defaultTiming.size;
        if (size) {
            const sizeIcon = config.statusBar.sizeIcon;
            const sizeSuffix = (config.statusBar.compactSize) ? "B"
                : (size === 1) ? " byte"
                    : " bytes";
            text += ` ${sizeIcon} ${size}${sizeSuffix}`;
            if (config.statusBar.showBytes) {
                const bytes = humanReadableBytes(defaultTiming);
                if (bytes) {
                    text += ` (${bytes})`;
                }
            }
        }

        return text;
    }

    private buidTimingsText(
        defaultTiming: TotalTimingMeterable,
        flowTiming: TotalTimingMeterable | undefined,
        atExitTiming: TotalTimingMeterable | undefined): string | undefined {

        switch (config.statusBar.totalTimings) {
            case "all":
            case "combineAll":
                return humanReadableTimings(
                    [defaultTiming, flowTiming, atExitTiming],
                    config.statusBar.totalTimingsCombined);

            case "smart":
            case "combineSmart":
                return humanReadableTimings(
                    [atExitTiming || flowTiming ? undefined : defaultTiming, flowTiming, atExitTiming],
                    config.statusBar.totalTimingsCombined);

            case "best":
                return humanReadableTimings(
                    [atExitTiming || flowTiming || defaultTiming]);

            case "default":
            default:
                return humanReadableTimings([defaultTiming]);
        }
    }

    private buildTooltip(
        defaultTiming: TotalTimingMeterable,
        flowTiming: TotalTimingMeterable | undefined,
        atExitTiming: TotalTimingMeterable | undefined): vscode.MarkdownString {

        const text = new vscode.MarkdownString("|&nbsp;|&nbsp;|&nbsp;|\n|:---|---:|:---|\n");

        const instruction = humanReadableInstructions(defaultTiming);
        if (instruction) {
            text.appendMarkdown(`|**Instructions**||${instruction}|\n`);
        }

        const timingSuffix = config.platform === "cpc" ? "NOPs" : "clock cycles";
        [defaultTiming, flowTiming, atExitTiming].forEach(totalTiming => {
            if (!totalTiming) {
                return;
            }
            const value = humanReadableTiming(totalTiming);
            if (!value) {
                return;
            }
            text.appendMarkdown(`|**${totalTiming.name}**|${value}|${timingSuffix}|\n`);
        });

        const size = defaultTiming.size;
        if (size) {
            text.appendMarkdown(`|**Size**|${size}|bytes\n`);
            const bytes = humanReadableBytes(defaultTiming);
            if (bytes) {
                text.appendMarkdown(`|**Bytes**||${bytes}|\n`);
            }
        }

        const textToCopy = this.commandHandler.buildTextToCopy(defaultTiming, flowTiming, atExitTiming);
        if (textToCopy) {
            text.appendMarkdown("\n---\n\n")
                .appendMarkdown(`Copy "${textToCopy}" to clipboard\n`);
        }

        return text;
    }
}
