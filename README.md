[![Travis-CI](https://travis-ci.org/theNestruo/z80-asm-meter-vscode.svg?branch=master)](https://travis-ci.org/theNestruo/z80-asm-meter-vscode)
[![CodeFactor](https://www.codefactor.io/repository/github/thenestruo/z80-asm-meter-vscode/badge/master)](https://www.codefactor.io/repository/github/thenestruo/z80-asm-meter-vscode/overview/master)
[![Visual Studio Marketplace](https://vsmarketplacebadge.apphb.com/version-short/theNestruo.z80-asm-meter.svg)](https://marketplace.visualstudio.com/items?itemName=theNestruo.z80-asm-meter)

# Z80 Assembly meter in Visual Studio Code

The **Z80 Assembly meter** extension for Visual Studio Code meters clock cycles and bytecode size from Z80 assembly source code.

This extension meters timing in Z80 clock periods, referred to as T (time) cycles.

As the MSX standard requires so-called M1 wait cycles, this extension also meters M1 wait cycles for Z80 timing calculations on MSX. For a good explanation on how to do Z80 timing calculations on MSX, please read [Wait States](http://map.grauw.nl/resources/z80instr.php#waits) from Grauw [MSX Assembly Page](http://map.grauw.nl).

In Amstrad CPC architecture, all instruction timings are stretched so that they are all multiples of a microsecond (1&#00B5;s), which is approximatively equivalent to the duration of a NOP instruction. This extension can meter duration in "number of NOPs" for timing calculations on Amstrad CPC.

ZX Spectrum Next Extended Z80 Instruction Set is supported.

## Features

Select Z80 assembly source code to view clock cycles, mnemonic of the instruction, and/or bytecode size in the status bar.

![Z80 Assembly meter](doc/images/screenshot.png)

If there is no selection, the current line will be used.

## Recommendations

This extension can be installed standalone, but does not contribute any problem matcher, symbol provider, definition provider, or completion proproser for Z80 assembly.

Therefore, this extension can be installed alongside other Z80-related extensions such as:

* [Z80 Macro-Assembler](https://marketplace.visualstudio.com/items?itemName=mborik.z80-macroasm) by mborik
* [Z80 Assembly](https://marketplace.visualstudio.com/items?itemName=Imanolea.z80-asm) by Imanolea
* [MSX Z80](https://marketplace.visualstudio.com/items?itemName=sharksym.asm-msx) by Yeoungman Seo
* [pasmo](https://marketplace.visualstudio.com/items?itemName=boukichi.pasmo) by BouKiChi
* [DeZog - Z80 Debugger](https://marketplace.visualstudio.com/items?itemName=maziac.dezog) by Maziac
* (and probably others; please check the `z80-asm-meter.languageIds` setting)

## Extension Settings

This extension contributes the following settings:

* `z80-asm-meter.languageIds`: Additional language IDs for which the extension is enabled (such as "c", to meter in-lined assembly). Defaults to: `"asm-collection", "pasmo", "z80", "z80-asm", "z80-macroasm", "zeus-asm"`.

* `z80-asm-meter.maxLines`: When working with huge files, metering can be disabled when the line count of the selection exceeds a certain threshold. Unlimited by default.

* `z80-asm-meter.maxLoC`: Stops metering when the parsed lines of code (LoC) count exceeds a certain threshold. Unlimited by default.

* `z80-asm-meter.maxOpcodes`: Stops instruction and opcode block visualization (in the tooltip) when the instruction count exceeds this value. Defaults to 16.

* `z80-asm-meter.platform`: Controls the instruction set to use and the timing information to display:
    * `z80` (default): Uses the default Z80 instruction set and shows default timing information.
    * `msx`: For MSX developers. Uses the default Z80 instruction set and shows Z80+M1 timing information (MSX standard).
    * `cpc`: For Amstrad CPC developers. Uses the default Z80 instruction set and shows timing measured in number of NOPs.
    * `z80n`: For ZX Spectrum Next developers. Includes the ZX Spectrum Next Extended Z80 instruction set and shows default timing information.

* `z80-asm-meter.viewBytecodeSize`: Enables the bytecode size information in the status bar. Enabled by default.

* `z80-asm-meter.viewInstruction`: Enables the processed instruction in the status bar. Useful to check if the extension is mistaking instructions. Disabled by default.

* `z80-asm-meter.viewLoC`: Enables the processed lines of code (LOC) count in the status bar. Disabled by default.

* `z80-asm-meter.viewOpcode`: Enables the opcode in the status bar. Disabled by default.

Deprecated settings:

* ~~`z80-asm-meter.timing`~~: Use `z80-asm-meter.platform` setting instead.

* ~~`z80-asm-meter.size`~~: Use `z80-asm-meter.viewBytecodeSize` and `z80-asm-meter.viewLoC` settings instead.

* ~~`z80-asm-meter.opcode`~~: Use `z80-asm-meter.viewInstruction` and `z80-asm-meter.viewOpcode` settings instead.

## Credits

Coded by [**theNestruo**](https://github.com/theNestruo) ([Néstor Sancho](https://twitter.com/NestorSancho)).
* Contributors: [**IIIvan37**](https://github.com/IIIvan37), [**hlide**](https://github.com/hlide), [**Kris Borowinski**](https://github.com/kborowinski).
* Inspired by Rafael Jannone [BiT](http://msx.jannone.org/bit/).
* [Z80 Instruction Set](http://map.grauw.nl/resources/z80instr.php) from Grauw [MSX Assembly Page](http://map.grauw.nl).
* Amstrad CPC timing information from [Z80 CPC Timings - Cheat sheet](https://wiki.octoate.de/lib/exe/fetch.php/amstradcpc:z80_cpc_timings_cheat_sheet.20131019.pdf) made by cpcitor/findyway from data at http://www.cpctech.org.uk/docs/instrtim.html.<!-- * Amstrad CPC timing information from [Rasm Z80 assembler](http://www.cpcwiki.eu/forum/programming/rasm-z80-assembler-in-beta/) documentation. -->
* ZX Spectrum Next [Extended Z80 Instruction Set](https://wiki.specnext.dev/Extended_Z80_instruction_set) from [Sinclair ZX Spectrum Next Official Developer Wiki](https://wiki.specnext.dev).
