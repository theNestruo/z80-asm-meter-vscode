import * as vscode from 'vscode';
import { config } from "../config";
import { Meterable } from "../types/Meterable";

export const hrMarkdown = "\n---\n\n";

// Numbers

export function formatHexadecimalNumber(n: number): string {

	return n.toString(16).toUpperCase();
}

export function formatHexadecimalByte(n: number): string {

	const s = "00" + ((n & 0xff).toString(16).toUpperCase());
	return s.substring(s.length - 2);
}

// Timing

export function formatTiming(t: number[]): string {

	return t[0] === t[1] ? t[0].toString() : t[0] + "/" + t[1];
}

export function printableTimingSuffix() {

	return config.platform === "cpc" ? " NOPs" : "clock cycles";
}

export function printTiming(meterable: Meterable): string | undefined {

	// timing depending on the platform
	const timing =
		config.platform === "msx" ? meterable.msxTiming
		: config.platform === "cpc" ? meterable.cpcTiming
		: meterable.z80Timing;

	// (no data)
	if (!timing) {
		return undefined;
	}

	// As text
	const text = formatTiming(timing);

	// Special case: NEC PC-8000 series dual timing
	if (config.platform !== "pc8000") {
		return text;
	}
	const m1Text = formatTiming(meterable.msxTiming);
	return `${text} (${m1Text})`;
}

// Size

export function printSize(n: number): string {

	const dec = n.toString();
	if (n < 10) {
		return dec;
	}

	switch (config.statusBar.sizeNumericFormat) {
		default:
		case "decimal":
			return dec;

		case "hexadecimal":
			return formatHexadecimalSize(n);

		case "both":
			return `${dec} (${formatHexadecimalSize(n)})`;
	}
}

function formatHexadecimalSize(n: number): string {

	const hex = config.statusBar.sizeHexadecimalFormat.startsWith("uppercase")
			? n.toString(16).toUpperCase()
			: n.toString(16).toLowerCase();

	switch (config.statusBar.sizeHexadecimalFormat) {
		case "hash":
		case "uppercaseHash":
			return `#${hex}`;

		default:
		case "motorola":
		case "uppercaseMotorola":
			return `$${hex}`;

		case "intel":
		case "uppercaseIntel":
			return "0123456789".includes(hex.charAt(0))
				? `${hex}h`
				: `0${hex}h`;

		case "intelUppercase":
		case "uppercaseIntelUppercase":
			return "0123456789".includes(hex.charAt(0))
				? `${hex}H`
				: `0${hex}H`;

		case "cStyle":
		case "uppercaseCStyle":
			return `0x${hex}`;
	}
}

// Bytes

export function printBytes(meterable: Meterable): string | undefined {

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

// Positions and ranges

export function printPosition(position: vscode.Position): string {

	return `#${position.line + 1}`;
}

export function printRange(range: vscode.Range): string {

	return range.isSingleLine
		? printPosition(range.start)
		: `#${range.start.line + 1}&nbsp;&ndash;&nbsp;#${range.end.line + 1}`;
}
