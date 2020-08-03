var comments    = XRegExp("^(?<code>[^;]+)(;.*)?$");
var label       = XRegExp("^(?<label>[A-Za-z]+)\\:.*$");
var instr       = XRegExp("^([A-Za-z]+\\:[ \\t]*)?(?<instr>[^:]+)$");
var instrFormat = XRegExp("^(?<mnemonic>[A-Za-z]+)(?<instrBody>.*)$");

var instrMap    = {
    ADD:   [XRegExp("^(?<mnemonic>ADD)[ \\t]+\\$(?<d>[0-9]+)[ \\t]+\\$(?<s>[0-9]+)[ \\t]+\\$(?<t>[0-9]+)$"), instrChecker0],
    ADDI:  [XRegExp("^(?<mnemonic>ADDI)[ \\t]+\\$(?<d>[0-9]+)[ \\t]+\\$(?<s>[0-9]+)[ \\t]+#(?<i>-?[0-9]+)$"), instrChecker0],
    SUB:   [XRegExp("^(?<mnemonic>SUB)[ \\t]+\\$(?<d>[0-9]+)[ \\t]+\\$(?<s>[0-9]+)[ \\t]+\\$(?<t>[0-9]+)$"), instrChecker0],
    AND:   [XRegExp("^(?<mnemonic>AND)[ \\t]+\\$(?<d>[0-9]+)[ \\t]+\\$(?<s>[0-9]+)[ \\t]+\\$(?<t>[0-9]+)$"), instrChecker0],
    ANDI:  [XRegExp("^(?<mnemonic>ANDI)[ \\t]+\\$(?<d>[0-9]+)[ \\t]+\\$(?<s>[0-9]+)[ \\t]+#(?<u>[0-9]+)$"), instrChecker0],
    OR:    [XRegExp("^(?<mnemonic>OR)[ \\t]+\\$(?<d>[0-9]+)[ \\t]+\\$(?<s>[0-9]+)[ \t]+\$(?<t>[0-9]+)$"), instrChecker0],
    ORI:   [XRegExp("^(?<mnemonic>ORI)[ \t]+\\$(?<d>[0-9]+)[ \\t]+\\$(?<s>[0-9]+)[ \\t]+#(?<u>[0-9]+)$"), instrChecker0],
    XOR:   [XRegExp("^(?<mnemonic>XOR)[ \\t]+\\$(?<d>[0-9]+)[ \\t]+\\$(?<s>[0-9]+)[ \\t]+\\$(?<t>[0-9]+)$"), instrChecker0],
    SLL:   [XRegExp("^(?<mnemonic>SLL)[ \\t]+\\$(?<d>[0-9]+)[ \\t]+\\$(?<s>[0-9]+)[ \\t]+#(?<u>[0-9]+)$"), instrChecker0],
    SRL:   [XRegExp("^(?<mnemonic>SRL)[ \\t]+\\$(?<d>[0-9]+)[ \\t]+\\$(?<s>[0-9]+)[ \\t]+#(?<u>[0-9]+)$"), instrChecker0],
    SLLV:  [XRegExp("^(?<mnemonic>SLLV)[ \\t]+\\$(?<d>[0-9]+)[ \\t]+\\$(?<s>[0-9]+)[ \\t]+\\$(?<t>[0-9]+)$"), instrChecker0],
    SRLV:  [XRegExp("^(?<mnemonic>SRLV)[ \\t]+\\$(?<d>[0-9]+)[ \\t]+\\$(?<s>[0-9]+)[ \\t]+\\$(?<t>[0-9]+)$"), instrChecker0],
    CMP:   [XRegExp("^(?<mnemonic>CMP)[ \\t]+\\$(?<d>[0-9]+)[ \\t]+\\$(?<s>[0-9]+)[ \\t]+\\$(?<t>[0-9]+)$"), instrChecker0],
    MUL:   [XRegExp("^(?<mnemonic>MUL)[ \\t]+\\$(?<d>[0-9]+)[ \\t]+\\$(?<s>[0-9]+)[ \\t]+\\$(?<t>[0-9]+)$"), instrChecker0],
    DIV:   [XRegExp("^(?<mnemonic>DIV)[ \\t]+\\$(?<d>[0-9]+)[ \\t]+\\$(?<s>[0-9]+)[ \\t]+\\$(?<t>[0-9]+)$"), instrChecker0],

    J:     [XRegExp("^(?<mnemonic>J)[ \\t]+(#(?<i>-?[0-9]+)|(?<l>[A-Za-z]+))$"), instrChecker1],
    JR:    [XRegExp("^(?<mnemonic>JR)[ \\t]+\\$(?<s>[0-9]+)$"), instrChecker0],
    BBR:   [XRegExp("^(?<mnemonic>BBR)[ \\t]+\\$(?<s>[0-9]+)[ \\t]+\\$(?<t>[0-9]+)$"), instrChecker0],
    BBO:   [XRegExp("^(?<mnemonic>BBO)[ \\t]+\\$(?<s>[0-9]+)[ \\t]+(#(?<i>-?[0-9]+)|(?<l>[A-Za-z]+))$"), instrChecker1],

    SW:    [XRegExp("^(?<mnemonic>SW)[ \\t]+\\$(?<s>[0-9]+)[ \\t]+\\$(?<t>[0-9]+)[ \\t]+#(?<i>-?[0-9]+)$"), instrChecker0],
    LW:    [XRegExp("^(?<mnemonic>LW)[ \\t]+\\$(?<d>[0-9]+)[ \\t]+\\$(?<s>[0-9]+)[ \\t]+#(?<i>-?[0-9]+)$"), instrChecker0],

    LC:    [XRegExp("^(?<mnemonic>LC)[ \\t]+\\$(?<d>[0-9]+)[ \\t]+(#(?<i>-?[0-9]+)|(?<l>[A-Za-z]+))$"), instrChecker1],
    MV:    [XRegExp("^(?<mnemonic>MV)[ \\t]+\\$(?<d>[0-9]+)[ \\t]+\\$(?<s>[0-9]+)$"), instrChecker0],
    CT:	   [XRegExp("^(?<mnemonic>CT)[ \\t]+(#(?<i>-?[0-9]+)|(?<l>[A-Za-z]+))$"), instrChecker2],
    CMPLT: [XRegExp("^(?<mnemonic>CMPLT)[ \\t]+\\$(?<d>[0-9]+)[ \\t]+\\$(?<s>[0-9]+)[ \\t]+\\$(?<t>[0-9]+)$"), instrChecker0],
    HALT:  [XRegExp("^(?<mnemonic>HALT)$"), instrChecker0]
};

var arithImmBitSize = 16;
var arithUImmRange  = [0, (2 << arithImmBitSize) - 1];
var arithSImmRange  = [- (2 << (arithImmBitSize - 1)), (2 << (arithImmBitSize - 1)) - 1];
var ctImmBitSize    = 32;
var ctImmRange      = [- (2 << (ctImmBitSize - 1)), (2 << (ctImmBitSize - 1)) - 1];

function instrChecker2(lineNo,
                       match,
                       instructions,
                       labels,
                       unseenLabels,
                       errors) {
    // Checker for CT instruction
    var outInstr = {
        operation: match.mnemonic,
        breakpoint: false,
        code: match.input
    };

    if (match.i !== undefined) {
        var i = parseInt(match.i);
        if(i < arithSImmRange[0] || i > arithSImmRange[1]) {
            errors.push("Line " + lineNo + ": Signed immediate out of " +
                "range, acceptable values are " + arithSImmRange[0] +
                " <= reg <= " + arithSImmRange[0]);
        } else {
            outInstr.signedImm = i;
        }
    } else {
        // Process the label
        var l = match.l;
        if (!(l in labels)) {
            unseenLabels[l] = lineNo;
        }
        outInstr.l = l;
    }

    instructions.push(outInstr);
};

function instrChecker1(lineNo,
                       match,
                       instructions,
                       labels,
                       unseenLabels,
                       errors) {
    // Checker for BBO, J and LC instructions
    var outInstr = {
        operation: match.mnemonic,
        breakpoint: false,
        code: match.input
    };

    if(match.d !== undefined) {
        var d = parseInt(match.d);
        if (d >= Processor.TOT_REGS || d < 0) {
            errors.push("Line " + lineNo + ": Destination register out of " +
                "range, acceptable values are 0 <= reg < " +
                Processor.TOT_REGS);
        } else {
            outInstr.d = d;
        }
    }

    if (match.s !== undefined) {
        var s = parseInt(match.s);
        if (s >= Processor.TOT_REGS || s < 0) {
            errors.push("Line " + lineNo + ": First operand register out of " +
                "range, acceptable values are 0 <= reg < " +
                Processor.TOT_REGS);
        } else {
            outInstr.s = s;
        }
    }

    if (match.i !== undefined) {
        var i = parseInt(match.i);
        if(i < arithSImmRange[0] || i > arithSImmRange[1]) {
            errors.push("Line " + lineNo + ": Signed immediate out of " +
                "range, acceptable values are " + arithSImmRange[0] +
                " <= reg <= " + arithSImmRange[0]);
        } else {
            outInstr.signedImm = i;
        }
    } else {
        // Process the label
        var l = match.l;
        if (!(l in labels)) {
            unseenLabels[l] = lineNo;
        }
        outInstr.l = l;
    }

    instructions.push(outInstr);
};

function instrChecker0(lineNo,
                       match,
                       instructions,
                       labels,
                       unseenLabels,
                       errors) {
    var outInstr = {
        operation: match.mnemonic,
        breakpoint: false,
        code: match.input
    };

    if(match.d !== undefined) {
        var d = parseInt(match.d);
        if (d >= Processor.TOT_REGS || d < 0) {
            errors.push("Line " + lineNo + ": Destination register out of " +
                "range, acceptable values are 0 <= reg < " +
                Processor.TOT_REGS);
        } else {
            outInstr.d = d;
        }
    }

    if (match.s !== undefined) {
        var s = parseInt(match.s);
        if (s >= Processor.TOT_REGS || s < 0) {
            errors.push("Line " + lineNo + ": First operand register out " +
                "of range, acceptable values are 0 <= reg < " +
                Processor.TOT_REGS);
        } else {
            outInstr.s = s;
        }
    }

    if (match.t !== undefined) {
        var t = parseInt(match.t);
        if (t >= Processor.TOT_REGS || t < 0) {
            errors.push("Line " + lineNo + ": Second operand register out " +
                "of range, acceptable values are 0 <= reg < " +
                Processor.TOT_REGS);
            return;
        } else {
            outInstr.t = t;
        }
    }

    if (match.u !== undefined) {
        var u = parseInt(match.u);
        if(u < arithUImmRange[0] || u > arithUImmRange[1]) {
            errors.push("Line " + lineNo + ": Unsigned immediate out of " +
                "range, acceptable values are " + arithUImmRange[0] +
                " <= reg <= " + arithUImmRange[0]);
        } else {
            outInstr.unsignedImm = u;
        }
    }

    if (match.i !== undefined) {
        var i = parseInt(match.i);
        if(i < arithSImmRange[0] || i > arithSImmRange[1]) {
            errors.push("Line " + lineNo + ": Signed immediate out of " +
                "range, acceptable values are " + arithSImmRange[0] +
                " <= reg <= " + arithSImmRange[0]);
        } else {
            outInstr.signedImm = i;
        }
    }

    instructions.push(outInstr);
};

// Resolve the label (if any) to avoid complications in the IssueDecode
// pipeline stage. This should only occur in J, BBO and LC
function resolveLabels(instructions, labels) {
    for (var i = 0; i < instructions.length; ++i) {
        var instr     = instructions[i];
        if (!("l" in instr)) {
            continue;
        }

        var instrAddr = i;
        var labelAddr = labels[instr.l];
        if (instr.operation == "LC" || instr.operation == "CT") {
            // CT, LC: use the label address itself
            instr.signedImm = labelAddr;
        } else {
            // BBO, J: use instrAddr + offset == labelAddr
            instr.signedImm = labelAddr - instrAddr;
        }
    }
};

function asmSyntaxChecker(asmCode) {
    // Output instructions
    var instructions = []
    var labels = {}
    var errors = []
    var unseenLabels = {};

    var codeLines = asmCode.split("\n");
    for (var i = 0; i < codeLines.length; i++) {
        var lineNo  = i + 1;

        // Remove all comments from the code
        var match = XRegExp.exec(codeLines[i], comments);
        if (match == null) {
            continue;
        }
        var codeLine = match.code.trim();
        if (codeLine.length < 1) {
            continue;
        }

        // Get labels
        match = XRegExp.exec(codeLine, label);
        if (match != null) {
            // Check if definition already exists
            if (match.label in labels) {
                errors.push("Line " + lineNo + ": Redefinition of label '" +
                    match.label + "'. Previous definition at line " +
                    labels[match.label]);
                continue;
            }
            // Keep track of label
            labels[match.label] = instructions.length
            // Remove label from unseenLabels if it was previously referenced
            if (match.label in unseenLabels) {
                delete unseenLabels[match.label];
            }
        }

        // Get instruction
        match = XRegExp.exec(codeLine, instr);
        if (match == null) {
            continue;
        }
        codeLine = match.instr.trim();

        // Get the instruction mnemonic
        match = XRegExp.exec(codeLine, instrFormat);
        if (match == null || !(match.mnemonic in instrMap)) {
            errors.push("Line " + lineNo + ": Invalid instruction mnemonic");
            continue;
        }

        // Ensure that mnemonic is case insensitive
        var mnemonic = match.mnemonic.toUpperCase()
        codeLine = mnemonic + match.instrBody;

        // Match the instruction against its expected format
        match = XRegExp.exec(codeLine, instrMap[mnemonic][0]);
        if (match == null) {
            errors.push("Line " + lineNo + ": Instruction '" + mnemonic +
                "' does not match expected format");
            continue;
        }

        // Check instruction for errors
        instrMap[mnemonic][1](lineNo, match, instructions, labels,
            unseenLabels, errors);
    }

    for (var l in unseenLabels) {
        errors.push("Label '" + l + "' used in line " + unseenLabels[l] +
            ", but never defined");
    }

    if (errors.length == 0) {
        resolveLabels(instructions, labels);
    }

    return {
        instructions: instructions,
        labels      : labels,
        errors      : errors,
        rawAsmCode  : asmCode
    };
};

function assembleAndReport(editor, aceConsole) {
    var session = aceConsole.session;
    var results = asmSyntaxChecker(editor.getValue());
    var resultStatus = "SUCCESS: Terminated without errors";

    // Print opening message
    session.insert({
            row: session.getLength(),
            column: 0
        },
        "\nStarting assembly process...\n"
    );

    // Print all errors
    for (var message in results.errors) {
        session.insert({
                row: session.getLength(),
                column: 0
            },
            "ERROR: " + results.errors[message] + "\n"
        );
    }

    if (results.errors.length > 0) {
        resultStatus = "FAIL: Please fix your program before you can " +
            "proceed to simulation";
    }

    // Print final message
    session.insert({
            row: session.getLength(),
            column: 0
        },
        resultStatus + "\n==Assembly process terminated==\n"
    );

    // Scroll to end of text
    aceConsole.scrollToLine(50, true, true, function () {});

    return results;
};
