import { Meterable } from "../model/Meterables";

export function formatHexadecimalByte(n: number): string {

    const s = "00" + ((n & 0xff).toString(16).toUpperCase());
    return s.substring(s.length - 2);
}

export function printHumanReadableBytes(meterable: Meterable): string | undefined {

	const meterables = [...meterable.flatten()];
	const firstBytes = shiftFirstBytes(meterables);

	// (empty)
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
		if (bytes && bytes.length) {
			return bytes;
		}
	}
	return undefined;
}

function popLastBytes(meterables: Meterable[]): string[] | undefined {

	while (meterables.length) {
		const bytes = meterables.pop()?.bytes;
		if (bytes && bytes.length) {
			return bytes;
		}
	}
	return undefined;
}
