import {
    UI,
    showError,
    setServerStatus,
    setLoadingState,
    updateStats,
    resetGraphUI,
    initModal,
    initDivider
} from './ui.js';
import { checkPlanarity, pingServer } from './api.js';
import { renderGraph } from './visualization.js';

document.addEventListener("DOMContentLoaded", () => {
    // Initialize UI components
    initModal();
    initDivider();

    // Server Status Check
    async function checkServer() {
        const connected = await pingServer();
        setServerStatus(connected);
    }
    setServerStatus(false);
    checkServer();
    setInterval(checkServer, 10000);

    // File Handling
    async function handleFile(file) {
        setLoadingState();
        resetGraphUI(); // Clear previous graph and reset UI

        const result = await checkPlanarity(file);

        if (result.success) {
            setServerStatus(result.serverConnected);
            const data = result.data;

            // Check for Invalid Input
            if (data.status === "InvalidInput") {
                showError(data.message || "Invalid file format.");
                return;
            }

            renderGraph(data);
            updateStats(data);
        } else {
            console.error("Error:", result.error);
            showError("Failed to process graph: " + (result.error.message || result.error));
        }
    }

    // Drag & Drop
    UI.dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        UI.dropZone.classList.add("drag-over");
    });

    UI.dropZone.addEventListener("dragleave", () => {
        UI.dropZone.classList.remove("drag-over");
    });

    UI.dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        UI.dropZone.classList.remove("drag-over");
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    // File Input
    UI.fileInput.addEventListener("change", (e) => {
        if (e.target.files.length) {
            handleFile(e.target.files[0]);
        }
    });
});
