import { Meterable } from "../model/Meterable";
import { SourceCode } from "../model/SourceCode";
import { TimingHints } from "../model/TimingHints";
import { extractMnemonicOf, extractOperandsOf } from "../utils/AssemblyUtils";
import { NumericExpressionParser } from "../utils/NumberUtils";

export interface InstructionParser {

	get isEnabled(): boolean;

	parse(s: SourceCode): Meterable | undefined;
}

export interface RepetitionParser {

	get isEnabled(): boolean;

	parse(instruction: string): number | undefined;

	parseEnd(instruction: string): boolean;
}

export interface TimingHintsParser {

	get isEnabled(): boolean;

	parse(s: SourceCode): TimingHints | undefined;
}

export abstract class AbstractRepetitionParser implements RepetitionParser {

	readonly expectedMnemonic: string;

	readonly expectedEndMnemonic: string;

	constructor(mnemonic: string, mnemonicEnd: string) {
		this.expectedMnemonic = mnemonic;
		this.expectedEndMnemonic = mnemonicEnd;
	}

	abstract get isEnabled(): boolean;

	parse(instruction: string): number | undefined {

		const mnemonic = extractMnemonicOf(instruction);
		if (mnemonic !== this.expectedMnemonic) {
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

	parseEnd(instruction: string): boolean {

		return extractMnemonicOf(instruction) === this.expectedEndMnemonic;
	}

}
