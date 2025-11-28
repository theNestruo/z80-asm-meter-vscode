// VS Code extensibility API
// Import the `vscode` module and reference it as `vscode` below.
import * as vscode from 'vscode';

import { mainParser, mainParserWithoutMacro, mainParserWithoutTimingHints } from './parser/MainParser';
import { macroParser } from './parser/impl/MacroParser';
import { regExpTimingHintsParser } from './parser/timingHints/RegExpTimingHintsParser';
import { CopyFromActiveTextEditorSelecionToClipboardCommand } from './vscode/Commands';
import { CachedConfigurationReaderDecorator } from './vscode/ConfigurationReader';
import { InlayHintsProvider } from './vscode/InlayHintsProvider';
import { CachedStatusBarHandler, DebouncedStatusBarHandler } from "./vscode/StatusBarHandlers";


/**
 * Activate the extension.
 * This method is called when your extension is activated.
 * Your extension is activated the very first time the command is executed.
 */
export function activate(context: vscode.ExtensionContext) {

	CachedConfigurationReaderDecorator.activate(context);

	// VS Code integrations
	const command = new CopyFromActiveTextEditorSelecionToClipboardCommand(context);
	const statusBarHandler = new DebouncedStatusBarHandler(context, new CachedStatusBarHandler(context, command));
	new InlayHintsProvider(context);

	// Registers disposables so they are disposed automatically
	// when the extension is deactivated
	context.subscriptions.push(
		mainParser,
		mainParserWithoutMacro,
		mainParserWithoutTimingHints,
		macroParser,
		regExpTimingHintsParser
	);

	// Triggers an update of the status bar immediately after activation
	statusBarHandler.forceUpdateRequest();
}

/**
 * Deactivate the extension.
 * This method is called when your extension is deactivated.
 */
export function deactivate() {}
