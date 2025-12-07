import { config } from "../../../config";
import type { OptionalSingletonRef } from "../../../types/References";
import { OptionalSingletonRefImpl } from "../../../types/References";
import type { RepetitionParser } from "../types/RepetitionParser";
import { AbstractRepetitionParser } from "./AbstractRepetitionParser";

class GlassReptRepetitionParserRef extends OptionalSingletonRefImpl<RepetitionParser, GlassReptRepetitionParser> {

	protected get enabled(): boolean {
		return config.syntax.glassReptEndmRepetition;
	}

	protected createInstance(): GlassReptRepetitionParser {
		return new GlassReptRepetitionParser();
	}
}

export const glassReptRepetitionParser: OptionalSingletonRef<RepetitionParser> = new GlassReptRepetitionParserRef();

//

/**
 * Actual implementation of the Glass REPT/ENDM repetition parser
 */
export class GlassReptRepetitionParser extends AbstractRepetitionParser {

	constructor() {
		super("REPT", "ENDM");
	}
}

