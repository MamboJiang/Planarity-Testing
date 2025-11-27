document.addEventListener("DOMContentLoaded", () => {
    const fileInput = document.getElementById("file-input");
    const dropZone = document.getElementById("drop-zone");
    const graphContainer = document.getElementById("graph-container");
    const statusPanel = document.getElementById("status-panel");
    const statusText = document.getElementById("status-text");
    const statusDot = document.querySelector(".status-dot");
    const nodeCountEl = document.getElementById("node-count");
    const edgeCountEl = document.getElementById("edge-count");

    // Modal Elements
    const errorModal = document.getElementById("error-modal");
    const errorMessage = document.getElementById("error-message");
    const closeModalBtn = document.getElementById("close-modal");

    // Draggable divider
    const divider = document.getElementById("panel-divider");
    const leftPanel = document.querySelector(".view-panel:first-child");
    const rightPanel = document.getElementById("result-panel");

    let isDragging = false;

    divider.addEventListener("mousedown", (e) => {
        isDragging = true;
        document.body.style.cursor = "col-resize";
        e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;

        const container = document.querySelector(".split-view");
        const containerRect = container.getBoundingClientRect();
        const offsetX = e.clientX - containerRect.left;
        const percentage = (offsetX / containerRect.width) * 100;

        // Limit between 20% and 80%
        if (percentage > 20 && percentage < 80) {
            leftPanel.style.flex = `${percentage} 1 0%`;
            rightPanel.style.flex = `${100 - percentage} 1 0%`;
        }
    });

    document.addEventListener("mouseup", () => {
        isDragging = false;
        document.body.style.cursor = "";
    });

    // Close Modal Event
    closeModalBtn.addEventListener("click", () => {
        errorModal.classList.remove("show");
        setTimeout(() => {
            errorModal.style.display = "none";
        }, 300);
    });

    // Initialize D3 Zoom (Removed: handled per graph instance)

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

    function showError(message) {
        errorMessage.textContent = message;
        errorModal.style.display = "flex";
        // Trigger reflow
        void errorModal.offsetWidth;
        errorModal.classList.add("show");

        // Reset Status Panel
        statusText.textContent = "Error";
        statusDot.style.backgroundColor = "#ef4444";
        statusDot.style.boxShadow = "0 0 8px #ef4444";
    }

    async function handleFile(file) {
        // Update UI to loading state
        statusPanel.style.display = "block";
        statusText.textContent = "Processing...";
        statusDot.style.backgroundColor = "#fbbf24"; // Yellow
        statusDot.style.boxShadow = "0 0 8px #fbbf24";

        // Reset UI state
        document.getElementById("result-panel").classList.remove("expanded");
        document.getElementById("conflict-stat").style.display = "none";
        document.getElementById("conflict-type").textContent = "-";
        document.getElementById("result-header").style.color = ""; // Reset color

        const formData = new FormData();
        formData.append("file", file);

        try {
            let data;
            try {
                const response = await fetch("http://127.0.0.1:5001/check-planarity", {
                    method: "POST",
                    body: formData
                });
                if (!response.ok) throw new Error("Backend error");
                data = await response.json();
            } catch (err) {
                console.warn("Backend connection failed, using mock data.", err);
                data = mockResponse(file.name);
            }

            // Check for Invalid Input from Backend
            if (data.status === "InvalidInput") {
                showError(data.message || "Invalid file format.");
                return;
            }

            renderGraph(data);
            updateStats(data);

        } catch (error) {
            console.error("Error:", error);
            showError("Failed to process graph: " + error.message);
        }
    }

    function updateStats(data) {
        nodeCountEl.textContent = data.nodes.length;
        edgeCountEl.textContent = data.edges.length;
        const resultHeader = document.getElementById("result-header");

        if (data.status === "planar") {
            statusText.textContent = "Planar Graph";
            statusDot.style.backgroundColor = "#4ade80"; // Green
            statusDot.style.boxShadow = "0 0 8px #4ade80";

            // Header Color Green
            resultHeader.style.color = "#4ade80";

        } else {
            statusText.textContent = "Non-Planar";
            statusDot.style.backgroundColor = "#ef4444"; // Red
            statusDot.style.boxShadow = "0 0 8px #ef4444";

            // Header Color Red
            resultHeader.style.color = "#ef4444";

            // Expand panel and show type
            setTimeout(() => {
                document.getElementById("result-panel").classList.add("expanded");
                if (data.type) {
                    document.getElementById("conflict-stat").style.display = "flex";
                    document.getElementById("conflict-type").textContent = data.type;
                }
                // Show Play Animation button and Reset button
                document.getElementById("play-animation").classList.remove("hidden");
                document.getElementById("reset-graph").classList.remove("hidden");
            }, 500);
        }
    }

    function renderGraph(data) {
        // Clear previous graphs
        document.getElementById("original-graph").innerHTML = "";
        document.getElementById("result-graph").innerHTML = "";

        // Reset animation UI
        document.getElementById("play-animation").classList.add("hidden");
        document.getElementById("reset-graph").classList.add("hidden");
        document.getElementById("animation-controls").classList.add("hidden");

        // Reset panel expansion (will re-trigger if non-planar)
        document.getElementById("result-panel").classList.remove("expanded");

        // 1. Render Original Input
        renderSingleGraph("#original-graph", data, {
            forceDirected: true,
            highlightConflicts: false,
            staticCoords: false
        });

        // 2. Render Result
        if (data.status === "planar") {
            renderSingleGraph("#result-graph", data, {
                forceDirected: false,
                highlightConflicts: false,
                staticCoords: true
            });
        } else {
            // Non-Planar: Render with Canonical Subgraph (static mode initially)
            renderCanonicalGraph("#result-graph", data);
        }
    }

    function renderCanonicalGraph(containerId, data) {
        const container = document.querySelector(containerId);
        const width = container.clientWidth;
        const height = container.clientHeight;
        const controls = d3.select("#controls-result");

        const zoom = d3.zoom()
            .scaleExtent([0.1, 10])
            .on("zoom", (event) => {
                svg.select("g.main-group").attr("transform", event.transform);
            });

        const svg = d3.select(containerId)
            .append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .call(zoom)
            .on("dblclick.zoom", null);

        const mainGroup = svg.append("g").attr("class", "main-group");

        // --- 1. Draw Main Graph (Force Directed) ---
        const nodes = data.nodes.map(d => ({ ...d }));
        const edges = data.edges.map(d => ({ ...d }));

        // Store conflict edges with original string IDs for animation
        const conflictEdgesOriginal = edges.filter(e => e.is_conflict).map(e => ({
            source: e.source,
            target: e.target,
            sourceId: String(e.source),
            targetId: String(e.target)
        }));

        const conflictNodeIds = new Set();
        conflictEdgesOriginal.forEach(e => {
            conflictNodeIds.add(e.sourceId);
            conflictNodeIds.add(e.targetId);
        });

        const simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(edges).id(d => d.id).distance(100))
            .force("charge", d3.forceManyBody().strength(-300))
            .force("center", d3.forceCenter(width / 3, height / 2));

        const link = mainGroup.append("g")
            .selectAll("line")
            .data(edges)
            .join("line")
            .attr("class", d => d.is_conflict ? "edge conflict" : "edge");

        const node = mainGroup.append("g")
            .selectAll(".node")
            .data(nodes)
            .join("g")
            .attr("class", "node");

        node.append("circle").attr("r", 6);
        node.append("text").attr("dx", 10).attr("dy", 4).text(d => d.id);

        // Track snapped nodes
        const snappedNodes = new Map(); // nodeId -> canonicalNode

        // Function to update physics based on snapped state
        function updatePhysics() {
            if (snappedNodes.size > 0) {
                // Disable physics when any node is snapped
                simulation.stop();
            } else {
                // Re-enable physics when no nodes are snapped
                simulation.alpha(0.3).restart();
            }
        }

        // Function to hide/show canonical nodes based on snapping
        function updateCanonicalVisibility() {
            // Create a set of occupied canonical node IDs
            const occupiedCanonicalIds = new Set();
            for (const [nodeId, canonNode] of snappedNodes) {
                occupiedCanonicalIds.add(canonNode.id);
            }

            // Update all canonical nodes
            canonicalGroup.selectAll(".node.canonical")
                .each(function (d) {
                    const isOccupied = occupiedCanonicalIds.has(d.id);
                    const nodeGroup = d3.select(this);
                    nodeGroup
                        .style("opacity", isOccupied ? 0 : 1)
                        .style("pointer-events", isOccupied ? "none" : "all");

                    // Also restore circle opacity (in case it was changed during animation)
                    nodeGroup.select("circle").style("opacity", isOccupied ? 0 : 1);
                });

            // Hide canonical edges if both endpoints are snapped
            canonicalGroup.selectAll(".edge.canonical")
                .each(function (d) {
                    const sourceOccupied = occupiedCanonicalIds.has(d.source.id);
                    const targetOccupied = occupiedCanonicalIds.has(d.target.id);
                    d3.select(this).style("opacity", (sourceOccupied && targetOccupied) ? 0 : 1);
                });
        }

        // Make nodes draggable
        node.call(d3.drag()
            .on("start", function (event, d) {
                // If node is snapped, unsnap it first
                if (snappedNodes.has(d.id)) {
                    const canonNode = snappedNodes.get(d.id);
                    snappedNodes.delete(d.id);
                    updateCanonicalVisibility();
                    updatePhysics();
                }

                // Only restart simulation if no nodes are snapped
                if (snappedNodes.size === 0) {
                    if (!event.active) simulation.alphaTarget(0.3).restart();
                }
                d.fx = d.x;
                d.fy = d.y;
            })
            .on("drag", function (event, d) {
                d.fx = event.x;
                d.fy = event.y;

                // Manually update node position when physics is stopped
                if (snappedNodes.size > 0) {
                    d.x = event.x;
                    d.y = event.y;
                    d3.select(this).attr("transform", `translate(${d.x},${d.y})`);

                    // Update edges connected to this node
                    link.filter(e => e.source === d || e.target === d)
                        .attr("x1", e => e.source.x)
                        .attr("y1", e => e.source.y)
                        .attr("x2", e => e.target.x)
                        .attr("y2", e => e.target.y);

                    // Update connector lines when physics is stopped
                    const connectors = [];
                    const conflictNodesArr = nodes.filter(n => conflictNodeIds.has(n.id));
                    conflictNodesArr.forEach((n, i) => {
                        const target = canonicalData.nodes[i % canonicalData.nodes.length];
                        connectors.push({ source: n, target: target });
                    });

                    connectorGroup.selectAll(".connector-line")
                        .data(connectors)
                        .join("line")
                        .attr("class", "connector-line")
                        .attr("x1", d => d.source.x)
                        .attr("y1", d => d.source.y)
                        .attr("x2", d => d.target.x)
                        .attr("y2", d => d.target.y);
                }
            })
            .on("end", function (event, d) {
                // Only stop simulation if no nodes are snapped
                if (snappedNodes.size === 0) {
                    if (!event.active) simulation.alphaTarget(0);
                }

                // Snap to canonical node if close enough
                const snapDistance = 30; // pixels (reduced from 50)
                let snapTarget = null;

                // Only snap if we have canonical nodes and this is a conflict node
                if (conflictNodeIds.has(d.id)) {
                    let minDistance = snapDistance;

                    for (const canonNode of canonicalData.nodes) {
                        // Skip if this canonical node is already occupied
                        let occupied = false;
                        for (const [nodeId, cn] of snappedNodes) {
                            if (cn.id === canonNode.id && nodeId !== d.id) {
                                occupied = true;
                                break;
                            }
                        }
                        if (occupied) continue;

                        const dx = d.x - canonNode.x;
                        const dy = d.y - canonNode.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        if (distance < minDistance) {
                            minDistance = distance;
                            snapTarget = canonNode;
                        }
                    }
                }

                if (snapTarget) {
                    // Animate the node flying to the canonical position
                    const nodeSelection = d3.select(this);
                    const transitionDuration = 300;
                    const startTime = Date.now();

                    // Function to update connectors during animation
                    const updateConnectorsDuringFlight = () => {
                        const connectors = [];
                        const conflictNodesArr = nodes.filter(n => conflictNodeIds.has(n.id));
                        conflictNodesArr.forEach((n, i) => {
                            const target = canonicalData.nodes[i % canonicalData.nodes.length];
                            connectors.push({ source: n, target: target });
                        });

                        connectorGroup.selectAll(".connector-line")
                            .data(connectors)
                            .join("line")
                            .attr("class", "connector-line")
                            .attr("x1", d => d.source.x)
                            .attr("y1", d => d.source.y)
                            .attr("x2", d => d.target.x)
                            .attr("y2", d => d.target.y);
                    };

                    nodeSelection
                        .transition()
                        .duration(transitionDuration)
                        .ease(d3.easeCubicOut)
                        .attrTween("transform", function () {
                            const startX = d.x;
                            const startY = d.y;
                            return function (t) {
                                const x = startX + (snapTarget.x - startX) * t;
                                const y = startY + (snapTarget.y - startY) * t;
                                d.x = x;
                                d.y = y;
                                d.fx = x;
                                d.fy = y;

                                // Update edges connected to this node during animation
                                link.filter(e => e.source === d || e.target === d)
                                    .attr("x1", e => e.source.x)
                                    .attr("y1", e => e.source.y)
                                    .attr("x2", e => e.target.x)
                                    .attr("y2", e => e.target.y);

                                // Update connector lines during animation
                                updateConnectorsDuringFlight();

                                return `translate(${x},${y})`;
                            };
                        })
                        .on("end", function () {
                            // Snap complete
                            d.fx = snapTarget.x;
                            d.fy = snapTarget.y;
                            snappedNodes.set(d.id, snapTarget);
                            updateCanonicalVisibility();
                            updatePhysics();

                            // Final connector update
                            updateConnectorsDuringFlight();

                            // Visual feedback on canonical node
                            canonicalGroup.selectAll(".node.canonical")
                                .filter(n => n.id === snapTarget.id)
                                .select("circle")
                                .transition()
                                .duration(200)
                                .attr("r", 12)
                                .transition()
                                .duration(200)
                                .attr("r", 8)
                                .transition()
                                .duration(200)
                                .style("opacity", 0);
                        });
                } else {
                    // If not snapped, release the node
                    d.fx = null;
                    d.fy = null;
                }
            })
        );

        // --- 2. Canonical Graph (initially visible) ---
        const type = data.type || "K5";
        const canonicalData = generateCanonicalData(type, width * 0.8, height * 0.7); // Bottom-right

        const canonicalGroup = mainGroup.append("g").attr("class", "canonical-group");
        const connectorGroup = mainGroup.append("g").attr("class", "connector-group");

        canonicalGroup.selectAll(".edge.canonical")
            .data(canonicalData.edges)
            .join("line")
            .attr("class", "edge canonical")
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        const canonicalNodes = canonicalGroup.selectAll(".node.canonical")
            .data(canonicalData.nodes)
            .join("g")
            .attr("class", "node canonical")
            .attr("transform", d => `translate(${d.x},${d.y})`);

        canonicalNodes.append("circle").attr("r", 8);
        canonicalNodes.append("text").attr("dx", 10).attr("dy", 4).text(d => d.id);

        // --- 3. Animation State ---
        let animationMode = false;
        let currentStep = 0;
        const totalSteps = conflictEdgesOriginal.length;

        // Animation edges group (initially empty)
        const animEdgesGroup = mainGroup.append("g").attr("class", "anim-edges");

        // Animation nodes group (copy of canonical nodes, shown during animation)
        const animNodesGroup = mainGroup.append("g").attr("class", "anim-nodes");

        function updateAnimationStep(step) {
            currentStep = Math.max(0, Math.min(step, totalSteps));

            // Update progress UI
            const progress = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;
            d3.select("#progress-fill").style("width", progress + "%");
            d3.select("#step-counter").text(`Step ${currentStep} / ${totalSteps}`);

            // Show canonical nodes during animation (using normal node style)
            // Map node IDs to conflict node IDs from the original graph
            const conflictNodeIdsArray = Array.from(conflictNodeIds);
            const mappedCanonicalNodes = canonicalData.nodes.map((n, i) => ({
                ...n,
                id: conflictNodeIdsArray[i % conflictNodeIdsArray.length] || n.id
            }));

            animNodesGroup.selectAll(".node")
                .data(mappedCanonicalNodes)
                .join(
                    enter => {
                        const g = enter.append("g").attr("class", "node");
                        g.append("circle").attr("r", 6);
                        g.append("text").attr("dx", 10).attr("dy", 4).text(d => d.id);

                        // Make animation nodes draggable to prevent SVG zoom interference
                        g.call(d3.drag()
                            .on("start", function (event) {
                                event.sourceEvent.stopPropagation(); // Prevent zoom
                            })
                            .on("drag", function (event) {
                                event.sourceEvent.stopPropagation(); // Prevent zoom
                            })
                            .on("end", function (event) {
                                event.sourceEvent.stopPropagation(); // Prevent zoom
                            })
                        );

                        return g;
                    }
                )
                .attr("transform", d => `translate(${d.x},${d.y})`);

            // Redraw animation edges (fly from original to canonical position)
            const edgesToShow = conflictEdgesOriginal.slice(0, currentStep);
            const edgesToRemove = conflictEdgesOriginal.slice(currentStep);

            // Handle entering edges (fly in)
            animEdgesGroup.selectAll(".edge.canonical")
                .data(edgesToShow, (d, i) => i)
                .join(
                    enter => {
                        const line = enter.append("line")
                            .attr("class", "edge canonical");

                        // Set initial position from graph nodes
                        line.attr("x1", d => {
                            const sourceNode = nodes.find(n => n.id === d.sourceId);
                            return sourceNode ? sourceNode.x : 0;
                        })
                            .attr("y1", d => {
                                const sourceNode = nodes.find(n => n.id === d.sourceId);
                                return sourceNode ? sourceNode.y : 0;
                            })
                            .attr("x2", d => {
                                const targetNode = nodes.find(n => n.id === d.targetId);
                                return targetNode ? targetNode.x : 0;
                            })
                            .attr("y2", d => {
                                const targetNode = nodes.find(n => n.id === d.targetId);
                                return targetNode ? targetNode.y : 0;
                            });

                        // Animate to canonical position
                        line.transition()
                            .duration(500)
                            .attr("x1", (d, i) => canonicalData.edges[i].source.x)
                            .attr("y1", (d, i) => canonicalData.edges[i].source.y)
                            .attr("x2", (d, i) => canonicalData.edges[i].target.x)
                            .attr("y2", (d, i) => canonicalData.edges[i].target.y);

                        return line;
                    },
                    update => {
                        // For existing edges, just keep them at canonical position
                        return update
                            .attr("x1", (d, i) => canonicalData.edges[i].source.x)
                            .attr("y1", (d, i) => canonicalData.edges[i].source.y)
                            .attr("x2", (d, i) => canonicalData.edges[i].target.x)
                            .attr("y2", (d, i) => canonicalData.edges[i].target.y);
                    },
                    exit => {
                        // Fly back to original position before removing
                        exit.transition()
                            .duration(500)
                            .attr("x1", d => {
                                const sourceNode = nodes.find(n => n.id === d.sourceId);
                                return sourceNode ? sourceNode.x : 0;
                            })
                            .attr("y1", d => {
                                const sourceNode = nodes.find(n => n.id === d.sourceId);
                                return sourceNode ? sourceNode.y : 0;
                            })
                            .attr("x2", d => {
                                const targetNode = nodes.find(n => n.id === d.targetId);
                                return targetNode ? targetNode.x : 0;
                            })
                            .attr("y2", d => {
                                const targetNode = nodes.find(n => n.id === d.targetId);
                                return targetNode ? targetNode.y : 0;
                            })
                            .remove();
                    }
                );
        }

        // Play Animation Button
        d3.select("#play-animation").on("click", () => {
            animationMode = true;
            currentStep = 0;

            // Hide static canonical edges and nodes
            canonicalGroup.selectAll(".edge.canonical").style("display", "none");
            canonicalGroup.selectAll(".node.canonical").style("display", "none");

            // Hide Play button, show animation controls
            d3.select("#play-animation").classed("hidden", true);
            d3.select("#animation-controls").classed("hidden", false);

            // Start animation
            updateAnimationStep(0);
        });

        // Cancel Animation Button
        d3.select("#cancel-animation").on("click", () => {
            animationMode = false;
            currentStep = 0;

            // Clear animation edges and nodes
            animEdgesGroup.selectAll("*").remove();
            animNodesGroup.selectAll("*").remove();

            // Restore static canonical
            canonicalGroup.selectAll(".edge.canonical").style("display", null);
            canonicalGroup.selectAll(".node.canonical").style("display", null);

            // Hide animation controls, show Play button
            d3.select("#animation-controls").classed("hidden", true);
            d3.select("#play-animation").classed("hidden", false);

            // Reset progress
            d3.select("#progress-fill").style("width", "0%");
            d3.select("#step-counter").text("Step 0 / 0");
        });

        // Prev/Next Buttons
        d3.select("#anim-prev").on("click", () => {
            if (animationMode) updateAnimationStep(currentStep - 1);
        });

        d3.select("#anim-next").on("click", () => {
            if (animationMode) updateAnimationStep(currentStep + 1);
        });

        // --- 4. Update Simulation ---
        simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node.attr("transform", d => `translate(${d.x},${d.y})`);

            // Connector lines (always the same, regardless of animation state)
            const connectors = [];
            const conflictNodesArr = nodes.filter(n => conflictNodeIds.has(n.id));
            conflictNodesArr.forEach((n, i) => {
                const target = canonicalData.nodes[i % canonicalData.nodes.length];
                connectors.push({ source: n, target: target });
            });

            connectorGroup.selectAll(".connector-line")
                .data(connectors)
                .join("line")
                .attr("class", "connector-line")
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);
        });

        // Bind Controls
        controls.select(".zoom-in").on("click", () => svg.transition().call(zoom.scaleBy, 1.2));
        controls.select(".zoom-out").on("click", () => svg.transition().call(zoom.scaleBy, 0.8));
        controls.select(".reset-view").on("click", () => svg.transition().call(zoom.transform, d3.zoomIdentity));

        // Reset Graph Button - restore to initial state
        d3.select("#reset-graph").on("click", () => {
            // Clear all snapped nodes
            snappedNodes.clear();

            // Remove all fixed positions
            nodes.forEach(n => {
                n.fx = null;
                n.fy = null;
            });

            // Restore canonical visibility
            updateCanonicalVisibility();

            // Restart physics
            simulation.alpha(0.3).restart();
            updatePhysics();
        });
    }

    function generateCanonicalData(type, centerX, centerY) {
        const radius = 100;
        let nodes = [];
        let edges = [];

        if (type === "K5") {
            // Pentagon layout
            for (let i = 0; i < 5; i++) {
                const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                nodes.push({
                    id: `K5-${i + 1}`,
                    x: centerX + radius * Math.cos(angle),
                    y: centerY + radius * Math.sin(angle)
                });
            }
            // Complete graph edges
            for (let i = 0; i < 5; i++) {
                for (let j = i + 1; j < 5; j++) {
                    edges.push({ source: nodes[i], target: nodes[j] });
                }
            }
        } else if (type === "K3,3") {
            // Bipartite layout (two columns)
            for (let i = 0; i < 3; i++) {
                nodes.push({ id: `U${i + 1}`, x: centerX - 50, y: centerY - 60 + i * 60 }); // Left set
                nodes.push({ id: `V${i + 1}`, x: centerX + 50, y: centerY - 60 + i * 60 }); // Right set
            }
            // Complete bipartite edges
            for (let i = 0; i < 3; i++) { // Left set indices: 0, 2, 4
                for (let j = 0; j < 3; j++) { // Right set indices: 1, 3, 5
                    edges.push({ source: nodes[i * 2], target: nodes[j * 2 + 1] });
                }
            }
        }
        return { nodes, edges };
    }

    function renderSingleGraph(containerId, data, options) {
        const container = document.querySelector(containerId);
        const width = container.clientWidth;
        const height = container.clientHeight;

        // Determine which control panel to use based on containerId
        const controlId = containerId === "#original-graph" ? "#controls-original" : "#controls-result";
        const controls = d3.select(controlId);

        // Create a unique zoom behavior for this graph instance
        const zoom = d3.zoom()
            .scaleExtent([0.1, 10])
            .on("zoom", (event) => {
                svg.select("g").attr("transform", event.transform);
            });

        const svg = d3.select(containerId)
            .append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .call(zoom)
            .on("dblclick.zoom", null); // Disable double click zoom

        const g = svg.append("g");

        const nodes = data.nodes.map(d => ({ ...d }));
        const edges = data.edges.map(d => ({ ...d }));
        const nodeMap = new Map(nodes.map(n => [n.id, n]));

        // Draw Edges
        const link = g.append("g")
            .selectAll("line")
            .data(edges)
            .join("line")
            .attr("class", d => (options.highlightConflicts && d.is_conflict) ? "edge conflict" : "edge");

        // Draw Nodes
        const node = g.append("g")
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

            // Initial Transform to center
            const initialTransform = d3.zoomIdentity.translate(xOffset, yOffset);
            svg.call(zoom.transform, initialTransform);

            link
                .attr("x1", d => nodeMap.get(d.source).x)
                .attr("y1", d => nodeMap.get(d.source).y)
                .attr("x2", d => nodeMap.get(d.target).x)
                .attr("y2", d => nodeMap.get(d.target).y);

            node.attr("transform", d => `translate(${d.x},${d.y})`);
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

        // Bind Control Buttons
        controls.select(".zoom-in").on("click", () => {
            svg.transition().duration(300).call(zoom.scaleBy, 1.2);
        });

        controls.select(".zoom-out").on("click", () => {
            svg.transition().duration(300).call(zoom.scaleBy, 0.8);
        });

        controls.select(".reset-view").on("click", () => {
            if (options.staticCoords) {
                // Re-center static layout
                const xExtent = d3.extent(nodes, d => d.x);
                const yExtent = d3.extent(nodes, d => d.y);
                const xCenter = (xExtent[0] + xExtent[1]) / 2;
                const yCenter = (yExtent[0] + yExtent[1]) / 2;
                const xOffset = width / 2 - xCenter;
                const yOffset = height / 2 - yCenter;
                svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity.translate(xOffset, yOffset));
            } else {
                svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
            }
        });
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
