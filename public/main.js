window.$ = {
    one: (...args) => window.top.document.querySelector(...args),
    all: (...args) => window.top.document.querySelectorAll(...args),
    on: (dom, eventName, func) => dom.addEventListener(eventName, func),
    off: (dom, eventName, func) => dom.removeEventListener(eventName, func),
    make: (domString) => {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = domString;
        return wrapper.firstElementChild;
    },
    attr: (dom, attr, value) => {
        attr = attr.toString();
        if (typeof value == "undefined") {
            return dom.getAttribute(attr);
        }
        dom.setAttribute(attr, value.toString());
    },
    find: (dom, ...args) => dom.querySelector(...args),
    css: (dom, attr, value) => {
        attr = attr.toString();
        if (typeof value == "undefined") {
            return window.getComputedStyle(dom)[attr];
        }
        dom.style[attr] = value.toString();
    },
    prop: (dom, prop) => window.getComputedStyle(dom).getPropertyValue(prop),
    pos: (dom) => {
        return {
            top: dom.offsetTop,
            left: dom.offsetLeft,
        };
    },
};

window.onload = function () {
    for (let i = 1; i <= 20; i++) {
        addToList(`File ${i}`);
    }
};

function addToList(name, uuid) {
    const container = $.one("#file-container");

    // Create the file dom and append it to body
    uuid = uuid ?? name;
    let fileElt = $.make(`
    <div class="file" data-hold="false" data-uuid="${uuid.toString()}">
        <span class="reorder no-select">menu</span>
        <span class="name">${name.toString()}</span>
        <span class="remove no-select">close</span>
    </div>
    `);
    container.appendChild(fileElt);

    // increase number of files
    let listLen = +$.attr(container, "data-files");
    $.attr(container, "data-files", listLen + 1);

    // setup events for that item
    setupListEltEvent(fileElt);
}

function setupListEltEvent(fileElt) {
    const container = $.one("#file-container");
    const header = parseInt($.prop(container, "--header-height")); // 44px
    const fileHeight = parseInt($.css(fileElt, "height")); // 50px
    const containerHeight = parseInt($.css(container, "height"));
    const containerTop = $.pos(container).top;
    const MAX_SPEED = 60;
    const SCROLL_NUDGE_RATIO = 1 / 3;
    let placeholder;
    let prevY = 0,
        currentY = 0;
    let isDragging = false;

    $.on($.find(fileElt, ".reorder"), "pointerdown", (event) => {
        prevY = event.clientY; // initial Y position
        isDragging = true;

        event.preventDefault();
        $.on(document, "pointermove", onPointermove);
        $.on(document, "pointerup", onPointerup);
        setMoveStyle(fileElt, true);

        placeholder = $.make(
            `<div id="placeholder" style='width: 100%; height: 50px;'>`
        );
        container.insertBefore(placeholder, fileElt);

        animate(); // for scrolling
    });

    function onPointerup() {
        isDragging = false;
        $.off(document, "pointermove", onPointermove);
        $.off(document, "pointerup", onPointerup);
        setMoveStyle(fileElt, false);
        container.replaceChild(fileElt, placeholder);
    }

    function onPointermove(event) {
        currentY = event.clientY;

        let deltaY = currentY - prevY;

        // clamp mouse to maxTopY
        let maxTopY = containerTop + header;
        currentY = Math.max(currentY, maxTopY);

        // clamp mouse to maxBottomY
        let maxBottomY = containerTop + containerHeight;
        currentY = Math.min(currentY, maxBottomY);

        prevY = currentY;

        let nextY = moveElt(fileElt, deltaY);
        swapElts(nextY);
    }

    function animate() {
        const scrollX = container.scrollLeft;
        const scrollY = container.scrollTop;
        const fileTop = $.pos(fileElt).top;
        const scrollHeight =
            $.pos($.one(".file:last-of-type")).top + fileHeight;

        const pastTop = fileTop - scrollY - (header + 1);
        const pastBottom =
            fileTop + fileHeight - (containerHeight + scrollY) - 1;

        const hasTopSlack = scrollY > 0;
        const hasBottomSlack = scrollY < scrollHeight - containerHeight;

        let scrollDeltaY = 0;
        const thresh = header / 2;
        if (pastBottom > thresh && hasBottomSlack) {
            scrollDeltaY = Math.min(pastBottom * SCROLL_NUDGE_RATIO, MAX_SPEED);
        } else if (pastTop < -thresh && hasTopSlack) {
            scrollDeltaY = Math.max(pastTop * SCROLL_NUDGE_RATIO, -MAX_SPEED);
        }

        if (scrollDeltaY) {
            if (Math.sign(scrollDeltaY) == -1) scrollDeltaY *= 2;
            container.scrollTo(scrollX, scrollY + scrollDeltaY);
            moveElt(fileElt, scrollDeltaY);
        }

        if (isDragging) requestAnimationFrame(animate);
    }

    function moveElt(elt, dist) {
        let eltY = $.pos(elt).top + dist;
        let scrollY = container.scrollTop;

        // clamp it to top
        let maxTop = Math.max(scrollY, header / 2);
        eltY = Math.max(eltY, maxTop);

        // clamp it to bottom
        let maxBottom = 0;
        /*
         * The clamping is done w.r.t. the last element.
         * If when swaping we swap with last element this causes a problem.
         * In that case we get second to last element and use that as reference.
         */
        let lastFile = $.one(".file:last-of-type");
        let noHeld = $.all(`.file[data-hold="false"]`);
        let lastNotHeld = noHeld[noHeld.length - 1];
        if (lastFile == lastNotHeld) {
            maxBottom = $.pos(lastFile).top + header / 2;
        } else {
            maxBottom = $.pos(lastNotHeld).top + fileHeight + header / 2;
        }
        eltY = Math.min(eltY, maxBottom);

        $.css(elt, "top", `${eltY}px`);
        return eltY;
    }

    function swapElts(eltY) {
        let orgY = $.pos(placeholder).top;
        let changeY = eltY - orgY;

        // move placeholder down to next element
        const thres = header / 2 + fileHeight / 10;
        if (changeY > thres) {
            let nextElt = placeholder.nextElementSibling.nextElementSibling;
            if (nextElt) container.insertBefore(nextElt, placeholder);
        } else if (changeY < -thres) {
            let prevElt = placeholder.previousElementSibling;
            if (prevElt) container.insertBefore(placeholder, prevElt);
        }
    }

    function setMoveStyle(elt, should) {
        if (should) {
            let pos = $.pos(elt);
            $.css(elt, "position", "absolute");
            $.css(elt, "top", `${pos.top}px`);
            $.css(elt, "left", `${pos.left}px`);
            $.attr(elt, "data-hold", "true");
        } else {
            $.css(elt, "position", "");
            $.css(elt, "top", "");
            $.css(elt, "left", "");
            $.attr(elt, "data-hold", "false");
        }
    }

    $.on(container, "wheel", (event) => {
        if ($.attr(fileElt, "data-hold") == "true") event.preventDefault();
    });
}
