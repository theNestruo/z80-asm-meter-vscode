export function moveToFirst<T>(array: T[], i: number): T[] {

	const n = array.length;
	if (!n || i < 1 || i >= n) {
		return array;
	}
	array.unshift(...array.splice(i, 1));
	return array;
}
