import * as vscode from 'vscode';

/**
 * Extension configuration reader
 */
interface ConfigurationReader {

	/**
	 * Read the configuration value
	 * @param section
	 */
	read<T>(section: string): T;

	/**
	 * Read the configuration value, returning a default value when the setting is not explicitly set
	 * @param section
	 * @param actualDefaultValue
	 */
	readWithDefaultValue<T>(section: string, actualDefaultValue: T | undefined): T;
}

/**
 * Direct configuration reader that queries VS Code configuration
 */
class DefaultConfigurationReader implements ConfigurationReader {

	/** Direct configuration reader singelton instance */
	static readonly instance = new DefaultConfigurationReader();

	private constructor() {}

	read<T>(section: string): T {
		return <T>vscode.workspace.getConfiguration("z80-asm-meter").get(section);
	}

	readWithDefaultValue<T>(section: string, actualDefaultValue: T | undefined): T {

		// (sanity check)
		if (actualDefaultValue === undefined) {
			return this.read(section);
		}

		return <T>this.readIgnoreDefault(section) ?? actualDefaultValue;
	}

	private readIgnoreDefault<T>(section: string): T | undefined {
		const config = vscode.workspace.getConfiguration("z80-asm-meter");
		const info = config.inspect(section);
		const isSet = info
			&& (info.globalValue
				|| info.workspaceValue
				|| info.workspaceFolderValue
				|| info.defaultLanguageValue
				|| info.globalLanguageValue
				|| info.workspaceLanguageValue
				|| info.workspaceFolderLanguageValue);
		return isSet ? <T>config.get(section) : undefined;
	}
}

/**
 * Configuration reader that caches in-memory
 */
export class CachedConfigurationReaderDecorator implements ConfigurationReader, vscode.Disposable {

	/**
	 * Creates a cached configuration reader instance
	 * and sets it as the public configuration reader instance
	 * @param context extension context to register disposables
	 */
	static activate(context: vscode.ExtensionContext) {

		// Prevents double activation
		if (configurationReader instanceof CachedConfigurationReaderDecorator) {
			return;
		}

		const instance = new CachedConfigurationReaderDecorator();

		// Registers as disposable
		context.subscriptions.push(instance);

		// Sets as the exported configurationReader
		configurationReader = instance;
	}

	private readonly disposable: vscode.Disposable;

	private cache = new Map<string, any>();

	constructor(
		private readonly delegate: ConfigurationReader = DefaultConfigurationReader.instance) {

		// Listen for configuration changes
		this.disposable = vscode.workspace.onDidChangeConfiguration(this.onConfigurationChange, this);
	}

	dispose() {
		this.cache.clear();
		this.disposable.dispose();

		// Resets the default implementation
		configurationReader = DefaultConfigurationReader.instance;
	}

	onConfigurationChange(_e: vscode.ConfigurationChangeEvent) {
		this.cache.clear();
	}

	read<T>(section: string): T {

		if (this.cache.has(section)) {
			return this.cache.get(section);
		}

		const value: T = this.delegate.read(section);
		this.cache.set(section, value);
		return value;
	}

	readWithDefaultValue<T>(section: string, actualDefaultValue: T | undefined): T {

		if (actualDefaultValue === undefined) {
			return this.read(section);
		}

		if (this.cache.has(section)) {
			return this.cache.get(section);
		}

		const value: T = this.delegate.readWithDefaultValue(section, actualDefaultValue);
		this.cache.set(section, value);
		return value;
	}
}

/** Extension configuration reader */
export let configurationReader: ConfigurationReader = DefaultConfigurationReader.instance;
