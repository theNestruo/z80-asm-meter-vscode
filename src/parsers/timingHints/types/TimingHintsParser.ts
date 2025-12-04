import { SourceCode } from "../../../types/SourceCode";
import { TimingHints } from "./TimingHints";

/**
 * A timing hint parser
 */
export interface TimingHintsParser {

	parseTimingHints(s: SourceCode): TimingHints | undefined;
}
