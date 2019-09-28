// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { Z80MeterController } from './z80MeterController';

let z80MeterController: Z80MeterController | undefined;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	z80MeterController = new Z80MeterController();
	context.subscriptions.push(z80MeterController);
}

// this method is called when your extension is deactivated
export function deactivate() {

	if (z80MeterController) {
		z80MeterController.dispose();
		z80MeterController = undefined;
	}
}
