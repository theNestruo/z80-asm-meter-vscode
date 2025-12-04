import { MacroDefinitionConfiguration } from "./parsers/instructions/config/MacroDefinitionConfiguration";
import { ParserConfiguration } from "./parsers/instructions/config/ParserConfiguration";
import { SyntaxConfiguration } from "./parsers/instructions/config/SyntaxConfiguration";
import { TimingHintsConfiguration } from "./parsers/timingHints/config/TimingHintsConfiguration";
import { AtExitTotalTimingConfiguration } from "./totalTimings/config/AtExitTotalTimingConfiguration";
import { ExecutionFlowTotalTimingConfiguration } from "./totalTimings/config/ExecutionFlowTotalTimingConfiguration";
import { InlayHintsConfiguration } from "./vscode/config/InlayHintsConfiguration";
import { StatusBarConfiguration } from "./vscode/config/StatusBarConfiguration";
import { configurationReader } from "./vscode/ConfigurationReader";

class Configuration {

	get languageIds(): string[] {
		return configurationReader.read("languageIds");
	}

	get platform(): "z80" | "cpc" | "msx" | "msxz80" | "pc8000" | "z80n" {
		return configurationReader.read("platform");
	}

	get instructionSets(): string[] {

		return this.platform === "z80n"
			? ["S", "N"]
			: ["S"];
	}

	get expandSelectionToLine(): boolean {

		return configurationReader.read("expandSelectionToLine");
	}

	// Status bar configuration
	readonly statusBar = new StatusBarConfiguration();

	// Assembler syntax configuration
	readonly syntax = new SyntaxConfiguration();

	// Parser configuration
	readonly parser = new ParserConfiguration();

	// Timing Hints configuration and Total timing calculations configuration
	readonly timing = new TimingConfiguration();

	// User-defined macros
	get macros(): MacroDefinitionConfiguration[] {
		return configurationReader.read("macros");
	}

	// Inlay hints configuration
	readonly inlayHints = new InlayHintsConfiguration();
}

class TimingConfiguration {

	// Timing Hints configuration
	readonly hints = new TimingHintsConfiguration();

	// Total timing calculations configuration
	readonly executionFlow = new ExecutionFlowTotalTimingConfiguration();
	readonly atExit = new AtExitTotalTimingConfiguration();
}

/** Extension configuration */
export const config = new Configuration();
