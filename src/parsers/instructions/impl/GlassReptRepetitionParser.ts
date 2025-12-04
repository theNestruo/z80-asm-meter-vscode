import { config } from "../../../config";
import { OptionalSingletonRefImpl } from "../../../types/References";
import { AbstractRepetitionParser } from "./AbstractRepetitionParser";
import { RepetitionParser } from "../types/RepetitionParser";

class GlassReptRepetitionParserRef extends OptionalSingletonRefImpl<RepetitionParser, GlassReptRepetitionParser> {

    protected get enabled(): boolean {
        return config.syntax.glassReptEndmRepetition;
    }

    protected createInstance(): GlassReptRepetitionParser {
        return new GlassReptRepetitionParser();
    }
}

export const glassReptRepetitionParser = new GlassReptRepetitionParserRef();

//

/**
 * Actual implementation of the Glass REPT/ENDM repetition parser
 */
export class GlassReptRepetitionParser extends AbstractRepetitionParser {

    constructor() {
        super("REPT", "ENDM");
    }
}

