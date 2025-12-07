import type * as vscode from "vscode";

/**
 * Objects whose initialization must be called during the extension activation
 * (likely due a subscription to ConfigurationChangeEvents)
 */
export interface Activable {

	onActivate(): vscode.Disposable;
}
