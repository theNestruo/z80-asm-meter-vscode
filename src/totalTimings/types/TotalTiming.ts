import type { Meterable } from "../../types/Meterable";

/**
 * Any total timing calculation
 */
export interface TotalTiming extends Meterable {

	readonly name: string;
	readonly statusBarIcon: string;
}
