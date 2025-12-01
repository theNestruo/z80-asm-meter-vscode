// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { mainParser, mainParserWithoutMacro, mainParserWithoutTimingHints } from './parser/MainParser';
import { macroParser } from './parser/impl/MacroParser';
import { regExpTimingHintsParser } from './parser/timingHints/RegExpTimingHintsParser';
import { CopyFromActiveTextEditorSelecionToClipboardCommand } from './vscode/Commands';
import { InlayHintsProvider } from './vscode/InlayHintsProvider';
import { CachedStatusBarHandler, DebouncedStatusBarHandler } from "./vscode/StatusBarHandlers";
import { configurationReader } from './vscode/ConfigurationReader';


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	configurationReader.activate(context);

	const copyFromActiveTextEditorSelecionCommand =
			new CopyFromActiveTextEditorSelecionToClipboardCommand();

	const internalStatusBarHandler =
			new CachedStatusBarHandler(copyFromActiveTextEditorSelecionCommand);
	const statusBarHandler =
			new DebouncedStatusBarHandler(internalStatusBarHandler);

	const inlayHintsProvider = new InlayHintsProvider();

	context.subscriptions.push(
		copyFromActiveTextEditorSelecionCommand,
		internalStatusBarHandler,
		statusBarHandler,
		inlayHintsProvider,

		// subscribe to configuration change event
		configurationReader,
		mainParser,
		mainParserWithoutMacro,
		mainParserWithoutTimingHints,
		macroParser,
		regExpTimingHintsParser
	);

	// First execution
	internalStatusBarHandler.onUpdateRequest();
}

// this method is called when your extension is deactivated
export function deactivate() {
}
