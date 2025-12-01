import * as vscode from 'vscode';

/**
 * Convenience interface for classes that require activation
 */
export interface Activable {

	activate(context: vscode.ExtensionContext): void;
}

/**
 * Base class for classes that will be automatically disposed if they are created
 */
export abstract class SelfDisposable implements vscode.Disposable {

	constructor(context: vscode.ExtensionContext) {
		context.subscriptions.push(this);
	}

	abstract dispose(): void;
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

/**
 * An optional singleton.
 * May be present or absent depending on the configuration
 */
export interface OptionalSingleton<T> {

	get instance(): T | undefined;
}

/**
 * A singleton
 */
export interface Singleton<T> extends OptionalSingleton<T> {

	get instance(): T;
}

/**
 * A singleton that is created lazily.
 * The singleton instance will be automatically disposed on deactivation
 */
export abstract class LazySingleton<T> extends DisposableActivable implements Singleton<T> {

    protected _instance?: T = undefined;

	override dispose(): void {
		this._instance = undefined;
	}

	get instance(): T {
		return this._instance = this._instance ?? this.createInstance();
	}

	protected abstract createInstance(): T;
}

/**
 * An optional singleton that is created lazily.
 * May be present or absent depending on the configuration.
 * The singleton instance will be automatically disposed if configuration changes and on deactivation
 */
export abstract class LazyOptionalSingleton<T> extends DisposableActivable implements OptionalSingleton<T> {

	private _instance?: T = undefined;

	override activate(context: vscode.ExtensionContext): void {
		super.activate(context);

		context.subscriptions.push(
			// Subscribe to configuration change event
			vscode.workspace.onDidChangeConfiguration(this.onConfigurationChange, this)
		);
	}

	override dispose(): void {
		this._instance = undefined;
	}

	onConfigurationChange(_e: vscode.ConfigurationChangeEvent) {

		if ((!this.enabled) && this._instance) {
			if (this._instance instanceof vscode.Disposable) {
				this._instance.dispose();
			}
			this._instance = undefined;
		}
	}

	get instance(): T | undefined {
		if (!this.enabled) {
			return undefined;
		}
		return this._instance = this._instance ?? this.createInstance();
	}

	protected abstract get enabled(): boolean;

	protected abstract createInstance(): T;
}

