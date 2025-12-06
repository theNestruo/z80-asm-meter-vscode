import * as vscode from "vscode";

/**
 * References an optional instance.
 * The instance may be present or absent depending on the configuration
 * @param I the instance type
 */
export interface OptionalSingletonRef<I> extends vscode.Disposable {

	get instance(): I | undefined;
}

/**
 * References an optional singleton that is created lazily.
 * The singleton instance may be present or absent depending on the configuration,
 * and will be automatically removed if configuration changes and on disposal
 * @param I the instance type (interface)
 * @param T the actual instance type (implementation)
 */
export abstract class OptionalSingletonRefImpl<I, T extends I> implements OptionalSingletonRef<I> {

	private readonly disposable: vscode.Disposable;
	protected theInstance?: I = undefined;

	constructor() {
		this.disposable =
			// Subscribe to configuration change event
			// eslint-disable-next-line @typescript-eslint/unbound-method
			vscode.workspace.onDidChangeConfiguration(this.onConfigurationChange, this);
	}

	get instance(): I | undefined {
		return this.theInstance ??= this.enabled
			? this.createInstance()
			: undefined;
	}

	protected abstract get enabled(): boolean;

	protected abstract createInstance(): T;

	onConfigurationChange(_: vscode.ConfigurationChangeEvent): void {

		// Removes the implementation if disabled
		if (!this.enabled) {
			this.destroyInstance();
		}
	}

	dispose(): void {
		this.disposable.dispose();
		this.destroyInstance();
	}

	protected destroyInstance(): void {

		if (this.theInstance instanceof vscode.Disposable) {
			this.theInstance.dispose();
		}
		this.theInstance = undefined;
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
export abstract class SingletonRefImpl<I, T extends I> implements SingletonRef<I> {

	protected theInstance?: T = undefined;

	get instance(): I {
		return this.theInstance ??= this.createInstance();
	}

	protected abstract createInstance(): T;

	dispose(): void {
		this.destroyInstance();
	}

	protected destroyInstance(): void {

		if (this.theInstance instanceof vscode.Disposable) {
			this.theInstance.dispose();
		}
		this.theInstance = undefined;
	}
}
