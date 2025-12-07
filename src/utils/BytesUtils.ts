import type { Meterable } from "../types/Meterable";

/*
 * Print
 */

export function printBytes(meterable: Meterable): string | undefined {

	const meterables = [...meterable.flatten()];
	const firstBytes = shiftFirstBytes(meterables);

	// (sanity check)
	if (!firstBytes) {
		return undefined;
	}

	const lastBytes = popLastBytes(meterables);
	let text = firstBytes.join(" ");
	if (lastBytes) {
		if (meterables.length) {
			text += " ...";
		}
		text += " " + lastBytes.join(" ");
	}
	return text;
}

function shiftFirstBytes(meterables: Meterable[]): string[] | undefined {

	while (meterables.length) {
		const bytes = meterables.shift()?.bytes;
		if (bytes?.length) {
			return bytes;
		}
	}
	return undefined;
}

function popLastBytes(meterables: Meterable[]): string[] | undefined {

	while (meterables.length) {
		const bytes = meterables.pop()?.bytes;
		if (bytes?.length) {
			return bytes;
		}
	}
	return undefined;
}
