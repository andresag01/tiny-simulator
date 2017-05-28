function Simulator() {
    this.popupManager = new PopupManager();
    this.processor    = null;

    // Popup trackers
    this.popups = {
        memory          : {
            htmlId        : null,
            htmlGenerator : this.memoryHtmlGenerator,
            closeCallback : this.closePopup,
            component     : "memory"
        },
        help            : {
            htmlId        : null,
            htmlGenerator : this.helpHtmlGenerator,
            closeCallback : this.closePopup,
            component     : "help"
        },
        summary         : {
            htmlId        : null,
            htmlGenerator : this.summaryHtmlGenerator,
            closeCallback : this.closePopup,
            component     : "summary"
        },
        rnt             : {
            htmlId        : null,
            htmlGenerator : this.rntHtmlGenerator,
            closeCallback : this.closePopup,
            component     : "rnt"
        },
        rob             : {
            htmlId        : null,
            htmlGenerator : this.robHtmlGenerator,
            closeCallback : this.closePopup,
            component     : "rob"
        },
        execRs          : {
            htmlId        : null,
            htmlGenerator : this.execRsHtmlGenerator,
            closeCallback : this.closePopup,
            component     : "execRs"
        },
        loadStoreRs       : {
            htmlId        : null,
            htmlGenerator : this.loadStoreRsHtmlGenerator,
            closeCallback : this.closePopup,
            component     : "loadRs"
        },
        branchRs        : {
            htmlId        : null,
            htmlGenerator : this.branchRsHtmlGenerator,
            closeCallback : this.closePopup,
            component     : "branchRs"
        },
        instrBuff       : {
            htmlId        : null,
            htmlGenerator : this.instrBuffHtmlGenerator,
            closeCallback : this.closePopup,
            component     : "instrBuff"
        },
        regs            : {
            htmlId        : null,
            htmlGenerator : this.regsHtmlGenerator,
            closeCallback : this.closePopup,
            component     : "regs"
        },
        cdb             : {
            htmlId        : null,
            htmlGenerator : this.cdbHtmlGenerator,
            closeCallback : this.closePopup,
            component     : "cdb"
        },
        execUnits       : {
            htmlId        : null,
            htmlGenerator : this.execUnitsHtmlGenerator,
            closeCallback : this.closePopup,
            component     : "execUnits"
        },
        memUnits        : {
            htmlId        : null,
            htmlGenerator : this.memUnitsHtmlGenerator,
            closeCallback : this.closePopup,
            component     : "memUnits"
        },
        branchPredictor : {
            htmlId        : null,
            htmlGenerator : this.branchPredictorHtmlGenerator,
            closeCallback : this.closePopup,
            component     : "branchPredictor"
        }
    };
};

/**
 * This code handles everything to do with the interactive functions of the
 * appliation.
 */
Simulator.prototype.start = function(editor, aceConsole, containerToClear, containerToShow) {
    var results = assembleAndReport(editor, aceConsole);

    if (results.errors.length > 0) {
        window.alert("Assembly process failed. Please fix your program " +
            "before you can proceed to simulation!");
    } else if (results.instruction < 1) {
        window.alert("There are no instructions to execute!");
    } else {
        // Clear the contents of the website and repopulate with
        // processor graphics
        this.processor = new Processor(results);

        self = this;
        $(containerToClear).fadeOut(1000, function() {
                // Remove the existing stuff from the screen
                $(containerToClear).remove();

                // Update the informatin in the hidden div
                self.updateProcessorShortInfo();

                // Fade in the block diagram
                $(containerToShow).fadeIn("slow");

                self.drawProcessorBlockDiagram("#processorBlockDiagram");

                slideBottom.openPermanent();
            }
        );

        // Attach the event listener for the left menu to the bottom menu
        var slideLeftBtn = document.querySelector('#simulation-c-button--slide-left');
        slideLeftBtn.addEventListener('click', function(e) {
                e.preventDefault;
                slideBottom.closeBottomMenu();
                slideLeft.open();
            }
        );

        // Attach event listeners to bottom menu items
        $(".sim_interact").click(
            {
                simulator: this
            },
            function(event) {
                // Get text of the calling option
                event.data.simulator.interact(this);
            }
        );

    }
};

Simulator.prototype.drawProcessorBlockDiagram = function(container) {
    self = this;
    var cy = cytoscape({
        // container to render in
        container: $(container),

        boxSelectionEnabled: false,
        autounselectify: true,
        zoomingEnabled: true,
        panningEnabled: true,

        // list of graph elements to start with
        elements: [
            {
                data: {
                    id: 'fetchUnit',
                    name: 'Fetch\nunit',
                },
                position: { x: 0, y: 0, },
                classes: 'large-block fetch',
                locked: true,
                grabbable: false,
                selected: false,
                selectable: true,
            },
            {
                data: {
                    id: 'instructionQueue',
                    name: 'Instruction\nqueue',
                },
                position: { x: 160, y: -130, },
                classes: 'small-block fetch',
                locked: true,
                grabbable: false,
                selected: false,
                selectable: true,
            },
            {
                data: {
                    id: 'issueDecodeUnit',
                    name: 'Issue\nand\ndecode\nunit',
                },
                position: { x: 320, y: 0, },
                classes: 'large-block issueDecode',
                locked: true,
                grabbable: false,
                selected: false,
                selectable: true,
            },
            {
                data: {
                    id: 'renameTable',
                    name: 'Rename\ntable',
                },
                position: { x: 160, y: 0, },
                classes: 'small-block neutral',
                locked: true,
                grabbable: false,
                selected: false,
                selectable: true,
            },
            {
                data: {
                    id: 'registerFile',
                    name: 'Register\nfile',
                },
                position: { x: 160, y: 130, },
                classes: 'small-block neutral',
                locked: true,
                grabbable: false,
                selected: false,
                selectable: true,
            },
            {
                data: {
                    id: 'aluReservationStation',
                    name: 'ALU\nreservation\nstation',
                },
                position: { x: 470, y: -130, },
                classes: 'small-block issueDecode',
                locked: true,
                grabbable: false,
                selected: false,
                selectable: true,
            },
            {
                data: {
                    id: 'loadStoreReservationStation',
                    name: 'Load/Store\nreservation\nstation',
                },
                position: { x: 470, y: 0, },
                classes: 'small-block issueDecode',
                locked: true,
                grabbable: false,
                selected: false,
                selectable: true,
            },
            {
                data: {
                    id: 'branchReservationStation',
                    name: 'Branch\nreservation\nstation',
                },
                position: { x: 470, y: 130, },
                classes: 'small-block issueDecode',
                locked: true,
                grabbable: false,
                selected: false,
                selectable: true,
            },
            {
                data: {
                    id: 'memoryUnit0',
                    name: '',
                },
                position: { x: 640, y: 30, },
                classes: 'small-block execute',
                locked: true,
                grabbable: false,
                selected: false,
                selectable: false,
            },
            {
                data: {
                    id: 'memoryUnit1',
                    name: 'Memory\nunit',
                },
                position: { x: 650, y: 40, },
                classes: 'small-block execute',
                locked: true,
                grabbable: false,
                selected: false,
                selectable: true,
            },
            {
                data: {
                    id: 'executionUnit0',
                    name: '',
                },
                position: { x: 640, y: -130, },
                classes: 'small-block execute',
                locked: true,
                grabbable: false,
                selected: false,
                selectable: false,
            },
            {
                data: {
                    id: 'executionUnit1',
                    name: '',
                },
                position: { x: 650, y: -120, },
                classes: 'small-block execute',
                locked: true,
                grabbable: false,
                selected: false,
                selectable: false,
            },
            {
                data: {
                    id: 'executionUnit2',
                    name: '',
                },
                position: { x: 660, y: -110, },
                classes: 'small-block execute',
                locked: true,
                grabbable: false,
                selected: false,
                selectable: false,
            },
            {
                data: {
                    id: 'executionUnit3',
                    name: 'Execution\nunit',
                },
                position: { x: 670, y: -100, },
                classes: 'small-block execute',
                locked: true,
                grabbable: false,
                selected: false,
                selectable: true,
            },
            {
                data: {
                    id: 'commonDataBus',
                    name: 'Common\ndata\nbus',
                },
                position: { x: 784, y: 0, },
                classes: 'large-block neutral',
                locked: true,
                grabbable: false,
                selected: false,
                selectable: true,
            },
            {
                data: {
                    id: 'writebackUnit',
                    name: 'Writeback\nunit',
                },
                position: { x: 888, y: 0, },
                classes: 'large-block writeback',
                locked: true,
                grabbable: false,
                selected: false,
                selectable: true,
            },
            {
                data: {
                    id: 'reorderBuffer',
                    name: 'Reorder\nbuffer',
                },
                position: { x: 963, y: -275, },
                classes: 'large-block neutral',
                locked: true,
                grabbable: false,
                selected: false,
                selectable: true,
            },
            {
                data: {
                    id: 'commitUnit',
                    name: 'Commit\nunit',
                },
                position: { x: 1038, y: 0, },
                classes: 'large-block commit',
                locked: true,
                grabbable: false,
                selected: false,
                selectable: true,
            },
            {
                data: {
                    id: 'fetchStage',
                    name: 'Fetch',
                },
                position: { x: 85, y: 235, },
                classes: 'stage fetch',
                locked: true,
                grabbable: false,
                selected: false,
                selectable: true,
            },
            {
                data: {
                    id: 'issueDecodeStage',
                    name: 'Issue/Decode',
                },
                position: { x: 400, y: 235, },
                classes: 'stage issueDecode',
                locked: true,
                grabbable: false,
                selected: false,
                selectable: true,
            },
            {
                data: {
                    id: 'executeStage',
                    name: 'Execute'
                },
                position: { x: 655, y: 235, },
                classes: 'stage execute',
                locked: true,
                grabbable: false,
                selected: false,
                selectable: true,
            },
            {
                data: {
                    id: 'writebackStage',
                    name: 'Writeback'
                },
                position: { x: 888, y: 235, },
                classes: 'stage writeback',
                locked: true,
                grabbable: false,
                selected: false,
                selectable: true,
            },
            {
                data: {
                    id: 'commitStage',
                    name: 'Commit'
                },
                position: { x: 1038, y: 235, },
                classes: 'stage commit',
                locked: true,
                grabbable: false,
                selected: false,
                selectable: true,
            },
            {
                data: {
                    source: 'fetchUnit',
                    target: 'instructionQueue',
                },
            },
            {
                data: {
                    source: 'instructionQueue',
                    target: 'issueDecodeUnit',
                },
            },
            {
                data: {
                    source: 'renameTable',
                    target: 'issueDecodeUnit',
                },
            },
            {
                data: {
                    source: 'registerFile',
                    target: 'issueDecodeUnit',
                },
            },
            {
                data: {
                    source: 'issueDecodeUnit',
                    target: 'renameTable',
                },
            },
            {
                data: {
                    source: 'issueDecodeUnit',
                    target: 'branchReservationStation',
                },
            },
            {
                data: {
                    source: 'issueDecodeUnit',
                    target: 'aluReservationStation',
                },
            },
            {
                data: {
                    source: 'issueDecodeUnit',
                    target: 'loadStoreReservationStation',
                },
            },
            {
                data: {
                    source: 'aluReservationStation',
                    target: 'executionUnit0',
                },
            },
            {
                data: {
                    source: 'loadStoreReservationStation',
                    target: 'memoryUnit0',
                },
            },
            {
                data: {
                    source: 'executionUnit0',
                    target: 'commonDataBus',
                },
            },
            {
                data: {
                    source: 'memoryUnit0',
                    target: 'commonDataBus',
                },
            },
            {
                data: {
                    source: 'commonDataBus',
                    target: 'writebackUnit',
                },
            },
            {
                data: {
                    source: 'writebackUnit',
                    target: 'reorderBuffer',
                },
            },
            {
                data: {
                    source: 'reorderBuffer',
                    target: 'writebackUnit',
                },
            },
            {
                data: {
                    source: 'commitUnit',
                    target: 'reorderBuffer',
                },
            },
            {
                data: {
                    source: 'reorderBuffer',
                    target: 'commitUnit',
                },
            },
            {
                data: {
                    source: 'commitUnit',
                    target: 'branchReservationStation',
                },
            },
            {
                data: {
                    source: 'branchReservationStation',
                    target: 'commitUnit',
                },
            },
            {
                data: {
                    source: 'commitUnit',
                    target: 'renameTable',
                },
            },
            {
                data: {
                    source: 'commitUnit',
                    target: 'registerFile',
                },
            },
        ],

        // the stylesheet for the graph
        style: [
            {
                selector: 'node',
                style: {
                    'text-valign': 'center',
                    'text-halign': 'center',
                    'background-color': '#666',
                    'label': 'data(name)',
                    'shape': 'rectangle',
                    'text-wrap': 'wrap',
                    'text-max-width': '1000px',
                    'font-family': 'Monaco',
                    'border-width': '1px',
                    'border-style': 'solid',
                },
            },
            {
                selector: 'node.large-block',
                style: {
                    'width': 100,
                    'height': 370,
                },
            },
            {
                selector: 'node.small-block',
                style: {
                    'width': 120,
                    'height': 110,
                },
            },
            {
                selector: 'node#commonDataBus',
                style: {
                    'width': 8,
                    'text-valign': 'top',
                    'label': 'data(name)',
                },
            },
            {
                selector: 'node#reorderBuffer',
                style: {
                    'height': 100,
                    'width': 100,
                    'shape': 'ellipse',
                },
            },
            {
                selector: 'edge',
                style: {
                    'curve-style': 'bezier',
                    'width': 3,
                    'line-color': '#000000',
                    'target-arrow-color': '#000000',
                    'target-arrow-shape': 'triangle',
                },
            },
            {
                selector: 'node.fetch',
                style: {
                    'border-color': '#00D026',
                    'background-color': '#00D026',
                    'background-opacity': '0.15',
                },
            },
            {
                selector: 'node.neutral',
                style: {
                    'border-color': '#85888D',
                    'background-color': '#85888D',
                    'background-opacity': '0.15',
                },
            },
            {
                selector: 'node.issueDecode',
                style: {
                    'border-color': '#009CFD',
                    'background-color': '#009CFD',
                    'background-opacity': '0.15',
                },
            },
            {
                selector: 'node.execute',
                style: {
                    'border-color': '#FF2A06',
                    'background-color': '#FF2A06',
                    'background-opacity': '0.15',
                },
            },
            {
                selector: 'node.writeback',
                style: {
                    'border-color': '#8336BC',
                    'background-color': '#8336BC',
                    'background-opacity': '0.15',
                },
            },
            {
                selector: 'node.commit',
                style: {
                    'border-color': '#FFFF04',
                    'background-color': '#FFFF04',
                    'background-opacity': '0.15',
                },
            },
            {
                selector: 'node#fetchStage',
                style: {
                    'width': 270,
                    'height': 50,
                },
            },
            {
                selector: 'node#issueDecodeStage',
                style: {
                    'width': 260,
                    'height': 50,
                },
            },
            {
                selector: 'node#executeStage',
                style: {
                    'width': 150,
                    'height': 50,
                },
            },
            {
                selector: 'node#writebackStage',
                style: {
                    'width': 100,
                    'height': 50,
                },
            },
            {
                selector: 'node#commitStage',
                style: {
                    'width': 100,
                    'height': 50,
                },
            },
        ],

        layout: {
          name: 'preset',
        },
    }).on('tap', 'node', function(evt) {
        switch (evt.target.id()) {
            case "instructionQueue":
                self.createPopup(self.popups.instrBuff);
                break;
            case "renameTable":
                self.createPopup(self.popups.rnt);
                break;
            case "registerFile":
                self.createPopup(self.popups.regs);
                break;
            case "aluReservationStation":
                self.createPopup(self.popups.execRs);
                break;
            case "loadStoreReservationStation":
                self.createPopup(self.popups.loadStoreRs);
                break;
            case "branchReservationStation":
                self.createPopup(self.popups.branchRs);
                break;
            case "reorderBuffer":
                self.createPopup(self.popups.rob);
                break;
            case "commonDataBus":
                self.createPopup(self.popups.cdb);
                break;
            case "executionUnit3":
                self.createPopup(self.popups.execUnits);
                break;
            case "memoryUnit1":
                self.createPopup(self.popups.memUnits);
                break;
            case "commitUnit":
                self.createPopup(self.popups.branchPredictor);
                break;
            default:
                console.log(evt.target.id() + " does not have internal state");
        }
    });
};

Simulator.prototype.updateProcessorShortInfo = function() {
    var pcAddr    = this.processor.regs.getPC();
    var instrAtPc = this.processor.memory.loadInstr(this.processor.regs.getPC());
    instrAtPc     = (instrAtPc == null) ? "Not an instruction" : instrAtPc.code;
    var cycleCnt  = this.processor.cycleCnt;
    var isHalted  = this.processor.isHalted() ? "Yes" : "No";

    // Update PC address
    $("#pcAddr").empty();
    $("#pcAddr").text(Number(pcAddr).toHexString(8));

    // Update PC data
    $("#instrAtPc").empty();
    $("#instrAtPc").text("'" + instrAtPc + "'");

    // Update cycle count
    $("#cycleCnt").empty();
    $("#cycleCnt").text("" + cycleCnt);

    // Update isHaltedFlag
    $("#isHalted").empty();
    $("#isHalted").text("" + isHalted);
};

Simulator.prototype.interact = function(trigger) {
    var option = $(trigger).text();
    if (option == "Memory") {
        this.createPopup(this.popups.memory);
    } else if (option == "Reset") {
        var results = asmSyntaxChecker(this.processor.rawAsmCode);
        this.processor.reset(results);
        this.updateProcessorShortInfo();
        this.updatePopups();
    } else if (option == "All") {
        // Start playing the spinner and run simulation concurrently
        var asyncSimTask = new AsyncSimulationTask(null, "spinner-overlay", this, spinner);
    } else if (option == "Summary") {
        this.createPopup(this.popups.summary);
    } else if (option == "Next") {
        // Start playing the spinner and run simulation concurrently
        var asyncSimTask = new AsyncSimulationTask(1, "spinner-overlay", this, spinner);
    } else if (option == "Next block") {
        var totCycles = $(trigger).parent().children("input").val();
        var asyncSimTask = new AsyncSimulationTask(totCycles, "spinner-overlay", this, spinner);
    } else if (option == "Help") {
        this.createPopup(this.popups.help);
    } else if (option == "Home") {
        window.location.replace(document.URL);
    }
};

Simulator.prototype.updatePopups = function() {
    for (var popup in this.popups) {
        var popupInfo = this.popups[popup];
        if (popupInfo.htmlId != null) {
            // Popup is active
            // Clear contents of the popup body
            $("#" + popupInfo.htmlId + " div.popup-body").empty();

            // Repopulate the body of the popup
            var htmlContent = popupInfo.htmlGenerator.call(this);
            $("#" + popupInfo.htmlId + " div.popup-body").append(htmlContent.body);
        }
    }
};

Simulator.prototype.createPopup = function(popupInfo) {
    if (popupInfo.htmlId != null) {
        // popup already exists, bring it to the front
        this.popupManager.changeFocus(popupInfo.htmlId);
    } else {
        // Popup does not exist, create it
        var htmlContent = popupInfo.htmlGenerator.call(this);
        popupInfo.htmlId = this.popupManager.createPopup(
            htmlContent.title,
            htmlContent.body,
            popupInfo.closeCallback,
            popupInfo,
            "simulator-block-diagram"
        );
    }
};

Simulator.prototype.closePopup = function(popupInfo) {
    popupInfo.htmlId = null;
};

Simulator.prototype.helpHtmlGenerator = function() {
    var body = "<h3>Tiny Simulator short help</h3>"                                    +
               "<p>Use the buttons in the bottom menu to operate the simulator:</p>"   +
               "<ul>"                                                                  +
               "    <li><b>All:</b> Run the simulation until the HALT instruction "    +
               "        is found.</li>"                                                +
               "    <li><b>Next:</b> Simulate the one processor cycle.</li>"           +
               "    <li><b>Next block:</b> Simulate the next X processor cycles.</li>" +
               "    <li><b>Memory:</b> Show a list view of the processor's main "      +
               "        memory. You can set/clear breakpoints by using the "           +
               "        checkboxes next to each memory address.</li>"                  +
               "    <li><b>Reset</b> Send a reset signal to the simulator. All the "   +
               "        processor state will be cleared.</li>"                         +
               "    <li><b>Summary</b> Display some simulation statistics.</li>"       +
               "    <li><b>Documentation</b>: Display the documentation panel.</li>"   +
               "</ul>"                                                                 +
               "<p>Click on each of the components of the processor's block diagram "  +
               "to display information about the internal state of that module.</p>";

    return {
        title : "Help",
        body  : body,
    };
};

Simulator.prototype.summaryHtmlGenerator = function() {
    // Extract required information from the processor
    var instrCnt         = this.processor.instrExecCnt;
    var instrLog         = this.processor.instrExecLog;
    var cycleCnt         = this.processor.cycleCnt;
    var instrPerCycle    = (cycleCnt == 0) ? "-" : instrCnt / cycleCnt;
    var passBPredictions = this.processor.passBPredictions;
    var failBPredictions = this.processor.failBPredictions;
    var totBPredictions  = passBPredictions + failBPredictions;
    var totBExecuted     = instrLog.totalBranchesExecuted();
    var isHalted         = this.processor.isHalted() ? "Yes" : "No";

    // Fill in the general information section
    var body  = "<h3>General information</h3>"                                              +
                "<table>"                                                                   +
                "   <tbody>"                                                                +
                "       <tr>"                                                               +
                "           <td>Halted</td>"                                                +
                "           <td>" + isHalted + "</td>"                                      +
                "       </tr>"                                                              +
                "       <tr>"                                                               +
                "           <td>Total cycles</td>"                                          +
                "           <td>" + cycleCnt + "</td>"                                      +
                "       </tr>"                                                              +
                "       <tr>"                                                               +
                "           <td>Total instructions</td>"                                    +
                "           <td>" + instrCnt + "</td>"                                      +
                "       </tr>"                                                              +
                "       <tr>"                                                               +
                "           <td>Instructions/Cycle</td>"                                    +
                "           <td>" + instrPerCycle + "</td>"                                 +
                "       </tr>"                                                              +
                "       <tr>"                                                               +
                "           <td>Execution units</td>"                                       +
                "           <td>" + Processor.TOT_EXEC + "</td>"                            +
                "       </tr>"                                                              +
                "       <tr>"                                                               +
                "           <td>Memory access units</td>"                                   +
                "           <td>" + Processor.TOT_MEM + "</td>"                             +
                "       </tr>"                                                              +
                "       <tr>"                                                               +
                "           <td>Logic and arithmetic reservation station size</td>"         +
                "           <td>" + (Processor.RS_PER_EXEC * Processor.TOT_EXEC) + "</td>"  +
                "       </tr>"                                                              +
                "       <tr>"                                                               +
                "           <td>Store reservation station size</td>"                        +
                "           <td>" + (Processor.RS_PER_EXEC * Processor.TOT_MEM) + "</td>"   +
                "       </tr>"                                                              +
                "       <tr>"                                                               +
                "           <td>Branch reservation station size</td>"                       +
                "           <td>" + Processor.RS_PER_BRANCH + "</td>"                       +
                "       </tr>"                                                              +
                "       <tr>"                                                               +
                "           <td>Instruction buffer size</td>"                               +
                "           <td>" + Processor.INSTR_BUFF_SIZE + "</td>"                     +
                "       </tr>"                                                              +
                "       <tr>"                                                               +
                "           <td>Reorder buffer size</td>"                                   +
                "           <td>" + Processor.ROB_SIZE + "</td>"                            +
                "       </tr>"                                                              +
                "       <tr>"                                                               +
                "           <td>Instructions fetched per cycle</td>"                        +
                "           <td>" + Processor.INSTR_FETCHED_PER_CYCLE + "</td>"             +
                "       </tr>"                                                              +
                "       <tr>"                                                               +
                "           <td>Instructions issued per cycle</td>"                         +
                "           <td>" + Processor.INSTR_ISSUED_PER_CYCLE + "</td>"              +
                "       </tr>"                                                              +
                "       <tr>"                                                               +
                "           <td>Instructions commited per cycle</td>"                       +
                "           <td>" + Processor.TOT_COMMITS_PER_CYCLE + "</td>"               +
                "       </tr>"                                                              +
                "       <tr>"                                                               +
                "           <td>Branch predictor table size</td>"                           +
                "           <td>" + Processor.BRANCH_TABLE_SIZE + "</td>"                   +
                "       </tr>"                                                              +
                "   </tbody>"                                                               +
                "</table>";

    // Fill in the branch statistics section
    body += "<h3>Branch statistics</h3><table><tbody>";
    body += "<tr><td>Total number of correct predictions</td><td>" +
        passBPredictions + "</td></tr>";
    body += "<tr><td>Total number of miss predictions</td><td>" +
        failBPredictions + "</td></tr>";
    body += "<tr><td>Total number of predictions</td><td>" + totBPredictions +
        "</td></tr>";
    body += "<tr><td>Total number of branches</td><td>" + totBExecuted +
        "</td> </tr>";
    body += "</tbody></table>";

    // Fill in the register data section
    body += "<h3>Register values</h3><table><thead><tr><th>Register Name</th>";
    body += "<th>Value (hex)</th><th>Value (decimal)</th></tr></thead><tbody>";
    for (var i = 0; i < Processor.TOT_REGISTERS; i++) {
        var regVal = (i == this.processor.regs.getPCIndex()) ?
            this.processor.regs.getPC() : this.processor.regs.get(i);
        body += "<tr> <td>$" + i + "</td> <td>0x" +
            Number(regVal).toHexString(8) + "</td><td>" + regVal +
            "</td></tr>";
    }
    body += "</tbody></table>";

    // Fill in the instruction statistics section
    body += "<h3>Instruction statistics</h3><table><thead><tr>";
    body += "<th>Instruction</th><th>Executed</th><th>Percentage</th>";
    body += "</tr></thead><tbody>";
    for (var instr in instrLog) {
        // Aparently JS will iterate through the function members as well!
        if (!Number.isInteger(instrLog[instr])) {
            continue;
        }
        var instrPercentage = instrLog.instructionPercentage(instr, instrCnt);
        instrPercentage     = isNaN(instrPercentage) ? "-" : instrPercentage;
        body += "<tr><td>" + instr + "</td><td>" + instrLog[instr] +
            "</td><td>%" + instrPercentage + "</td></tr>";
    }
    body += "</tbody></table>";

    return {
        title: "Simulation summary",
        body: body
    };
};

Simulator.prototype.memoryHtmlGenerator = function() {
    var memory = this.processor.memory.mem;
    var labels = this.processor.memory.labels;
    var pcAddr = this.processor.regs.getPC();

    // Create mapping addr -> labelName
    var addrToLabel = []
    for (var label in labels) {
        var addr = labels[label];
        if (typeof addrToLabel[addr] === 'undefined') {
            addrToLabel[addr] = [label];
        } else {
            addrToLabel[addr].push(label);
        }
    }

    var body  = '<table>'                                               +
                '   <thead>'                                            +
                '       <tr>'                                           +
                '           <th class="pc-col">PC</th>'                 +
                '           <th class="breakpoint-col">Breakpoint</th>' +
                '           <th class="address-col">Address</th>'       +
                '           <th class="value-col">Value</th>'           +
                '           <th class="labels-col">Labels</th>'         +
                '       </tr>'                                          +
                '   </thead>'                                           +
                '   <tbody>';
    // Put memory contents in the table
    for (var addr in memory) {
        var checkBoxValue = '';
        if (memory[addr].breakpoint) {
            checkBoxValue = ' checked';
        }
        var data = '';
        if (memory[addr].hasOwnProperty('data')) {
            data = 'CT ' + memory[addr].data;
        } else {
            data = memory[addr].code;
        }
        pcPointer = (addr == pcAddr) ? '&rarr;' : '';
        body += '<tr>'                                                   +
                '   <td>'                                                +
                pcPointer                                                +
                '   </td>'                                               +
                '   <td>'                                                +
                '       <input type="checkbox" value="false"'            +
                '           name="' + addr + '"' + checkBoxValue + ' />' +
                '   </td>'                                               +
                '   <td>'                                                +
                '       0x' + Number(addr).toHexString(8)                +
                '   </td>'                                               +
                '   <td>'                                                +
                        data                                             +
                '   </td>';
        if (typeof addrToLabel[addr] === 'undefined') {
            body += '<td></td>';
        } else {
            body += '<td>' + addrToLabel[addr].join(", ") + '</td>';
        }
        body += '</tr>';
    }
    body     += "</tbody></table>";

    // Add a button to update the breakpoints
    body     += '<button type="button" onclick="simulator.saveBreakpoints()">';
    body     += 'Apply</button>';

    return {
        title: "Memory contents and breakpoints",
        body: body
    };
};

Simulator.prototype.saveBreakpoints = function() {
    var self = this;
    $("#" + this.popups.memory.htmlId + " tbody tr").each(function() {
        var addr = parseInt($(this).children("td").eq(1).html());
        var breakpoint =
            $(this).children("td").eq(0).children("input").eq(0).is(":checked");
        if (breakpoint) {
            self.processor.memory.setBreakpoint(addr);
        } else {
            self.processor.memory.unsetBreakpoint(addr);
        }
    });
};

Simulator.prototype.openBlockingOverlay = function(overlayId) {
    // Display summary overlay
    var overlay = document.getElementById(overlayId);
    // Hide bottom menu
    slideBottom.closeBottomMenu();
    overlay.classList.remove('overlay-hidden');
    overlay.classList.add("overlay-visible");
    document.getElementById("overlay-mask").classList.add('is-active');
};

Simulator.prototype.closeBlockingOverlay = function(overlayId) {
    var overlay = document.getElementById(overlayId);
    overlay.classList.remove("overlay-visible");
    overlay.classList.add('overlay-hidden');
    document.getElementById("overlay-mask").classList.remove('is-active');
    slideBottom.openPermanent();
};

Simulator.prototype.regsHtmlGenerator = function() {
    var body = "<h3>Register values</h3>";
    body += "<table><thead><tr><th>Register Name</th>";
    body += "<th>Value (hex)</th><th>Value (decimal)</th></tr></thead><tbody>";
    for (var i = 0; i < Processor.TOT_REGISTERS; i++) {
        var regVal = (i == this.processor.regs.getPCIndex()) ?
            this.processor.regs.getPC() : this.processor.regs.get(i);
        body += "<tr> <td>$" + i + "</td> <td>0x" +
            Number(regVal).toHexString(8) + "</td><td>" + regVal +
            "</td></tr>";
    }
    body += "</tbody></table>";

    return {
        title: "Register file",
        body: body
    };
};

Simulator.prototype.rntHtmlGenerator = function() {
    var body = "<h3>Rename table values</h3>";
    body += "<table><thead><tr><th>Register</th><th>Names</th></tr></head>";
    body += "<tbody>";
    for (var i in this.processor.rnt.table) {
        var regVal = (i == this.processor.regs.getPCIndex()) ?
            "PC" : Number(i).toString();
        body += "<tr><td>$" + regVal + "</td> <td>";
        if (this.processor.rnt.table[i].length == 0) {
            body += "-";
        } else {
            for (var j in this.processor.rnt.table[i]) {
                body += (j > 0) ? ", " : "";
                body += this.processor.rnt.table[i][j];
            }
        }
        body += "</td></tr>";
    }
    body += "</tbody></table>";

    return {
        title: "Rename table",
        body: body
    };
};

Simulator.prototype.robHtmlGenerator = function() {
    var body = "<h3>Reorder Buffer Values</h3>";
    body += "<table><thead><tr><th>Reorder Buffer Tag</th>";
    body += "<th>Reservation Station Tag</th><th>Operation</th>";
    body += "<th>Result Register</th><th>Ready</th><th>Result</th>";
    body += "</tr></thead><body>";
    for (var i = this.processor.rob.first;
        i != this.processor.rob.last;
        i = (i + 1) % this.processor.rob.buff.length) {
        robTag    = Number(this.processor.rob.buff[i].robTag).toString();
        rsTag     = Number(this.processor.rob.buff[i].rsTag).toString();
        operation = this.processor.rob.buff[i].operation;
        resReg    = (this.processor.rob.buff[i].resReg == null) ? "-" :
            this.processor.rob.buff[i].resReg;
        ready     = this.processor.rob.buff[i].ready;
        resVal    = Number(this.processor.rob.buff[i].resVal).toString();

        body += "<tr>";
        body += "<td>" + robTag    + "</td>";
        body += "<td>" + rsTag     + "</td>";
        body += "<td>" + operation + "</td>";
        body += "<td>" + resReg    + "</td>";
        body += "<td>" + ready     + "</td>";
        body += "<td>" + resVal    + "</td>";
        body += "</tr>";
    }
    body += "</tbody></table>";

    return {
        title: "Reorder buffer",
        body: body
    };
};

Simulator.prototype.processRsRecord = function(record) {
    return {
	    operation: (record.operation == null) ? "-"   : record.operation,
	    rsj      : (record.rsj       == null) ? "-"   : record.rsj,
	    rsk      : (record.rsk       == null) ? "-"   : record.rsk,
	    vj       : (record.vj        == null) ? "-"   : record.vj,
	    vk       : (record.vk        == null) ? "-"   : record.vk,
	    addr     : (record.addr      == null) ? "-"   : record.addr,
	    robTag   : (record.robTag    == null) ? "-"   : record.robTag,
	    rsTag    : (record.rsTag     == null) ? "-"   : record.rsTag,
        inUse    : (record.inUse     == true) ? "Yes" : "No",
        pcSrcAddr: (record.pcSrcAddr == null) ? "-"   : record.pcSrcAddr
    }
};

Simulator.prototype.execRsHtmlGenerator = function() {
    var body = "<h3>Arithmetic and Logic Reservation Station Values</h3>";
    body += "<table><thead><tr><th>Reservation Station Tag</th>";
    body += "<th>Operation</th><th>rsj</th><th>rsk</th><th>vj</th><th>vk</th>";
    body += "<th>Reorder Buffer Tag</th><th>In Use?</th></tr></thead><tbody>";
    for (var i in this.processor.execRs.records) {
        if (this.processor.execRs.records[i] == null) {
            continue;
        }

        var recordStrs =
            this.processRsRecord(this.processor.execRs.records[i]);

        body += "<tr>";
        body += "<td>" + recordStrs.rsTag     + "</td>";
        body += "<td>" + recordStrs.operation + "</td>";
        body += "<td>" + recordStrs.rsj       + "</td>";
        body += "<td>" + recordStrs.rsk       + "</td>";
        body += "<td>" + recordStrs.vj        + "</td>";
        body += "<td>" + recordStrs.vk        + "</td>";
        body += "<td>" + recordStrs.rsTag     + "</td>";
        body += "<td>" + recordStrs.inUse     + "</td>";
        body += "</tr>";
    }
    body += "</tbody></table>";

    return {
        title: "Arithmetic and logic reservation station",
        body: body
    };
};

Simulator.prototype.loadStoreRsHtmlGenerator = function() {
    var body = "<h3>Load Reservation Station Values</h3>";
    body += "<table><thead><tr><th>Reservation Station Tag</th>";
    body += "<th>Operation</th><th>rsj</th><th>vj</th><th>Address</th>";
    body += "<th>Reorder Buffer Tag</th><th>In Use?</th></tr></thead><tbody>";
    for (var i in this.processor.loadRs.records) {
        if (this.processor.loadRs.records[i] == null) {
            continue;
        }

        var recordStrs =
            this.processRsRecord(this.processor.loadRs.records[i]);

        body += "<tr>";
        body += "<td>" + recordStrs.rsTag     + "</td>";
        body += "<td>" + recordStrs.operation + "</td>";
        body += "<td>" + recordStrs.rsj       + "</td>";
        body += "<td>" + recordStrs.vj        + "</td>";
        body += "<td>" + recordStrs.addr      + "</td>";
        body += "<td>" + recordStrs.rsTag     + "</td>";
        body += "<td>" + recordStrs.inUse     + "</td>";
        body += "</tr>";
    }
    body += "</tbody></table>";

    body += "<h3>Store Reservation Station Values</h3>";
    body += "<table><thead><tr><th>Reservation Station Tag</th>";
    body += "<th>Operation</th><th>rsj</th><th>rsk</th><th>vj</th>";
    body += "<th>vk</th><th>Address</th>";
    body += "<th>Reorder Buffer Tag</th><th>In Use?</th></tr></thead><tbody>";
    for (var i in this.processor.storeRs.records) {
        if (this.processor.storeRs.records[i] == null) {
            continue;
        }

        var recordStrs =
            this.processRsRecord(this.processor.storeRs.records[i]);

        body += "<tr>";
        body += "<td>" + recordStrs.rsTag     + "</td>";
        body += "<td>" + recordStrs.operation + "</td>";
        body += "<td>" + recordStrs.rsj       + "</td>";
        body += "<td>" + recordStrs.rsk       + "</td>";
        body += "<td>" + recordStrs.vj        + "</td>";
        body += "<td>" + recordStrs.vk        + "</td>";
        body += "<td>" + recordStrs.addr      + "</td>";
        body += "<td>" + recordStrs.rsTag     + "</td>";
        body += "<td>" + recordStrs.inUse     + "</td>";
        body += "</tr>";
    }
    body += "</tbody></table>";

    return {
        title: "Load/Store reservation station",
        body: body
    };
};

Simulator.prototype.branchRsHtmlGenerator = function() {
    var body = "<h3>Branch Reservation Station Values</h3>";
    body += "<table><thead><tr><th>Reservation Station Tag</th>";
    body += "<th>Operation</th><th>rsj</th><th>rsk</th><th>vj</th>";
    body += "<th>vk</th><th>Target address</th><th>Instruction address</th>";
    body += "<th>Reorder Buffer Tag</th><th>In Use?</th></tr></thead><tbody>";
    for (var i in this.processor.branchRs.records) {
        if (this.processor.branchRs.records[i] == null) {
            continue;
        }

        var recordStrs =
            this.processRsRecord(this.processor.branchRs.records[i]);

        body += "<tr>";
        body += "<td>" + recordStrs.rsTag     + "</td>";
        body += "<td>" + recordStrs.operation + "</td>";
        body += "<td>" + recordStrs.rsj       + "</td>";
        body += "<td>" + recordStrs.rsk       + "</td>";
        body += "<td>" + recordStrs.vj        + "</td>";
        body += "<td>" + recordStrs.vk        + "</td>";
        body += "<td>" + recordStrs.addr      + "</td>";
        body += "<td>" + recordStrs.pcSrcAddr + "</td>";
        body += "<td>" + recordStrs.rsTag     + "</td>";
        body += "<td>" + recordStrs.inUse     + "</td>";
        body += "</tr>";
    }
    body += "</tbody></table>";

    return {
        title: "Branch reservation station",
        body: body
    };
};

Simulator.prototype.instrBuffHtmlGenerator = function() {
    var body = "<h3>Instruction Buffer Contents</h3>";
    body += "<table><thead><tr><th>Address</th><th>Instruction</th>"
    body += "</tr></thead><tbody>";
    for (var i in this.processor.instrBuff) {
        if (this.processor.instrBuff[i] == null) {
            continue;
        } else if ("code" in this.processor.instrBuff[i].data) {
            body += "<tr>";
            body += "<td>" + this.processor.instrBuff[i].addr      + "</td>";
            body += "<td>" + this.processor.instrBuff[i].data.code + "</td>";
            body += "</tr>";
        }
    }
    body += "</tbody></table>";

    return {
        title: "Instruction buffer",
        body: body
    };
};

Simulator.prototype.cdbHtmlGenerator = function() {
    var body = "<h3>Common Data Bus Contents</h3>";
    body += "<table><thead><tr><th>Reorder Buffer Tag</th>";
    body += "<th>Reservation Station Tag</th><th>Result</th></tr>";
    body += "</thead><tbody>";
    for (var i in this.processor.cdb.buff) {
        if (this.processor.cdb.buff[i] == null) {
            continue;
        }

        body += "<tr>";
        body += "<td>" + this.processor.cdb.buff[i].robTag + "</td>";
        body += "<td>" + this.processor.cdb.buff[i].rsTag  + "</td>";
        body += "<td>" + this.processor.cdb.buff[i].resVal + "</td>";
        body += "</tr>";
    }
    body += "</tbody></table>";

    return {
        title: "Common data bus",
        body: body
    };
};

Simulator.prototype.execUnitsHtmlGenerator = function() {
    var body = "<h3>Execution Units Summary</h3>";
    body += "<table><theader><tr><td>Unit</td><td>Status</td>";
    body += "<td>Reservation station tag in use</td><td>";
    body += "Cycles to completion</td></tr></theader><tbody>";

    for (var i = 0; i < Processor.TOT_EXEC; ++i) {
        body += "<tr>";
        body += "<td>" + i + "</td>";
        if (this.processor.exec.localRs == null) {
            body += "<td>Idle</td>";
            body += "<td>" + "-" + "</td>";
            body += "<td>" + "-" + "</td>";
        } else {
            body += "<td>Busy</td>";
            body += "<td>" + this.processor.exec.localRs.rsTag + "</td>";
            body += "<td>" + this.processor.exec.remainingCycles + "</td>";
        }
        body += "</tr>";
    }
    body += "</tbody></table>";

    return {
        title: "Arithmetic and logic execution units",
        body: body
    };
};

Simulator.prototype.memUnitsHtmlGenerator = function() {
    var body = "<h3>Memory Access Units Summary</h3>";
    body += "<table><theader><tr><td>Unit</td><td>Status</td>";
    body += "<td>Reservation station tag in use</td><td>";
    body += "Cycles to completion</td></tr></theader><tbody>";

    for (var i = 0; i < Processor.TOT_MEM; ++i) {
        body += "<tr>";
        body += "<td>" + i + "</td>";
        if (this.processor.memAccess.localRs == null) {
            body += "<td>Idle</td>";
            body += "<td>" + "-" + "</td>";
            body += "<td>" + "-" + "</td>";
        } else {
            body += "<td>Busy</td>";
            body += "<td>" + this.processor.memAccess.localRs.rsTag + "</td>";
            body += "<td>" + this.processor.memAccess.remainingCycles + "</td>";
        }
        body += "</tr>";
    }
    body += "</tbody></table>";

    return {
        title: "Memory access execution units",
        body: body
    };
};

Simulator.prototype.branchPredictorHtmlGenerator = function() {
    var body = "<h3>Branch predictor contents</h3>"    +
               "<table>"                               +
               "   <theader>"                          +
               "       <tr>"                           +
               "           <th>Index</th>"             +
               "           <th>Take branch?</th>"      +
               "           <th>Target address</th>"    +
               "       </tr>"                          +
               "   </theader>"                         +
               "   <tbody>";

    for (var i in this.processor.branchPredictor.bCounterTable) {
        if (!this.processor.branchPredictor.bCounterTable[i].isSet()) {
            continue;
        }
        body += "<tr>";
        body += "<td>" + i + "</td>";
        if (this.processor.branchPredictor.bCounterTable[i].takeBranch()) {
            body += "<td>Yes</td>";
        } else {
            body += "<td>No</td>";
        }
        body += "<td>" + this.processor.branchPredictor.BTACache[i] + "</td>";
        body += "</tr>";
    }
    body += "</tbody></table>";

    return {
        title: "Commit unit (and branch predictor)",
        body: body
    };
};

Number.prototype.toHexString = function(size) {
    var hexStr = this.toString(16);
    while (hexStr.length < size) {
        hexStr = "0" + hexStr;
    }
    return hexStr;
}
