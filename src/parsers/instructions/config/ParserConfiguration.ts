import { configurationReader } from "../../../vscode/ConfigurationReader";

export class ParserConfiguration {

	get directivesDefsAsInstructions(): boolean {
		return configurationReader.read("parser.directives.defsAsInstructions");
	}

	get instructionsCacheSize(): number {
		return configurationReader.read("parser.instructionsCacheSize");
	}
}
