import * as vscode from 'vscode';

/**
 * References an optional instance.
 * The instance may be present or absent depending on the configuration
 * @param I the instance type
 */
export interface OptionalSingletonRef<I> {

	get instance(): I | undefined;
}

/**
 * References an optional singleton that is created lazily.
 * The singleton instance may be present or absent depending on the configuration,
 * and will be automatically removed if configuration changes and on disposal
 * @param I the instance type (interface)
 * @param T the actual instance type (implementation)
 */
export abstract class OptionalSingletonRefImpl<I, T extends I>
		implements OptionalSingletonRef<I>, vscode.Disposable {

	private readonly _disposable: vscode.Disposable;
	protected _instance?: I = undefined;

	constructor() {
		this._disposable =
			// Subscribe to configuration change event
			vscode.workspace.onDidChangeConfiguration(this.onConfigurationChange, this);
	}

	onConfigurationChange(_: vscode.ConfigurationChangeEvent) {

		// Removes the implementation if disabled
		if (!this.enabled) {
			this.destroyInstance();
		}
	}

	dispose() {
		this._disposable.dispose();
		this.destroyInstance();
	}

	get instance(): I | undefined {
		return this._instance ??= this.enabled
				? this.createInstance()
				: undefined;
	}

	protected abstract get enabled(): boolean;
	protected abstract createInstance(): T;

	protected destroyInstance() {

		if (this._instance instanceof vscode.Disposable) {
			this._instance.dispose();
		}
		this._instance = undefined;
	}
}

//

/**
 * References a singleton instance.
 * @param I the instance type
 */
export interface SingletonRef<I> extends OptionalSingletonRef<I> {

	get instance(): I;
}

/**
 * References a singleton instance that is created lazily.
 * The singleton instance will be automatically removed on disposal
 * @param I the instance type (interface)
 * @param T the actual instance type (implementation)
 */
export abstract class SingletonRefImpl<I, T extends I> implements SingletonRef<I>, vscode.Disposable {

	protected _instance?: I = undefined;

	dispose() {
		this.destroyInstance();
	}

	get instance(): I {
		return this._instance ??= this.createInstance();
	}

	protected abstract createInstance(): T;

	protected destroyInstance() {

		if (this._instance instanceof vscode.Disposable) {
			this._instance.dispose();
		}
		this._instance = undefined;
	}
}
