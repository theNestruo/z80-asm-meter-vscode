
[![NPM CI](https://github.com/theNestruo/z80-asm-meter-vscode/workflows/NPM%20CI/badge.svg)](https://github.com/theNestruo/z80-asm-meter-vscode/actions)
[![CodeFactor](https://www.codefactor.io/repository/github/thenestruo/z80-asm-meter-vscode/badge/master)](https://www.codefactor.io/repository/github/thenestruo/z80-asm-meter-vscode/overview/master)
[![Visual Studio Marketplace](https://vsmarketplacebadges.dev/version-short/theNestruo.z80-asm-meter.png)](https://marketplace.visualstudio.com/items?itemName=theNestruo.z80-asm-meter)

# Z80 Assembly meter in Visual Studio Code

The **Z80 Assembly meter** extension for Visual Studio Code meters clock cycles and bytecode size from Z80 assembly source code.

This extension meters timing in Z80 clock periods, referred to as T (time) cycles.

As the MSX standard requires so-called M1 wait cycles, this extension also meters M1 wait cycles for Z80 timing calculations on MSX. For a good explanation on how to do Z80 timing calculations on MSX, please read [Wait States](http://map.grauw.nl/resources/z80instr.php#waits) from Grauw [MSX Assembly Page](http://map.grauw.nl).

In Amstrad CPC architecture, all instruction timings are stretched so that they are all multiples of a microsecond (1&nbsp;&micro;s), which is approximatively equivalent to the duration of a NOP instruction. This extension can meter duration in "number of NOPs" for timing calculations on Amstrad CPC.

ZX Spectrum Next Extended Z80 Instruction Set is supported.

## Features

Select Z80 assembly source code to view clock cycles, mnemonic of the instruction, and/or bytecode size in the status bar. Click on either to copy the clock cycles and the bytecode size information to the clipboard.

![Z80 Assembly meter](doc/images/screenshot.png)
<br>_Theme: [Dark-](https://marketplace.visualstudio.com/items?itemName=theNestruo.dark-minus-theme)_

If there is no selection, the current line will be used.

## Recommendations

This extension can be installed standalone, but does not contribute any problem matcher, symbol provider, definition provider, or completion proproser for Z80 assembly.

Therefore, it is recommended to install this extension alongside other Z80-related extensions, such as:

* [Z80 Macro-Assembler](https://marketplace.visualstudio.com/items?itemName=mborik.z80-macroasm) by mborik
* [Z80 Assembly](https://marketplace.visualstudio.com/items?itemName=Imanolea.z80-asm) by Imanolea
* [MSX Z80](https://marketplace.visualstudio.com/items?itemName=sharksym.asm-msx) by Yeoungman Seo
* [pasmo](https://marketplace.visualstudio.com/items?itemName=boukichi.pasmo) by BouKiChi
* [DeZog - Z80 Debugger](https://marketplace.visualstudio.com/items?itemName=maziac.dezog) by Maziac
* (and probably others; please check the `z80-asm-meter.languageIds` setting)

## Extension Settings

This extension contributes the following settings:

### Main settings

* `z80-asm-meter.languageIds`: Additional language IDs for which the extension is enabled (such as "c", to meter in-lined assembly). Defaults to: `"asm-collection", "pasmo", "z80", "z80-asm", "z80-macroasm", "zeus-asm"`.

* `z80-asm-meter.platform`: Controls the instruction set to use and the timing information to display:
    * `z80` (default): Uses the default Z80 instruction set and shows default timing information.
    * `msx`: For MSX developers. Uses the default Z80 instruction set and shows Z80+M1 timing information (MSX standard).
    * `pc8000`: For NEC PC-8000 series developers. Uses the default Z80 instruction set and conveniently shows both default Z80 timing and Z80+M1 timing information.
    * `cpc`: For Amstrad CPC developers. Uses the default Z80 instruction set and shows timing measured in number of NOPs.
    * `z80n`: For ZX Spectrum Next developers. Includes the ZX Spectrum Next Extended Z80 instruction set and shows default timing information.

* `z80-asm-meter.directivesAsInstructions`: Controls which directives should try to be parsed as single byte instructions:
    * `none` (default): None; directives will be parsed as bytes.
    * `defs`: Tries to parse `DEFS` directive bytes as single byte instructions.

* `z80-asm-meter.viewBytes`: Enables the opcode in the status bar. Disabled by default.

* `z80-asm-meter.viewInstruction`: Enables the processed instruction in the status bar. Useful to check if the extension is mistaking instructions. Enabled by default.

*  `z80-asm-meter.debounce`: Milliseconds to prevent metering from being called too frequently when the selection changes. Defaults to: `100` (100&nbsp;ms).

### Assembler syntax related settings

* ~~`z80-asm-meter.sjasmplus`~~: Deprecated. Set `"z80-asm-meter.syntax"` to `"sjasmplus"` instead.

* `z80-asm-meter.syntax`: Adjusts the main syntax of the assembler:
    * `default` (default): Matches most assemblers.
    * `sjasmplus`: Enables support for parsing [SjASMPlus](https://github.com/sjasmplus/sjasmplus) [alternative syntax](https://z00m128.github.io/sjasmplus/documentation.html#s_asm_lang), [fake instructions](https://z00m128.github.io/sjasmplus/documentation.html#s_fake_instructions) and [pseudo-ops](https://z00m128.github.io/sjasmplus/documentation.html#s_pseudoops).
    * `glass`: Enables support for parsing [Glass Z80 assembler](http://www.grauw.nl/projects/glass/) syntax.

* `z80-asm-meter.syntax.label`: Adjusts the label detection to match the syntax of the assembler:
    * `default` (default): The labels must be followed by a colon (:) and can be indented. This behaviour matches most assemblers and coding styles.
    * `colonOptional`: The trailing colon is optional, and the labels must not be indented. This behaviour matches some assemblers such as [Pasmo](http://pasmo.speccy.org/) and [SjASMPlus](https://github.com/sjasmplus/sjasmplus).

* `z80-asm-meter.syntax.lineSeparator`: Adjusts the line separator to match the syntax of the assembler:
    * `none` (default): Does not allow multiple instructions on a single line.
    * `colon`: Use colon (`:`) to have more than one instruction on a line.
    * `pipe`: Use pipe (`|`) to have more than one instruction on a line. This behaviour matches some assemblers such as [tniASM](http://www.tni.nl/products/tniasm.html).

* `z80-asm-meter.syntax.repeat`: Enables support for parsing repeat count:
    * `none` (default): Disables repeat count.
    * `brackets`: The repeat count is specified within square brackets (`[` and `]`) before the instruction. This behaviour partially matches the source format of [Sjasm](http://www.xl2s.tk/sjasmman2.html#s3), but multiple repeat counts and iteration count are not supported.
    * `dot`: The repeat count is specified after a dot (`.`) before the instruction. This behaviour partially matches the repeat pseudo-op of [SjASMPlus](https://z00m128.github.io/sjasmplus/documentation.html#s_pseudoops), but multiple repeat counts and expressions are not supported.

### Timing related settings

* ~~`z80-asm-meter.timings.atExit`~~: Deprecated. Set `"z80-asm-meter.timings.mode"` to `"smart"` or `"all"` instead.

* `z80-asm-meter.timings.mode`: Enables alternative total timing calculation modes. See [timing modes](#timing-modes).

    * `default` (default): Disables alternative total timing calculation modes.
    * `smart`: Shows the alternative total timing calculation mode that best fits the selection.
    * `all`: Shows all the alternative total timing calculation modes that apply to the selection.

* `z80-asm-meter.timings.hints`: Enables timing hints, read from the line comment. See [timing hints](#timing-hints).

    * `none` (default): Disables timing hints.
    * `subroutine`: Subroutine timing hint will be added to `CALL`, `DJNZ`, `JP`, `JR`, `RET` or `RST` instructions only. If the timing hint is a pair of values, both will be added to the current source code block timings. If the instruction is conditional, the timing hint will be added to the _taken_ branch timing only.
    * `any`: Any timing hint will be added. This includes empty (i.e.: no actual source code) lines.

### Macro definitions

* `z80-asm-meter.macros`: An array of [user-defined macros](#macro-definitions):
    * `name`: The name of the macro.
    * `instructions`: The macro definition, as instructions for the macro. Optional.
    * `z80`: Declares or overrides Z80 default macro timing. Optional.
    * `msx`: Declares or overrides Z80+M1 macro timing information (MSX standard). Optional.
    * `cpc`: Declares or overrides macro timing measured in number of NOPs. Optional.
    * `size`: Declares or overrides macro byte count. Optional.

## Advanced usage

### Timing modes

There are three total timing calculation modes available:

![z80-asm-meter.timings.modes](doc/images/timings.modes.png)

1. **default**: The _default_ total timing calculation mode is the raw addition of the timings of the individual instructions.

2. **execution flow**: When the selection is a single subroutine (i.e.: there are no unconditional `JP`, `JR` or `RET` instructions in the selection), the _execution flow_ total timing calculation mode measures the timing of the execution flow through the selection (i.e.: to the next, non selected, instruction) by considering any `DJNZ` or conditional `JP`, `JR` or `RET` instruction as _not taken_.

3. **at exit**: When the selection is a single subroutine and the selection ends at an exit point (a conditional or unconditional `JP`, `JR` or `RET` instruction), the _at exit_ total timing calculation mode measures the timing of the execution flow to the selected exit point, by considering the last instruction as _taken_ if it is a conditional instruction.

### Timing hints

A timing hint follows the pattern: `[z80=27]` or `[msx=32/22]` with the key being:

* `z80` for Z80 timings,
* `msx` or `m1` for Z80+M1 timings,
* `cpc` for number of NOPs timings, or
* `t` or `ts` for the timing to be used regardless the platform. Specific platform timing hints will take precedence over `t` or `ts` generic timing hints.

The timing can be either a single value or a pair of values separated by slash (`/`). This is convenient for taking into account different execution paths within the called routine:

* `CALL ADD_HL_A ; [msx=32/22]` will be metered as 50/40 Z80+M1 clock cycles, as the result of adding 18(/18) + 32/22.

* `CALL Z, ADD_HL_A ; [msx=32/22]` will be metered as 50/11 Z80+M1 clock cycles, as the result of adding 18/11 + 32(/0). Please note the second timing hint (22) will be ignored in conditional operations.

For example:

![z80-asm-meter.timings.hints](doc/images/timings.hints.png)

* Of the timing hints of *.OFF_SCREEN* (41/28 clock cycles), the 41 has been added to the timing of conditional `CALL` instruction when the condition is _taken_ (18 clock cycles). Please note the second timing hint (28) has been ignored, as there is only one possible timing for the _taken_ condition path.

* The timing hint of *COORDS_TO_OFFSET* (144 clock cycles) has been added to the timing of the `CALL` instruction (18 clock cycles).

Negative timings are supported. This may seem unintuitive, but serves very particular use cases including, but not limited to:

* Adjust the timing of an instruction in self-modifying code to match the timing of the replacement instruction.

* Adjust timings when part of the code is to be skipped:

    ```asm
        ; (...)
        jr z, .else
        pop hl  ; [msx=-100] will abort caller
    .else:
        ; (...)
        ret     ; [msx=100] remaining code in the caller
    ```

### User-defined macros

Macro definitions are not read from actual source code. They must provided in user settings in order to be detected and properly metered. Macro definitions can be added to either user settings (`settings.json`) or workspace settings (`.vscode/settings.json`).

As most of the macro definition fields are optional, this extension uses a best-effort to meter a macro with the provided information. But, generally speaking, there are three ways to define a macro:

1. Macro definition with instructions. Macro will be metered by aggregating the metrics of the instructions. For example:

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

2. Macro definition with timing and size. Macro will be metered using the provided timing and/or size. For example:

    ```jsonc
    "z80-asm-meter.macros": [
        {
            "name": "ADD_HL_A",
            "z80": "24/19", // (note that there is no cpc timing,
            "msx": "28/23", //    so this macro won't be metered
            "size": 5       //    if platform=cpc)
        }
    ]
    ```

3. Macro definition with both instructions and timing and/or size. Provided timing and/or size will override the metrics of the instructions. For example:

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

Double check the `z80-asm-meter.languageIds` setting in your settings.

### My macros are not recognized

Macro definitions are not read from actual source code, but from user settings. Double check the `z80-asm-meter.macros` setting.

### How can I get clock cycles and bytecode size for in-lined assembly in my C files?

Double check the `z80-asm-meter.languageIds` setting in your settings. It has to include `c`:

```json
"z80-asm-meter.languageIds": [ "c" ],
```

### I've added `"z80-asm-meter.languageIds": [ "c", "s", "asm" ]`, but I only get clock cycles for in-lined assembly; now I don't get clock cycles in my assembly files!

The `z80-asm-meter.languageIds` setting uses language IDs, not extensions. Check the language ID of your assembly files and replace `"s"` and `"asm"` with that extension ID. Or use the default language IDs, then add `"c"`:

```json
"z80-asm-meter.languageIds": [ "asm-collection", "pasmo", "z80", "z80-asm", "z80-macroasm", "zeus-asm", "c" ],
```

## Credits

Coded by [**theNestruo**](https://github.com/theNestruo) ([Néstor Sancho](https://twitter.com/NestorSancho)).
* Contributors: [**IIIvan37**](https://github.com/IIIvan37), [**hlide**](https://github.com/hlide), [**Kris Borowinski**](https://github.com/kborowinski), [**alexanderk23**](https://github.com/alexanderk23).
* Inspired by Rafael Jannone [BiT](http://msx.jannone.org/bit/).
* [Z80 Instruction Set](http://map.grauw.nl/resources/z80instr.php) from Grauw [MSX Assembly Page](http://map.grauw.nl).
* Amstrad CPC timing information from [Z80 CPC Timings - Cheat sheet](https://wiki.octoate.de/lib/exe/fetch.php/amstradcpc:z80_cpc_timings_cheat_sheet.20131019.pdf) made by cpcitor/findyway from data at http://www.cpctech.org.uk/docs/instrtim.html.<!-- * Amstrad CPC timing information from [Rasm Z80 assembler](http://www.cpcwiki.eu/forum/programming/rasm-z80-assembler-in-beta/) documentation. -->
* ZX Spectrum Next [Extended Z80 Instruction Set](https://wiki.specnext.dev/Extended_Z80_instruction_set) from [Sinclair ZX Spectrum Next Official Developer Wiki](https://wiki.specnext.dev).
* SDCC syntax from _Z80 Instruction Set_ section from [ASZ80 Assembler](https://shop-pdp.net/ashtml/asz80.htm) documentation.
* SjASMPlus fake instructions from _Fake instructions_ section from [SjASMPlus documentation](https://z00m128.github.io/sjasmplus/documentation.html).
