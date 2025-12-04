import { configurationReader } from "../../vscode/ConfigurationReader";

export class ExecutionFlowTotalTimingConfiguration {

	get enabled(): boolean {
		return configurationReader.read("timing.executionFlow.enabled");
	}

	get threshold(): number {
		return configurationReader.read("timing.executionFlow.threshold");
	}

	get requireConditional(): boolean {
		return configurationReader.read("timing.executionFlow.requireConditional");
	}

	get stopOnUnconditionalJump(): boolean {
		return configurationReader.read("timing.executionFlow.stopOnUnconditionalJump");
	}

	get icon(): string {
		return configurationReader.read("timing.executionFlow.icon");
	}
}
