import { TotalTiming } from "./TotalTiming";

/**
 * "Execution flow to the selected exit point" total timing calculation
 */
export interface AtExitTotalTiming extends TotalTiming {

	readonly isLastInstructionRet: boolean;
	readonly isLastInstructionJump: boolean;
	readonly isLastInstructionCall: boolean;
}
