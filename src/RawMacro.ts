export interface RawMacro {
	name: string;
	z80: number | string | undefined;
	msx: number | string | undefined;
	cpc: number | string | undefined;
	size: number | string | undefined;
	instructions: string[] | undefined;
}
