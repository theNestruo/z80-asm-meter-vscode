import { Meterable } from "../model/Meterables";

export function printHumanReadableInstructions(meterable: Meterable): string | undefined {

	const meterables = [...meterable.flatten()];
	const firstInstruction = shiftFirstInstruction(meterables);

	// (empty)
	if (!firstInstruction) {
		return undefined;
	}

	const lastInstruction = popLastInstruction(meterables);
	let text = firstInstruction;
	if (lastInstruction) {
		if (meterables.length) {
			text += " ...";
		}
		text += ` ${lastInstruction}`;
	}
	return text;
}


function shiftFirstInstruction(meterables: Meterable[]): string | undefined {

	while (meterables.length) {
		const instruction = meterables.shift()?.instruction;
		if (instruction) {
			return instruction;
		}
	}
	return undefined;
}

function popLastInstruction(meterables: Meterable[]): string | undefined {

	while (meterables.length) {
		const instruction = meterables.pop()?.instruction;
		if (instruction) {
			return instruction;
		}
	}
	return undefined;
}
