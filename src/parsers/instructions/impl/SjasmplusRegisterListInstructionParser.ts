import { config } from "../../../config";
import { MeterableCollection } from "../../../types/AggregatedMeterables";
import type { Meterable } from "../../../types/Meterable";
import { OptionalSingletonRefImpl } from "../../../types/References";
import type { SourceCode } from "../../../types/SourceCode";
import { extractMnemonicOf, extractOperandsOf } from "../../../utils/AssemblyUtils";
import type { InstructionParser } from "../types/InstructionParser";
import { z80InstructionParser } from "./Z80InstructionParser";

class SjasmplusRegisterListInstructionParserRef
	extends OptionalSingletonRefImpl<InstructionParser, SjasmplusRegisterListInstructionParser> {

	protected get enabled(): boolean {
		return config.syntax.sjasmplusRegisterListInstructions;
	}

	protected override createInstance(): SjasmplusRegisterListInstructionParser {
		return new SjasmplusRegisterListInstructionParser();
	}
}

export const sjasmplusRegisterListInstructionParser = new SjasmplusRegisterListInstructionParserRef();

//

/**
 * Actual implementation of the SjASMPlus register-list instruction parser
 */
class SjasmplusRegisterListInstructionParser implements InstructionParser {

	parseInstruction(s: SourceCode): Meterable | undefined {

		// Register lists instructions
		const instruction = s.instruction;
		const mnemonic = extractMnemonicOf(instruction);
		if (!["PUSH", "POP", "INC", "DEC"].includes(mnemonic)) {
			return undefined;
		}

		const collection = new MeterableCollection();
		for (const operand of extractOperandsOf(instruction)) {
			if (operand === "") {
				continue;
			}
			const partialInstruction = `${mnemonic} ${operand}`;

			// Tries to parse Z80 instruction
			const z80Instruction = z80InstructionParser.instance.parseRawInstruction(partialInstruction);
			if (!z80Instruction) {
				// (unknown mnemonic/instruction)
				return undefined;
			}

			collection.add(z80Instruction);
		}
		return collection;
	}
}
