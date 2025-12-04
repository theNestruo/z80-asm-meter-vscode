import { extractMnemonicOf, extractOperandsOf } from "../../../utils/AssemblyUtils";
import { parseNumericExpression } from "../../../utils/NumberUtils";
import { RepetitionParser } from "../types/RepetitionParser";

/**
 * Base class for repetition parser implementations
 */
export abstract class AbstractRepetitionParser implements RepetitionParser {

	constructor(
		private readonly beginMnemonic: string,
		private readonly endMnemonic: string) {
	}

	parseBeginRepetition(instruction: string): number | undefined {

		const mnemonic = extractMnemonicOf(instruction);
		if (mnemonic !== this.beginMnemonic) {
			return undefined;
		}

		const operands = extractOperandsOf(instruction);
		if ((!operands.length)
			|| (operands.length > 2)) {
			return undefined;
		}

		const repetitions = parseNumericExpression(operands[0]);
		return repetitions !== undefined && repetitions >= 0 ? repetitions : 1;
	}

	parseEndRepetition(instruction: string): boolean {

		return extractMnemonicOf(instruction) === this.endMnemonic;
	}
}
