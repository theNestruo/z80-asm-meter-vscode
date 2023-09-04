import Meterable from "../../model/Meterable";
import { flatten } from "../../utils/MeterableUtils";

export default abstract class TimingDecorator implements Meterable {

	// The meterable instance to be decorated
	private decoratedMeterable: Meterable;

	// Derived information (will be cached for performance reasons)
	private cachedZ80Timing: number[] | undefined;
	private cachedMsxTiming: number[] | undefined;
	private cachedCpcTiming: number[] | undefined;
	private cachedMeterables: Meterable[] | undefined;

	protected constructor(meterable: Meterable) {

		this.decoratedMeterable = meterable;
	}

	getInstruction(): string {
		return this.decoratedMeterable.getInstruction();
	}

	getZ80Timing(): number[] {

		if (!this.cachedZ80Timing) {
			const meterables = this.getFlattenedMeterables();
			let i = 0;
			const n = meterables.length;
			var totalZ80Timing: number[] = [0, 0];
			meterables.forEach(meterable => {
				const z80Timing = this.modifiedTimingsOf(
					meterable.getZ80Timing(), i++, n, meterable.getInstruction());
				totalZ80Timing[0] += z80Timing[0];
				totalZ80Timing[1] += z80Timing[1];
			});
			this.cachedZ80Timing = totalZ80Timing;
		}
		return this.cachedZ80Timing;
	}

	getMsxTiming(): number[] {

		if (!this.cachedMsxTiming) {
			const meterables = this.getFlattenedMeterables();
			let i = 0;
			const n = meterables.length;
			var totalMsxTiming: number[] = [0, 0];
			meterables.forEach(meterable => {
				const msxTiming = this.modifiedTimingsOf(
					meterable.getMsxTiming(), i++, n, meterable.getInstruction());
				totalMsxTiming[0] += msxTiming[0];
				totalMsxTiming[1] += msxTiming[1];
			});
			this.cachedMsxTiming = totalMsxTiming;
		}
		return this.cachedMsxTiming;
	}

	getCpcTiming(): number[] {

		if (!this.cachedCpcTiming) {
			const meterables = this.getFlattenedMeterables();
			let i = 0;
			const n = meterables.length;
			var totalCpcTiming: number[] = [0, 0];
			meterables.forEach(meterable => {
				const cpcTiming = this.modifiedTimingsOf(
					meterable.getCpcTiming(), i++, n, meterable.getInstruction());
				totalCpcTiming[0] += cpcTiming[0];
				totalCpcTiming[1] += cpcTiming[1];
			});
			this.cachedCpcTiming = totalCpcTiming;
		}
		return this.cachedCpcTiming;
	}

	getBytes(): string[] {
		return this.decoratedMeterable.getBytes();
	}

	getSize(): number {
		return this.decoratedMeterable.getSize();
	}

	isComposed(): boolean {
		return true;
	}

	getFlattenedMeterables(): Meterable[] {

		if (!this.cachedMeterables) {
			this.cachedMeterables = flatten(this.decoratedMeterable);
		}
		return this.cachedMeterables;
	}

	protected abstract modifiedTimingsOf(timing: number[],
		i: number, n: number, instruction: string): number[];
}
