import { MeterableCollection } from '../../../types/AggregatedMeterables';
import { SourceCode } from '../../../types/SourceCode';
import { InstructionParser } from '../../instructions/types/InstructionParser';
import { RepetitionParser } from '../../instructions/types/RepetitionParser';
import { TimingHintsParser } from '../../timingHints/types/TimingHintsParser';

/**
 * The main parser
 */
export interface MainParser extends InstructionParser, RepetitionParser, TimingHintsParser {

    parse(sourceCodes: SourceCode[]): MeterableCollection | undefined;
}
