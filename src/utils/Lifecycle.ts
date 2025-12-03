import * as vscode from 'vscode';

/**
 * Holds an optional instance.
 * The instance may be present or absent depending on the configuration
 */
export interface OptionalSingletonHolder<T> {

	get instance(): T | undefined;
}

/**
 * Holds an optional singleton that is created lazily.
 * The singleton instance may be present or absent depending on the configuration,
 * and will be automatically removed if configuration changes and on disposal
 */
export abstract class OptionalSingletonHolderImpl<T> implements OptionalSingletonHolder<T>, vscode.Disposable {

	private readonly _disposable: vscode.Disposable;
	protected _instance?: T = undefined;

	constructor() {
		this._disposable =
			// Subscribe to configuration change event
			vscode.workspace.onDidChangeConfiguration(this.onConfigurationChange, this);
	}

	onConfigurationChange(_: vscode.ConfigurationChangeEvent) {

		// Removes the implementation if disabled
		if (!this.enabled) {
			if (this._instance instanceof vscode.Disposable) {
				this._instance.dispose();
			}
			this._instance = undefined;
		}
	}

	dispose() {
		this._disposable.dispose();

		if (this._instance instanceof vscode.Disposable) {
			this._instance.dispose();
		}
		this._instance = undefined;
	}

	get instance(): T | undefined {
		return this._instance ??= this.enabled
				? this.createInstance()
				: undefined;
	}

	protected abstract get enabled(): boolean;
	protected abstract createInstance(): T;
}

//

/**
 * Holds an instance.
 */
export interface SingletonHolder<T> extends OptionalSingletonHolder<T> {

	get instance(): T;
}

/**
 * Holds a singleton instance that is created lazily.
 * The singleton instance will be automatically removed on disposal
 */
export abstract class SingletonHolderImpl<T> implements SingletonHolder<T>, vscode.Disposable {

	protected _instance?: T = undefined;

	dispose() {
		if (this._instance instanceof vscode.Disposable) {
			this._instance.dispose();
		}
		this._instance = undefined;
	}

	get instance(): T {
		return this._instance ??= this.createInstance();
	}

	protected abstract createInstance(): T;
}
