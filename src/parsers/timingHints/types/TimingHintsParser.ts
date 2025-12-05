import type { SourceCode } from "../../../types/SourceCode";
import type { TimingHints } from "./TimingHints";

/**
 * A timing hint parser
 */
export interface TimingHintsParser {

	parseTimingHints(s: SourceCode): TimingHints | undefined;
}
