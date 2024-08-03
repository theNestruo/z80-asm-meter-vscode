import * as vscode from 'vscode';
import { config } from "../config";
import { mainParser } from "../parser/MainParser";
import { AtExitTotalTiminsMeterable, atExitTotalTiming } from '../totalTiming/AtExitTotalTiming';
import { defaultTotalTiming } from '../totalTiming/DefaultTotalTiming';
import { executionFlowTotalTiming } from '../totalTiming/ExecutionFlowTotalTiming';
import { TotalTimingMeterable } from '../totalTiming/TotalTiming';
import { humanReadableBytes } from '../utils/ByteUtils';
import { humanReadableInstructions } from "../utils/InstructionUtils";
import { humanReadableSize } from '../utils/SizeUtils';
import { espaceIfNotInfix, hashCode, pluralize } from "../utils/TextUtils";
import { formatTiming, humanReadableTimings } from '../utils/TimingUtils';
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
			["leftmost", "left"].includes(alignment)
				? vscode.StatusBarAlignment.Left
				: vscode.StatusBarAlignment.Right,
			["leftmost", "right"].includes(alignment)
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
		atExitTiming: AtExitTotalTiminsMeterable | undefined): string {

		// Builds the statur bar text
		let text = "";

		if (config.statusBar.showInstruction) {
			const instruction = humanReadableInstructions(defaultTiming);
			if (instruction) {
				const instructionIcon = espaceIfNotInfix(config.statusBar.instructionIcon);
				text += `${instructionIcon}${instruction}`;
			}
		}

		const timing = this.buidTimingsText(defaultTiming, flowTiming, atExitTiming);
		if (timing) {
			const timingsIcon = espaceIfNotInfix(config.statusBar.timingsIcon);
			text += `${timingsIcon}${timing}`;
		}

		const size = defaultTiming.size;
		if (size) {
			const sizeIcon = espaceIfNotInfix(config.statusBar.sizeIcon);
			const formattedSize = humanReadableSize(size);
			const sizeSuffix = pluralize(config.statusBar.sizeSuffix, size);
			text += `${sizeIcon}${formattedSize}${sizeSuffix}`;
			if (config.statusBar.showBytes) {
				const bytes = humanReadableBytes(defaultTiming);
				if (bytes) {
					text += ` (${bytes})`;
				}
			}
		}

		return text.trim().replace(/\s+/, " ");
	}

	private buidTimingsText(
		defaultTiming: TotalTimingMeterable,
		flowTiming: TotalTimingMeterable | undefined,
		atExitTiming: AtExitTotalTiminsMeterable | undefined): string | undefined {

		const [b, c, d] = this.reorder(flowTiming, atExitTiming);

		switch (config.statusBar.totalTimings) {
			case "all":
			case "combineAll":
				return humanReadableTimings(
					[defaultTiming, b, c, d], config.statusBar.totalTimingsCombined);

			case "smart":
			case "combineSmart":
				return flowTiming || atExitTiming
					? humanReadableTimings([b, c, d], config.statusBar.totalTimingsCombined)
					: humanReadableTimings([defaultTiming]);

			case "best":
				return humanReadableTimings([atExitTiming || flowTiming || defaultTiming]);

			case "default":
			default:
				return humanReadableTimings([defaultTiming]);
		}
	}

	private reorder(
		flowTiming: TotalTimingMeterable | undefined,
		atExitTiming: AtExitTotalTiminsMeterable | undefined): (TotalTimingMeterable | undefined)[] {

		// Applies requested order
		const totalTimingsOrder = config.statusBar.totalTimingsOrder;
		const [retTiming, jumpCallTiming] = atExitTiming?.isLastInstructionRet
			? [atExitTiming, undefined]
			: [undefined, atExitTiming];
		return totalTimingsOrder === "retFlowJumpCall" ? [retTiming, flowTiming, jumpCallTiming]
			: totalTimingsOrder === "flowRetJumpCall" ? [flowTiming, retTiming, jumpCallTiming]
			: totalTimingsOrder === "retJumpCallFlow" ? [retTiming, jumpCallTiming, flowTiming]
			: [undefined, undefined, undefined]; // (should never happen)
	}

	private buildTooltip(
		defaultTiming: TotalTimingMeterable,
		flowTiming: TotalTimingMeterable | undefined,
		atExitTiming: AtExitTotalTiminsMeterable | undefined): vscode.MarkdownString {

		const instruction = humanReadableInstructions(defaultTiming);
		const size = defaultTiming.size;
		const bytes = size ? humanReadableBytes(defaultTiming) : undefined;

		const text = new vscode.MarkdownString();

		if (instruction || size) {
			text.appendMarkdown(`|||\n|---|---|\n`);
			if (instruction) {
				text.appendMarkdown(`|Instructions:|**${instruction}**|\n`);
			}
			if (size) {
				if (bytes) {
					text.appendMarkdown(`|Bytes:|**${bytes}**|\n`);
				}
			}
			text.appendMarkdown("\n---\n\n");
		}

		text.appendMarkdown(this.buildTooltipTiming([defaultTiming, ...this.reorder(flowTiming, atExitTiming)]).value);

		if (size) {
			const formattedSize = humanReadableSize(size);
			const platform = config.platform;
			const hasM1 = platform === "msx" || platform === "pc8000";
			text.appendMarkdown(hasM1
				? `|Size:|**${formattedSize}**||bytes|\n`
				: `|Size:|**${formattedSize}**|bytes|\n`);
		}
		text.appendMarkdown("\n");

		const textToCopy = this.commandHandler.buildTextToCopy(defaultTiming, flowTiming, atExitTiming);
		if (textToCopy) {
			text.appendMarkdown(`---\n\nCopy "${textToCopy}" to clipboard\n`);
		}

		return text;
	}

	private buildTooltipTiming(
		totalTimings: (TotalTimingMeterable | undefined)[]): vscode.MarkdownString {

		const platform = config.platform;
		const hasM1 = platform === "msx" || platform === "pc8000";
		const timingSuffix = platform === "cpc" ? "NOPs" : "clock cycles";

		const table = new vscode.MarkdownString(
			platform === "msx" ? "||MSX|Z80||\n|--:|--:|--:|---|\n"
				: platform === "pc8000" ? "||Z80|Z80+M1||\n|--:|--:|--:|---|\n"
					: "||||\n|--:|--:|---|\n"
		);

		for (const totalTiming of totalTimings) {
			if (!totalTiming) {
				continue;
			}

			const value = formatTiming(totalTiming.z80Timing);
			const m1Value = formatTiming(totalTiming.msxTiming);
			if (!value && (!hasM1 || !m1Value)) {
				continue;
			}

			switch (platform) {
				case 'msx':
					table.appendMarkdown(`|${totalTiming.name}:|**${m1Value}**|${value}|${timingSuffix}|\n`);
					break;
				case 'pc8000':
					table.appendMarkdown(`|${totalTiming.name}:|**${value}**|${m1Value}|${timingSuffix}|\n`);
					break;
				default:
					table.appendMarkdown(`|${totalTiming.name}:|**${value}**|${timingSuffix}|\n`);
					break;
			}
		};

		return table;
	}
}
