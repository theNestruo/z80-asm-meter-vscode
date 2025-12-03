import { SourceCode } from "../types/SourceCode";
import { TimingHints } from "./TimingHintedMeterable";

export interface TimingHintsParser {

	parse(s: SourceCode): TimingHints | undefined;
}
