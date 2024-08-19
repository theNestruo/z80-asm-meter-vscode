// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { CopyToClipboardCommand } from './commands';
import { mainParser, mainParserWithoutMacro, mainParserWithoutTimingHints } from './parser/MainParser';
import { macroParser } from './parser/impl/MacroParser';
import { regExpTimingHintsParser } from './parser/impl/RegExpTimingHintsParser';
import { sjasmplusFakeInstructionParser } from './parser/impl/SjasmplusParser';
import { z80InstructionParser } from './parser/impl/Z80InstructionParser';
import { CachedStatusBarHandler, DebouncedStatusBarHandler } from "./statusBarHandlers";


let disposable: vscode.Disposable | undefined;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	const copyToClipboardCommand = new CopyToClipboardCommand();

	const internalStatusBarHandler = new CachedStatusBarHandler(copyToClipboardCommand);
	const statusBarHandler = new DebouncedStatusBarHandler(internalStatusBarHandler);

	disposable = vscode.Disposable.from(
		internalStatusBarHandler,

		// subscribe to selection change and editor activation events
		vscode.window.onDidChangeTextEditorSelection(
			statusBarHandler.onUpdateRequest, statusBarHandler),
		vscode.window.onDidChangeActiveTextEditor(
			statusBarHandler.onUpdateRequest, statusBarHandler),
		vscode.workspace.onDidChangeTextDocument(
			statusBarHandler.onUpdateRequest, statusBarHandler),

		// create a command to copy timing and size to clipboard
		vscode.commands.registerCommand(
			copyToClipboardCommand.command, copyToClipboardCommand.onExecute, copyToClipboardCommand),

		// subscribe to configuration change event
		vscode.workspace.onDidChangeConfiguration(
			internalStatusBarHandler.onConfigurationChange, internalStatusBarHandler),

		vscode.workspace.onDidChangeConfiguration(
			z80InstructionParser.onConfigurationChange, z80InstructionParser),
		vscode.workspace.onDidChangeConfiguration(
			sjasmplusFakeInstructionParser.onConfigurationChange, sjasmplusFakeInstructionParser),

		vscode.workspace.onDidChangeConfiguration(
			mainParser.onConfigurationChange, mainParser),
		vscode.workspace.onDidChangeConfiguration(
			mainParserWithoutMacro.onConfigurationChange, mainParserWithoutMacro),
		vscode.workspace.onDidChangeConfiguration(
			mainParserWithoutTimingHints.onConfigurationChange, mainParserWithoutTimingHints),

		vscode.workspace.onDidChangeConfiguration(
			macroParser.onConfigurationChange, macroParser),

		vscode.workspace.onDidChangeConfiguration(
			regExpTimingHintsParser.onConfigurationChange, regExpTimingHintsParser),
	);
	context.subscriptions.push(disposable);

	// First execution
	internalStatusBarHandler.onUpdateRequest();
}

// this method is called when your extension is deactivated
export function deactivate() {

	disposable?.dispose();
		disposable = undefined;
}
