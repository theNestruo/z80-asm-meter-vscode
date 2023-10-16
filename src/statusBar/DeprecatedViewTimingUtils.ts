import { workspace } from "vscode";
import { Meterable } from "../model/Meterable";
import { formatTiming } from "../utils/TimingUtils";
import { config } from "../config";

// export function viewTooltipTimings(meterables: Meterable[]): string {

// 	// Header
// 	let text =
// 		config.platform === "msx" ? "||MSX (Z80+M1)|Z80||\n|:---|:---:|:---:|:---|\n"
// 			: config.platform === "cpc" ? "||Amstrad CPC|Z80|\n|:---|:---:|:---:|\n"
// 				: config.platform === "pc8000" ? "||Z80|Z80+M1||\n|:---|:---:|:---:|:---|\n"
// 					: "||Z80||\n|:---|:---:|:---|\n";

// 	// Rows
// 	meterables.forEach(meterable => {
// 		const description = /* meterable instanceof TimingDecorator
// 			? meterable.getDescription()
// 			: */ "Total timing";
// 		text += `|${description}`;
// 		const z80text = formatTiming(meterable.z80Timing);
// 		if (config.platform === "msx") {
// 			const msxText = formatTiming(meterable.msxTiming);
// 			text += `|**${msxText}**|${z80text}|clock cycles|\n`;
// 		} else if (config.platform === "cpc") {
// 			const cpcText = formatTiming(meterable.cpcTiming);
// 			text += `|**${cpcText} NOPs**|${z80text} clock cycles|\n`;
// 		} else if (config.platform === "pc8000") {
// 			const m1Text = formatTiming(meterable.msxTiming);
// 			text += `|**${z80text}**|${m1Text}|clock cycles|\n`;
// 		} else {
// 			text += `|**${z80text}**|clock cycles|\n`;
// 		}
// 	});

// 	return text;
// }

export function viewTimingToCopy(meterable: Meterable): string | undefined {

	const text = buildStatusBarTiming(meterable);
	if (text === undefined) {
		return undefined;
	}

	// As text, with suffix
	return text + ((config.platform === "cpc") ? " NOPs" : " clock cycles");
}

export function viewTimingToCopyAsHints(meterable: Meterable): string {

	if (config.platform === "msx") {
		const msxText = formatTiming(meterable.msxTiming);
		return `[msx=${msxText}]`;
	}
	if (config.platform === "cpc") {
		const cpcText = formatTiming(meterable.cpcTiming);
		return `[cpc=${cpcText}]`;
	}
	const z80text = formatTiming(meterable.z80Timing);
	let text = `[z80=${z80text}]`;
	if (config.platform === "pc8000") {
		const m1Text = formatTiming(meterable.msxTiming);
		text += ` [m1=${m1Text}]`;
	}
	return text;
}

function buildStatusBarTiming(meterable: Meterable): string | undefined {

	const text = buildBasicTiming(meterable);
	if (!text) {
		return undefined;
	}

	if (config.platform !== "pc8000") {
		return text;
	}

	const m1Text = formatTiming(meterable.msxTiming);
	return `${text} / ${m1Text}`;
}

function buildBasicTiming(meterable: Meterable): string | undefined {

	const timing = config.platform === "msx" ? meterable.msxTiming
		: config.platform === "cpc" ? meterable.cpcTiming
			: meterable.z80Timing;

	// (no data)
	if ((!timing)
		|| (timing.length < 2)
		|| ((timing[0] === 0) && (timing[1] === 0))) {
		return undefined;
	}

	// As text
	return formatTiming(timing);
}
