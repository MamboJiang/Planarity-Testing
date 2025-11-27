// Frontend/js/visualization.js

export function renderGraph(data) {
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
        startStopped: true, // Default to no physics effect initially
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
        
        // Show Enable Physics Button for Planar Graph
        const enablePhysicsBtn = document.getElementById("enable-physics-planar");
        if (enablePhysicsBtn) {
            enablePhysicsBtn.classList.remove("hidden");
            enablePhysicsBtn.style.display = "flex";
        }
    } else {
        // Non-Planar: Render with Canonical Subgraph (static mode initially)
        renderCanonicalGraph("#result-graph", data);
    }
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
    // const nodeMap = new Map(nodes.map(n => [n.id, n])); // Unused in this version

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

    // --- Simulation Setup ---
    // We always create the simulation so we can toggle it later.
    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(edges).id(d => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2));

    simulation.on("tick", ticked);

    // --- Initial Layout Logic ---
    if (options.staticCoords && nodes[0].x !== undefined) {
        // Stop simulation immediately to prevent force layout from running
        simulation.stop();
        
        // Use static coordinates from data
        // Note: nodes passed to forceSimulation are the same objects
        // But forceSimulation might have overwritten x,y with initial randoms if we didn't be careful?
        // Actually, d3.forceSimulation(nodes) uses existing x,y if present.
        // So we just need to ensure we don't let it tick.
        
        // Update DOM positions immediately
        ticked();
        
        // Zoom to fit after static layout is ready
        zoomToFit();
        
    } else if (options.startStopped) {
        // For Original Input (forceDirected but startStopped)
        // We let the simulation initialize (calculate starting positions) but stop it.
        // Or actually, usually we want to let it run for a bit to stabilize?
        // But "Original Input" implies "as provided".
        // If the input file has coordinates, D3 uses them.
        // If not, D3 assigns random or force-based initial positions.
        // If we want "Original Input", we probably want to respect input coordinates if any.
        // If no coordinates, D3 force layout starts from random.
        // If we stop immediately, it will look like a jumble if random.
        // But the user said "make original input default to no physics".
        // If the user uploads a file with positions (like JSON), we show that.
        // If GML/Matrix without positions, D3 initializes them.
        
        simulation.stop();
        
        // If the nodes didn't have coordinates, D3 initialized them.
        // Let's render them.
        ticked();
        
        zoomToFit();
    } else {
        // Normal running simulation
        // Wait for a few ticks or let it run?
        // Usually we let it run.
        // But for "zoom to fit", it's hard with moving target.
        // We can set an initial zoom based on initial positions?
        // Or just center it.
        // D3 forceCenter keeps it centered.
        // We can do a one-time zoomToFit after a short delay?
        // Or just let user zoom.
        // But request said "Auto zoom to fit".
        
        // Let's do a zoomToFit on start.
        // But force layout expands.
        // Maybe we don't zoomToFit for running simulation continuously, just once.
        zoomToFit();
    }

    function ticked() {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node.attr("transform", d => `translate(${d.x},${d.y})`);
    }

    function zoomToFit() {
        // Calculate bounding box of nodes
        if (nodes.length === 0) return;

        const xExtent = d3.extent(nodes, d => d.x);
        const yExtent = d3.extent(nodes, d => d.y);
        
        if (xExtent[0] === undefined || yExtent[0] === undefined) return;

        const padding = 40;
        const boundsWidth = xExtent[1] - xExtent[0];
        const boundsHeight = yExtent[1] - yExtent[0];
        
        const midX = (xExtent[0] + xExtent[1]) / 2;
        const midY = (yExtent[0] + yExtent[1]) / 2;
        
        // If bounds are tiny (single point), default to scale 1
        if (boundsWidth === 0 || boundsHeight === 0) {
             svg.call(zoom.transform, d3.zoomIdentity.translate(width/2 - midX, height/2 - midY));
             return;
        }

        const scaleX = (width - padding * 2) / boundsWidth;
        const scaleY = (height - padding * 2) / boundsHeight;
        const scale = Math.min(scaleX, scaleY, 2); // Cap max scale at 2

        // Calculate translation to center the graph
        // d3.zoomIdentity.translate(tx, ty).scale(k)
        // The transform is: newX = k * x + tx
        // We want: center = k * mid + tx
        // tx = center - k * mid
        
        const tx = width / 2 - scale * midX;
        const ty = height / 2 - scale * midY;

        svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity
            .translate(tx, ty)
            .scale(scale));
    }

    // Handle Planar Graph Physics Toggle
    if (containerId === "#result-graph" && options.staticCoords) {
         const enablePhysicsBtn = document.getElementById("enable-physics-planar");
         const resetPlanarBtn = document.getElementById("reset-planar");
         
         if (enablePhysicsBtn && resetPlanarBtn) {
             // Clean up old event listeners (not strictly necessary as we replace elements or listeners, but good practice if elements persist)
             // Since we re-render the graph, the button elements are outside the graph container, so they persist.
             // We need to be careful not to stack listeners?
             // Actually, `onclick` property assignment overwrites previous handler. safely.
             
             enablePhysicsBtn.onclick = () => {
                 enablePhysicsBtn.classList.add("hidden");
                 enablePhysicsBtn.style.display = "none";
                 resetPlanarBtn.classList.remove("hidden");
                 resetPlanarBtn.style.display = "flex";
                 
                 simulation.alpha(1).restart();
             };
             
             resetPlanarBtn.onclick = () => {
                 resetPlanarBtn.classList.add("hidden");
                 resetPlanarBtn.style.display = "none";
                 enablePhysicsBtn.classList.remove("hidden");
                 enablePhysicsBtn.style.display = "flex";
                 
                 simulation.stop();
                 
                 // Clear current graph container before re-rendering
                 d3.select(containerId).selectAll("*").remove();
                 
                 // Re-render to reset positions
                 renderSingleGraph(containerId, data, options);
             };
         }
    }

    // Bind Control Buttons
    controls.select(".zoom-in").on("click", () => {
        svg.transition().duration(300).call(zoom.scaleBy, 1.2);
    });

    controls.select(".zoom-out").on("click", () => {
        svg.transition().duration(300).call(zoom.scaleBy, 0.8);
    });

    controls.select(".reset-view").on("click", () => {
        zoomToFit();
    });
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
    const conflictNodeDegrees = new Map();

    conflictEdgesOriginal.forEach(e => {
        conflictNodeIds.add(e.sourceId);
        conflictNodeIds.add(e.targetId);

        conflictNodeDegrees.set(e.sourceId, (conflictNodeDegrees.get(e.sourceId) || 0) + 1);
        conflictNodeDegrees.set(e.targetId, (conflictNodeDegrees.get(e.targetId) || 0) + 1);
    });

    // Pre-calculate principal conflict nodes (degree > 2 in conflict subgraph) for connector mapping
    const principalConflictNodes = nodes.filter(n => {
        // Use backend flag if available (more robust)
        if (n.is_principal !== undefined) {
            return n.is_principal;
        }
        
        // Fallback: Calculate from edges
        if (!conflictNodeIds.has(n.id)) return false;
        const degree = conflictNodeDegrees.get(n.id);
        return degree > 2;
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
        .attr("class", d => {
            let classes = "node";
            if (conflictNodeIds.has(d.id)) {
                const degree = conflictNodeDegrees.get(d.id);
                if (degree > 2) {
                    classes += " conflict-principal";
                } else {
                    classes += " conflict-subdivision";
                }
            }
            return classes;
        });

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

        // Hide ALL canonical edges if ANY node is snapped
        const anyNodeSnapped = snappedNodes.size > 0;
        canonicalGroup.selectAll(".edge.canonical")
            .style("opacity", anyNodeSnapped ? 0 : 1);
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
                // Only map principal nodes to canonical nodes
                principalConflictNodes.forEach((n, i) => {
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
                    // Only map principal nodes to canonical nodes
                    principalConflictNodes.forEach((n, i) => {
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
                        const connectors = [];
                        principalConflictNodes.forEach((n, i) => {
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
        // Only map principal nodes to canonical nodes
        principalConflictNodes.forEach((n, i) => {
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
