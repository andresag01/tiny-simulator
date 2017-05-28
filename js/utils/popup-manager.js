function PopupManager() {
    this.popupList = [];
};

PopupManager.prototype.createPopup = function(title, body, closeCallback, closeCallbackArgs, parentId) {
    popupId = 'popup' + this.popupList.length;

    popupTpl  = '<div id="' + popupId + '" class="popup" style="position: absolute; z-index: ' + (1000 - this.popupList.length) + '">';
    popupTpl += '<div class="popup-header">'
    popupTpl += '<div class="popup-buttons">X</div>';
    popupTpl += '<div class="popup-title">' + title + '</div>';
    popupTpl += '</div>';
    popupTpl += '<div class="popup-body">' + body + '</div>';
    popupTpl += '</div>';
    $("#" + parentId).append(popupTpl);


    $("#" + popupId).draggable({containment: "parent", cursor: "crosshair", disabled: true});
    $("#" + popupId).resizable();
    $("#" + popupId).mousedown(
        { popupId: popupId, popupManager: this },
        function(event) {
            event.data.popupManager.changeFocus(event.data.popupId);
        }
    );
    $("#" + popupId).children("div.popup-header").children("div.popup-buttons").click(
        {
            popupId           : popupId,
            popupManager      : this,
            closeCallback     : closeCallback,
            closeCallbackArgs : closeCallbackArgs
        },
        function(event) {
            if (event.data.closeCallback != null) {
                event.data.closeCallback(event.data.closeCallbackArgs);
            }
            event.data.popupManager.closePopup(event.data.popupId);
        }
    );
    $("#" + popupId).children("div.popup-header").children("div.popup-title").mouseover(
        { popupId: popupId, popupManager: this },
        function(event) {
            $('#' + event.data.popupId).draggable('enable');
        }
    );
    $("#" + popupId).children("div.popup-header").children("div.popup-title").mouseout(
        { popupId: popupId, popupManager: this },
        function(event) {
            $('#' + event.data.popupId).draggable('disable');
        }
    );

    this.popupList.push(popupId);
    this.changeFocus(popupId);

    return popupId;
};

PopupManager.prototype.changeFocus = function(popupId) {
    // find the item in the list
    popupIndex = null;
    for (var i in this.popupList) {
        if (this.popupList[i] == popupId) {
            popupIndex = i;
            break;
        }
    }

    if (popupIndex == null) {
        console.log("ERROR: popup " + popupId + " does not exist in popupList");
        return;
    } else if (popupIndex == 0) {
        // If element is already at the head then we have nothing to do
        return;
    }

    // update all z-indexes needed
    for (var i = 0; i < popupIndex; ++i) {
        $("#" + this.popupList[i]).css("z-index", 1000 - i - 1);
    }

    // put popupId on top of everything
    $("#" + popupId).css("z-index", 1000);
    // move element to head of array
    this.popupList.splice(popupIndex, 1);
    this.popupList.unshift(popupId);
};

PopupManager.prototype.closePopup = function(popupId) {
    $("#" + popupId).remove();

    // fix the z-index list
    popupIndex = null;
    for (var i in this.popupList) {
        if (this.popupList[i] == popupId) {
            popupIndex = i;
            break;
        }
    }

    if (popupIndex == null) {
        console.log("ERROR: popup " + popupId + " does not exist in popupList");
        return;
    }

    // update all z-indexes needed
    for (var i = popupIndex + 1; i < this.popupList.length; ++i) {
        $("#" + this.popupList[i]).css("z-index", 1000 - i + 1);
    }

    this.popupList.splice(popupIndex, 1);
};
