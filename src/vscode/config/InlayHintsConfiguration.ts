import { configurationReader } from "../ConfigurationReader";

export class InlayHintsConfiguration {

	get enabled(): boolean {
		return configurationReader.read("inlayHints.enabled");
	}

	get subroutinesPosition(): "lineStart" | "afterLabel" | "beforeCode" | "afterCode" | "beforeComment" | "insideComment" | "lineEnd" {
		return configurationReader.read("inlayHints.subroutines.position");
	}

	get subroutinesExitPointsCount(): number {
		return configurationReader.read("inlayHints.subroutines.exitPointCount");
	}

	get unlabelledSubroutines(): boolean {
		return configurationReader.read("inlayHints.subroutines.unlabelled");
	}

	get nestedSubroutines(): "disabled" | "enabled" | "entryPoint" {
		return configurationReader.read("inlayHints.subroutines.nested");
	}

	get fallthroughSubroutines(): boolean {
		return configurationReader.read("inlayHints.subroutines.fallthrough");
	}

	get exitPointPosition(): "lineStart" | "afterLabel" | "beforeCode" | "afterCode" | "beforeComment" | "insideComment" | "lineEnd" {
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

	get exitPointLabel(): "first" | "closest" {
		return configurationReader.read("inlayHints.exitPoint.label");
	}
}
