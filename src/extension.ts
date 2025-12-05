// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import type * as vscode from "vscode";

import { availableInstructionParsers, availableRepetitionParsers, availableTimingHintsParsers, mainParser, mainParserForMacroParser, mainParserForTimingHintsParsers } from "./parsers/parsers";
import { configurationReader } from "./vscode/ConfigurationReader";
import { FromActiveTextEditorSelecionCopyToClipboardCommand } from "./vscode/CopyToClipboardCommands";
import { InlayHintsProvider } from "./vscode/InlayHintsProvider";
import { CachedStatusBarHandler, DebouncedStatusBarHandler } from "./vscode/StatusBarHandlers";


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext): void {

	// (vscode.Disposables)
	context.subscriptions.push(
		configurationReader,
		...availableInstructionParsers,
		...availableRepetitionParsers,
		...availableTimingHintsParsers,
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
export function deactivate(): void {
	// (nop)
}
