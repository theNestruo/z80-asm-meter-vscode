import { configurationReader } from "../../vscode/ConfigurationReader";

export class AtExitTotalTimingConfiguration {

	get retEnabled(): boolean {
		return configurationReader.read("timing.atExit.retEnabled");
	}

	get jumpEnabled(): boolean {
		return configurationReader.read("timing.atExit.jumpEnabled");
	}

	get callEnabled(): boolean {
		return configurationReader.read("timing.atExit.callEnabled");
	}

	get threshold(): number {
		return configurationReader.read("timing.atExit.threshold");
	}

	get requireConditional(): boolean {
		return configurationReader.read("timing.atExit.requireConditional");
	}

	get stopOnUnconditionalJump(): boolean {
		return configurationReader.read("timing.atExit.stopOnUnconditionalJump");
	}

	get retIcon(): string {
		return configurationReader.read("timing.atExit.retIcon");
	}

	get jumpIcon(): string {
		return configurationReader.read("timing.atExit.jumpIcon");
	}

	get callIcon(): string {
		return configurationReader.read("timing.atExit.callIcon");
	}
}
