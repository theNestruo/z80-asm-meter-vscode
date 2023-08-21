import { extractMnemonicOf, extractOperandsOf } from "../../utils/utils";
import NumericExpressionParser from "../NumericExpressionParser";

export default class GlassReptParser {

    // Singleton
    static instance = new GlassReptParser();

	parseRept(instruction: string): number | undefined {

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
        return repetitions && repetitions > 0 ? repetitions : 1;
	}

	parseEndm(instruction: string): boolean {

		const mnemonic = extractMnemonicOf(instruction);
		return mnemonic === "ENDM";
	}
}
