import { config } from '../../../config';
import { OptionalSingletonRefImpl } from '../../../types/References';
import { RepetitionParser } from '../types/RepetitionParser';
import { AbstractRepetitionParser } from './AbstractRepetitionParser';

class SjasmplusReptRepetitionParserRef
    extends OptionalSingletonRefImpl<RepetitionParser, SjasmplusReptRepetitionParser> {

    override get enabled(): boolean {
        return config.syntax.sjasmplusReptEndrRepetition;
    }

    override createInstance(): SjasmplusReptRepetitionParser {
        return new SjasmplusReptRepetitionParser();
    }
}

export const sjasmplusReptRepetitionParser = new SjasmplusReptRepetitionParserRef();

//

/**
 * Actual implementation of the SjASMPlus RETP/ENDR repetition parser
 */
class SjasmplusReptRepetitionParser extends AbstractRepetitionParser {

    constructor() {
        super("REPT", "ENDR");
    }
}
