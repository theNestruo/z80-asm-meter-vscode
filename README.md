
[![NPM CI](https://github.com/theNestruo/z80-asm-meter-vscode/workflows/NPM%20CI/badge.svg)](https://github.com/theNestruo/z80-asm-meter-vscode/actions)
[![CodeFactor](https://www.codefactor.io/repository/github/thenestruo/z80-asm-meter-vscode/badge/master)](https://www.codefactor.io/repository/github/thenestruo/z80-asm-meter-vscode/overview/master)
[![Visual Studio Marketplace](https://vsmarketplacebadge.apphb.com/version-short/theNestruo.z80-asm-meter.svg)](https://marketplace.visualstudio.com/items?itemName=theNestruo.z80-asm-meter)

# Z80 Assembly meter in Visual Studio Code

The **Z80 Assembly meter** extension for Visual Studio Code meters clock cycles and bytecode size from Z80 assembly source code.

This extension meters timing in Z80 clock periods, referred to as T (time) cycles.

As the MSX standard requires so-called M1 wait cycles, this extension also meters M1 wait cycles for Z80 timing calculations on MSX. For a good explanation on how to do Z80 timing calculations on MSX, please read [Wait States](http://map.grauw.nl/resources/z80instr.php#waits) from Grauw [MSX Assembly Page](http://map.grauw.nl).

In Amstrad CPC architecture, all instruction timings are stretched so that they are all multiples of a microsecond (1&micro;s), which is approximatively equivalent to the duration of a NOP instruction. This extension can meter duration in "number of NOPs" for timing calculations on Amstrad CPC.

ZX Spectrum Next Extended Z80 Instruction Set is supported.

## Features

Select Z80 assembly source code to view clock cycles, mnemonic of the instruction, and/or bytecode size in the status bar. Click on either to copy the clock cycles and the bytecode size information to the clipboard.

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

* `z80-asm-meter.macros`: An array of user-defined macros:
    * `name`: The name of the macro.
    * `instructions`: The macro definition, as instructions for the macro. Optional.
    * `z80`: Declares or overrides Z80 default macro timing. Optional.
    * `msx`: Declares or overrides Z80+M1 macro timing information (MSX standard). Optional.
    * `cpc`: Declares or overrides macro timing measured in number of NOPs. Optional.
    * `size`: Declares or overrides macro byte count. Optional.

* `z80-asm-meter.platform`: Controls the instruction set to use and the timing information to display:
    * `z80` (default): Uses the default Z80 instruction set and shows default timing information.
    * `msx`: For MSX developers. Uses the default Z80 instruction set and shows Z80+M1 timing information (MSX standard).
    * `cpc`: For Amstrad CPC developers. Uses the default Z80 instruction set and shows timing measured in number of NOPs.
    * `z80n`: For ZX Spectrum Next developers. Includes the ZX Spectrum Next Extended Z80 instruction set and shows default timing information.

* `z80-asm-meter.sjasmplus`: Enables support for parsing [SjASMPlus](https://github.com/sjasmplus/sjasmplus) [alternative syntax](https://z00m128.github.io/sjasmplus/documentation.html#s_asm_lang) and [fake instructions](https://z00m128.github.io/sjasmplus/documentation.html#s_fake_instructions). Disabled by default.

* `z80-asm-meter.syntax.label`: Adjusts the label detection to match the syntax of the assembler:
    * `default` (default): The labels must be followed by a colon (:) and can be indented. This behaviour matches most assemblers and coding styles.
    * `colonOptional`: The trailing colon is optional, and the labels must not be indented. This behaviour matches some assemblers such as [Pasmo](http://pasmo.speccy.org/) and [SjASMPlus](https://github.com/sjasmplus/sjasmplus).

* `z80-asm-meter.viewBytes`: Enables the opcode in the status bar. Disabled by default.

* `z80-asm-meter.viewInstruction`: Enables the processed instruction in the status bar. Useful to check if the extension is mistaking instructions. Enabled by default.

## Macro definitions

Macro definitions are not read from actual source code. They must provided in user settings in order to be detected and properly metered. Macro definitions can be added to either user settings (`settings.json`) or workspace settings (`.vscode/settings.json`).

As most of the macro definition fields are optional, this extension uses a best-effort to meter a macro with the provided information. But, generally speaking, there are three ways to define a macro:

1. Macro definition with instructions. Macro will be metered by aggregating the metrics of the instructions.

    ```jsonc
    "z80-asm-meter.macros": [
        {
            "name": "ADD_HL_A",
            "instructions": [
                "ADD A, L",
                "LD L, A",
                "JR NC, zz",
                "INC H"
            ]
        }
    ]
    ```

2. Macro definition with timing and size. Macro will be metered using the provided timing and/or size.

    ```jsonc
    "z80-asm-meter.macros": [
        {
            "name": "ADD_HL_A",
            "z80": "24/19", // (note that there is no cpc timing,
            "msx": "28/23", // so this macro won't be metered
            "size": 5       // if platform=cpc)
        }
    ]
    ```

3. Macro definition with both instructions and timing and/or size. Provided timing and/or size will override the metrics of the instructions.

    ```jsonc
    "z80-asm-meter.macros": [
        {
            "name": "ADD_HL_A",
            "instructions": [
                "ADD A, L", "LD L, A", "JR NC, zz", "INC H"
            ],
            "msx": "23" // (overrides actual timing for platform=msx)
        }
    ]
    ```

## F.A.Q.

### The status bar does not display any information. I don't get clock cycles and bytecode size!

Double check the `z80-asm-meter.languageIds` setting.

### My macros are not recognized

Macro definitions are not read from actual source code, but from user settings. Double check the `z80-asm-meter.macros` setting.

## Credits

Coded by [**theNestruo**](https://github.com/theNestruo) ([Néstor Sancho](https://twitter.com/NestorSancho)).
* Contributors: [**IIIvan37**](https://github.com/IIIvan37), [**hlide**](https://github.com/hlide), [**Kris Borowinski**](https://github.com/kborowinski), [**alexanderk23**](https://github.com/alexanderk23).
* Inspired by Rafael Jannone [BiT](http://msx.jannone.org/bit/).
* [Z80 Instruction Set](http://map.grauw.nl/resources/z80instr.php) from Grauw [MSX Assembly Page](http://map.grauw.nl).
* Amstrad CPC timing information from [Z80 CPC Timings - Cheat sheet](https://wiki.octoate.de/lib/exe/fetch.php/amstradcpc:z80_cpc_timings_cheat_sheet.20131019.pdf) made by cpcitor/findyway from data at http://www.cpctech.org.uk/docs/instrtim.html.<!-- * Amstrad CPC timing information from [Rasm Z80 assembler](http://www.cpcwiki.eu/forum/programming/rasm-z80-assembler-in-beta/) documentation. -->
* ZX Spectrum Next [Extended Z80 Instruction Set](https://wiki.specnext.dev/Extended_Z80_instruction_set) from [Sinclair ZX Spectrum Next Official Developer Wiki](https://wiki.specnext.dev).
* SDCC syntax from _Z80 Instruction Set_ section from [ASZ80 Assembler](https://shop-pdp.net/ashtml/asz80.htm) documentation.
* SjASMPlus fake instructions from _Fake instructions_ section from [SjASMPlus documentation](https://z00m128.github.io/sjasmplus/documentation.html).
