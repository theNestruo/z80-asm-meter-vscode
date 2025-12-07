import * as vscode from "vscode";
import type { Activable } from "../types/Activable";

/**
 * Extension configuration reader
 */
interface ConfigurationReader {

	// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
	read<T>(section: string): T;

	readWithDefaultValue<T>(section: string, actualDefaultValue: T | undefined): T;
}

/**
 * Default implementation of the extension configuration reader
 */
class DefaultConfigurationReader implements ConfigurationReader {

	// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
	read<T>(section: string): T {

		return vscode.workspace.getConfiguration("z80-asm-meter").get(section) as T;
	}

	readWithDefaultValue<T>(section: string, actualDefaultValue: T | undefined): T {

		if (actualDefaultValue === undefined) {
			return this.read(section);
		}
		return this.readIgnoreDefault(section) as T ?? actualDefaultValue;
	}

	// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
	private readIgnoreDefault<T>(section: string): T | undefined {

		const config = vscode.workspace.getConfiguration("z80-asm-meter");
		const info = config.inspect(section);
		const isSet = info?.globalValue
			?? info?.workspaceValue
			?? info?.workspaceFolderValue
			?? info?.defaultLanguageValue
			?? info?.globalLanguageValue
			?? info?.workspaceLanguageValue
			?? info?.workspaceFolderLanguageValue;
		return isSet ? config.get(section) as T : undefined;
	}

	dispose(): void {
		// (nop)
	}
}

/**
 * Cached implementation of the extension configuration reader
 */
class CachedConfigurationReader extends DefaultConfigurationReader implements Activable {

	private readonly cache = new Map<string, unknown>();

	onActivate(): vscode.Disposable {
		// eslint-disable-next-line @typescript-eslint/unbound-method
		return vscode.workspace.onDidChangeConfiguration(this.onConfigurationChange, this);
	}

	protected onConfigurationChange(e: vscode.ConfigurationChangeEvent): void {

		// Clears cache
		if (e.affectsConfiguration("z80-asm-meter")) {
			this.cache.clear();
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
	override read<T>(section: string): T {

		if (this.cache.has(section)) {
			return this.cache.get(section) as T;
		}

		const value: T = super.read(section);
		this.cache.set(section, value);
		return value;
	}

	override readWithDefaultValue<T>(section: string, actualDefaultValue: T | undefined): T {

		if (actualDefaultValue === undefined) {
			return this.read(section);
		}

		if (this.cache.has(section)) {
			return this.cache.get(section) as T;
		}

		const value: T = super.readWithDefaultValue(section, actualDefaultValue);
		this.cache.set(section, value);
		return value;
	}
}

/** Extension configuration reader */
export const configurationReader: ConfigurationReader & Activable = new CachedConfigurationReader();
