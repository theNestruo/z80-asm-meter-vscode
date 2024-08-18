import HLRU from 'hashlru';
import * as vscode from 'vscode';
import { config } from "../config";
import { TotalTimingMeterable } from '../model/TotalTimingMeterable';
import { mainParser } from "../parser/MainParser";
import { TotalTimings } from '../totalTiming/TotalTimings';
import { humanReadableBytes } from '../utils/ByteUtils';
import { readFromSelection } from '../utils/EditorUtils';
import { humanReadableInstructions } from "../utils/InstructionUtils";
import { humanReadableSize } from '../utils/SizeUtils';
import { espaceIfNotInfix, hashCode, pluralize } from "../utils/TextUtils";
import { formatTiming, humanReadableTimings } from '../utils/TimingUtils';
import { CopyToClipboardCommandHandler } from "./CommandHandler";

class StatusBarItemContents {

    readonly text: string;

    /** The optional line repetition count */
    readonly tooltip: vscode.MarkdownString;

    constructor(text: string, tooltip: vscode.MarkdownString) {
        this.text = text;
        this.tooltip = tooltip;
    }
}

abstract class StatusBarHandler {

	protected readonly commandHandler: CopyToClipboardCommandHandler;

	private statusBarItem: vscode.StatusBarItem | undefined;

	protected constructor(commandHandler: CopyToClipboardCommandHandler) {
		this.commandHandler = commandHandler;
		this.create();
	}

	dispose() {
		this.destroy();
	}

	onConfigurationChange(e: vscode.ConfigurationChangeEvent) {

		// Recreates StatusBarItem on alignment change
		if (e.affectsConfiguration("z80-asm-meter.statusBar.alignment")) {
			this.destroy();
			this.create();
		}
	}

	update() {

		// Reads the source code
		const sourceCode = readFromSelection();

		// Parses the source code and builds the status bar item contents
		const contents = this.parseAndBuildStatusBarItemContents(sourceCode);

		// Shows or hides the actual status bar item
		if (contents) {
			this.show(contents);
		} else {
			this.hide();
		}
	}

	protected parseAndBuildStatusBarItemContents(sourceCode: string | undefined): StatusBarItemContents | undefined {

		// (sanity check)
		if (!sourceCode) {
			return undefined;
		}

		// Parses the source code
		const metered = mainParser.parse(sourceCode);
		if (!metered) {
			return undefined;
		}

		// Prepares the total timings
		const totalTimings = new TotalTimings(metered);

		// Builds the status bar item contents
		return new StatusBarItemContents(
				this.buildText(totalTimings),
				this.buildTooltip(totalTimings));
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

		this.statusBarItem?.dispose();
		this.statusBarItem = undefined;
	}

	private show(contents: StatusBarItemContents) {
		this.create();
		this.statusBarItem!.text = contents.text;
		this.statusBarItem!.tooltip = contents.tooltip;
		this.statusBarItem!.command = this.commandHandler;
		this.statusBarItem!.show();
	}

	private hide() {

		this.statusBarItem?.hide();
	}

	private buildText(totalTimings: TotalTimings): string {

		// Builds the statur bar text
		let text = "";

		if (config.statusBar.showInstruction) {
			const instruction = humanReadableInstructions(totalTimings.defaultTiming);
			if (instruction) {
				const instructionIcon = espaceIfNotInfix(config.statusBar.instructionIcon);
				text += `${instructionIcon}${instruction}`;
			}
		}

		const timing = this.buidTimingsText(totalTimings);
		if (timing) {
			const timingsIcon = espaceIfNotInfix(config.statusBar.timingsIcon);
			text += `${timingsIcon}${timing}`;
		}

		const size = totalTimings.defaultTiming.size;
		if (size) {
			const sizeIcon = espaceIfNotInfix(config.statusBar.sizeIcon);
			const formattedSize = humanReadableSize(size);
			const sizeSuffix = pluralize(config.statusBar.sizeSuffix, size);
			text += `${sizeIcon}${formattedSize}${sizeSuffix}`;
			if (config.statusBar.showBytes) {
				const bytes = humanReadableBytes(totalTimings.defaultTiming);
				if (bytes) {
					text += ` (${bytes})`;
				}
			}
		}

		return text.trim().replace(/\s+/, " ");
	}

	private buidTimingsText(totalTimings: TotalTimings): string | undefined {

		switch (config.statusBar.totalTimings) {
			case "all":
			case "combineAll":
				return humanReadableTimings(totalTimings.ordered(), config.statusBar.totalTimingsCombined);

			case "smart":
			case "combineSmart": {
				const [a, b, c, d] = totalTimings.ordered();
				return totalTimings.flowTiming || totalTimings.atExitTiming
					? humanReadableTimings([b, c, d], config.statusBar.totalTimingsCombined)
					: humanReadableTimings([a]);
			}

			case "best":
				return humanReadableTimings([totalTimings.best()]);

			case "default":
			default:
				return humanReadableTimings([totalTimings.defaultTiming]);
		}
	}

	private buildTooltip(totalTimings: TotalTimings): vscode.MarkdownString {

		const instruction = humanReadableInstructions(totalTimings.defaultTiming);
		const size = totalTimings.defaultTiming.size;
		const bytes = size ? humanReadableBytes(totalTimings.defaultTiming) : undefined;

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

		text.appendMarkdown(this.buildTooltipTiming(totalTimings.ordered()).value);

		if (size) {
			const formattedSize = humanReadableSize(size);
			const platform = config.platform;
			const hasM1 = platform === "msx" || platform === "pc8000";
			text.appendMarkdown(hasM1
				? `|Size:|**${formattedSize}**||bytes|\n`
				: `|Size:|**${formattedSize}**|bytes|\n`);
		}
		text.appendMarkdown("\n");

		const textToCopy = this.commandHandler.buildTextToCopy(totalTimings);
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
		}

		return table;
	}
}

export class CachedStatusBarHandler extends StatusBarHandler {

	private cache;

	constructor(commandHandler: CopyToClipboardCommandHandler) {
		super(commandHandler);

		this.cache = HLRU(config.statusBar.cacheSize);
	}

	onConfigurationChange(e: vscode.ConfigurationChangeEvent) {
		super.onConfigurationChange(e);

		this.cache = HLRU(config.statusBar.cacheSize);
	}

	protected override parseAndBuildStatusBarItemContents(
		sourceCode: string | undefined): StatusBarItemContents | undefined {

		// (sanity check)
		if (!sourceCode) {
			return undefined;
		}

		// Checks cache
		const currentHashCode = hashCode(sourceCode);
		const cachedContents = this.cache.get(currentHashCode);
		if (cachedContents) {
			return cachedContents;
		}

		// Parses the source code and builds the status bar item contents
		const contents = super.parseAndBuildStatusBarItemContents(sourceCode);

		// Caches the status bar item contents
		this.cache.set(currentHashCode, contents);

		return contents;
	}
}

export class DebouncedStatusBarHandler {

	private readonly delegate: StatusBarHandler;

	private isLeadingEvent: boolean = true;
	private previousEventTimestamp: number | undefined = undefined;
	private updateStatusBarTimeout: NodeJS.Timeout | undefined;

	constructor(statusBarHandler: StatusBarHandler) {
		this.delegate = statusBarHandler;
	}

	dispose() {
		this.delegate.dispose();
	}

	onConfigurationChange(e: vscode.ConfigurationChangeEvent) {
		this.delegate.onConfigurationChange(e);
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

	forceUpdate() {
		this.delegate.update();
	}
}
