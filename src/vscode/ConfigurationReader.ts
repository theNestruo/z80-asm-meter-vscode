import * as vscode from 'vscode';

class ConfigurationReader {

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

class CachedConfigurationReader implements vscode.Disposable {

	private readonly _disposable: vscode.Disposable;

	private cache = new Map<string, any>();

	constructor(
		private readonly delegate: ConfigurationReader) {

		this._disposable =
			// Subscribe to configuration change event
			vscode.workspace.onDidChangeConfiguration(this.onConfigurationChange, this);
	}

	onConfigurationChange(_e: vscode.ConfigurationChangeEvent) {
		this.cache.clear();
	}

	dispose() {
        this._disposable.dispose();
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

export const configurationReader = new CachedConfigurationReader(new ConfigurationReader());
