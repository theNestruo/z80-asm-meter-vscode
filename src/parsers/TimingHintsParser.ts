import { SourceCode } from "../types/SourceCode";
import { TimingHints } from "../types/TimingHintedMeterable";

export interface TimingHintsParser {

	parse(s: SourceCode): TimingHints | undefined;
}
