import * as vscode from "vscode";

/**
 * Default implementation of the extension configuration reader
 */
class ConfigurationReader {

	read(section: string): unknown {

		return vscode.workspace.getConfiguration("z80-asm-meter").get(section);
	}

	readWithDefaultValue<T>(section: string, actualDefaultValue: T | undefined): T {

		if (actualDefaultValue === undefined) {
			return this.read(section) as T;
		}
		return this.readIgnoreDefault(section) as T ?? actualDefaultValue;
	}

	private readIgnoreDefault(section: string): unknown {

		const config = vscode.workspace.getConfiguration("z80-asm-meter");
		const info = config.inspect(section);
		const isSet = info?.globalValue
			?? info?.workspaceValue
			?? info?.workspaceFolderValue
			?? info?.defaultLanguageValue
			?? info?.globalLanguageValue
			?? info?.workspaceLanguageValue
			?? info?.workspaceFolderLanguageValue;
		return isSet ? config.get(section) : undefined;
	}
}

/**
 * Cached implementation of the extension configuration reader
 */
class CachedConfigurationReader extends ConfigurationReader implements vscode.Disposable {

	private readonly disposable: vscode.Disposable;
	private readonly cache = new Map<string, unknown>();

	constructor() {
		super();

		this.disposable =
			// Subscribe to configuration change event
			// eslint-disable-next-line @typescript-eslint/unbound-method
			vscode.workspace.onDidChangeConfiguration(this.onConfigurationChange, this);
	}

	override read(section: string): unknown {

		if (this.cache.has(section)) {
			return this.cache.get(section);
		}

		const value = super.read(section);
		this.cache.set(section, value);
		return value;
	}

	override readWithDefaultValue<T>(section: string, actualDefaultValue: T | undefined): T {

		if (actualDefaultValue === undefined) {
			return this.read(section) as T;
		}

		if (this.cache.has(section)) {
			return this.cache.get(section) as T;
		}

		const value: T = super.readWithDefaultValue(section, actualDefaultValue);
		this.cache.set(section, value);
		return value;
	}

	onConfigurationChange(_: vscode.ConfigurationChangeEvent): void {
		this.cache.clear();
	}

	dispose(): void {
		this.disposable.dispose();
		this.cache.clear();
	}
}

/** Extension configuration reader */
export const configurationReader = new CachedConfigurationReader();
