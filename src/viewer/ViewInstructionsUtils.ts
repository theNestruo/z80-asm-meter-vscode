import Meterable from "../model/Meterable";
import { flatten } from "../utils/MeterableUtils";

export function viewInstructions(metered: Meterable): string | undefined {

	const flattenedMeterables = flatten(metered);
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
