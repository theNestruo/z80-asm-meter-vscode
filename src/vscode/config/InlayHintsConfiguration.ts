import { configurationReader } from "../ConfigurationReader";

export type InlayHintPositionType = "lineStart" | "afterLabel" | "beforeCode" | "afterCode" | "beforeComment" | "insideComment" | "lineEnd";

export type NestedSubroutinesType = "disabled" | "enabled" | "entryPoint";

export type ExitPointLabelType = "first" | "closest";

export class InlayHintsConfiguration {

	get enabled(): boolean {
		return configurationReader.read("inlayHints.enabled");
	}

	get subroutinesPosition(): InlayHintPositionType {
		return configurationReader.read("inlayHints.subroutines.position");
	}

	get subroutinesExitPointsCount(): number {
		return configurationReader.read("inlayHints.subroutines.exitPointCount");
	}

	get unlabelledSubroutines(): boolean {
		return configurationReader.read("inlayHints.subroutines.unlabelled");
	}

	get nestedSubroutines(): NestedSubroutinesType {
		return configurationReader.read("inlayHints.subroutines.nested");
	}

	get fallthroughSubroutines(): boolean {
		return configurationReader.read("inlayHints.subroutines.fallthrough");
	}

	get exitPointPosition(): InlayHintPositionType {
		return configurationReader.read("inlayHints.exitPoint.position");
	}

	get exitPointSubroutinesThreshold(): number {
		return configurationReader.read("inlayHints.exitPoint.subroutinesThreshold");
	}

	get exitPointLinesThreshold(): number {
		return configurationReader.read("inlayHints.exitPoint.linesThreshold");
	}

	get exitPointSubroutinesCount(): number {
		return configurationReader.read("inlayHints.exitPoint.subroutinesCount");
	}

	get exitPointRet(): boolean {
		return configurationReader.read("inlayHints.exitPoint.ret");
	}

	get exitPointJp(): boolean {
		return configurationReader.read("inlayHints.exitPoint.jp");
	}

	get exitPointJr(): boolean {
		return configurationReader.read("inlayHints.exitPoint.jr");
	}

	get exitPointDjnz(): boolean {
		return configurationReader.read("inlayHints.exitPoint.djnz");
	}

	get exitPointLabel(): ExitPointLabelType {
		return configurationReader.read("inlayHints.exitPoint.label");
	}
}
