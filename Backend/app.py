from flask import Flask, request, jsonify
from flask_cors import CORS
import networkx as nx
import io
import json
import os

# Initialize flask app
app = Flask(__name__)
CORS(app)
#1

# === 1. Custom Parser for .txt (The Robust Logic) ===
def parse_txt_content(content_str):
    """
    Parses raw text data. Robustly handles mixed formats (Matrix vs Edge List).
    """
    try:
        G = nx.Graph()
        raw_lines = content_str.strip().split('\n')
        # Filter out empty lines immediately
        lines = [line.strip() for line in raw_lines if line.strip()]

        if not lines:
            return None

        # Analyze dimensions
        first_row_parts = lines[0].split()
        num_cols = len(first_row_parts)
        num_rows = len(lines)

        # Logic: Matrix MUST be square (Rows == Cols) and have > 1 columns
        is_square_matrix = (num_rows == num_cols) and (num_cols > 1)

        # Check for non-numeric characters in header to rule out Matrix
        has_letters = any(c.isalpha() for c in first_row_parts)

        # Strategy A: Matrix
        is_matrix = is_square_matrix and not has_letters

        if is_matrix:
            print("Format: TXT Adjacency Matrix")
            try:
                for r, line in enumerate(lines):
                    values = line.split()
                    if len(values) != num_cols:
                        raise ValueError("Row mismatch")
                    for c, val in enumerate(values):
                        if val != '0':
                            G.add_edge(str(r), str(c))
                return G
            except ValueError:
                print("Matrix parsing failed, fallback to Edge List.")
                G.clear()

        # Strategy B: Edge List (Fallback & Default)
        print("Format: TXT Edge List")
        for line in lines:
            parts = line.split()
            # Skip invalid lines (garbage, empty, single chars)
            if len(parts) < 2:
                continue

            # Strict: Take only first two parts, convert to string immediately
            u, v = str(parts[0]).strip(), str(parts[1]).strip()
            G.add_edge(u, v)

        if G.number_of_nodes() == 0:
            return None

        return G

    except Exception as e:
        print(f"TXT Parsing Error: {e}")
        return None


# === 2. Master Dispatcher (The Sniffer) ===
def parse_graph_file(file):
    filename = file.filename.lower()

    # Read file into memory
    file_bytes = file.read()

    # Decode to string for content sniffing (ignore errors for binary files)
    try:
        content_str = file_bytes.decode('utf-8').strip()
    except:
        content_str = ""

    print(f"Processing file: {filename}")

    G = None

    try:
        # === STRATEGY 1: Content Sniffing ===
        # If it looks like JSON, parse as JSON regardless of extension
        if content_str.startswith('{') or content_str.startswith('['):
            print("Sniffer: Detected JSON content")
            content = json.loads(content_str)
            # node_link_graph expects {nodes: [], links: []}
            G = nx.node_link_graph(content)

        # If it looks like XML, try GraphML or GEXF
        elif content_str.startswith('<'):
            print("Sniffer: Detected XML content")
            if 'graphml' in content_str.lower():
                G = nx.read_graphml(io.BytesIO(file_bytes))
            elif 'gexf' in content_str.lower():
                G = nx.read_gexf(io.BytesIO(file_bytes))
            else:
                G = nx.read_graphml(io.BytesIO(file_bytes))

        # === STRATEGY 2: Extension Dispatch (Fallback) ===
        elif filename.endswith('.gml'):
            G = nx.read_gml(io.BytesIO(file_bytes))
        elif filename.endswith('.dot') or filename.endswith('.gv'):
            G_temp = nx.nx_pydot.read_dot(io.BytesIO(file_bytes))
            G = nx.Graph(G_temp)
        elif filename.endswith('.mtx'):
            G = nx.read_matrix_market(io.BytesIO(file_bytes))
        elif filename.endswith('.net'):
            G = nx.read_pajek(io.BytesIO(file_bytes))

        # === STRATEGY 3: Text Parser (Last Resort) ===
        else:
            print("Sniffer: Defaulting to TXT/EdgeList parser")
            G = parse_txt_content(content_str)

    except Exception as e:
        print(f"Parser Exception: {e}")
        return None

    # Sanity Check: Convert Directed -> Undirected
    if G and G.is_directed():
        print("Note: Converted directed graph to undirected.")
        G = G.to_undirected()

    return G


# === 3. Routes ===
@app.route('/check-planarity', methods=['POST'])
def check_planarity():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files['file']

    # Use the master dispatcher
    G = parse_graph_file(file)

    if G is None or G.number_of_nodes() == 0:
        return jsonify({
            "status": "InvalidInput",
            "message": "Could not parse graph. Check file format or content.",
            "error_code": 400
        }), 200

    try:
        # Check Planarity
        is_planar, certificate = nx.check_planarity(G, counterexample=True)
        scale = 500

        # === Layout Logic ===
        if is_planar:
            try:
                # Prefer Planar Layout for clean drawing
                pos = nx.planar_layout(certificate)
            except:
                # Fallback if planar_layout fails (rare)
                pos = nx.spring_layout(G, seed=42)
        else:
            # Non-Planar: MUST use spring_layout (Force-Directed)
            pos = nx.spring_layout(G, seed=42)

        # Serialize Nodes (Now always includes x/y)
        nodes = [{"id": str(n), "x": xy[0] * scale, "y": xy[1] * scale} for n, xy in pos.items()]

        # Handle Conflicts (if any)
        conflict_edges = set()
        conflict_type = "None"

        if not is_planar:
            if certificate:
                for u, v in certificate.edges():
                    conflict_edges.add(frozenset([str(u), str(v)]))

                # Identify Subgraph Type
                principal_nodes = [n for n, d in certificate.degree() if d > 2]
                if len(principal_nodes) == 5:
                    conflict_type = "K5"
                elif len(principal_nodes) == 6:
                    conflict_type = "K3,3"
                else:
                    conflict_type = "Complex Non-Planar"

        # Serialize Edges
        edges = []
        for u, v in G.edges():
            u_str, v_str = str(u), str(v)
            is_conflict = frozenset([u_str, v_str]) in conflict_edges
            edges.append({
                "source": u_str,
                "target": v_str,
                "is_conflict": is_conflict
            })

        return jsonify({
            "status": "planar" if is_planar else "non_planar",
            "type": conflict_type,
            "nodes": nodes,
            "edges": edges,
            "message": "Graph is Planar" if is_planar else f"Non-Planar: {conflict_type}"
        })

    except Exception as e:
        print(f"Algorithm Error: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    print("Backend running on http://localhost:5001")
    app.run(debug=True, port=5001)

    #1