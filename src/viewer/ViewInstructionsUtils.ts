import Meterable from "../model/Meterable";
import { flatten } from "../utils/MeterableUtils";

export function viewInstructions(meterable: Meterable): string | undefined {

	const flattenedMeterables = flatten(meterable);
	const firstInstruction = shiftFirstInstruction(flattenedMeterables);

	// (empty)
	if (!firstInstruction) {
		return undefined;
	}

	const lastInstruction = popLastInstruction(flattenedMeterables);
	let text = firstInstruction;
	if (lastInstruction) {
		if (flattenedMeterables.length) {
			text += " ...";
		}
		text += ` ${lastInstruction}`;
	}
	return text;
}

export function viewLastInstruction(meterable: Meterable): string | undefined {

	const flattenedMeterables = flatten(meterable);

	// (consumes first instruction)
	const firstInstruction = shiftFirstInstruction(flattenedMeterables);
	if (!firstInstruction) {
		return undefined;
	}

	return popLastInstruction(flattenedMeterables);
}

function shiftFirstInstruction(flattenedMeterables: Meterable[]): string | undefined {

	while (flattenedMeterables.length) {
		const instruction = flattenedMeterables.shift()?.getInstruction();
		if (instruction) {
			return instruction;
		}
	}
	return undefined;
}

function popLastInstruction(flattenedMeterables: Meterable[]): string | undefined {

	while (flattenedMeterables.length) {
		const instruction = flattenedMeterables.pop()?.getInstruction();
		if (instruction) {
			return instruction;
		}
	}
	return undefined;
}
