import Meterable from "../model/Meterable";
import { flatten } from "../utils/MeterableUtils";

export function viewStatusBarSize(meterable: Meterable): string | undefined {

	const size = meterable.getSize();
	switch (size) {
		case 0: return undefined;
		case 1: return size + " byte";
		default: return size + " bytes";
	}
}

export function viewTooptipSize(meterable: Meterable): string {

	const size = viewStatusBarSize(meterable);
	return size
			? `|||\n|:---|:---:|\n|Size|**${size}**|\n`
			: "";
}

export function viewBytes(meterable: Meterable): string | undefined {

	const flattenedMeterables = flatten(meterable);
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
