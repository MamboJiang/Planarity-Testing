export function mockResponse(filename) {
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
