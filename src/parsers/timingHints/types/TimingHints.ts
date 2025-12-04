
/**
 * The values of a timing hint
 */
export class TimingHints {

	constructor(
		readonly z80Timing?: number[],
		readonly msxTiming?: number[],
		readonly cpcTiming?: number[]) {
	}
}
