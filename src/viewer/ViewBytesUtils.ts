import Meterable from "../model/Meterable";
import { flatten } from "../utils/MeterableUtils";

export function viewSize(metered: Meterable): string | undefined {

	const size = metered.getSize();
	switch (size) {
		case 0: return undefined;
		case 1: return size + " byte";
		default: return size + " bytes";
	}
}

export function viewBytes(metered: Meterable): string | undefined {

	const flattenedMeterables = flatten(metered);
	const firstBytes = shiftFirstBytes(flattenedMeterables);

	// (empty)
	if (!firstBytes) {
		return undefined;
	}

	const lastBytes = popLastBytes(flattenedMeterables);
	let text = firstBytes.join(" ");
	if (lastBytes) {
		if (flatten.length) {
			text += " ...";
		}
		text += " " + lastBytes.join(" ");
	}
	return text;
}

function shiftFirstBytes(flattenedMeterables: Meterable[]): string[] | undefined {

	while (flattenedMeterables.length) {
		const bytes = flattenedMeterables.shift()?.getBytes();
		if (bytes && bytes.length) {
			return bytes;
		}
	}
	return undefined;
}

function popLastBytes(flattenedMeterables: Meterable[]): string[] | undefined {

	while (flattenedMeterables.length) {
		const bytes = flattenedMeterables.pop()?.getBytes();
		if (bytes && bytes.length) {
			return bytes;
		}
	}
	return undefined;
}
