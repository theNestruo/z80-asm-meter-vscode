import SourceCodePart from "./SourceCodePart";

/**
 * A container for a source code line: source code parts and trailing comment
 */
export default class SourceCodeLine {

	/** The source code parts */
	private parts: string[] = [];

	/** The trailing comment */
	private comment: string | undefined;

	constructor(parts?: string[], comment?: string) {

		this.parts = parts ? parts : [];
		this.comment = comment;
	}

	addPart(part: string): boolean {

		// (sanity check)
		if (!part) {
			return false;
		}

		this.parts.push(part);
		return true;
	}

	getParts(): SourceCodePart[] {

		if (this.parts.length) {
			const sourceCodeParts: SourceCodePart[] = [];
			this.parts.forEach(part => sourceCodeParts.push(new SourceCodePart(part, this.comment)));
			return sourceCodeParts;
		}

		// Preserves emtpy line (i.e.: no source code parts) line comments
		return !!this.comment
				? [new SourceCodePart("", this.comment)]
				: [];
	}

	getPartsAsString(): string[] {
		return this.parts;
	}

	setComment(comment: string): boolean {

		// (sanity check)
		if (!comment) {
			return false;
		}

		this.comment = comment;
		return true;
	}

	getComment(): string | undefined {
		return this.comment;
	}
}
