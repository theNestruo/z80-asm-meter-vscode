import * as vscode from 'vscode';
import { config } from "../config";
import { Meterable } from '../types';
import { TotalTimingMeterable } from '../totalTiming/TotalTimingMeterable';
import { TotalTimings } from '../totalTiming/TotalTimings';
import { spaceIfNotInfix, pluralize } from "./TextUtils";

// Numbers

export function formatHexadecimalNumber(n: number): string {

	return n.toString(16).toUpperCase();
}

export function formatHexadecimalByte(n: number): string {

	const s = "00" + ((n & 0xff).toString(16).toUpperCase());
	return s.substring(s.length - 2);
}

// Status bar

export function printStatusBarText(totalTimings: TotalTimings): string {

	// Builds the statur bar text
	let text = "";

	if (config.statusBar.showInstruction) {
		text += printStatusBarInstructions(totalTimings.default);
	}

	const timing = printStatusBarTotalTimings(totalTimings);
	if (timing) {
		const timingsIcon = spaceIfNotInfix(config.statusBar.timingsIcon);
		text += `${timingsIcon}${timing}`;
	}

	const size = totalTimings.default.size;
	if (size) {
		text += printStatusBarSize(size);
		if (config.statusBar.showBytes) {
			const bytes = printBytes(totalTimings.default);
			if (bytes) {
				text += ` (${bytes})`;
			}
		}
	}

	return text.trim().replace(/\s+/, " ");
}

function printStatusBarInstructions(meterable: Meterable): string {

	const instruction = printInstructions(meterable);
	if (!instruction) {
		return "";
	}

	const instructionIcon = spaceIfNotInfix(config.statusBar.instructionIcon);
	return `${instructionIcon}${instruction}`;
}

function printStatusBarTotalTimings(totalTimings: TotalTimings): string {

	switch (config.statusBar.totalTimings) {
		case "all":
		case "combineAll":
			return printStatusBarTotalTimingsArray(totalTimings.ordered());

		case "smart":
		case "combineSmart": {
			const [a, b, c, d] = totalTimings.ordered();
			return totalTimings.executionFlow || totalTimings.atExit
				? printStatusBarTotalTimingsArray([b, c, d])
				: printStatusBarTotalTimingsArray([ a ]);
		}

		case "best":
			return printStatusBarTotalTimingsArray([ totalTimings.best() ]);

		case "default":
		default:
			return printStatusBarTotalTimingsArray([ totalTimings.default ]);
	}
}

function printStatusBarTotalTimingsArray(totalTimings: (TotalTimingMeterable | undefined)[]): string {

	let text = "";

	let previousIcon = "";
	let previousValue = "";
	totalTimings.forEach(totalTiming => {
		if (!totalTiming) {
			return;
		}
		const icon = totalTiming.statusBarIcon;
		const value = printTiming(totalTiming) || "0";

		// Combines when the previous timing when they have the same values
		if (!config.statusBar.totalTimingsCombined) {
			text += `${icon}${value} `;

		} else {
			// Same as previous timing?
			if (value === previousValue) {
				// Combines the decoration
				previousIcon += icon;

			} else {
				// Preserves the previous timing entry
				if (previousIcon || previousValue) {
					text += `${previousIcon}${previousValue} `;
				}
				// Aggregates a new timing entry
				previousIcon = icon;
				previousValue = value;
			}
		}
	});
	if (config.statusBar.totalTimingsCombined) {
		text += `${previousIcon}${previousValue} `;
	}
	return text.trim();
}

function printStatusBarSize(n: number): string {

	const sizeIcon = spaceIfNotInfix(config.statusBar.sizeIcon);
	const formattedSize = printSize(n);
	const sizeSuffix = pluralize(config.statusBar.sizeSuffix, n);
	return `${sizeIcon}${formattedSize}${sizeSuffix}`;
}

// Status bar: tooltip (Markdown)

export function printTooltipMarkdown(totalTimings: TotalTimings): string[] {

	// Timing
	const markdown = printMarkdownTotalTimingsArray(totalTimings.ordered());

	// (separator)
	markdown.push(hrMarkdown);

	// Instruction and/or size
	const instruction = printInstructions(totalTimings.default);
	const size = totalTimings.default.size;
	if (instruction || size) {
		markdown.push("|||");
		markdown.push("|---|---|");
		if (instruction) {
			markdown.push(`|Instructions:|\`${instruction}\`|`);
		}
		if (size) {
			const formattedSize = printSize(size);
			const sizeSuffix = pluralize(" byte| bytes", size);
			const bytes = printBytes(totalTimings.default);
			markdown.push(bytes
				? `|Bytes:|${formattedSize}${sizeSuffix} (\`${bytes}\`)|`
				: `|Bytes:|${formattedSize}${sizeSuffix}|`);
		}
	}
	return markdown;
}

export const hrMarkdown = "\n---\n\n";

function printMarkdownTotalTimingsArray(
	totalTimings: (TotalTimingMeterable | undefined)[]): string[] {

	const platform = config.platform;
	const hasM1 = platform === "msx" || platform === "pc8000";
	const timingSuffix = printableTimingSuffix();

	const table =
		platform === "msx" ? [ "|||MSX|Z80||", "|--:|:--|--:|--:|---|" ]
		: platform === "pc8000" ? [ "|||Z80|Z80+M1||", "|--:|:--|--:|--:|---|" ]
		: [ "|||||", "|--:|:--|--:|---|" ];

	for (const totalTiming of totalTimings) {
		if (!totalTiming) {
			continue;
		}

		const value = formatTiming(totalTiming.z80Timing);
		const m1Value = formatTiming(totalTiming.msxTiming);
		if (!value && (!hasM1 || !m1Value)) {
			continue;
		}

		switch (platform) {
			case 'msx':
				table.push(`|${totalTiming.statusBarIcon}|${totalTiming.name}|**${m1Value}**|${value}|${timingSuffix}|`);
				break;
			case 'pc8000':
				table.push(`|${totalTiming.statusBarIcon}|${totalTiming.name}|**${value}**|${m1Value}|${timingSuffix}|`);
				break;
			default:
				table.push(`|${totalTiming.statusBarIcon}|${totalTiming.name}|**${value}**|${timingSuffix}|`);
				break;
		}
	}

	return table;
}

// Instructions

function printInstructions(meterable: Meterable): string | undefined {

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

// Timing

export function formatTiming(t: number[]): string {

	return t[0] === t[1] ? t[0].toString() : t[0] + "/" + t[1];
}

export function printableTimingSuffix() {

	return config.platform === "cpc" ? " NOPs" : " clock cycles";
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

function printSize(n: number): string {

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

	return `Line #${position.line + 1}`;
}

export function printRange(range: vscode.Range): string {

	return range.isSingleLine
		? printPosition(range.start)
		: `Lines #${range.start.line + 1} - #${range.end.line + 1}`;
}
