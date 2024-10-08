import { Meterable } from "../types";

export abstract class TotalTimingMeterable implements Meterable {

	// The original meterable instance
	protected originalMeterable: Meterable;

	// Derived information (will be cached for performance reasons)
	private cachedZ80Timing?: number[];
	private cachedMsxTiming?: number[];
	private cachedCpcTiming?: number[];

	protected constructor(meterable: Meterable) {

		this.originalMeterable = meterable;
	}

	abstract get name(): string;

	abstract get statusBarIcon(): string;

	get instruction(): string {
		return this.originalMeterable.instruction;
	}

	get z80Timing(): number[] {

		if (!this.cachedZ80Timing) {
			const meterables = this.flatten();
			let i = 0;
			const n = meterables.length;
			const totalZ80Timing: number[] = [0, 0];
			meterables.forEach(meterable => {
				const z80Timing = this.modifiedTimingsOf(
					meterable.z80Timing, i++, n, meterable.instruction);
				totalZ80Timing[0] += z80Timing[0];
				totalZ80Timing[1] += z80Timing[1];
			});
			this.cachedZ80Timing = totalZ80Timing;
		}
		return this.cachedZ80Timing;
	}

	get msxTiming(): number[] {

		if (!this.cachedMsxTiming) {
			const meterables = this.flatten();
			let i = 0;
			const n = meterables.length;
			const totalMsxTiming: number[] = [0, 0];
			meterables.forEach(meterable => {
				const msxTiming = this.modifiedTimingsOf(
					meterable.msxTiming, i++, n, meterable.instruction);
				totalMsxTiming[0] += msxTiming[0];
				totalMsxTiming[1] += msxTiming[1];
			});
			this.cachedMsxTiming = totalMsxTiming;
		}
		return this.cachedMsxTiming;
	}

	get cpcTiming(): number[] {

		if (!this.cachedCpcTiming) {
			const meterables = this.flatten();
			let i = 0;
			const n = meterables.length;
			const totalCpcTiming: number[] = [0, 0];
			meterables.forEach(meterable => {
				const cpcTiming = this.modifiedTimingsOf(
					meterable.cpcTiming, i++, n, meterable.instruction);
				totalCpcTiming[0] += cpcTiming[0];
				totalCpcTiming[1] += cpcTiming[1];
			});
			this.cachedCpcTiming = totalCpcTiming;
		}
		return this.cachedCpcTiming;
	}

	get bytes(): string[] {
		return this.originalMeterable.bytes;
	}

	get size(): number {
		return this.originalMeterable.size;
	}

	flatten(): Meterable[] {
		return this.originalMeterable.flatten();
	}

	get isComposed(): boolean {
		return this.originalMeterable.isComposed;
	}

	protected abstract modifiedTimingsOf(timing: number[],
		i: number, n: number, instruction: string): number[];
}
