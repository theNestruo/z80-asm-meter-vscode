import { AbstractInstruction } from "./AbstractInstruction";
import { extractRawInstructionFrom, parseTimingsLenient } from "./utils";
import { Z80Instruction } from "./Z80Instruction";
import { Z80InstructionParser } from "./Z80InstructionParser";

export class Macro extends AbstractInstruction {

	// User-provided information
	private name: string;
	private z80Timing: number[] | undefined;
	private msxTiming: number[] | undefined;
	private cpcTiming: number[] | undefined;
	private size: number | undefined;
	private rawInstructions: string[] | undefined;

	// Information
    private instructionSets: string[];

	// Derived information (will be cached for performance reasons)
	private instructions: Z80Instruction[] | undefined;
    public bytes: string | undefined;

	public constructor(source: any, instructionSets: string[]) {
		super();

		this.name = source.name;
		this.z80Timing = parseTimingsLenient(source.z80);
		this.msxTiming = parseTimingsLenient(source.msx);
		this.cpcTiming = parseTimingsLenient(source.cpc);
		this.size = parseInt(source.size);
		this.rawInstructions = source.instructions;

		this.instructionSets = instructionSets;
	}

	public getInstruction(): string {

		return this.name;
	}

    public getInstructions(): Z80Instruction[] | undefined {

		if (this.rawInstructions === undefined) {
			return undefined;
		}
		if (this.rawInstructions.length == 0) {
			return [];
		}

		// Cached
		if (this.instructions !== undefined) {
			return this.instructions;
		}

		// Computed, then cached
		var lInstructions: Z80Instruction[] = [];
		this.rawInstructions.forEach(rawPart => {
			const rawInstruction = extractRawInstructionFrom(rawPart);
			var lInstruction = Z80InstructionParser.instance.parseInstruction(rawInstruction, this.instructionSets);
			if (lInstruction) {
				// (should never be undefined)
				lInstructions.push(lInstruction);
			}
		});
		return this.instructions = lInstructions;
    }

    /**
     * @returns The Z80 timing, in time (T) cycles
     */
	public getZ80Timing(): number[] {

		// User-provided (or cached)
		if (this.z80Timing !== undefined) {
			return this.z80Timing;
		}

		// Computed, then cached
		var lZ80Timing = [0, 0];
		const lInstructions = this.getInstructions() || [];
		lInstructions.forEach(instruction => {
			const instructionZ80Timing = instruction.getZ80Timing();
			lZ80Timing[0] += instructionZ80Timing[0];
			lZ80Timing[1] += instructionZ80Timing[1];
		});
		return this.z80Timing = lZ80Timing;
	 }

	 /**
	  * @returns The Z80 timing with the M1 wait cycles required by the MSX standard
	  */
	 public getMsxTiming(): number[] {

		// User-provided (or cached)
		if (this.msxTiming !== undefined) {
			return this.msxTiming;
		}

		// Computed, then cached
		var lMsxTiming = [0, 0];
		const lInstructions = this.getInstructions() || [];
		lInstructions.forEach(instruction => {
			const instructionMsxTiming = instruction.getMsxTiming();
			lMsxTiming[0] += instructionMsxTiming[0];
			lMsxTiming[1] += instructionMsxTiming[1];
		});
		return this.msxTiming = lMsxTiming;
	 }

	 /**
	  * @returns The CPC timing, in NOPS
	  */
	 public getCpcTiming(): number[] {

		// User-provided (or cached)
		if (this.cpcTiming !== undefined) {
			return this.cpcTiming;
		}

		// Computed, then cached
		var lCpcTiming = [0, 0];
		const lInstructions = this.getInstructions() || [];
		lInstructions.forEach(instruction => {
			const instructionCpcTiming = instruction.getCpcTiming();
			lCpcTiming[0] += instructionCpcTiming[0];
			lCpcTiming[1] += instructionCpcTiming[1];
		});
		return this.cpcTiming = lCpcTiming;
	 }

	 /**
	  * @returns The bytes of the instruction
	  */
	 public getBytes(): string {

		// User-provided (or cached)
		if (this.bytes !== undefined) {
			return this.bytes;
		}

		// Computed (from size), then cached
		const lInstructions = this.getInstructions();
		if (lInstructions === undefined) {
			const lSize = this.getSize();
			return this.bytes = new Array(lSize).fill("n").join(" ");
		}

		// Computed (from instructions), then cached
		var lBytes: string[] = [];
		lInstructions.forEach(instruction => {
			lBytes.push(instruction.getBytes());
		});
		return this.bytes = lBytes.join(" ");
	 }

	 /**
	  * @returns The size in bytes
	  */
	 public getSize(): number {

		// User-provided (or cached)
		if ((this.size !== undefined) && (!isNaN(this.size))) {
			return this.size;
		}

		// Computed, then cached
		var lSize = 0;
		const lInstructions = this.getInstructions() || [];
		lInstructions.forEach(instruction => {
			const instructionSize = instruction.getSize();
			lSize += instructionSize;
		});
		return this.size = lSize;
	 }
 }