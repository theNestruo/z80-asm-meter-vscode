import * as vscode from 'vscode';

/**
 * Convenience interface for classes that require activation
 */
export interface Activable {

	activate(context: vscode.ExtensionContext): void;
}

/**
 * Base class for classes that will be automatically disposed if they are activated
 */
export abstract class DisposableActivable implements Activable, vscode.Disposable {

	activate(context: vscode.ExtensionContext): void {
		context.subscriptions.push(this);
	}

	abstract dispose(): void;
}

