import { config } from '../../../config';
import { OptionalSingletonRefImpl } from '../../../types/References';
import { RepetitionParser } from '../types/RepetitionParser';
import { AbstractRepetitionParser } from './AbstractRepetitionParser';

class SjasmplusDupRepetitionParserRef
    extends OptionalSingletonRefImpl<RepetitionParser, SjasmplusDupRepetitionParser> {

    protected get enabled(): boolean {
        return config.syntax.sjasmplusDupEdupRepetition;
    }

    protected override createInstance(): SjasmplusDupRepetitionParser {
        return new SjasmplusDupRepetitionParser();
    }
}

export const sjasmplusDupRepetitionParser = new SjasmplusDupRepetitionParserRef();

//

/**
 * Actual implementation of the SjASMPlus DUP/EDUP repetition parser
 */
class SjasmplusDupRepetitionParser extends AbstractRepetitionParser {

    constructor() {
        super("DUP", "EDUP");
    }
}
