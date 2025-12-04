import { configurationReader } from "../../../vscode/ConfigurationReader";

export class SyntaxConfiguration {

	get syntax(): "default" | "glass" | "pasmo" | "sjasm" | "sjasmplus" | "spasm-ng" | "tniasm" {
		return configurationReader.read("syntax");
	}

	private get lineSeparator(): "disabled" | "backslash" | "colon" | "pipe" {

		return configurationReader.readWithDefaultValue("syntaxFeature.lineSeparator",
			this.syntax === "spasm-ng" ? "backslash" // (derived)
				: this.syntax === "tniasm" ? "pipe" // (derived)
					: undefined);
	}

	get lineSeparatorCharacter(): string | undefined {

		const value = this.lineSeparator;
		return value === "backslash" ? "\\"
			: value === "colon" ? ":"
				: value === "pipe" ? "|"
					: undefined;
	}

	private get labelColonOptional(): boolean {

		const value = this.syntax;
		return configurationReader.readWithDefaultValue("syntaxFeature.labelColonOptional",
			value === "pasmo" ? true // (derived)
				: value === "sjasmplus" ? true // (derived)
					: undefined);
	}

	get labelRegExp(): RegExp {

		return this.labelColonOptional
			? /(^[^\s:]+(?:[\s:]|$))/
			: /(^\s*[^\s:]+:)/;
	}

	private get repeat(): "disabled" | "brackets" | "dot" {

		return configurationReader.readWithDefaultValue("syntaxFeature.repeat",
			(this.syntax === "sjasm") ? "brackets" // (derived)
				: (this.syntax === "sjasmplus") ? "dot" // (derived)
					: undefined);
	}

	get repeatRegExp(): RegExp | undefined {

		const value = this.repeat;
		return value === "brackets" ? /^(?:\[([^\]]+)\]\s)(.+)$/
			: value === "dot" ? /^(?:\.(\S+)\s)(.+)$/
				: undefined;
	}

	get sjasmplusFakeInstructions(): boolean {

		return configurationReader.readWithDefaultValue("syntaxFeature.fakeInstructions",
			(this.syntax === "sjasmplus") ? true // (derived)
				: undefined);
	}

	get sjasmplusRegisterListInstructions(): boolean {

		return configurationReader.readWithDefaultValue("syntaxFeature.registerListInstructions",
			(this.syntax === "sjasmplus") ? true // (derived)
				: undefined);
	}

	get glassNegativeConditions(): boolean {

		return configurationReader.readWithDefaultValue("syntaxFeature.negativeConditions",
			(this.syntax === "glass") ? true // (derived)
				: undefined);
	}

	get sjasmplusDupEdupRepetition(): boolean {

		return configurationReader.readWithDefaultValue("syntaxFeature.dupEdup",
			(this.syntax === "sjasmplus") ? true // (derived)
				: undefined);
	}

	get sjasmplusReptEndrRepetition(): boolean {

		return configurationReader.readWithDefaultValue("syntaxFeature.reptEndr",
			(this.syntax === "sjasmplus") ? true // (derived)
				: undefined);
	}

	get glassReptEndmRepetition(): boolean {

		return configurationReader.readWithDefaultValue("syntaxFeature.reptendm",
			(this.syntax === "glass") ? true // (derived)
				: undefined);
	}
}
