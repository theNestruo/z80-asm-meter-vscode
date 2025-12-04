/**
 * RegExp-based user-defined timing hints
 */
export interface TimingHintsDefinitionConfiguration {

	/**
	 * The pattern of the regular expression to match against the line comment
	 */
	pattern: RegExp;

	/**
	 * The string indicating the flags of the regular expression
	 */
	flags: string | undefined;

	/**
	 * Declares or overrides Z80 default macro timing (optional)
	 */
	z80: number | string | undefined;

	/**
	 * Declares or overrides Z80+M1 macro timing information (MSX standard) (optional)
	 */
	msx: number | string | undefined;

	/**
	 * Declares or overrides Z80+M1 macro timing information (MSX standard) (optional)
	 */
	m1: number | string | undefined;

	/**
	 * Declares or overrides macro timing measured in number of NOPs (optional)
	 */
	cpc: number | string | undefined;

	/**
	 * Declares or overrides default macro timing (optional)
	 */
	ts: number | string | undefined;

	/**
	 * Declares or overrides default macro timing (optional)
	 */
	t: number | string | undefined;
}
