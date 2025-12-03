// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { FromActiveTextEditorSelecionCopyToClipboardCommand } from './vscode/Commands';
import { configurationReader } from './vscode/ConfigurationReader';
import { InlayHintsProvider } from './vscode/InlayHintsProvider';
import { CachedStatusBarHandler, DebouncedStatusBarHandler } from "./vscode/StatusBarHandlers";
import { glassFakeInstructionParser, glassReptRepetitionParser } from './parsers/instructions/GlassParser';
import { macroParser } from './parsers/instructions/MacroParser';
import { sjasmplusDupRepetitionParser, sjasmplusFakeInstructionParser, sjasmplusRegisterListInstructionParser, sjasmplusReptRepetitionParser } from './parsers/instructions/SjasmplusParser';
import { defaultTimingHintsParser } from './parsers/timingHints/DefaultTimingHintsParser';
import { regExpTimingHintsParser } from './parsers/timingHints/RegExpTimingHintsParser';
import { mainParser, mainParserForMacroParser, mainParserForTimingHintsParsers } from './parsers/main/MainParser';


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	console.log("before");

	try {

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

	console.log("after");

	} catch (e) {
		console.error("error", e);
	}
}

// this method is called when your extension is deactivated
export function deactivate() {
}
