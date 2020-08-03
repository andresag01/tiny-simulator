function AsyncSimulationTask(totCycles, overlayId, simulator, spinner) {
    this.remainingCycles = totCycles;
    this.overlayId       = overlayId;
    this.processor       = simulator.processor;
    this.simulator       = simulator;
    this.spinner         = spinner;
    this.timer           = null;

    var self = this;
    // Register periodic function
    // Return true if background task should be executed again
    // Return false to jump to postExecute()
    this.stepExecute = function() {
        var isHalted = self.processor.isHalted();
        for (var i = 0;
            (i < AsyncSimulationTask.CYCLES_PER_CALLBACK) && !isHalted &&
            (self.remainingCycles == null || self.remainingCycles > 0);
            i++) {
            // Execute 1 cycle here
            self.processor.next();
            isHalted = self.processor.isHalted();

            if (self.remainingCycles != null) {
                self.remainingCycles--;
            }
        }

        if (self.remainingCycles != null) {
            return (self.remainingCycles > 0) ? !isHalted : false;
        } else {
            return !isHalted;
        }
    };


    // Run pre execute stage
    if (!this.preExecute()) {
        this.postExecute();
        return;
    }

    // Post callbacks
    this.timer = setInterval(
        function() {
            if(!self.stepExecute()) {
                clearInterval(self.timer);
                self.postExecute();
            }
        },
        AsyncSimulationTask.STEP_INTERVAL_MS
    );
};

// Return true if background task should be executed
// return false to jump to postExecute()
AsyncSimulationTask.prototype.preExecute = function() {
    simulator.openBlockingOverlay(this.overlayId);

    // Register function for stopping callbacks
    var self = this;
    this.stopExecute = function() {
        if (self.timer != null) {
            clearInterval(self.timer);
        }
        self.postExecute();
    };

    // Cancel button
    stopButton = $("#overlay-cancel").click(self.stopExecute);

    // Add the button
    this.spinner.play();
    return true;
};

// Return null or an Error
AsyncSimulationTask.prototype.postExecute = function() {
    // Update short info
    simulator.updateProcessorShortInfo();

    // Update all popup information
    simulator.updatePopups();

    // Close the blocking overlay
    simulator.closeBlockingOverlay(this.overlayId);
    this.spinner.stop();
    return null;
};

// Change this to speed up execution
AsyncSimulationTask.STEP_INTERVAL_MS    = 50;
AsyncSimulationTask.CYCLES_PER_CALLBACK = 10;
