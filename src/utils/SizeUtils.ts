import { config } from '../config';

/*
 * Print
 */

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

