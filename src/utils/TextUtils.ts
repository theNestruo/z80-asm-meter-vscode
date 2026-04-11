// (used instead of /\s/ for performance reasons)
export const whitespaceCharacters = new Set([
	"\f", "\n", "\r", "\t", "\v",
	"\u0020", "\u00a0",
	"\u1680",
	"\u2000", "\u2001", "\u2002", "\u2003", "\u2004", "\u2005", "\u2006", "\u2007", "\u2008", "\u2009", "\u200a",
	"\u2028", "\u2029", "\u202f", "\u205f", "\u3000", "\ufeff"]);

export function isEmptyOrBlank(s: string | undefined): boolean {

	if (!s) {
		return true;
	}

	const n = s.length;
	for (let i = 0; i < n; i++) {
		if (!whitespaceCharacters.has(s[i])) {
			return false;
		}
	}
	return true;
}

export function toUpperCaseCharacter(c: string): string {

	// (for performance reasons)
	return (c >= 'a' && c <= 'z')
		? String.fromCharCode(c.charCodeAt(0) - 0x20)
		: c;
}

export function hashCode(s: string): number {

	if (!s.length) {
		return 0;
	}

	const n = s.length;
	let hash = 0;
	for (let i = 0; i < n; i++) {
		hash = ((hash << 5) - hash) + s.charCodeAt(i);
		hash |= 0; // (as 32 bit integer)
	}
	return hash;
}

export function spaceIfNotInfix(s: string): string {

	return s.trim().includes(" ") ? s : ` ${s.trim()} `;
}

export function pluralize(s: string, n: number): string {

	const split = s.split("|", 2);
	if (split.length === 1) {
		return s;
	}
	return (n === 1) || (n === -1) ? split[0] : split[1];
}

export function removeSuffix(s: string | undefined, suffix: string): string | undefined {

	return s?.endsWith(suffix)
		? s.substring(0, s.length - suffix.length)
		: s;
}

export function positionFromStart(_: string, start?: number): number {

	return (start === undefined) || (start < 0)
		? 0
		: start;
}

export function positionFromStartAndSkipWhitespaceAfter(s: string, start?: number): number {

	const substring = (start === undefined) || (start < 0) ? s : s.substring(start);
	return s.length - substring.trimStart().length;
}

export function positionFromEnd(s: string, end?: number): number {

	return (end === undefined) || (end < 0)
		? s.length
		: end;
}

export function positionFromEndAndSkipWhitespaceBefore(s: string, end?: number): number {

	const substring = (end === undefined) || (end < 0) ? s : s.substring(0, end);
	return substring.trimEnd().length;
}

export function validateCodicon(ps: string | undefined, defaultCodicon: string): string {

	const s = ps?.trim();
	return (s?.startsWith("$(") && s.endsWith(")")) ? s : defaultCodicon;
}

export const hrMarkdown = "\n---\n\n";
