function Processor(initialData) {
    this.memory = new Memory(initialData.instructions, initialData.labels);
    this.regs   = new RegisterFile(Processor.TOT_REGISTERS, Processor.PC_REGISTER);
    this.halted = false;

    // Pipeline stage modules
    this.exec        = Array.apply(null, Array(Processor.TOT_EXEC)).map(
        function() {
            return new Execute(this);
        },
        this
    );
    this.memAccess   = Array.apply(null, Array(Processor.TOT_MEM)).map(
        function() {
            return new MemoryAccess(this);
        },
        this
    );
    this.fetch       = new Fetch(this);
    this.issueDecode = new IssueDecode(this);
    this.writeback   = new Writeback(this);
    this.commit      = new Commit(this);

    // execUnits reservation stations
    this.execRs   = new ReservationStation(
        Processor.RS_PER_EXEC * Processor.TOT_EXEC
    );
    // memUnit reservation stations
    this.loadRs   = new ReservationStation(
        Processor.RS_PER_EXEC * Processor.TOT_MEM
    );
    this.storeRs  = new ReservationStation(
        Processor.RS_PER_STOREQ
    );
    // branch reservation stations
    this.branchRs = new ReservationStation(
        Processor.RS_PER_BRANCH
    );

    // Other components
    this.instrBuff  = Array.apply(null, Array(Processor.INSTR_BUFF_SIZE)).map(
        function() {
            return null;
        }
    );
    this.rob             = new ReorderBuffer(this, Processor.ROB_SIZE);
    this.rnt             = new RenameTable(Processor.TOT_REGISTERS);
    this.branchPredictor = new BranchPredictor(Processor.BRANCH_TABLE_SIZE);
    this.cdb             = new CommonDataBus(
        this.exec.length + this.memAccess.length
    );

    // Keep track of instructions executed
    this.instrExecCnt  = 0;
    this.instrExecLog  = new ExecutionLog();

    // Collect data about branch prediction performance
    this.passBPredictions = 0;
    this.failBPredictions = 0;

    // Total number of cycles simulated
    this.cycleCnt = 0;

    // For debugging we have this flag that is set during
    // issue-decode stage that tells us when we hit a breakpoint
    this.breakpointHit = false;

    // The raw assembly code that is being simulated
    this.rawAsmCode = initialData.rawAsmCode;
};

Processor.prototype.next = function() {
    if (this.isHalted()) {
        return;
    }

    this.cycleCnt++;

    this.commit.next();
    this.writeback.next();
    for (var unit in this.exec) {
        this.exec[unit].next();
    }
    for (var unit in this.memAccess) {
        this.memAccess[unit].next();
    }
    this.issueDecode.next();
    this.fetch.next();
};

Processor.prototype.isHalted = function() {
    return this.commit.isHalted();
};

Processor.prototype.reset = function(initialData) {
    this.rawAsmCode = initialData.rawAsmCode;

    // Reset all the processor components
    this.memory.reset(initialData.instructions, initialData.labels);
    this.regs.reset();
    this.issueDecode.reset();
    this.writeback.reset();
    this.commit.reset();
    // Fetch also resets the instruction buffer
    this.fetch.reset();
    for (var i in this.exec) {
        this.exec[i].reset();
    }
    for (var i in this.memAccess) {
        this.exec[i].reset();
    }
    this.execRs.reset();
    this.loadRs.reset();
    this.storeRs.reset();
    this.branchRs.reset();
    this.rob.reset();
    this.rnt.reset();
    this.branchPredictor.reset();
    this.cdb.reset();
    this.halted = false;

    // Reset all statistics
    this.instrExecCnt  = 0;
    this.instrExecLog  = new ExecutionLog();
    this.passBPredictions = 0;
    this.failBPredictions = 0;
    this.cycleCnt = 0;
    this.breakpointHit = false;
};

// Processor configuration parameters
Processor.RS_PER_EXEC             = 3;
Processor.RS_PER_STOREQ           = 4;
Processor.RS_PER_BRANCH           = 4;

Processor.ROB_SIZE                = 30;

Processor.TOT_EXEC                = 4;
Processor.TOT_MEM                 = 2;

Processor.TOT_REGISTERS           = 32;
Processor.PC_REGISTER             = Processor.TOT_REGISTERS - 1;

Processor.INSTR_BUFF_SIZE         = 32;

Processor.BRANCH_TABLE_K          = 5;
Processor.BRANCH_TABLE_SIZE       = 1 << Processor.BRANCH_TABLE_K;

Processor.INSTR_FETCHED_PER_CYCLE = 8;
Processor.INSTR_ISSUED_PER_CYCLE  = 4;
Processor.TOT_WRITEBACK_PER_CYCLE = 4;
Processor.TOT_COMMITS_PER_CYCLE   = 4;

/*****************************************************************************/

/*
 * Commit unit
 */

function Commit(processor) {
    this.processor = processor;
    this.halted    = false;
};

Commit.prototype.reset = function() {
    this.halted = false;
};

Commit.prototype.isHalted = function() {
    return this.halted;
};

Commit.prototype.recoverFromFailedPrediction = function(readyRobEntry,
                                                        correctTargetAddr) {
    // Set the PC to the correct position
    this.processor.regs.setPC(correctTargetAddr);

    // Clear the CDB
    this.processor.cdb.clearAll();

    // Clear the ROB
    this.processor.rob.clearAll();

    // Clear the RNT
    this.processor.rnt.clearAll();

    // Clear all reservation stations
    this.processor.execRs.clearAll();
    this.processor.loadRs.clearAll();
    this.processor.storeRs.clearAll();
    this.processor.branchRs.clearAll();

    // it is possible that the prediction was wrong and the IssueDecode
    // module saw a HALT instruction and stopped working, so put it back to
    // work
    this.processor.issueDecode.halted = false;
};

Commit.prototype.next = function() {
    if (this.halted ||
        (this.processor.issueDecode.isHalted() &&
        this.processor.rob.isEmpty())) {
        // The rest of the processor stopped working because of HALT
        //instruction
        this.halted = true;
        return;
    }

    for (var i = 0; i < Processor.TOT_COMMITS_PER_CYCLE; i++) {
        var robEntry = this.processor.rob.nextReadyEntry();
        if (robEntry == null) {
            // Nothing is ready to commit
            return;
        }

        // Write the values back to the result register
        // (depending on instruction code)
        switch(robEntry.operation) {
            case "SUB":
            case "MUL":
            case "DIV":
            case "AND":
            case "OR":
            case "XOR":
            case "SLLV":
            case "SRLV":
            case "CMP":
            case "CMPLT":
            case "ADD":
            case "LC":
            case "MV":
            case "ADDI":
            case "ANDI":
            case "ORI":
            case "SLL":
            case "SLR":
            case "LW": {
                // All arithmetic instructions have a result operand,
                // so we need to write that value back to the register file
                this.processor.regs.set(robEntry.resReg, robEntry.resVal);

                // Remove the rename entry from the rename table
                this.processor.rnt.removeRegName(robEntry.resReg, robEntry.robTag);
                break;
            }

            case "SW": {
                // Access memory to store the value at the front of the ROB
                var storeRsRecord =
                    this.processor.storeRs.getRecordWithTag(robEntry.rsTag);
                this.processor.memory.store(
                    storeRsRecord.vk + storeRsRecord.addr,
                    storeRsRecord.vj
                );

                // Clear the storeRs used to hold the data
                this.processor.storeRs.clearRecord(robEntry.rsTag);

                // This instruction does not write registers, so no need to
                // update the RenameTable
                break;
            }

            case "BBO": {
                var branchRsRecord    =
                    this.processor.branchRs.getRecordWithTag(robEntry.rsTag);
                var correctTargetAddr = 0;

                // Update the branch predictor depending on whether the branch
                // was taken or not
                if (branchRsRecord.vj != 0) {
                    // Branch taken
                    correctTargetAddr =
                        branchRsRecord.addr + branchRsRecord.pcSrcAddr;
                    this.processor.branchPredictor.incCounterAtAddr(
                        branchRsRecord.pcSrcAddr
                    );
                } else {
                    // Branch not taken
                    correctTargetAddr =
                        1 + branchRsRecord.pcSrcAddr;
                    this.processor.branchPredictor.decCounterAtAddr(
                        branchRsRecord.pcSrcAddr
                    );
                }

                if (correctTargetAddr != robEntry.resVal) {
                    // Prediction failed, recover by clearing the pipeline
                    this.recoverFromFailedPrediction(
                        robEntry,
                        correctTargetAddr
                    );
                    this.processor.failBPredictions++;
                } else {
                    // Prediction succeeded
                    this.processor.branchRs.clearRecord(branchRsRecord.rsTag);
                    this.processor.passBPredictions++;
                }
                break;
            }

            case "JR": {
                var branchRsRecord    =
                    this.processor.branchRs.getRecordWithTag(robEntry.rsTag);
                var correctTargetAddr = branchRsRecord.vj;

                // Here we only speculated on the target address but not on the
                // condition
                if (correctTargetAddr != robEntry.resVal) {
                    // Prediction failed, recover by clearing the pipeline
                    this.recoverFromFailedPrediction(
                        robEntry,
                        correctTargetAddr
                    );
                    this.processor.failBPredictions++;
                } else {
                    // Prediction succeeded
                    this.processor.branchRs.clearRecord(branchRsRecord.rsTag);
                    this.processor.passBPredictions++;
                }

                // Update the target address in the Branch predictor
                this.processor.branchPredictor.updateTargetAddr(
                    branchRsRecord.pcSrcAddr,
                    correctTargetAddr
                );
                break;
            }

            case "BBR": {
                var branchRsRecord    =
                    this.processor.branchRs.getRecordWithTag(robEntry.rsTag);

                // Update the branch predictor depending on whether the branch
                // was taken or not
                if (branchRsRecord.vj != 0) {
                    // Branch taken
                    correctTargetAddr = branchRsRecord.vk;
                    this.processor.branchPredictor.incCounterAtAddr(
                        branchRsRecord.pcSrcAddr
                    );
                } else {
                    // Branch not taken
                    correctTargetAddr =
                        1 + branchRsRecord.pcSrcAddr;
                    this.processor.branchPredictor.decCounterAtAddr(
                        branchRsRecord.pcSrcAddr
                    );
                }

                if (correctTargetAddr != robEntry.resVal) {
                    // Prediction failed, recover by clearing the pipeline
                    this.recoverFromFailedPrediction(
                        robEntry,
                        correctTargetAddr
                    );
                    this.processor.failBPredictions++;
                } else {
                    // Prediction succeeded
                    this.processor.branchRs.clearRecord(branchRsRecord.rsTag);
                    this.processor.passBPredictions++;
                }

                // Update the target address in the Branch predictor
                this.processor.branchPredictor.updateTargetAddr(
                    branchRsRecord.pcSrcAddr,
                    correctTargetAddr
                );
                break;
            }

            default: {
                throw "ERROR: Unrecognised instruction '" + robEntry.operation + "' in commit unit.";
            }
        }

        // Count the instruction that we just finished executing
        this.processor.instrExecCnt++;
        this.processor.instrExecLog.inc(robEntry.operation);
    }
};

/*****************************************************************************/

/*
 * Writeback unit
 */

function Writeback(processor) {
    this.processor = processor;
    this.halted    = false;
};

Writeback.prototype.reset = function() {
    this.halted = false;
};

Writeback.prototype.isHalted = function() {
    return this.halted;
};

Writeback.prototype.updateRsRecords = function(rsRecords, result) {
    for (var recordIndex in rsRecords) {
        if (rsRecords[recordIndex] == null) {
            continue;
        }
        if (rsRecords[recordIndex].rsj != null &&
            rsRecords[recordIndex].rsj == result.robTag) {
            rsRecords[recordIndex].rsj = null;
            rsRecords[recordIndex].vj  = result.resVal;
        }
        if (rsRecords[recordIndex].rsk != null &&
            rsRecords[recordIndex].rsk == result.robTag) {
            rsRecords[recordIndex].rsk = null;
            rsRecords[recordIndex].vk  = result.resVal;
        }
    }
};

Writeback.prototype.next = function() {
    if (this.halted) {
        return;
    }

    for (var i = 0; i < Processor.TOT_WRITEBACK_PER_CYCLE; i++) {
        var result = this.processor.cdb.nextResult();
        if (result == null) {
            // there are no results so far, so stall pipeline
            return;
        }

        // Update the value in ROB
        var robEntry    = this.processor.rob.getEntryByTag(result.robTag);
        robEntry.ready  = true;
        robEntry.resVal = result.resVal;

        // Update all ALU reservation stations waiting for results
        this.updateRsRecords(this.processor.execRs.getAllRecords(), result);

        // Update all BRANCH reservation stations waiting for results
        this.updateRsRecords(this.processor.branchRs.getAllRecords(), result);

        // Update all LOAD reservation stations waiting for results
        this.updateRsRecords(this.processor.loadRs.getAllRecords(), result);

        // Update all STORE reservation stations waiting for results
        this.updateRsRecords(this.processor.storeRs.getAllRecords(), result);

        // Make reservation station available
        switch(robEntry.operation) {
            case "SUB":
            case "AND":
            case "MUL":
            case "DIV":
            case "OR":
            case "XOR":
            case "SLLV":
            case "SRLV":
            case "CMP":
            case "CMPLT":
            case "ADD":
            case "LC":
            case "MV":
            case "ADDI":
            case "ANDI":
            case "ORI":
            case "SLL":
            case "SLR": {
                this.processor.execRs.clearRecord(result.rsTag);
                break;
            }

            case "LW": {
                this.processor.loadRs.clearRecord(result.rsTag);
                break;
            }

            default: {
                throw "ERROR: Unrecognised instruction '" + robEntry.operation +
                    "' in writeback unit.";
            }
        }
    }
};

/*****************************************************************************/

/*
 * Memory access unit
 */

function MemoryAccess(processor) {
    this.processor       = processor;
    this.halted          = false;
    this.localRs         = null;
    this.remainingCycles = 0;
};

MemoryAccess.prototype.reset = function() {
    this.halted          = false;
    this.localRs         = null;
    this.remainingCycles = 0;
};

MemoryAccess.prototype.isHalted = function() {
    return this.halted;
};

MemoryAccess.prototype.toString = function() {
    var str = "halted:" + this.halted;
    str += ", localRs:";
    if (this.localRs != null) {
        str += "[" + this.localRs.toString() + "]";
    } else {
        str += "[NULL]";
    }
    str += ", remainingCycles:" + this.remainingCycles;
    return str;
};

MemoryAccess.prototype.getReadyRecord = function() {
    var localRsList   = this.processor.loadRs.getRecordsForExec();

    for (var i in localRsList) {
        // Something is ready to execute if it doesnt depend on the ROB
        if (localRsList[i]     != null &&
            localRsList[i].rsj == null) {
            // Resolve the address
            if (localRsList[i].vj != null) {
                localRsList[i].addr += localRsList[i].vj;
                localRsList[i].vj    = null;
            }
            // Need to check if there is a store to the same address before
            // this load in the ROB
            var precededByStore = this.processor.rob.hasStoreBeforeWithAddr(
                localRsList[i].robTag,
                localRsList[i].addr
            );
            if (!precededByStore) {
                return localRsList[i];
            }
        }
    }
    return null
};

MemoryAccess.prototype.next = function() {
    if (this.halted) {
        return;
    } else if (this.processor.cdb.isFull()) {
        // There is no space in the CDB, stall the pipeline
        return;
    }

    // because of branch prediction, we need to check that the thing we
    // are processing still exists in the RS if it doesnt then
    // get something new to work on
    if (this.localRs != null &&
        this.processor.loadRs.getRecordWithTag(this.localRs.rsTag) == null) {
        this.localRs = null;
    }

    if (this.localRs == null) {
        // Currently we are not processing anything
        this.localRs = this.getReadyRecord();
        if (this.localRs == null) {
            // No records are ready to be executed so stall the pipeline
            return;
        } else {
            this.remainingCycles = OperationsDuration[this.localRs.operation];
            this.localRs.inUse = true;
        }
    }

    // if the wait is one cycle, this is the last wait cycle, so compute the
    // result and proceed to the next instruction
    if (this.remainingCycles > 1) {
        // processing not finished yet
        this.remainingCycles--;
        return;
    }
    switch(this.localRs.operation) {
        case "LW": {
            this.processor.cdb.addEntry(
                this.localRs.robTag,
                this.localRs.rsTag,
                this.processor.memory.load(this.localRs.addr)
            );
            break;
        }

        default: {
            throw "ERROR: Unrecognised instruction '" + this.localRs.operation +
                "' in execution unit.";
        }
    }
    // Finished executing thie instruction in this.localRs. Next cycle we will
    // execute something else in the reservation station.
    this.localRs = null;
};

/*****************************************************************************/

/*
 * Execution unit
 */

function Execute(processor) {
    this.processor       = processor;
    this.halted          = false;
    this.localRs         = null;
    this.remainingCycles = 0;
};

Execute.prototype.reset = function() {
    this.halted          = false;
    this.localRs         = null;
    this.remainingCycles = 0;
};

Execute.prototype.isHalted = function() {
    return this.halted;
};

Execute.prototype.toString = function() {
    var str = "halted:" + this.halted;
    str += ", localRs:";
    if (this.localRs != null) {
        str += "[" + this.localRs.toString() + "]";
    } else {
        str += "[NULL]";
    }
    str += ", remainingCycles:" + this.remainingCycles;
    return str;
};

Execute.prototype.getReadyRecord = function() {
    var localRsList   = this.processor.execRs.getRecordsForExec();

    for (var i in localRsList) {
        // Something is ready to be executed if it doesnt depend on the ROB
        if (localRsList[i]     != null &&
            localRsList[i].rsj == null &&
            localRsList[i].rsk == null) {
            return localRsList[i];
        }
    }

    return null;
};

Execute.prototype.next = function() {
    if (this.halted) {
        return;
    } else if (this.processor.cdb.isFull()) {
        // There is no space in the CDB, stall the pipeline
        return;
    }

    // because of branch prediction, we need to check that the thing we
    // are processing still exists in the RS if it doesnt then
    // get something new to work on
    if (this.localRs != null &&
        this.processor.execRs.getRecordWithTag(this.localRs.rsTag) == null) {
        this.localRs = null;
    }

    if (this.localRs == null) {
        // Currently we are not processing anything
        this.localRs = this.getReadyRecord();
        if (this.localRs == null) {
            // No records are ready to be executed so stall the pipeline
            return;
        } else {
            this.remainingCycles = OperationsDuration[this.localRs.operation];
            this.localRs.inUse = true;
        }
    }

    // if the wait is one cycle, this is the last wait cycle, so compute the
    // result and proceed to the next instruction
    if (this.remainingCycles > 1) {
        // processing not finished yet
        this.remainingCycles--;
        return;
    }
    switch(this.localRs.operation) {
        case "MUL": {
            this.processor.cdb.addEntry(
                this.localRs.robTag,
                this.localRs.rsTag,
                this.localRs.vj * localRs.vk
            );
            break;
        }

        case "DIV": {
            if (this.localRs.vk == 0) {
                // division by 0... dodgy business!
                this.processor.cdb.addEntry(
                    this.localRs.robTag,
                    this.localRs.rsTag,
                    0
                );
            } else {
                this.processor.cdb.addEntry(
                    this.localRs.robTag,
                    this.localRs.rsTag,
                    Math.floor(this.localRs.vj / this.localRs.vk)
                );
            }
            break;
        }

        case "SUB": {
            this.processor.cdb.addEntry(
                this.localRs.robTag,
                this.localRs.rsTag,
                this.localRs.vj - this.localRs.vk
            );
            break;
        }

        case "AND":
        case "ANDI": {
            this.processor.cdb.addEntry(
                this.localRs.robTag,
                this.localRs.rsTag,
                this.localRs.vj & this.localRs.vk
            );
            break;
        }

        case "ORI":
        case "OR": {
            this.processor.cdb.addEntry(
                this.localRs.robTag,
                this.localRs.rsTag,
                this.localRs.vj | this.localRs.vk
            );
            break;
        }

        case "XOR": {
            this.processor.cdb.addEntry(
                this.localRs.robTag,
                this.localRs.rsTag,
                this.localRs.vj ^ this.localRs.vk
            );
            break;
        }

        case "SLL":
        case "SLLV": {
            this.processor.cdb.addEntry(
                this.localRs.robTag,
                this.localRs.rsTag,
                this.localRs.vj << this.localRs.vk
            );
            break;
        }

        case "SRL":
        case "SRLV": {
            this.processor.cdb.addEntry(
                this.localRs.robTag,
                this.localRs.rsTag,
                this.localRs.vj >> this.localRs.vk
            );
            break;
        }

        case "CMP": {
            this.processor.cdb.addEntry(
                this.localRs.robTag,
                this.localRs.rsTag,
                (this.localRs.vj == this.localRs.vk) ? 1 : 0
            );
            break;
        }

        case "CMPLT": {
            this.processor.cdb.addEntry(
                this.localRs.robTag,
                this.localRs.rsTag,
                (this.localRs.vj < this.localRs.vk) ? 1 : 0
            );
            break;
        }

        case "ADD":
        case "ADDI": {
            this.processor.cdb.addEntry(
                this.localRs.robTag,
                this.localRs.rsTag,
                this.localRs.vj + this.localRs.vk
            );
            break;
        }

        case "LC":
        case "MV": {
            this.processor.cdb.addEntry(
                this.localRs.robTag,
                this.localRs.rsTag,
                this.localRs.vj
            );
            break;
        }

        default: {
            throw "ERROR: Unrecognised instruction '" + this.localRs.operation
                + "' in execution unit.";
        }
    }
    // Finished executing thie instruction in this.localRs. Next cycle we will
    // execute something else in the reservation station.
    this.localRs = null;
};

/*****************************************************************************/

/*
 * Issue/Decode unit
 */

function IssueDecode(processor) {
    this.processor = processor;
    this.halted    = false;
};

IssueDecode.prototype.reset = function() {
    this.halted = false;
};

IssueDecode.prototype.isHalted = function() {
    return this.halted;
};


IssueDecode.prototype.createALURsRecord = function(operation,
                                                   resReg,
                                                   regNamej,
                                                   regNamek,
                                                   regValj,
                                                   regValk) {
    // get the ROB tag to put it in the RS record
    var robTag = this.processor.rob.nextROBTag();

    // add entry to the RenameTable at position of result register
    this.processor.rnt.setNewRegName(resReg, robTag);

    // put data into the RS and get the rsTag for the new record
    var rsTag = this.processor.execRs.addRecord(
        operation,
        regNamej,
        regNamek,
        regValj,
        regValk,
        null,
        robTag
    );

    // put data into the ROB
    this.processor.rob.addEntry(operation, resReg, 0, rsTag);

    // increment program counter and dequeue instruction
    this.processor.regs.incPC();
};

IssueDecode.prototype.createBRANCHRsRecord = function(operation,
                                                      regNamej,
                                                      regNamek,
                                                      regValj,
                                                      regValk,
                                                      addr,
                                                      pcTargetAddr) {
    // make a copy of the current PC
    var pcSrcAddr = this.processor.regs.getPC();

    // get the ROB tag to put it in the RS
    var robTag = this.processor.rob.nextROBTag();

    // no need to add anything to rnt because the target register is PC

    // put data into the RS and set the rsTag
    rsTag = this.processor.branchRs.addRecord(
        operation,
        regNamej,
        regNamek,
        regValj,
        regValk,
        addr,
        robTag,
        pcSrcAddr
    );

    // put data into the ROB -- the ROBEntry.resVal == predictedTargetAddr
    this.processor.rob.addEntry(operation, 0, pcTargetAddr, rsTag, true);

    // increment program counter and dequeue/clear instrBuff
    this.processor.regs.setPC(pcTargetAddr);
};

IssueDecode.prototype.createLOADRsRecord = function(operation,
                                                    resReg,
                                                    regNamej,
                                                    regValj,
                                                    addr) {
    // get the ROB tag to put in the RS
    var robTag = this.processor.rob.nextROBTag();

    // add entry to RenameTable at position of result register
    this.processor.rnt.setNewRegName(resReg, robTag);

    var rsTag = this.processor.loadRs.addRecord(
        operation,
        regNamej,
        null,
        regValj,
        null,
        addr,
        robTag
    );

    // put data into the ROB
    this.processor.rob.addEntry(operation, resReg, 0, rsTag);

    // increment program counter and dequeue instruction
    this.processor.regs.incPC();
};

IssueDecode.prototype.createSTORERsRecord = function(operation,
                                                     regNamej,
                                                     regNamek,
                                                     regValj,
                                                     regValk,
                                                     addr) {
    // get the ROB tag to put in the RS
    var robTag = this.processor.rob.nextROBTag();

    // The result register is NULL in store instruction, so no need to update
    // the RenameTable

    // put data into the RS and set the RS tag
    var rsTag = this.processor.storeRs.addRecord(
        operation,
        regNamej,
        regNamek,
        regValj,
        regValk,
        addr,
        robTag
    );

    // put data into the ROB
    this.processor.rob.addEntry(operation, 0, 0, rsTag);

    // increment program counter and dequeue instruction
    this.processor.regs.incPC();
};

IssueDecode.prototype.incInstructionCount = function(operation) {
    // Increase the global instruction count
    this.processor.instrExecCnt++;

    // Increase the count for that particular operation
    this.processor.instrExecLog.inc(operation);
};

IssueDecode.prototype.next = function() {
    if (this.halted) {
        // do nothing if halted
        return;
    }

    for (var k = 0; k < Processor.INSTR_ISSUED_PER_CYCLE; k++) {
        // Do nothing if the instruction buffer is empty
        var instr = this.processor.fetch.getNextInstr();
        if (instr == null || instr.data == null) {
            return;
        }

        instr            = instr.data;
        var operation    = instr.operation;
        var regj         = 0;
        var regk         = 0;
        var resReg       = 0;
        var offset       = 0;
        var pcTargetAddr = 0;
        var regNamej     = null;
        var regNamek     = null;
        var regValj      = null;
        var regValk      = null;
        var robEntry     = null;

        switch(operation) {
            // ALU instructions
            case "ADD":
            case "SUB":
            case "MUL":
            case "DIV":
            case "AND":
            case "OR":
            case "XOR":
            case "SLLV":
            case "SRLV":
            case "CMP":
            case "CMPLT": {
                if (this.processor.execRs.isFull() ||
                    this.processor.rob.isFull()) {
                    // Stall the pipeline, no rs available
                    // OR stall the pipeline no rob entry available
                    return;
                }

                // get source register addrs
                regj   = instr.s;
                regk   = instr.t;
                // get result register addrs
                resReg = instr.d;

                // check if registers have been renamed
                // if not renamed then get values from register file
                if (this.processor.rnt.isRenamed(regj)) {
                    regNamej = this.processor.rnt.getLatestName(regj);
                    robEntry = this.processor.rob.getEntryByTag(regNamej);
                    if (robEntry.ready) {
                        regValj = robEntry.resVal;
                        regNamej = null;
                    }
                } else {
                    regValj = this.processor.regs.get(regj);
                }
                if (this.processor.rnt.isRenamed(regk)) {
                    regNamek = this.processor.rnt.getLatestName(regk);
                    robEntry = this.processor.rob.getEntryByTag(regNamek);
                    if (robEntry.ready) {
                        regValk = robEntry.resVal;
                        regNamek = null;
                    }
                } else {
                    regValk = this.processor.regs.get(regk);
                }

                // Issue this instruction by creating new records in the ROB
                // and RS
                this.createALURsRecord(
                    operation,
                    resReg,
                    regNamej,
                    regNamek,
                    regValj,
                    regValk
                );

                break;
            }

            case "LC": {
                if (this.processor.execRs.isFull() ||
                    this.processor.rob.isFull()) {
                    // Stall the pipeline, no rs available
                    // OR stall the pipeline no rob entry available
                    return;
                }

                // Get source register addrs
                // No need to check the ROB or register file because there
                // arent any source registers
                resReg  = instr.d;
                regValj = instr.signedImm;

                this.createALURsRecord(
                    operation,
                    resReg,
                    regNamej,
                    regNamek,
                    regValj,
                    regValk
                );

                break;
            }

            case "ANDI":
            case "ORI":
            case "SLL":
            case "SLR": {
                if (this.processor.execRs.isFull() ||
                    this.processor.rob.isFull()) {
                    // Stall the pipeline, no rs available
                    // OR stall the pipeline no rob entry available
                    return;
                }

                resReg = instr.d;
                regj   = instr.s;
                regk   = instr.unsignedImm;

                // check if registers have been renamed
                // if not renamed then get values from register file
                if (this.processor.rnt.isRenamed(regj)) {
                    regNamej = this.processor.rnt.getLatestName(regj);
                    robEntry = this.processor.rob.getEntryByTag(regNamej);
                    if (robEntry.ready) {
                        regValj = robEntry.resVal;
                        regNamej = null;
                    }
                } else {
                    regValj = this.processor.regs.get(regj);
                }
                // regk is only an immediate
                regValk = regk;

                this.createALURsRecord(
                    operation,
                    resReg,
                    regNamej,
                    regNamek,
                    regValj,
                    regValk
                );

                break;
            }

            case "ADDI": {
                if (this.processor.execRs.isFull() ||
                    this.processor.rob.isFull()) {
                    // Stall the pipeline, no rs available
                    // OR stall the pipeline no rob entry available
                    return;
                }

                resReg = instr.d;
                regj   = instr.s;
                regk   = instr.signedImm;

                // check if registers have been renamed
                // if not renamed then get values from register file
                if (this.processor.rnt.isRenamed(regj)) {
                    regNamej = this.processor.rnt.getLatestName(regj);
                    robEntry = this.processor.rob.getEntryByTag(regNamej);
                    if (robEntry.ready) {
                        regValj = robEntry.resVal;
                        regNamej = null;
                    }
                } else {
                    regValj = this.processor.regs.get(regj);
                }
                // regk is only an immediate
                regValk = regk;

                this.createALURsRecord(
                    operation,
                    resReg,
                    regNamej,
                    regNamek,
                    regValj,
                    regValk
                );

                break;
            }

            case "MV": {
                if (this.processor.execRs.isFull() ||
                    this.processor.rob.isFull()) {
                    // Stall the pipeline, no rs available
                    // OR stall the pipeline no rob entry available
                    return;
                }

                resReg = instr.d;
                regj   = instr.s;

                // check if registers have been renamed
                // if not renamed then get values from register file
                if (this.processor.rnt.isRenamed(regj)) {
                    regNamej = this.processor.rnt.getLatestName(regj);
                    robEntry = this.processor.rob.getEntryByTag(regNamej);
                    if (robEntry.ready) {
                        regValj = robEntry.resVal;
                        regNamej = null;
                    }
                } else {
                    regValj = this.processor.regs.get(regj);
                }

                this.createALURsRecord(
                    operation,
                    resReg,
                    regNamej,
                    regNamek,
                    regValj,
                    regValk
                );

                break;
            }

            // memory instructions
            case "LW": {
                if (this.processor.loadRs.isFull() ||
                    this.processor.rob.isFull()) {
                    // Stall the pipeline, no rs available
                    // OR stall the pipeline no rob entry available
                    return;
                }

                regj   = instr.s;
                offset = instr.signedImm;
                resReg = instr.d;

                // check if registers have been renamed
                // if not renamed then get values from register file
                if (this.processor.rnt.isRenamed(regj)) {
                    regNamej = this.processor.rnt.getLatestName(regj);
                    robEntry = this.processor.rob.getEntryByTag(regNamej);
                    if (robEntry.ready) {
                        regValj = robEntry.resVal;
                        regNamej = null;
                    }
                } else {
                    regValj = this.processor.regs.get(regj);
                }

                this.createLOADRsRecord(
                    operation,
                    resReg,
                    regNamej,
                    regValj,
                    offset
                );

                break;
            }

            case "SW" : {
                if (this.processor.storeRs.isFull() ||
                    this.processor.rob.isFull()) {
                    // Stall the pipeline, no rs available
                    // OR stall the pipeline no rob entry available
                    return;
                }

                regj   = instr.s;
                regk   = instr.t;
                offset = instr.signedImm;

                // check if registers have been renamed
                // if not renamed then get values from register file
                if (this.processor.rnt.isRenamed(regj)) {
                    regNamej = this.processor.rnt.getLatestName(regj);
                    robEntry = this.processor.rob.getEntryByTag(regNamej);
                    if (robEntry.ready) {
                        regValj = robEntry.resVal;
                        regNamej = null;
                    }
                } else {
                    regValj = this.processor.regs.get(regj);
                }
                if (this.processor.rnt.isRenamed(regk)) {
                    regNamek = this.processor.rnt.getLatestName(regk);
                    robEntry = this.processor.rob.getEntryByTag(regNamek);
                    if (robEntry.ready) {
                        regValk = robEntry.resVal;
                        regNamek = null;
                    }
                } else {
                    regValk = this.processor.regs.get(regk);
                }

                this.createSTORERsRecord(
                    operation,
                    regNamej,
                    regNamek,
                    regValj,
                    regValk,
                    offset
                );

                break;
            }

            // BRANCH instructions
            // these are executed at this stage
            // Stall for no and wait until all rs are empty
            case "J": {
                // Increment the PC by the specified amount
                this.processor.regs.incPCByOffset(instr.signedImm);

                // Increment the instruction counter since this doesnt reach the
                // commit stage
                this.incInstructionCount(operation);

                // Note that this is a bit unrealistic because there is no
                // delay to fetch instructions once the buffer has been clear
                // due to a jump
                break;
            }

            case "BBO": {
                if (this.processor.branchRs.isFull() ||
                    this.processor.rob.isFull()) {
                    // Stall the pipeline, no rs available
                    // OR stall the pipeline no rob entry available
                    return;
                }

                regj   = instr.s;
                offset = instr.signedImm;

                // check if registers have been renamed
                //  if not renamed then get values from register file
                if (this.processor.rnt.isRenamed(regj)) {
                    regNamej = this.processor.rnt.getLatestName(regj);
                    robEntry = this.processor.rob.getEntryByTag(regNamej);
                    if (robEntry.ready) {
                        regValj = robEntry.resVal;
                        regNamej = null;
                    }
                } else {
                    regValj = this.processor.regs.get(regj);
                }

                // If the regVal is set then we dont need to speculate
                // simply jump to the address
                if (regValj == null) {
                    var counterEntry =
                        this.processor.branchPredictor.getCounter(
                            this.processor.regs.getPC()
                        );
                    if (counterEntry.isSet()) {
                        // use dynamic branch prediction
                        if (counterEntry.takeBranch()) {
                            pcTargetAddr = this.processor.regs.getPC() + offset;
                        } else {
                            pcTargetAddr = this.processor.regs.getPC() + 1;
                        }
                    } else {
                        // use static branch prediction
                        if (offset < 0) {
                            // assume backward branches always taken
                            pcTargetAddr = this.processor.regs.getPC() + offset;
                        } else {
                            // assume forward branches never taken
                            pcTargetAddr = this.processor.regs.getPC() + 1;
                        }
                    }
                } else if (regValj != 0) {
                    pcTargetAddr = this.processor.regs.getPC() + offset;
                } else {
                    pcTargetAddr = this.processor.regs.getPC() + 1;
                }

                this.createBRANCHRsRecord(
                    operation,
                    regNamej,
                    regNamek,
                    regValj,
                    regValk,
                    offset,
                    pcTargetAddr
                );

                break;
            }

            case "JR": {
                if (this.processor.branchRs.isFull() ||
                    this.processor.rob.isFull()) {
                    // Stall the pipeline, no rs available
                    // OR stall the pipeline no rob entry available
                    return;
                }

                regj = instr.s;

                // check if registers have been renamed
                //  if not renamed then get values from register file
                if (this.processor.rnt.isRenamed(regj)) {
                    regNamej = this.processor.rnt.getLatestName(regj);
                    robEntry = this.processor.rob.getEntryByTag(regNamej);
                    if (robEntry.ready) {
                        regValj = robEntry.resVal;
                        regNamej = null;
                    }
                } else {
                    regValj = this.processor.regs.get(regj);
                }

                if (regValj == null) {
                    // predict whatever the BTACache says
                    pcTargetAddr = this.processor.branchPredictor.getTargetAddr(
                        this.processor.regs.getPC()
                    );
                } else {
                    pcTargetAddr = regValj;
                }

                this.createBRANCHRsRecord(
                    operation,
                    regNamej,
                    regNamek,
                    regValj,
                    regValk,
                    offset,
                    pcTargetAddr
                );

                break;
            }

            case "BBR": {
                if (this.processor.branchRs.isFull() ||
                    this.processor.rob.isFull()) {
                    // Stall the pipeline, no rs available
                    // OR stall the pipeline no rob entry available
                    return;
                }

                regj = instr.s;
                regk = instr.t;

                // check if registers have been renamed
                // if not renamed then get values from register file
                if (this.processor.rnt.isRenamed(regj)) {
                    regNamej = this.processor.rnt.getLatestName(regj);
                    robEntry = this.processor.rob.getEntryByTag(regNamej);
                    if (robEntry.ready) {
                        regValj = robEntry.resVal;
                        regNamej = null;
                    }
                } else {
                    regValj = this.processor.regs.get(regj);
                }
                if (this.processor.rnt.isRenamed(regk)) {
                    regNamek = this.processor.rnt.getLatestName(regk);
                    robEntry = this.processor.rob.getEntryByTag(regNamek);
                    if (robEntry.ready) {
                        regValk = robEntry.resVal;
                        regNamek = null;
                    }
                } else {
                    regValk = this.processor.regs.get(regk);
                }

                // first use prediction of the target address
                if (regValj == null) {
                    // predict whatever the BTACache says
                    pcTargetAddr = this.processor.branchPredictor.getTargetAddr(
                        this.processor.regs.getPC()
                    );
                } else {
                    pcTargetAddr = regValj;
                }

                // speculate on the condition and pick a target address
                if (regValj == null) {
                    var counterEntry =
                        this.processor.branchPredictor.getCounter(
                            this.processor.regs.getPC()
                        );
                    if (counterEntry.isSet()) {
                        // use dynamic branch prediction
                        if (!counterEntry.takeBranch()) {
                            pcTargetAddr = this.processor.regs.getPC() + 1;
                        }
                    } else {
                        // Use static branch prediction
                        if (pcTargetAddr >= 0) {
                            // Assume forward branches never taken
                            pcTargetAddr = this.processor.regs.getPC() + 1;
                        }
                    }
                } else if (regValj == 0) {
                    pcTargetAddr = this.processor.regs.getPC() + 1;
                } else {
                    throw "ERROR: regValj was unexpected valu when speculating BBR";
                }

                break;
            }

            case "HALT" : {
                // halt this module and the fetch
                this.halted = true;
                break;
            }

            default: {
                // This is not an instruction but an actual value in memory
                // Do nothing ...
                break;
            }
        }
    }
};

/*****************************************************************************/

/*
 * Instruction inside the instruction buffer
 */

function Instruction(addr, data) {
    this.addr = addr;
    this.data = data;
};

Instruction.prototype.toString = function () {
    var str = "Addr:" + Number(this.addr).toString(16);
    str += ", data:";
    if ("code" in this.data) {
        str += "[" + this.data.code + "]";
    } else {
        str += "[null]";
    }
    return str;
};

/*****************************************************************************/

/*
 * Fetch unit
 */

function Fetch(processor) {
    this.processor = processor;
    this.halted    = false;
    this.last      = 0;
    this.first     = 0;
    this.size      = 0;
};

Fetch.prototype.resetBuffer = function() {
    this.last                = 0;
    this.first               = 0;
    this.size                = 0;
    this.processor.instrBuff =
        Array.apply(null, Array(Processor.INSTR_BUFF_SIZE)).map(
            function() {
                return null;
            }
        );
};

Fetch.prototype.reset = function() {
    this.halted    = false;
    this.resetBuffer();
};

Fetch.prototype.toString = function() {
    var str = "halted:" + this.halted;
    str += ", first:" + this.first;
    str += ", last:" + this.last;
    str += ", size:" + this.size;
    return str;
};

Fetch.prototype.addInstruction = function(addr, data) {
    this.processor.instrBuff[this.last] = new Instruction(addr, data);
    this.last = (this.last + 1) % this.processor.instrBuff.length;
    if (this.size < this.processor.instrBuff.length) {
        this.size++;
    }
};

Fetch.prototype.highestAddr = function() {
    var lastIndex;
    if (this.last == 0) {
        lastIndex = this.processor.instrBuff.length - 1;
    } else {
        lastIndex = this.last - 1;
    }
    if (this.processor.instrBuff[lastIndex] == null) {
        return null;
    }
    return this.processor.instrBuff[lastIndex].addr;
};

Fetch.prototype.lowestAddr = function() {
    if (this.processor.instrBuff[this.first] == null) {
        return null;
    }
    return this.processor.instrBuff[this.first].addr;
};

Fetch.prototype.getInstrAtAddr = function(addr) {
    for (var i in this.processor.instrBuff) {
        if (this.processor.instrBuff[i] == null) {
            continue;
        } else if (this.processor.instrBuff[i].addr == addr) {
            return this.processor.instrBuff[i];
        }
    }
    return null;
};

Fetch.prototype.getNextInstr = function() {
    if (this.processor.memory.hasBreakpoint(this.processor.regs.getPC())) {
        this.processor.breakpointHit = true;
    }
    return this.getInstrAtAddr(this.processor.regs.getPC());
};

Fetch.prototype.isHalted = function() {
    return this.halted;
};

Fetch.prototype.next = function() {
    if (this.halted) {
        return;
    }
    // This stage of the pipeline loads the instructions into the instrBuff
    var pc = this.processor.regs.getPC();
    var highestAddr = this.highestAddr();
    var lowestAddr  = this.lowestAddr();

    // It would be desirable to have some clever mechanism to clean up
    // instructions that have already been used. e.g. have a window around
    // the PC to avoid fetch cycles.

    if (highestAddr == null || lowestAddr == null ||
        pc > highestAddr || pc < lowestAddr) {
        // If we have nothing in the buffer or we have jumped so far that we havent
        // got the data in buffer then reset everything and start fetching
        this.resetBuffer();
        for (var i = pc; i < pc + Processor.INSTR_FETCHED_PER_CYCLE; i++) {
            var instr = this.processor.memory.loadInstr(i);
            if (instr == null) {
                // No more instructions to load in higher addresses
                break;
            }
            this.addInstruction(i, instr);
        }
    } else if (pc + Processor.TOT_EXEC > highestAddr) {
        // Processor only consumes 4 instructions per cycle at most
        // so just make sure that there is enough for next cycle
        for (var i = highestAddr + 1;
            i < highestAddr + Processor.INSTR_FETCHED_PER_CYCLE + 1;
            i++) {
            var instr = this.processor.memory.loadInstr(i);
            if (instr == null) {
                // No more instructions to load in higher addresses
                break;
            }
            this.addInstruction(i, instr);
        }
    } else if(this.size < this.processor.instrBuff.length) {
        // if we are fine wrt pc but there is space in buffer then fetch the
        // next 4 instructions
        var fetchAddr = (pc < highestAddr) ? highestAddr + 1 : pc + 1;
        for (var i = fetchAddr;
            i < fetchAddr + Processor.INSTR_FETCHED_PER_CYCLE + 1 &&
            this.size < this.processor.instrBuff.length;
            i++) {
            var instr = this.processor.memory.loadInstr(i);
            if (instr == null) {
                // No more instructions to load in higher addresses
                break;
            }
            this.addInstruction(i, instr);
        }
    }
};

/*****************************************************************************/

/*
 * BranchCounter
 */

function BranchCounter() {
    this.counter = 1 << (BranchCounter.CNT_BIT_SIZE - 1);
    this.setFlag = false;
};

BranchCounter.prototype.toString = function() {
    var str = "setFlag:" + this.setFlag;
    str += ", counter:" + this.counter;
    return str;
};

BranchCounter.prototype.takeBranch = function() {
    if (this.counter < (1 << (BranchCounter.CNT_BIT_SIZE - 1))) {
        return false;
    }
    return true;
};

BranchCounter.prototype.isSet = function() {
    return this.setFlag;
};

BranchCounter.prototype.incCnt = function() {
    this.setFlag = true;
    this.counter+=
        (this.counter + 1 < (1 << BranchCounter.CNT_BIT_SIZE)) ? 1 : 0;
};

BranchCounter.prototype.decCnt = function() {
    this.setFlag = true;
    this.counter = (this.counter - 1 >= 0) ? this.counter - 1 : 0;
};

BranchCounter.CNT_BIT_SIZE = 2;

/*****************************************************************************/

/*
 * Branch predictor
 */

function BranchPredictor(size) {
    this.bCounterTable = Array.apply(null, Array(size)).map(
        function() {
            return new BranchCounter();
        }
    );
    // Branch prediction table with most recently used
    // targer addr
    this.BTACache      = Array.apply(null, Array(size)).map(
        function() {
            return 0;
        }
    );
};

BranchPredictor.prototype.reset = function() {
    this.bCounterTable = Array.apply(
        null, Array(this.bCounterTable.length)
    ).map(
        function() {
            return new BranchCounter();
        }
    );
    this.BTACache      = Array.apply(
        null, Array(this.BTACache.length)
    ).map(
        function() {
            return 0;
        }
    );
};

BranchPredictor.prototype.toString = function() {
    var str = "BranchPredictor counter table:\n";
    for (var i = 0; i < this.bCounterTable.length; ++i) {
        if (this.bCounterTable[i].isSet()) {
            str += "\ti:" + i;
            str += ", counter:[" + this.bCounterTable[i].toString() + "]\n";
        }
    }
    str += "BranchPredictor target address table:\n";
    for (var i = 0; i < this.BTACache.length; ++i) {
        if (this.BTACache[i] != 0) {
            str += "\ti:" + i;
            str += ", counter:[" + this.BTACache[i] + "]\n";
        }
    }
    return str;
};

// During branch prediction, this function gets the
// index of the table that has the counter and target addr
BranchPredictor.prototype.getTableIndex = function(addr) {
    return addr % (this.BTACache.length - 1);
};

BranchPredictor.prototype.getTargetAddr = function(addr) {
    return this.BTACache[this.getTableIndex(addr)];
};

BranchPredictor.prototype.getCounter = function(addr) {
    return this.bCounterTable[this.getTableIndex(addr)];
};

BranchPredictor.prototype.incCounterAtAddr = function(addr) {
    this.bCounterTable[this.getTableIndex(addr)].incCnt();
};

BranchPredictor.prototype.decCounterAtAddr = function(addr) {
    this.bCounterTable[this.getTableIndex(addr)].decCnt();
};

BranchPredictor.prototype.updateTargetAddr = function(addr, targetAddr) {
    this.BTACache[this.getTableIndex(addr)] = targetAddr;
};

/*****************************************************************************/

/*
 * Common Data Bus
 */

function CommonDataBus(size) {
    // This works very similar to the reorder buffer i.e. as a circular buffer
    this.first  = 0;
    this.last   = 0;
    this.filled = 0;
    this.buff   = Array.apply(null, Array(size)).map(
        function() {
            return null;
        }
    );
};

CommonDataBus.prototype.reset = function() {
    this.clearAll();
};

CommonDataBus.prototype.toString = function() {
    var str = "first:" + this.first;
    str += ", last:" + this.last;
    str += ", filled:" + this.filled + "\n";
    for (var i = 0; i < this.buff.length; ++i) {
        if (this.buff[i] != null) {
            str += "\ti:" + i;
            str += ", entry:[" + this.buff[i].toString() + "]\n";
        }
    }
    return str;
};

CommonDataBus.prototype.isFull = function() {
    return (this.filled < this.buff.length) ? false : true;
};

CommonDataBus.prototype.addEntry = function(robTag, rsTag, resVal) {
    this.buff[this.last] = new CDBEntry(robTag, rsTag, resVal);
    this.last = (this.last + 1) % this.buff.length;
    this.filled++;
};

CommonDataBus.prototype.nextResult = function() {
    if (this.buff[this.first] != null) {
        var entry = this.buff[this.first];
        this.buff[this.first] = null;
        this.first = (this.first + 1) % this.buff.length;
        this.filled--;
        return entry;
    }
    return null;
};

CommonDataBus.prototype.clearAll = function() {
    this.first    = 0;
    this.last     = 0;
    this.filled   = 0;
    this.buff      = Array.apply(null, Array(this.buff.length)).map(
        function() {
            return null;
        }
    );
};

/*****************************************************************************/

/*
 * An entry inside the Common Data Bus
 */

function CDBEntry(robTag, rsTag, resVal) {
    this.robTag = robTag;
    this.rsTag  = rsTag;
    this.resVal = resVal;
};

CDBEntry.prototype.toString = function() {
    var str = "robTag:" + this.robTag;
    str += ", rsTag:" + this.rsTag;
    str += ", resVal:" + this.resVal;
    return str;
};

/*****************************************************************************/

/*
 * Reservation Station
 */

function ReservationStation(size) {
    this.records = Array.apply(null, Array(size)).map(
        function() {
            return null;
        }
    );
};

ReservationStation.prototype.reset = function() {
    this.clearAll();
};

ReservationStation.prototype.toString = function() {
    var str = "";
    for (var i = 0; i < this.records.length; ++i) {
        if (this.records[i] != null) {
            str += "\ti:" + i;
            str += ", record:[" + this.records[i].toString() + "]\n";
        }
    }
    return str;
};

// The same function for getFreeStoreRSForIssue() and
// getFreeRSForIssue()
ReservationStation.prototype.isFull = function() {
    for (var recordIndex in this.records) {
        if (this.records[recordIndex] == null) {
            return false;
        }
    }
    return true;
};

// The same function for getFreeStoreRSForIssue() and
// getFreeRSForIssue()
ReservationStation.prototype.addRecord = function(operation,
                                                  regNamej,
                                                  regNamek,
                                                  regValj,
                                                  regValk,
                                                  addr,
                                                  robTag,
                                                  pcSrcAddr) {
    if (typeof(pcSrcAddr) === "undefined") {
        // This really sucks, but we are using js. Trying to give it a default
        // parameter in the function definition fails!
        pcSrcAddr = null;
    }

    for (var recordIndex in this.records) {
        if (this.records[recordIndex] == null) {
            this.records[recordIndex] = new RSRecord(
                operation,
                regNamej,
                regNamek,
                regValj,
                regValk,
                addr,
                robTag,
                recordIndex,
                pcSrcAddr
            );
            return recordIndex;
        }
    }
    return null;
};

ReservationStation.prototype.getRecordsForExec = function() {
    unusedRecords = [];
    for (var recordIndex in this.records) {
        if (this.records[recordIndex] != null &&
            !this.records[recordIndex].inUse) {
            unusedRecords.push(this.records[recordIndex]);
        }
    }
    return unusedRecords;
};

ReservationStation.prototype.getRecordWithTag = function(rsTag) {
    return this.records[rsTag];
};

ReservationStation.prototype.getAllRecords = function() {
    return this.records;
}

ReservationStation.prototype.clearRecord = function(recordIndex) {
    this.records[recordIndex] = null;
};

ReservationStation.prototype.clearAll = function() {
    this.records = Array.apply(null, Array(this.records.length)).map(
        function() {
            return null;
        }
    );
};

/*****************************************************************************/

/*
 * RSRecord i.e. an entry in a reservation station
 */

function RSRecord(operation, rsj, rsk, vj, vk, addr, robTag, rsTag, pcSrcAddr) {
    if (typeof(pcSrcAddr) === "undefined") {
        // This really sucks, but we are using js. Trying to give it a default
        // parameter in the function definition fails!
        pcSrcAddr = null;
    }

	this.operation = operation;	//operation to do
	this.rsj       = rsj;//rob entry of first operand
	this.rsk       = rsk;//rob entry of second operand
	this.vj        = vj; //value of first operant
	this.vk        = vk; //value of second operand
	this.addr      = addr;//address of load/store instructions
	this.robTag    = robTag;
	this.rsTag     = rsTag;
    this.inUse     = false;
    // This is only used in the branch reservation stations
    // so that commit knows what counter to increment of the
    // branch prediction
    this.pcSrcAddr = pcSrcAddr;
};

RSRecord.prototype.toString = function() {
    var str = "operation:" + this.operation;
    str += ", rsj:" + this.rsj;
    str += ", rsk:" + this.rsk;
    str += ", vj:" + this.vj;
    str += ", vk:" + this.vk;
    str += ", addr:";
    if (this.addr != null) {
        str += Number(this.addr).toString(16);
    }
    str += ", robTag:" + this.robTag;
    str += ", rsTag:" + this.rsTag;
    str += ", inUse:" + this.inUse;
    str += ", pcSrcAddr:" + this.pcSrcAddr;
    return str;
};

/*****************************************************************************/

/*
 * Reorder buffer
 */

function ReorderBuffer(processor, size) {
    this.buff      = Array.apply(null, Array(size)).map(
        function() {
            return null
        }
    );
    this.first     = 0;
    this.last      = 0;
    this.nextAddr  = 0;
    this.filled    = 0;
    this.processor = processor;
};

ReorderBuffer.prototype.reset = function() {
    this.clearAll();
};

ReorderBuffer.prototype.toString = function() {
    var str = "first:" + this.first;
    str += ", last:" + this.last;
    str += ", nextAddr:" + this.nextAddr;
    str += ", filled:" + this.filled;
    for (var i = 0; i < this.buff.length; ++i) {
        if (this.buff[i] != null) {
            str += "\n\ti:" + i;
            str += ", entry:[" + this.buff[i].toString() + "]";
        }
    }
    return str;
};

ReorderBuffer.prototype.clearAll = function() {
    this.first    = 0;
    this.last     = 0;
    this.filled   = 0;
    this.nextAddr = 0;
    this.buff      = Array.apply(null, Array(this.buff.length)).map(
        function() {
            return null;
        }
    );
};

ReorderBuffer.prototype.hasStoreBeforeWithAddr = function(robTag, memAddr) {
    // robTag contains the id of a mem load instruction from address
    // memAddr. We need to check whether there is a store instruction
    // accessing memAddr preceding this load
    var rsTag;
    var storeInstr = null;
    var cnt = 0;
    for (var i = this.first; cnt < this.filled;
        i = (i + 1) % this.buff.length) {
        if (this.buff[i].robTag == robTag) {
            return false;
        } else if (this.buff[i].operation != "SW") {
            continue;
        }
        rsTag = this.buff[i].rsTag;
        storeInstr = this.processor.storeRs.records[rsTag];
        if (storeInstr.vk != null) {
            if (storeInstr.vk + storeInstr.addr == memAddr) {
                return true;
            }
        } else {
            // Address of store has not been resolved, so stall the pipeline!
            return true;
        }
    }
    return false;
};

ReorderBuffer.prototype.nextROBTag = function() {
    return this.nextAddr;
};

ReorderBuffer.prototype.isEmpty = function() {
    return (this.filled == 0) ? true : false;
};

ReorderBuffer.prototype.isFull = function() {
    return (this.filled < this.buff.length) ? false : true;
};

ReorderBuffer.prototype.addEntry = function(operation,
                                            resReg,
                                            resVal,
                                            rsTag,
                                            ready) {
    if (typeof(ready) === "undefined") {
        // This really sucks, but we are using js. Trying to give it a default
        // parameter in the function definition fails!
        ready = false;
    }

    this.buff[this.last] = new ROBEntry(
        operation,
        this.nextAddr,
        resReg,
        resVal,
        ready,
        rsTag
    );
    this.nextAddr++;
    this.last = (this.last + 1) % this.buff.length;
    this.filled++;
};

ReorderBuffer.prototype.getEntryByTag = function(robTag) {
    var cnt = 0;
    for (var i = this.first; cnt <= this.filled; i = (i + 1) % this.buff.length) {
        if (this.buff[i].robTag == robTag) {
            return this.buff[i];
        }
        cnt++;
    }
    return null;
};

ReorderBuffer.prototype.nextReadyEntry = function() {
    if (this.buff[this.first] != null) {
        if (this.buff[this.first].ready ||
            this.buff[this.first].operation == "SW") {
            var entry = this.buff[this.first];
            this.buff[this.first] = null;
            this.first = (this.first + 1) % this.buff.length;
            this.filled--;
            return entry;
        }
    }
    return null;
};

/*****************************************************************************/

/*
 * Objects that represent a single entry in the reorder buffer
 */

function ROBEntry(operation, robTag, resReg, resVal, ready, rsTag) {
    this.operation = operation;
    this.robTag    = robTag;
    this.resReg    = resReg;
    this.resVal    = resVal;
    this.ready     = ready;
    this.rsTag     = rsTag;
};

ROBEntry.prototype.toString = function() {
    var str = "operation:" + this.operation;
    str += ", robTag:" + this.robTag;
    str += ", resReg:" + this.resReg;
    str += ", resVal:" + this.resVal;
    str += ", ready:" + this.ready;
    str += ", rsTag:" + this.rsTag;
    return str;
};

/*****************************************************************************/

/*
 * Object that keeps track of the number of instructions executed
 */

function ExecutionLog() {
    this.ADD   = 0;
    this.ADDI  = 0;
    this.SUB   = 0;
    this.MUL   = 0;
    this.DIV   = 0;
    this.AND   = 0;
    this.ANDI  = 0;
    this.OR    = 0;
    this.ORI   = 0;
    this.XOR   = 0;
    this.SLL   = 0;
    this.SLR   = 0;
    this.SLLV  = 0;
    this.SRLV  = 0;
    this.CMP   = 0;
    this.CMPLT = 0;
    this.J     = 0;
    this.JR    = 0;
    this.BBR   = 0;
    this.BBO   = 0;
    this.SW    = 0;
    this.LW    = 0;
    this.LC    = 0;
    this.MV    = 0;
    this.HALT  = 0;
};

ExecutionLog.prototype.toString = function() {
    var str = "";
    for (var instr in this) {
        if (Number.isInteger(this[instr])) {
            str += "\tinstr:" + instr;
            str += ", count:" + this[instr] + "\n";
        }
    }
    return str;
};

ExecutionLog.prototype.instructionPercentage = function(operation, totInstructions) {
    return this[operation] / totInstructions;
}

ExecutionLog.prototype.inc = function(operation) {
    this[operation] += 1;
};

ExecutionLog.prototype.totalBranchesExecuted = function() {
    return this.J + this.JR + this.BBR + this.BBO;
};

/*****************************************************************************/

/*
 * Rename table
 */

function RenameTable(totalRegs) {
    this.table = Array.apply(null, Array(totalRegs)).map(
        function() {
            return [];
        }
    );
};

RenameTable.prototype.reset = function() {
    this.clearAll();
};

RenameTable.prototype.toString = function() {
    var str = "";
    for (var i = 0; i < this.table.length; ++i) {
        str += "\ti:" + i;
        str += ", entry:[" + this.table[i];
        str += "]\n";
    }
    return str;
};

RenameTable.prototype.clearAll = function() {
    this.table = Array.apply(null, Array(this.table.length)).map(
        function() {
            return [];
        }
    );
};

RenameTable.prototype.isRenamed = function(regIndex) {
    return (this.table[regIndex].length > 0);
};

RenameTable.prototype.getLatestName = function(regIndex) {
    if (this.table[regIndex].length > 0) {
        return this.table[regIndex][0];
    } else {
        return null;
    }
};

RenameTable.prototype.removeRegName = function(regIndex, name) {
    var nameIndex = this.table[regIndex].indexOf(name);
    if (nameIndex < 0) {
        throw "Cannot remove name '" + name + "' from rename table, it does not exist!";
    } else {
        this.table[regIndex].splice(nameIndex, 1);
    }
};

RenameTable.prototype.getRegFromName = function(name) {
    for (var regIndex in this.table) {
        if (this.table[regIndex].indexOf(name) >= 0) {
            return regIndex;
        }
    }
    return -1;
};

RenameTable.prototype.setNewRegName = function(regIndex, name) {
    this.table[regIndex].unshift(name);
};

/*****************************************************************************/

/*
 * Memory
 */

function Memory(instructions, labels) {
    // Memory works as a hash table. If the location contains something
    // then this.mem[location] will have a value different to null or
    // undefined.
    this.mem    = instructions;
    this.labels = labels;
};

Memory.prototype.reset = function(instructions, labels) {
    this.mem    = instructions;
    this.labels = labels;
};

Memory.prototype.store = function(addr, data) {
    if (addr in this.mem) {
        this.mem[addr] = {
            data: data,
            breakpoint: this.mem[addr].breakpoint
        };
    } else {
        this.mem[addr] = {
            data: data,
            breakpoint: false
        };
    }
};

Memory.prototype.load = function(addr) {
    if (addr in this.mem) {
        if ("operation" in this.mem[addr]) {
            if (this.mem[addr].operation == "CT") {
                return this.mem[addr].signedImm;
            } else {
                throw "You are not allowed to read instruction memory!";
            }
        }
        return this.mem[addr].data;
    } else {
        // Data was never accessed before. Just return 0
        return 0;
    }
};

Memory.prototype.loadInstr = function(addr) {
    if (addr in this.mem) {
        return this.mem[addr];
    } else {
        // Data was never accessed before. Just return null and cause an error
        // if this happens to be issued
        return null;
    }
};

Memory.prototype.getMemoryState = function() {
    return this.mem;
};

Memory.prototype.getLabels = function() {
    return this.labels;
};

Memory.prototype.hasBreakpoint = function(addr) {
    if (addr in this.mem) {
        return this.mem[addr].breakpoint;
    } else {
        return false;
    }
};

Memory.prototype.setBreakpoint = function(addr) {
    if (addr in this.mem) {
        this.mem[addr].breakpoint = true;
    } else {
        this.mem[addr] = {
            data: 0,
            breakpoint: true
        };
    }
};

Memory.prototype.unsetBreakpoint = function(addr) {
    if (addr in this.mem) {
        this.mem[addr].breakpoint = false;
    }
};

Memory.prototype.toString = function(addr) {
    var str = "";
    if (typeof optionalArg !== 'undefined') {
        if (addr in this.mem) {
            var data = this.mem[addr];
            str += "addr:0x" + Number(addr).toString(16);
            str +=" (" + addr + "), data:[";
            for (key in data) {
                str += key + ":" + data[key] + ", ";
            }
            str = str.substring(0, str.length - 2);
            str += "]";
        } else {
            str += "addr:0x" + Number(addr).toString(16);
            str += " (" + addr + ")";
            str += ", data:[NULL]";
        }
    } else {
        for (addr in this.mem) {
            str += "addr:0x" + Number(addr).toString(16);
            str +=" (" + addr + "), data:[";
            for (key in this.mem[addr]) {
                str += key + ":" + this.mem[addr][key] + ", ";
            }
            str = str.substring(0, str.length - 2);
            str += "]\n";
        }
        for (label in this.labels) {
            str += "\n" + label + ":0x";
            str += Number(this.labels[label]).toString(16);
            str += " (" + this.labels[label] + ")";
        }
    }
    return str;
};

/*****************************************************************************/

/*
 * Register File
 */

function RegisterFile(totalRegs, pcIndex) {
    this.regs = Array.apply(null, Array(totalRegs)).map(
        function() {
            return 0;
        }
    );
    this.pcIndex = pcIndex;
};

RegisterFile.prototype.reset = function() {
    for (var i = 0; i < this.regs.length; ++i) {
        this.regs[i] = 0;
    }
};

RegisterFile.prototype.toString = function() {
    var str = "";
    for (var i = 0; i < this.regs.length; ++i) {
        if (i > 0) {
            str += ", ";
        }
        if (i == this.pcIndex) {
            str += "$pc:0x" + Number(this.regs[i]).toString(16);
        } else {
            str += "$" + i + ":" + this.regs[i];
        }
    }
    return str;
};

RegisterFile.prototype.getPCIndex = function() {
    return this.pcIndex;
}

RegisterFile.prototype.get = function(index) {
    if (index == this.pcIndex) {
        throw "PC register is not general purpose and is not directly accessible";
    }
    return this.regs[index];
};

RegisterFile.prototype.getPC = function() {
    return this.regs[this.pcIndex];
};

RegisterFile.prototype.setPC = function(addr) {
    this.regs[this.pcIndex] = addr;
};

RegisterFile.prototype.incPC = function() {
    this.regs[this.pcIndex] += 1;
};

RegisterFile.prototype.incPCByOffset = function(offset) {
    this.regs[this.pcIndex] += offset;
};

RegisterFile.prototype.set = function(index, val) {
    if (index == this.pcIndex) {
        throw "PC register is not general purpose and is not directly accessible";
    }
    this.regs[index] = val;
};

/*****************************************************************************/

/*
 * Configure the number of cycles that takes to execute an instruction
 */

OperationsDuration = {
    ADD   : 2,
    ADDI  : 2,
    SUB   : 2,
    MUL   : 4,
    DIV   : 14,
    AND   : 1,
    ANDI  : 1,
    OR    : 1,
    ORI   : 1,
    XOR   : 1,
    SLL   : 1,
    SLR   : 1,
    SLLV  : 1,
    SRLV  : 1,
    CMP   : 1,
    CMPLT : 1,
    J     : 1,
    JR    : 1,
    BBR   : 1,
    BBO   : 1,
    SW    : 1,
    LW    : 1,
    LC    : 1,
    MV    : 1,
    HALT  : 1
};

/*****************************************************************************/
