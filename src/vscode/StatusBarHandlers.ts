import HLRU from 'hashlru';
import * as vscode from 'vscode';
import { config } from "../config";
import { mainParser } from "../parser/MainParser";
import { TotalTimings } from '../totalTiming/TotalTimings';
import { hrMarkdown, printStatusBarText, printTooltipMarkdown } from '../utils/FormatterUtils';
import { hashCode } from "../utils/TextUtils";
import { preprocessLinesAsSourceCode, readLinesFromActiveTextEditorSelection } from './SourceCodeReader';
import { AbstractCopyToClipboardCommand } from './Commands';

class StatusBarItemContents {
	constructor(
			readonly text: string,
			/** The optional line repetition count */
			readonly tooltip: vscode.MarkdownString) {
		//
    }
}

abstract class StatusBarHandler {

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
        this.disposable.dispose();
		this.destroy();
	}

	onConfigurationChange(e: vscode.ConfigurationChangeEvent) {

		// Recreates StatusBarItem on alignment change
		if (e.affectsConfiguration("z80-asm-meter.statusBar.alignment")) {
			this.destroy();
			this.create();
		}
	}

	onUpdateRequest() {

        // const startTime = new Date().getTime();

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

        // const endTime = new Date().getTime();
        // console.log(`${lines.length} lines metered in ${endTime - startTime} ms`);
	}

	protected parseAndBuildStatusBarItemContents(lines: string[]): StatusBarItemContents | undefined {

		// (sanity check)
		if (!lines.length) {
			return undefined;
		}

		// Parses the source code
		const metered = mainParser.parse(preprocessLinesAsSourceCode(lines));
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

		const text = printTooltipMarkdown(totalTimings);

		const commandDescription = this.command.buildDescription(totalTimings);
		if (commandDescription) {
			text.appendMarkdown(hrMarkdown)
				.appendMarkdown(commandDescription);
		}

		return text;
	}
}

export class CachedStatusBarHandler extends StatusBarHandler {

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
			return cachedContents;
		}

		// Parses the source code and builds the status bar item contents
		const contents = super.parseAndBuildStatusBarItemContents(lines);

		// Caches the status bar item contents
		this.cache.set(currentHashCode, contents);

		return contents;
	}
}

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
			// Immediate execution
			this.delegate.onUpdateRequest();
			this.isLeadingEvent = false;
			return;
		}

		// Debounced execution
		this.updateStatusBarTimeout = setTimeout(() => {
			this.delegate.onUpdateRequest();
			this.isLeadingEvent = true;
		}, debounce);
	}
}
