import { extractMnemonicOf, extractOperandsOf } from "../../utils/utils";
import NumericExpressionParser from "../NumericExpressionParser";

export default class SjasmplusDupParser {

	static parseDupOrRept(instruction: string): number | undefined {

		const mnemonic = extractMnemonicOf(instruction);
		if ([ "DUP", "REPT" ].indexOf(mnemonic) === -1) {
			return undefined;
		}

		const operands = extractOperandsOf(instruction);
		if ((!operands.length)
			|| (operands.length > 2)) {
			return undefined;
		}

        const repetitions = NumericExpressionParser.parse(operands[0]);
        return repetitions !== undefined && repetitions >= 0 ? repetitions : 1;
	}

	static parseEdupOrEndr(instruction: string): boolean {

		const mnemonic = extractMnemonicOf(instruction);
		return [ "EDUP", "ENDR" ].indexOf(mnemonic) !== -1;
	}
}
