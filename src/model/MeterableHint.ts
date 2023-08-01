import { extractMnemonicOf, extractOperandsOf, parseTimingsLenient, parteIntLenient, undefinedIfNaN } from "../utils/utils";
import Meterable from "./Meterable";

export default class MeterableHint implements Meterable {

	/**
	 * Conditionaly builds an instance of a repetition of Meterables
	 * @param meterable The meterable instance
	 * @param rawComment The line comment; can contain timing hints
	 * @return The meterable instance, or a hinted meterable instance,
	 * depending on the contents of the line comment
	 */
	static of(rawComment: string | undefined): MeterableHint | undefined {

		// (sanity check)
		if (!rawComment) {
			return undefined;
		}

		// Checks timing hint comment
		const matches = rawComment?.matchAll(/\[(ts?|z80|cpc|msx)\s*=\s*((?:\-\s*)?\d+(?:\/(?:\-\s*)?\d+)?)\]/g);
		if (!matches) {
			return undefined;
		}

		// Parses timing hint comment
		var timingHint: number[] | undefined;
		var z80TimingHint: number[] | undefined;
		var msxTimingHint: number[] | undefined;
		var cpcTimingHint: number[] | undefined;
		for (const match of matches) {
			const parsedTimingHint = parseTimingsLenient(match[2]);
			if (!parsedTimingHint) {
				continue;
			}

			switch (match[1]) {
				case "t":
				case "ts":
					timingHint = parsedTimingHint;
					break;
				case "z80":
					z80TimingHint = parsedTimingHint;
					break;
				case "cpc":
					cpcTimingHint = parsedTimingHint;
					break;
				case "msx":
					msxTimingHint = parsedTimingHint;
					break;
			}
		}

		// Validates timing hint comment
		if (!timingHint && !z80TimingHint && !msxTimingHint && !cpcTimingHint) {
			return undefined;
		}

		return new MeterableHint(
				timingHint, z80TimingHint, msxTimingHint, cpcTimingHint);
	}

    // Information
	private timingHint: number[];
    private z80TimingHint: number[] | undefined;
    private msxTimingHint: number[] | undefined;
    private cpcTimingHint: number[] | undefined;

	private constructor(
			timingHint: number[] | undefined,
			z80TimingHint: number[] | undefined,
			msxTimingHint: number[] | undefined,
			cpcTimingHint: number[] | undefined) {

		this.timingHint = timingHint || [0, 0];
		this.z80TimingHint = z80TimingHint;
		this.msxTimingHint = msxTimingHint;
		this.cpcTimingHint = cpcTimingHint;
	}

	getInstruction(): string {
		return "";
	}

	getZ80Timing(): number[] {

		return this.z80TimingHint || this.timingHint;
	}

	getMsxTiming(): number[] {

		return this.msxTimingHint || this.timingHint;
	}

	getCpcTiming(): number[] {

		return this.cpcTimingHint || this.timingHint;
	}

	getBytes(): string[] {

		return [];
	}

	getSize(): number {

		return 0;
	}

	isComposed(): boolean {
		return false;
	}

	getFlattenedMeterables(): Meterable[] {
		return [];
	}
}
