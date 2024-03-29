// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { mainParser, noMacroMainParser, noTimingHintsMainParser } from './parser/MainParser';
import { macroParser } from './parser/impl/MacroParser';
import { regExpTimingHintsParser } from './parser/impl/RegExpTimingHintsParser';
import { CommandHandler } from './statusBar/CommandHandler';
import { DebouncedStatusBarHandler, StatusBarHandler } from "./statusBar/StatusBarHandler";


let disposable: vscode.Disposable | undefined;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	const commandHandler = new CommandHandler();
	const statusBarHandler = new StatusBarHandler(commandHandler);
	const debouncedHandler = new DebouncedStatusBarHandler(statusBarHandler);

	disposable = vscode.Disposable.from(
		statusBarHandler,

		// subscribe to selection change and editor activation events
		vscode.window.onDidChangeTextEditorSelection(
			debouncedHandler.update, debouncedHandler),
		vscode.window.onDidChangeActiveTextEditor(
			debouncedHandler.update, debouncedHandler),
		vscode.workspace.onDidChangeTextDocument(
			debouncedHandler.update, debouncedHandler),

		// create a command to copy timing and size to clipboard
		vscode.commands.registerCommand(
			commandHandler.command, commandHandler.copy, commandHandler),

		// subscribe to configuration change event
		vscode.workspace.onDidChangeConfiguration(
			statusBarHandler.onConfigurationChange, statusBarHandler),

		vscode.workspace.onDidChangeConfiguration(
			mainParser.onConfigurationChange, mainParser),
		vscode.workspace.onDidChangeConfiguration(
			noMacroMainParser.onConfigurationChange, noMacroMainParser),
		vscode.workspace.onDidChangeConfiguration(
			noTimingHintsMainParser.onConfigurationChange, noTimingHintsMainParser),

		vscode.workspace.onDidChangeConfiguration(
			macroParser.onConfigurationChange, macroParser),

		vscode.workspace.onDidChangeConfiguration(
			regExpTimingHintsParser.onConfigurationChange, regExpTimingHintsParser),
	);
	context.subscriptions.push(disposable);

	// First execution
	statusBarHandler.update();
}

// this method is called when your extension is deactivated
export function deactivate() {

	if (disposable) {
		disposable.dispose();
		disposable = undefined;
	}
}
