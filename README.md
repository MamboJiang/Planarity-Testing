# 🌐 Planarity Inspector
> **Hackathon 2025 Project** - *Visualizing Graph Theory Algorithms with Modern Web Tech*

A powerful, interactive web application for testing graph planarity. Unlike standard tools that just say "Yes" or "No", Planarity Inspector **visualizes the proof**: it either constructs a planar embedding or extracts and animates the specific non-planar conflict (Kuratowski subgraph).

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.8+-blue.svg)
![JavaScript](https://img.shields.io/badge/javascript-ES6+-yellow.svg)
![D3.js](https://img.shields.io/badge/D3.js-v7-orange.svg)

## 🚀 Why This Project?

Graph planarity is a fundamental concept in graph theory with applications in circuit design and layout optimization. This tool bridges the gap between abstract algorithms and visual understanding.

### Key Highlights
*   **Dual-Algorithm Engine**:
    *   ⚡ **Left-Right Planarity Test (O(n))**: Industry-standard algorithm (via NetworkX) for instant results.
    *   🛠️ **Kuratowski Search (O(E·N))**: A custom implementation that finds specific $K_5$ or $K_{3,3}$ subdivisions to "prove" non-planarity.
*   **Interactive Proofs**:
    *   **Planar**: Physics-based force-directed layout that untangles the graph before your eyes.
    *   **Non-Planar**: Smooth animations that isolate the conflict subgraph, snapping it to its canonical form.
*   **Seamless Workflow**: Integrated **Graph Editor** allows you to draw, modify, and re-test graphs instantly.

---

## 📸 Screenshots

| | |
|:--:|:--:|
| <img src="readme_example/UI.png" alt="UI Overview" width="45%"/> | <img src="readme_example/Editor.png" alt="Graph Editor" width="45%"/> |
| **Modern UI & File Support** | **Built-in Graph Editor** |
| <img src="readme_example/Planar.png" alt="Planar Graph Result" width="45%"/> | <img src="readme_example/Non-Planar.png" alt="Non-Planar Graph Result" width="45%"/> |
| **Planar Embedding** | **Conflict Visualization** |

---

## ✨ Features

### 🎨 Interactive Graph Editor
*   **Draw & Edit**: Create nodes/edges with a click. Drag to reorganize.
*   **Sync & Reload**: Seamlessly switch between the editor and the analyzer.
*   **Smart Tools**: Auto-snap, selection deletion, and pan/zoom support.
*   **Import/Export**: Supports `.txt` (Edge List), `.json`, `.gml`, `.graphml`, `.dot`, and more.

### 📊 Advanced Visualization
#### For Planar Graphs
*   **Dynamic Layout**: Uses D3.js force simulation to untangle edges.
*   **Interactive Physics**: Grab nodes and throw them around—the graph stays planar!

#### For Non-Planar Graphs
*   **Conflict Isolation**: Automatically detects and highlights the specific edges causing non-planarity.
*   **Canonical Morphing**: Watch the graph transform to reveal the hidden $K_5$ or $K_{3,3}$ structure.
*   **Step-by-Step Animation**: Educational mode to trace the conflict edges one by one.

---

## 🛠️ Tech Stack

### Backend (`/Backend`)
*   **Flask**: Lightweight Python web server.
*   **NetworkX**: Powerful graph library for the Left-Right planarity test.
*   **Custom Algorithms**: Implemented logic for Kuratowski subgraph extraction.

### Frontend (`/Frontend`)
*   **Vanilla JS + ES6**: No heavy framework overhead.
*   **D3.js v7**: The gold standard for data visualization on the web.
*   **Glassmorphism UI**: Modern, clean aesthetic with CSS backdrop-filters.

---

## 🚀 Getting Started

### Prerequisites
*   **Python**: 3.8+
*   **Modern Browser**: Chrome, Firefox, Safari, or Edge

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/MamboJiang/Planarity-Testing.git
    cd Planarity-Testing
    ```

2.  **Backend Setup**
    ```bash
    cd Backend
    pip install -r requirements.txt
    ```

3.  **Start the App**
    ```bash
    python app.py
    ```
    The backend will start on `http://localhost:5001`.

4.  **Open Frontend**
    *   Simply open `Frontend/index.html` in your browser.
    *   (Optional) For best performance, serve it locally:
        ```bash
        cd Frontend
        npx serve .
        ```

---

## 📖 Usage Guide

1.  **Upload or Draw**: Drag & drop a file or use the Editor to create a graph.
2.  **Select Algorithm**: Choose between "Left-Right" (Fast) or "Kuratowski Search" (Educational).
3.  **Analyze**: The tool processes the graph.
    *   **If Planar**: Enjoy the physics simulation.
    *   **If Non-Planar**: Click "Play Animation" to see the proof.
4.  **Iterate**: Use the **Reload Analysis** button to re-run tests or jump back to the Editor to fix the graph.

---

## 🤝 Contributing

This is a Hackathon project! Ideas and PRs are welcome.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request
