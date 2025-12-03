// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { FromActiveTextEditorSelecionCopyToClipboardCommand } from './vscode/Commands';
import { configurationReader } from './vscode/ConfigurationReader';
import { InlayHintsProvider } from './vscode/InlayHintsProvider';
import { CachedStatusBarHandler, DebouncedStatusBarHandler } from "./vscode/StatusBarHandlers";
import { glassFakeInstructionParser, glassReptRepetitionParser } from './parser/impl/GlassParser';
import { macroParser } from './parser/impl/MacroParser';
import { sjasmplusDupRepetitionParser, sjasmplusFakeInstructionParser, sjasmplusRegisterListInstructionParser, sjasmplusReptRepetitionParser } from './parser/impl/SjasmplusParser';
import { defaultTimingHintsParser } from './parser/timingHints/DefaultTimingHintsParser';
import { regExpTimingHintsParser } from './parser/timingHints/RegExpTimingHintsParser';
import { mainParser, mainParserForMacroParser, mainParserForTimingHintsParsers } from './parser/MainParser';


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// (vscode.Disposables)
	context.subscriptions.push(
		configurationReader,
		//
		glassFakeInstructionParser,
		glassReptRepetitionParser,
		macroParser,
		sjasmplusFakeInstructionParser,
		sjasmplusRegisterListInstructionParser,
		sjasmplusDupRepetitionParser,
		sjasmplusReptRepetitionParser,
		defaultTimingHintsParser,
		regExpTimingHintsParser,
		//
		mainParser,
		mainParserForMacroParser,
		mainParserForTimingHintsParsers
	);

	// VS Code integrations
	const command = new FromActiveTextEditorSelecionCopyToClipboardCommand();
	const statusBarHandler = new CachedStatusBarHandler(command);
	const debouncedStatusBarHandler = new DebouncedStatusBarHandler(statusBarHandler);
	const inlayHintsProvider = new InlayHintsProvider();

	// (vscode.Disposables)
	context.subscriptions.push(
		command,
		statusBarHandler,
		debouncedStatusBarHandler,
		inlayHintsProvider
	);

	// Triggers the first execution
	statusBarHandler.onUpdateRequest();
}

// this method is called when your extension is deactivated
export function deactivate() {
}
