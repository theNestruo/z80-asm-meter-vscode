import * as vscode from 'vscode';
import { DisposableActivable } from '../utils/Lifecycle';

interface ConfigurationReader {

	read<T>(section: string): T;

	readWithDefaultValue<T>(section: string, actualDefaultValue: T | undefined): T;
}

class DirectConfigurationReader implements ConfigurationReader {

	static readonly instance = new DirectConfigurationReader();

	private constructor() {}

	read<T>(section: string): T {

		return <T>vscode.workspace.getConfiguration("z80-asm-meter").get(section);
	}

	readWithDefaultValue<T>(section: string, actualDefaultValue: T | undefined): T {

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

class CachedConfigurationReader extends DisposableActivable {

	private cache = new Map<string, any>();

	constructor(
		context: vscode.ExtensionContext,
		private readonly delegate: ConfigurationReader = DirectConfigurationReader.instance) {

		super();

		this.activate(context);
	}

	override activate(context: vscode.ExtensionContext): void {
		super.activate(context);

		context.subscriptions.push(
			// Subscribe to configuration change event
			vscode.workspace.onDidChangeConfiguration(this.onConfigurationChange, this)
		);
	}

	onConfigurationChange(_e: vscode.ConfigurationChangeEvent) {
		this.cache.clear();
	}

	dispose() {
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

class ExtensionConfigurationReader extends DisposableActivable implements ConfigurationReader {

	private delegate: ConfigurationReader = DirectConfigurationReader.instance;

	override activate(context: vscode.ExtensionContext): void {
		const cachedConfigurationReader = new CachedConfigurationReader(context);
		cachedConfigurationReader.activate(context);

		// Sets the CachedConfigurationReader instance
		this.delegate = cachedConfigurationReader;
	}

	override dispose(): void {
		// Removes the CachedConfigurationReader instance
		this.delegate = DirectConfigurationReader.instance;
	}

	read<T>(section: string): T {
		return this.delegate.read(section);
	}

	readWithDefaultValue<T>(section: string, actualDefaultValue: T | undefined): T {
		return this.delegate.readWithDefaultValue(section, actualDefaultValue);
	}
}

export const configurationReader = new ExtensionConfigurationReader();
