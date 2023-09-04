import { extractMnemonicOf, extractOperandsOf } from "../../utils/AssemblyUtils";
import NumericExpressionParser from "../NumericExpressionParser";

export default class GlassReptParser {

	static parseRept(instruction: string): number | undefined {

		const mnemonic = extractMnemonicOf(instruction);
		if (mnemonic !== "REPT") {
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

	static parseEndm(instruction: string): boolean {

		const mnemonic = extractMnemonicOf(instruction);
		return mnemonic === "ENDM";
	}
}
