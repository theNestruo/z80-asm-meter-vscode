import type { MeterableCollection } from "../../../types/AggregatedMeterables";
import type { SourceCode } from "../../../types/SourceCode";
import type { InstructionParser } from "../../instructions/types/InstructionParser";
import type { RepetitionParser } from "../../instructions/types/RepetitionParser";
import type { TimingHintsParser } from "../../timingHints/types/TimingHintsParser";

/**
 * The main parser
 */
export interface MainParser extends InstructionParser, RepetitionParser, TimingHintsParser {

	parse(sourceCodes: SourceCode[]): MeterableCollection | undefined;
}
