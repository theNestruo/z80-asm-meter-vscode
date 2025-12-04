import HLRU from 'hashlru';
import * as vscode from 'vscode';
import { config } from "../config";
import { mainParser } from '../parsers/parsers';
import { TotalTimings } from '../totalTimings/TotalTimings';
import { TotalTiming } from '../totalTimings/types/TotalTiming';
import { Meterable } from '../types/Meterable';
import { hrMarkdown } from '../utils/TextUtils';
import { printBytes } from '../utils/BytesUtils';
import { printSize } from '../utils/SizeUtils';
import { printInstructions } from '../utils/InstructionsUtils';
import { printTiming } from '../utils/TimingUtils';
import { printableTimingSuffix } from '../utils/TimingUtils';
import { formatTiming } from '../utils/TimingUtils';
import { linesToSourceCode } from '../utils/SourceCodeUtils';
import { hashCode, pluralize, spaceIfNotInfix, validateCodicon } from "../utils/TextUtils";
import { CopyToClipboardCommand } from './CopyToClipboardCommands';
import { readLinesFromActiveTextEditorSelection } from './SourceCodeReader';

/**
 * A container for the data to be displayed in the StatusBarItem
 */
class StatusBarItemContents {
	constructor(
			readonly text: string,
			/** The optional line repetition count */
			readonly tooltip: vscode.MarkdownString) {
    }
}

/**
 * Base implementation of the StatusBarItem handler
 */
class StatusBarHandler implements vscode.Disposable {

	private readonly _disposable: vscode.Disposable;

	private statusBarItem?: vscode.StatusBarItem;

	protected constructor(
		protected readonly command: CopyToClipboardCommand) {

		this._disposable =
			// Subscribe to configuration change event
			vscode.workspace.onDidChangeConfiguration(this.onConfigurationChange, this);

		this.create();
	}

	onUpdateRequest() {

		// Reads the source code
		const lines = readLinesFromActiveTextEditorSelection();

		// Parses the source code and builds the status bar item contents
		const contents = this.parseAndBuildStatusBarItemContents(lines);

		// Shows or hides the actual status bar item
		if (contents) {
			this.show(contents);
		} else {
			this.hide();
		}
	}

	protected parseAndBuildStatusBarItemContents(lines: string[]): StatusBarItemContents | undefined {

		// (sanity check)
		if (!lines.length) {
			return undefined;
		}

		// Parses the source code
		const metered = mainParser
		.instance.parse(linesToSourceCode(lines));
		if (!metered) {
			return undefined;
		}

		// Prepares the total timings
		const totalTimings = new TotalTimings(metered);

		// Builds the status bar item contents
		return new StatusBarItemContents(
				printStatusBarText(totalTimings),
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

	private show(contents: StatusBarItemContents) {
		this.create();
		this.statusBarItem!.text = contents.text;
		this.statusBarItem!.tooltip = contents.tooltip;
		this.statusBarItem!.command = this.command;
		this.statusBarItem!.show();
	}

	private hide() {
		this.statusBarItem?.hide();
	}

	private buildTooltip(totalTimings: TotalTimings): vscode.MarkdownString {

		const markdown = [
			...printMarkdownTotalTimingsAndSize(totalTimings),
			hrMarkdown,
			...printMarkdownInstructionsAndBytes(totalTimings)
		];

		const commandDescription = this.command.buildDescription(totalTimings);
		if (commandDescription) {
			markdown.push(hrMarkdown);
			markdown.push(commandDescription);
		}

		return new vscode.MarkdownString(markdown.join("\n"), true);
	}

	onConfigurationChange(e: vscode.ConfigurationChangeEvent) {

		// Recreates StatusBarItem on alignment change
		if (e.affectsConfiguration("z80-asm-meter.statusBar.alignment")) {
			this.destroy();
			this.create();
		}
	}

	dispose() {
		this._disposable.dispose();
		this.destroy();
	}

	private destroy() {
		this.statusBarItem?.dispose();
		this.statusBarItem = undefined;
	}
}

/**
 * Implementation of the StatusBarItem handler
 * that uses a LRU cache for previously metered selections
 */
export class CachedStatusBarHandler extends StatusBarHandler {

	// (for caching purposes)
	private readonly empty = new StatusBarItemContents("", new vscode.MarkdownString());

	private cache;

	constructor(
		command: CopyToClipboardCommand) {

		super(command);

		this.cache = HLRU(config.statusBar.cacheSize);
	}

	protected override parseAndBuildStatusBarItemContents(lines: string[]): StatusBarItemContents | undefined {

		// (sanity check)
		if (!lines.length) {
			return undefined;
		}

		// Checks cache
		const currentHashCode = hashCode(lines.join("\n"));
		const cachedContents = this.cache.get(currentHashCode);
		if (cachedContents) {
			return cachedContents !== this.empty ? cachedContents : undefined;
		}

		// Parses the source code and builds the status bar item contents
		const contents = super.parseAndBuildStatusBarItemContents(lines);

		// Caches the status bar item contents
		this.cache.set(currentHashCode, contents ?? this.empty);

		return contents;
	}

	override onConfigurationChange(e: vscode.ConfigurationChangeEvent) {
		super.onConfigurationChange(e);

        // Re-initializes cache
		this.cache = HLRU(config.statusBar.cacheSize);
	}

	override dispose(): void {
        this.cache.clear();
		super.dispose();
	}
}

/**
 * Decorator for any implementation of StatusBarItem handler
 * that prevents the metering to be triggered too frequently (debouncing)
 */
export class DebouncedStatusBarHandler implements vscode.Disposable {

	private readonly _disposable: vscode.Disposable;

	private isLeadingEvent: boolean = true;
	private previousEventTimestamp?: number = undefined;
	private updateStatusBarTimeout?: NodeJS.Timeout;

	constructor(
		private readonly delegate: StatusBarHandler) {

		this._disposable = vscode.Disposable.from(
			// Subscribe to selection change and editor activation events
			vscode.window.onDidChangeTextEditorSelection(this.onUpdateRequest, this),
			vscode.window.onDidChangeActiveTextEditor(this.onUpdateRequest, this),
			vscode.workspace.onDidChangeTextDocument(this.onUpdateRequest, this),
		);
	}

	onUpdateRequest() {

		// Checks debounce configuration
		const debounce = config.statusBar.debounce;
		if (debounce <= 0) {
			// No debounce: immediate execution
			this.delegate.onUpdateRequest();
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
			// (next event will not be a leading event)
			this.isLeadingEvent = false;
			// Immediate execution
			this.delegate.onUpdateRequest();
			return;
		}

		// Debounced execution
		this.updateStatusBarTimeout = setTimeout(() => {
			this.delegate.onUpdateRequest();
		}, debounce);
	}

	dispose() {
		clearTimeout(this.updateStatusBarTimeout);
		this._disposable.dispose();
	}
}

function printStatusBarText(totalTimings: TotalTimings): string {

	// Builds the statur bar text
	let text = "";

	if (config.statusBar.showInstruction) {
		text += printStatusBarInstructions(totalTimings.defaultTotalTiming);
	}

	const timing = printStatusBarTotalTimings(totalTimings);
	if (timing) {
		const timingsIcon = spaceIfNotInfix(config.statusBar.timingsIcon);
		text += `${timingsIcon}${timing}`;
	}

	const size = totalTimings.defaultTotalTiming.size;
	if (size) {
		text += printStatusBarSize(size);
		if (config.statusBar.showBytes) {
			const bytes = printBytes(totalTimings.defaultTotalTiming);
			if (bytes) {
				text += ` (${bytes})`;
			}
		}
	}

	return text.trim().replace(/\s+/, " ");
}

function printStatusBarInstructions(meterable: Meterable): string {

	const instruction = printInstructions(meterable);
	if (!instruction) {
		return "";
	}

	const instructionIcon = spaceIfNotInfix(config.statusBar.instructionIcon);
	return `${instructionIcon}${instruction}`;
}

function printStatusBarTotalTimings(totalTimings: TotalTimings): string {

	switch (config.statusBar.totalTimings) {
		case "all":
		case "combineAll":
			return printStatusBarTotalTimingsArray(totalTimings.ordered());

		case "smart":
		case "combineSmart": {
			const [a, b, c, d] = totalTimings.ordered();
			return (totalTimings.executionFlowTotalTiming || totalTimings.atExitTotalTiming)
				? printStatusBarTotalTimingsArray([b, c, d])
				: printStatusBarTotalTimingsArray([a]);
		}

		case "best":
			return printStatusBarTotalTimingsArray([totalTimings.best()]);

		case "default":
		default:
			return printStatusBarTotalTimingsArray([totalTimings.defaultTotalTiming]);
	}
}

function printStatusBarTotalTimingsArray(totalTimings: (TotalTiming | undefined)[]): string {

	let text = "";

	let previousIcon = "";
	let previousValue = "";
	totalTimings.forEach(totalTiming => {
		if (!totalTiming) {
			return;
		}
		const icon = totalTiming.statusBarIcon;
		const value = printTiming(totalTiming) ?? "0";

		// Combines when the previous timing when they have the same values
		if (!config.statusBar.totalTimingsCombined) {
			text += `${icon}${value} `;

		} else {
			// Same as previous timing?
			if (value === previousValue) {
				// Combines the decoration
				previousIcon += icon;

			} else {
				// Preserves the previous timing entry
				if (previousIcon || previousValue) {
					text += `${previousIcon}${previousValue} `;
				}
				// Aggregates a new timing entry
				previousIcon = icon;
				previousValue = value;
			}
		}
	});
	if (config.statusBar.totalTimingsCombined) {
		text += `${previousIcon}${previousValue} `;
	}
	return text.trim();
}

function printStatusBarSize(n: number): string {

	const sizeIcon = spaceIfNotInfix(config.statusBar.sizeIcon);
	const formattedSize = printSize(n);
	const sizeSuffix = pluralize(config.statusBar.sizeSuffix, n);
	return `${sizeIcon}${formattedSize}${sizeSuffix}`;
}

function printMarkdownTotalTimingsAndSize(totalTimings: TotalTimings): string[] {

	const table = printMarkdownTotalTimings(totalTimings);

	const size = totalTimings.defaultTotalTiming.size;
	if (size) {
		const sizeIcon = validateCodicon(config.statusBar.sizeIcon, "$(file-binary)");
		const formattedSize = printSize(size);
		const sizeSuffix = pluralize(" byte| bytes", size);
		const platform = config.platform;
		const hasBothZ80M1 = platform === "pc8000";
		table.push(hasBothZ80M1
			? `|${sizeIcon}|Size|**${formattedSize}**||${sizeSuffix}|`
			: `|${sizeIcon}|Size|**${formattedSize}**|${sizeSuffix}|`);
	}

	return table;
}

function printMarkdownTotalTimings(totalTimings: TotalTimings): string[] {

	const platform = config.platform;
	const hasM1 = platform === "msx" || platform === "msxz80" || platform === "pc8000";
	const timingSuffix = printableTimingSuffix();

	const table = platform === "msx" ? [
		"|   |   |MSX|   |",
		"|:-:|---|--:|---|"
	]
		: platform === "msxz80" ? [
			"|   |   |       |   |   |",
			"|:-:|---|------:|--:|---|",
			"|   |   |**MSX**|Z80|   |"
		]
			: platform === "pc8000" ? [
				"|   |   |       |      |   |",
				"|:-:|---|------:|-----:|---|",
				"|   |   |**Z80**|Z80+M1|   |"
			]
				: [
					"|   |   |Z80|   |",
					"|:-:|---|--:|---|"
				];

	totalTimings.ordered().forEach(totalTiming => {
		if (!totalTiming) {
			return;
		}

		const timingIcon = totalTiming.statusBarIcon || validateCodicon(config.statusBar.timingsIcon, "$(clock)");
		const value = formatTiming(totalTiming.z80Timing);
		const m1Value = formatTiming(totalTiming.msxTiming);
		if (!value && (!hasM1 || !m1Value)) {
			return;
		}

		switch (platform) {
			case "msx":
				table.push(`|${timingIcon}|${totalTiming.name}|**${m1Value}**|${timingSuffix}|`);
				break;
			case "msxz80":
				table.push(`|${timingIcon}|${totalTiming.name}|**${m1Value}**|${value}|${timingSuffix}|`);
				break;
			case "pc8000":
				table.push(`|${timingIcon}|${totalTiming.name}|**${value}**|${m1Value}|${timingSuffix}|`);
				break;
			default:
				table.push(`|${timingIcon}|${totalTiming.name}|**${value}**|${timingSuffix}|`);
				break;
		}
	});

	return table;
}

function printMarkdownInstructionsAndBytes(totalTimings: TotalTimings): string[] {

	const table = [];

	// Instruction and/or bytes
	const totalTiming = totalTimings.defaultTotalTiming;
	const instruction = printInstructions(totalTiming);
	const bytes = printBytes(totalTiming);
	if (instruction || bytes) {
		table.push("||||");
		table.push("|:-:|---|---|");
		if (instruction) {
			const instructionIcon = validateCodicon(config.statusBar.instructionIcon, "$(code)");
			table.push(`|${instructionIcon}|Instructions|**${instruction}**|`);
		}
		if (bytes) {
			table.push(`||Bytes|**${bytes}**|`);
		}
	}

	return table;
}
