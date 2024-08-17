// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { mainParser, noMacroMainParser, noTimingHintsMainParser } from './parser/MainParser';
import { macroParser } from './parser/impl/MacroParser';
import { regExpTimingHintsParser } from './parser/impl/RegExpTimingHintsParser';
import { CopyToClipboardCommandHandler } from './statusBar/CommandHandler';
import { CachedStatusBarHandler, DebouncedStatusBarHandler } from "./statusBar/StatusBarHandler";
import { z80InstructionParser } from './parser/impl/Z80InstructionParser';
import { sjasmplusFakeInstructionParser } from './parser/impl/SjasmplusParser';


let disposable: vscode.Disposable | undefined;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	const commandHandler = new CopyToClipboardCommandHandler();
	const statusBarHandler = new DebouncedStatusBarHandler(new CachedStatusBarHandler(commandHandler));

	disposable = vscode.Disposable.from(
		statusBarHandler,

		// subscribe to selection change and editor activation events
		vscode.window.onDidChangeTextEditorSelection(
			statusBarHandler.update, statusBarHandler),
		vscode.window.onDidChangeActiveTextEditor(
			statusBarHandler.update, statusBarHandler),
		vscode.workspace.onDidChangeTextDocument(
			statusBarHandler.update, statusBarHandler),

		// create a command to copy timing and size to clipboard
		vscode.commands.registerCommand(
			commandHandler.command, commandHandler.onExecute, commandHandler),

		// subscribe to configuration change event
		vscode.workspace.onDidChangeConfiguration(
			statusBarHandler.onConfigurationChange, statusBarHandler),

		vscode.workspace.onDidChangeConfiguration(
			z80InstructionParser.onConfigurationChange, z80InstructionParser),
		vscode.workspace.onDidChangeConfiguration(
			sjasmplusFakeInstructionParser.onConfigurationChange, sjasmplusFakeInstructionParser),

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
	statusBarHandler.forceUpdate();
}

// this method is called when your extension is deactivated
export function deactivate() {

	if (disposable) {
		disposable.dispose();
		disposable = undefined;
	}
}
