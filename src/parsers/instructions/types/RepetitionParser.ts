/**
 * A repetition parser
 */
export interface RepetitionParser {

	parseBeginRepetition(instruction: string): number | undefined;

	parseEndRepetition(instruction: string): boolean;
}
