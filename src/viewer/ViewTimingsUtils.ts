import { workspace } from "vscode";
import Meterable from "../model/Meterable";
import TimingDecorator from "../timing/modes/TimingDecorator";
import { formatTiming } from "../utils/NumberUtils";

export function viewStatusBarTimings(meterables: Meterable[]): string {

	let text = "";

	// Combines the decorated timings when they have the same values
	let currentDecoration = "";
	let currentTiming = "";
	for (let i = 0, n = meterables.length; i < n; i++) {
		const meterable = meterables[i];
		const decoration = meterable instanceof TimingDecorator ? meterable.getIcon() : "";
		const timing = buildStatusBarTiming(meterable) || "0";

		// Same as previous timing?
		if (currentTiming === timing) {
			// Combines the decoration
			currentDecoration += decoration;

		} else {
			// Aggregates a new timing entry
			if (currentDecoration || currentTiming) {
				text += `${currentDecoration}${currentTiming} `;
			}
			currentDecoration = decoration;
			currentTiming = timing;
		}
	}
	text += `${currentDecoration}${currentTiming} `;
	return text;
}

export function viewTooltipTimings(meterables: Meterable[]): string {

	// Reads relevant configuration
	const platformConfiguration: string =
		workspace.getConfiguration("z80-asm-meter").get("platform", "z80");

	// Header
	let text =
		platformConfiguration === "msx" ? "||MSX (Z80+M1)|Z80||\n|:---|:---:|:---:|:---|\n"
		: platformConfiguration === "cpc" ? "||Amstrad CPC|Z80|\n|:---|:---:|:---:|\n"
		: platformConfiguration === "pc8000" ? "||Z80|Z80+M1||\n|:---|:---:|:---:|:---|\n"
		: "||Z80||\n|:---|:---:|:---|\n";

	// Rows
	meterables.forEach(meterable => {
		const description = meterable instanceof TimingDecorator
			? meterable.getDescription()
			: "Total timings";
		text += `|${description}`;
		const z80text = formatTiming(meterable.getZ80Timing());
		if (platformConfiguration === "msx") {
			const msxText = formatTiming(meterable.getMsxTiming());
			text += `|**${msxText}**|${z80text}|clock cycles|\n`;
		} else if (platformConfiguration === "cpc") {
			const cpcText = formatTiming(meterable.getCpcTiming());
			text += `|**${cpcText} NOPs**|${z80text} clock cycles|\n`;
		} else if (platformConfiguration === "pc8000") {
			const m1Text = formatTiming(meterable.getMsxTiming());
			text += `|**${z80text}**|${m1Text}|clock cycles|\n`;
		} else {
			text += `|**${z80text}**|clock cycles|\n`;
		}
	});

	return text;
}

export function viewTimingsToCopy(meterable: Meterable): string | undefined {

	const text = buildStatusBarTiming(meterable);
	if (text === undefined) {
		return undefined;
	}

	// Reads relevant configuration
	const platformConfiguration: string =
		workspace.getConfiguration("z80-asm-meter").get("platform", "z80");

	// As text, with suffix
	return text + ((platformConfiguration === "cpc") ? " NOPs" : " clock cycles");
}

export function viewTimingsToCopyAsHints(meterable: Meterable): string {

	// Reads relevant configuration
	const platformConfiguration: string =
		workspace.getConfiguration("z80-asm-meter").get("platform", "z80");

	if (platformConfiguration === "msx") {
		const msxText = formatTiming(meterable.getMsxTiming());
		return `[msx=${msxText}]`;
	}
	if (platformConfiguration === "cpc") {
		const cpcText = formatTiming(meterable.getCpcTiming());
		return `[cpc=${cpcText}]`;
	}
	const z80text = formatTiming(meterable.getZ80Timing());
	let text = `[z80=${z80text}]`;
	if (platformConfiguration === "pc8000") {
		const m1Text = formatTiming(meterable.getMsxTiming());
		text += ` [m1=${m1Text}]`;
	}
	return text;
}

function buildStatusBarTiming(meterable: Meterable): string | undefined {

	const text = buildBasicTiming(meterable);
	if (!text) {
		return undefined;
	}

	// Reads relevant configuration
	const platformConfiguration: string =
		workspace.getConfiguration("z80-asm-meter").get("platform", "z80");

	if (platformConfiguration !== "pc8000") {
		return text;
	}

	const m1Text = formatTiming(meterable.getMsxTiming());
	return `${text} / ${m1Text}`;
}

function buildBasicTiming(meterable: Meterable): string | undefined {

	// Reads relevant configuration
	const platformConfiguration: string =
		workspace.getConfiguration("z80-asm-meter").get("platform", "z80");

	const timing = platformConfiguration === "msx" ? meterable.getMsxTiming()
		: platformConfiguration === "cpc" ? meterable.getCpcTiming()
			: meterable.getZ80Timing();

	// (no data)
	if ((!timing)
		|| (timing.length < 2)
		|| ((timing[0] === 0) && (timing[1] === 0))) {
		return undefined;
	}

	// As text
	return formatTiming(timing);
}
