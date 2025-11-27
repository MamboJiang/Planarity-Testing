document.addEventListener("DOMContentLoaded", () => {
    const fileInput = document.getElementById("file-input");
    const dropZone = document.getElementById("drop-zone");
    const graphContainer = document.getElementById("graph-container");
    const statusPanel = document.getElementById("status-panel");
    const statusText = document.getElementById("status-text");
    const statusDot = document.querySelector(".status-dot");
    const nodeCountEl = document.getElementById("node-count");
    const edgeCountEl = document.getElementById("edge-count");

    // Initialize D3 Zoom
    const zoom = d3.zoom()
        .scaleExtent([0.1, 10])
        .on("zoom", (event) => {
            d3.select("#graph-svg g").attr("transform", event.transform);
        });

    // Setup Drag & Drop
    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("drag-over");
    });

    dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("drag-over");
    });

    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("drag-over");
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener("change", (e) => {
        if (e.target.files.length) {
            handleFile(e.target.files[0]);
        }
    });

    async function handleFile(file) {
        // Update UI to loading state
        statusPanel.style.display = "block";
        statusText.textContent = "Processing...";
        statusDot.style.backgroundColor = "#fbbf24"; // Yellow
        statusDot.style.boxShadow = "0 0 8px #fbbf24";

        const formData = new FormData();
        formData.append("file", file);

        try {
            // In a real scenario, this connects to the backend
            // For MVP, we'll try to connect to localhost:5000, or fallback to mock data if it fails
            let data;
            try {
                const response = await fetch("http://127.0.0.1:5001/check-planarity", {
                    method: "POST",
                    body: formData
                });
                if (!response.ok) throw new Error("Backend error");
                data = await response.json();
            } catch (err) {
                console.warn("Backend connection failed, using mock data for demonstration.", err);
                // Mock Data for demonstration if backend is offline
                data = mockResponse(file.name);
            }

            renderGraph(data);
            updateStats(data);

        } catch (error) {
            console.error("Error:", error);
            statusText.textContent = "Error";
            statusDot.style.backgroundColor = "#ef4444"; // Red
            statusDot.style.boxShadow = "0 0 8px #ef4444";
            alert("Failed to process graph: " + error.message);
        }
    }

    function updateStats(data) {
        nodeCountEl.textContent = data.nodes.length;
        edgeCountEl.textContent = data.edges.length;

        if (data.status === "planar") {
            statusText.textContent = "Planar Graph";
            statusDot.style.backgroundColor = "#4ade80"; // Green
            statusDot.style.boxShadow = "0 0 8px #4ade80";
        } else {
            statusText.textContent = "Non-Planar";
            statusDot.style.backgroundColor = "#ef4444"; // Red
            statusDot.style.boxShadow = "0 0 8px #ef4444";
        }
    }

    function renderGraph(data) {
        // Clear previous graphs
        document.getElementById("original-graph").innerHTML = "";
        document.getElementById("result-graph").innerHTML = "";

        // 1. Render Original Input (Always Force Directed, No Conflict Highlights)
        renderSingleGraph("#original-graph", data, {
            forceDirected: true,
            highlightConflicts: false,
            staticCoords: false
        });

        // 2. Render Result
        if (data.status === "planar") {
            // Planar: Use static coordinates, no conflicts
            renderSingleGraph("#result-graph", data, {
                forceDirected: false,
                highlightConflicts: false,
                staticCoords: true
            });
        } else {
            // Non-Planar: Force Directed, WITH Conflict Highlights
            renderSingleGraph("#result-graph", data, {
                forceDirected: true,
                highlightConflicts: true,
                staticCoords: false
            });
        }
    }

    function renderSingleGraph(containerId, data, options) {
        const container = document.querySelector(containerId);
        const width = container.clientWidth;
        const height = container.clientHeight;

        const svg = d3.select(containerId)
            .append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .call(d3.zoom().scaleExtent([0.1, 10]).on("zoom", (event) => {
                svg.select("g").attr("transform", event.transform);
            }))
            .append("g");

        const nodes = data.nodes.map(d => ({ ...d }));
        const edges = data.edges.map(d => ({ ...d }));
        const nodeMap = new Map(nodes.map(n => [n.id, n]));

        // Draw Edges
        const link = svg.append("g")
            .selectAll("line")
            .data(edges)
            .join("line")
            .attr("class", d => (options.highlightConflicts && d.is_conflict) ? "edge conflict" : "edge");

        // Draw Nodes
        const node = svg.append("g")
            .selectAll(".node")
            .data(nodes)
            .join("g")
            .attr("class", "node");

        node.append("circle")
            .attr("r", 6);

        node.append("text")
            .attr("dx", 10)
            .attr("dy", 4)
            .text(d => d.id);

        if (options.staticCoords && nodes[0].x !== undefined) {
            // Static Layout (Planar)
            const xExtent = d3.extent(nodes, d => d.x);
            const yExtent = d3.extent(nodes, d => d.y);
            const xCenter = (xExtent[0] + xExtent[1]) / 2;
            const yCenter = (yExtent[0] + yExtent[1]) / 2;
            const xOffset = width / 2 - xCenter;
            const yOffset = height / 2 - yCenter;

            link
                .attr("x1", d => nodeMap.get(d.source).x + xOffset)
                .attr("y1", d => nodeMap.get(d.source).y + yOffset)
                .attr("x2", d => nodeMap.get(d.target).x + xOffset)
                .attr("y2", d => nodeMap.get(d.target).y + yOffset);

            node.attr("transform", d => `translate(${d.x + xOffset},${d.y + yOffset})`);
        } else {
            // Force Directed Layout
            const simulation = d3.forceSimulation(nodes)
                .force("link", d3.forceLink(edges).id(d => d.id).distance(100))
                .force("charge", d3.forceManyBody().strength(-300))
                .force("center", d3.forceCenter(width / 2, height / 2));

            simulation.on("tick", () => {
                link
                    .attr("x1", d => d.source.x)
                    .attr("y1", d => d.source.y)
                    .attr("x2", d => d.target.x)
                    .attr("y2", d => d.target.y);

                node.attr("transform", d => `translate(${d.x},${d.y})`);
            });
        }
    }

    // Mock Data Generator for testing without backend
    function mockResponse(filename) {
        if (filename.includes("k5") || filename.includes("non")) {
            return {
                status: "non_planar",
                nodes: [
                    { id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }, { id: "5" }
                ],
                edges: [
                    { source: "1", target: "2", is_conflict: true },
                    { source: "1", target: "3", is_conflict: true },
                    { source: "1", target: "4", is_conflict: true },
                    { source: "1", target: "5", is_conflict: true },
                    { source: "2", target: "3", is_conflict: true },
                    { source: "2", target: "4", is_conflict: true },
                    { source: "2", target: "5", is_conflict: true },
                    { source: "3", target: "4", is_conflict: true },
                    { source: "3", target: "5", is_conflict: true },
                    { source: "4", target: "5", is_conflict: true }
                ]
            };
        } else {
            return {
                status: "planar",
                nodes: [
                    { id: "A", x: 0, y: -100 },
                    { id: "B", x: -86, y: 50 },
                    { id: "C", x: 86, y: 50 },
                    { id: "D", x: 0, y: 0 }
                ],
                edges: [
                    { source: "A", target: "B" },
                    { source: "B", target: "C" },
                    { source: "C", "target": "A" },
                    { source: "A", target: "D" },
                    { source: "B", target: "D" },
                    { source: "C", target: "D" }
                ]
            };
        }
    }
});
