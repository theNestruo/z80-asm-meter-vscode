import { config } from "../../../config";
import type { OptionalSingletonRef } from "../../../types/References";
import { OptionalSingletonRefImpl } from "../../../types/References";
import type { RepetitionParser } from "../types/RepetitionParser";
import { AbstractRepetitionParser } from "./AbstractRepetitionParser";

class SjasmplusReptRepetitionParserRef
	extends OptionalSingletonRefImpl<RepetitionParser, SjasmplusReptRepetitionParser> {

	override get enabled(): boolean {
		return config.syntax.sjasmplusReptEndrRepetition;
	}

	override createInstance(): SjasmplusReptRepetitionParser {
		return new SjasmplusReptRepetitionParser();
	}
}

export const sjasmplusReptRepetitionParser: OptionalSingletonRef<RepetitionParser> = new SjasmplusReptRepetitionParserRef();

//

/**
 * Actual implementation of the SjASMPlus RETP/ENDR repetition parser
 */
class SjasmplusReptRepetitionParser extends AbstractRepetitionParser {

	constructor() {
		super("REPT", "ENDR");
	}
}
