import * as vscode from "vscode";

/**
 * Default implementation of the extension configuration reader
 */
class ConfigurationReader {

	read<T>(section: string): T {

		return vscode.workspace.getConfiguration("z80-asm-meter").get(section) as T;
	}

	readWithDefaultValue<T>(section: string, actualDefaultValue: T | undefined): T {

		if (actualDefaultValue === undefined) {
			return this.read(section);
		}
		return this.readIgnoreDefault(section) as T ?? actualDefaultValue;
	}

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
}

/**
 * Cached implementation of the extension configuration reader
 */
class CachedConfigurationReader extends ConfigurationReader implements vscode.Disposable {

	private readonly _disposable: vscode.Disposable;
	private readonly cache = new Map<string, unknown>();

	constructor() {
		super();

		this._disposable =
			// Subscribe to configuration change event
			// eslint-disable-next-line @typescript-eslint/unbound-method
			vscode.workspace.onDidChangeConfiguration(this.onConfigurationChange, this);
	}

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

	onConfigurationChange(_: vscode.ConfigurationChangeEvent): void {
		this.cache.clear();
	}

	dispose(): void {
		this._disposable.dispose();
		this.cache.clear();
	}
}

/** Extension configuration reader */
export const configurationReader = new CachedConfigurationReader();
