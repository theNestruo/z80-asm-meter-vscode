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

	// Activates singletons
	configurationReader.activate(context);

	// Instantiates VS Code integrations
	const command = new CopyFromActiveTextEditorSelecionToClipboardCommand(context);
	const internalStatusBarHandler = new CachedStatusBarHandler(context, command);
	new DebouncedStatusBarHandler(context, internalStatusBarHandler);
	new InlayHintsProvider(context);

	context.subscriptions.push(

		// subscribe to configuration change event
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
