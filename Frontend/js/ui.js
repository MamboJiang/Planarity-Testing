export const UI = {
    fileInput: document.getElementById("file-input"),
    dropZone: document.getElementById("drop-zone"),
    statusPanel: document.getElementById("status-panel"),
    statusText: document.getElementById("status-text"),
    statusDot: document.querySelector("#status-panel .status-dot"),
    nodeCountEl: document.getElementById("node-count"),
    edgeCountEl: document.getElementById("edge-count"),
    serverStatusDot: document.getElementById("server-status-dot"),
    errorModal: document.getElementById("error-modal"),
    errorMessage: document.getElementById("error-message"),
    closeModalBtn: document.getElementById("close-modal"),
    resultHeader: document.getElementById("result-header"),
    resultPanel: document.getElementById("result-panel"),
    conflictStat: document.getElementById("conflict-stat"),
    conflictType: document.getElementById("conflict-type"),
    playAnimationBtn: document.getElementById("play-animation"),
    resetGraphBtn: document.getElementById("reset-graph"),
    enablePhysicsPlanarBtn: document.getElementById("enable-physics-planar"),
    resetPlanarBtn: document.getElementById("reset-planar"),
    animationControls: document.getElementById("animation-controls"),
    originalGraph: document.getElementById("original-graph"),
    resultGraph: document.getElementById("result-graph"),
    divider: document.getElementById("panel-divider"),
    leftPanel: document.querySelector(".view-panel:first-child"),
    rightPanel: document.getElementById("result-panel"),
    container: document.querySelector(".split-view")
};

export function showError(message) {
    UI.errorMessage.textContent = message;
    UI.errorModal.style.display = "flex";
    void UI.errorModal.offsetWidth; // Trigger reflow
    UI.errorModal.classList.add("show");

    // Reset Status Panel
    UI.statusText.textContent = "Error";
    UI.statusDot.style.backgroundColor = "#ef4444";
    UI.statusDot.style.boxShadow = "0 0 8px #ef4444";
}

export function setServerStatus(connected) {
    if (!UI.serverStatusDot) return;
    if (connected) {
        UI.serverStatusDot.style.backgroundColor = "#4ade80";
        UI.serverStatusDot.style.boxShadow = "0 0 8px #4ade80";
        UI.serverStatusDot.setAttribute("title", "服务器已连接");
    } else {
        UI.serverStatusDot.style.backgroundColor = "#ef4444";
        UI.serverStatusDot.style.boxShadow = "0 0 8px #ef4444";
        UI.serverStatusDot.setAttribute("title", "服务器未连接");
    }
}

export function setLoadingState() {
    UI.statusPanel.style.display = "block";
    UI.statusText.textContent = "Processing...";
    UI.statusDot.style.backgroundColor = "#fbbf24"; // Yellow
    UI.statusDot.style.boxShadow = "0 0 8px #fbbf24";

    UI.resultPanel.classList.remove("expanded");
    UI.conflictStat.style.display = "none";
    UI.conflictType.textContent = "-";
    UI.resultHeader.style.color = "";
}

export function updateStats(data) {
    UI.nodeCountEl.textContent = data.nodes.length;
    UI.edgeCountEl.textContent = data.edges.length;

    if (data.status === "planar") {
        UI.statusText.textContent = "Planar Graph";
        UI.statusDot.style.backgroundColor = "#4ade80"; // Green
        UI.statusDot.style.boxShadow = "0 0 8px #4ade80";
        UI.resultHeader.style.color = "#4ade80";
    } else {
        UI.statusText.textContent = "Non-Planar";
        UI.statusDot.style.backgroundColor = "#ef4444"; // Red
        UI.statusDot.style.boxShadow = "0 0 8px #ef4444";
        UI.resultHeader.style.color = "#ef4444";

        setTimeout(() => {
            UI.resultPanel.classList.add("expanded");
            if (data.type) {
                UI.conflictStat.style.display = "flex";
                UI.conflictType.textContent = data.type;
            }
            UI.playAnimationBtn.classList.remove("hidden");
            UI.resetGraphBtn.classList.remove("hidden");
        }, 500);
    }
}

export function resetGraphUI() {
    UI.originalGraph.innerHTML = "";
    UI.resultGraph.innerHTML = "";
    UI.playAnimationBtn.classList.add("hidden");
    UI.resetGraphBtn.classList.add("hidden");
    if (UI.enablePhysicsPlanarBtn) UI.enablePhysicsPlanarBtn.classList.add("hidden");
    if (UI.resetPlanarBtn) {
        UI.resetPlanarBtn.classList.add("hidden");
        UI.resetPlanarBtn.style.display = "none";
    }
    UI.animationControls.classList.add("hidden");
    UI.resultPanel.classList.remove("expanded");
}

export function initModal() {
    UI.closeModalBtn.addEventListener("click", () => {
        UI.errorModal.classList.remove("show");
        setTimeout(() => {
            UI.errorModal.style.display = "none";
        }, 300);
    });
}

export function initDivider() {
    let isDragging = false;

    UI.divider.addEventListener("mousedown", (e) => {
        isDragging = true;
        document.body.style.cursor = "col-resize";
        e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;

        const containerRect = UI.container.getBoundingClientRect();
        const offsetX = e.clientX - containerRect.left;
        const percentage = (offsetX / containerRect.width) * 100;

        if (percentage > 20 && percentage < 80) {
            UI.leftPanel.style.flex = `${percentage} 1 0%`;
            UI.rightPanel.style.flex = `${100 - percentage} 1 0%`;
        }
    });

    document.addEventListener("mouseup", () => {
        isDragging = false;
        document.body.style.cursor = "";
    });
}
