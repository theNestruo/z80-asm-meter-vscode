import * as vscode from "vscode";
import type { Activable } from "./Activable";

/**
 * References an optional instance.
 * The instance may be present or absent depending on the configuration
 * @param I the instance type
 */
export interface OptionalSingletonRef<I> extends Activable {

	get instance(): I | undefined;
}

/**
 * References an optional singleton instance that is created lazily.
 * The singleton instance may be present or absent depending on the configuration,
 * and will be automatically destroyed if configuration changes
 * @param I the instance type (interface)
 * @param T the actual instance type (implementation)
 */
export abstract class OptionalSingletonRefImpl<I, T extends I> implements OptionalSingletonRef<I> {

	protected theInstance?: T;

	onActivate(): vscode.Disposable {
		// eslint-disable-next-line @typescript-eslint/unbound-method
		return vscode.workspace.onDidChangeConfiguration(this.onConfigurationChange, this);
	}

	protected onConfigurationChange(e: vscode.ConfigurationChangeEvent): void {

		// Forces re-creation of the instance
		if (e.affectsConfiguration("z80-asm-meter")) {
			this.destroyInstance();
		}
	}

	get instance(): I | undefined {
		return this.theInstance ??= this.enabled ? this.createInstance() : undefined;
	}

	protected abstract get enabled(): boolean;

	protected abstract createInstance(): T;

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
 * @param I the instance type (interface)
 * @param T the actual instance type (implementation)
 */
export abstract class SingletonRefImpl<I, T extends I> implements SingletonRef<I> {

	protected theInstance?: T;

	onActivate(): vscode.Disposable {
		// (empty disposable to fulfil interface)
		return vscode.Disposable.from();
	}

	get instance(): I {
		return this.theInstance ??= this.createInstance();
	}

	protected abstract createInstance(): T;
}

/**
 * References a singleton instance that is created lazily.
 * and will be automatically destroyed if configuration changes,
 * then lazily re-created
 * @param I the instance type (interface)
 * @param T the actual instance type (implementation)
 */
export abstract class ConfigurableSingletonRefImpl<I, T extends I>
	extends OptionalSingletonRefImpl<I, T> implements SingletonRef<I> {

	get instance(): I {
		return this.theInstance ??= this.createInstance();
	}

	protected readonly enabled = true;

	protected abstract createInstance(): T;
}
