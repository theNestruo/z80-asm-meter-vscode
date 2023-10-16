/**
 * A container for source code: a source code part and the trailing comment of the entire line
 */
export default class SourceCodePart {

	private part: string;
	private comment: string | undefined;

	constructor(part: string, comment?: string) {
		this.part = part;
		this.comment = comment;
	}

	getPart(): string {
		return this.part;
	}

	getComment(): string | undefined {
		return this.comment;
	}
}

