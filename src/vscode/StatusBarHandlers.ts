import HLRU from 'hashlru';
import * as vscode from 'vscode';
import { config } from "../config";
import { mainParser } from "../parser/MainParser";
import { TotalTimings } from '../totalTiming/TotalTimings';
import { hrMarkdown, printMarkdownInstructionsAndBytes, printMarkdownTotalTimingsAndSize, printStatusBarText } from '../utils/FormatterUtils';
import { linesToSourceCode } from '../utils/SourceCodeUtils';
import { hashCode } from "../utils/TextUtils";
import { AbstractCopyToClipboardCommand } from './Commands';
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
class StatusBarHandler {

	protected readonly command: AbstractCopyToClipboardCommand;

    private readonly disposable: vscode.Disposable;

	private statusBarItem?: vscode.StatusBarItem;

	protected constructor(copyToClipboardCommand: AbstractCopyToClipboardCommand) {
		this.command = copyToClipboardCommand;

		// Subscribe to configuration change event
		this.disposable = vscode.workspace.onDidChangeConfiguration(this.onConfigurationChange, this);

		this.create();
	}

	dispose() {
		this.destroy();
        this.disposable.dispose();
	}

	onConfigurationChange(e: vscode.ConfigurationChangeEvent) {

		// Recreates StatusBarItem on alignment change
		if (e.affectsConfiguration("z80-asm-meter.statusBar.alignment")) {
			this.destroy();
			this.create();
		}
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
		const metered = mainParser.parse(linesToSourceCode(lines));
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

	private destroy() {

		this.statusBarItem?.dispose();
		this.statusBarItem = undefined;
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
}

/**
 * Implementation of the StatusBarItem handler
 * that uses a LRU cache for previously metered selections
 */
export class CachedStatusBarHandler extends StatusBarHandler {

	// (for caching purposes)
	private readonly empty = new StatusBarItemContents("", new vscode.MarkdownString());

	private cache;

	constructor(command: AbstractCopyToClipboardCommand) {
		super(command);

		this.cache = HLRU(config.statusBar.cacheSize);
	}

	override onConfigurationChange(e: vscode.ConfigurationChangeEvent) {
		super.onConfigurationChange(e);

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
}

/**
 * Decorator for any implementation of StatusBarItem handler
 * that prevents the metering to be triggered too frequently (debouncing)
 */
export class DebouncedStatusBarHandler {

	private readonly delegate: StatusBarHandler;

    private readonly disposable: vscode.Disposable;

	private isLeadingEvent: boolean = true;
	private previousEventTimestamp?: number = undefined;
	private updateStatusBarTimeout?: NodeJS.Timeout;

	constructor(delegate: StatusBarHandler) {
		this.delegate = delegate;

		this.disposable = vscode.Disposable.from(
			// Subscribe to selection change and editor activation events
			vscode.window.onDidChangeTextEditorSelection(this.onUpdateRequest, this),
			vscode.window.onDidChangeActiveTextEditor(this.onUpdateRequest, this),
			vscode.workspace.onDidChangeTextDocument(this.onUpdateRequest, this),
		);
	}

	dispose() {
        this.disposable.dispose();
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
}
