from flask import Flask, request, jsonify
from flask_cors import CORS
import networkx as nx
import io
import json
import os
import time

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
            
            #map links to edges
            if 'links' in content and 'edges' not in content:
                content['edges'] = content['links']
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
        elif filename.endswith('.json'):
            print("Extension: Detected JSON file")
            content = json.loads(content_str)
            G = nx.node_link_graph(content)
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

def naive_kuratowski_search(G):
    # 1. 如果一开始就是平面图，直接返回 True, None
    if nx.is_planar(G):
        return True, None

    # 2. 复制一份图，准备进行破坏性实验
    K = G.copy()
    edges_to_check = list(K.edges())

    # 3. 暴力循环：尝试删除每一条边
    for u, v in edges_to_check:
        # 暂时删除边 (u, v)
        K.remove_edge(u, v)
        
        # 关键点：每删一次，都跑一遍完整的平面检测算法 (耗时来源!)
        if nx.is_planar(K):
            # 哎呀，删了这条边图就变平面了？那这条边是“罪魁祸首”之一，不能删！
            K.add_edge(u, v)
        else:
            # 删了这条边，图还是非平面的？说明这条边是无辜的/多余的，永久删除！
            pass
            
    # 循环结束后，K 中剩下的就是纯粹的 Kuratowski 子图
    return False, K

# === 3. Routes ===
@app.route('/check-planarity', methods=['POST'])
def check_planarity():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files['file']
    algorithm = request.form.get('algorithm', 'Left-Right')

    # Use the master dispatcher
    G = parse_graph_file(file)

    if G is None or G.number_of_nodes() == 0:
        return jsonify({
            "status": "InvalidInput",
            "message": "Could not parse graph. Check file format or content.",
            "error_code": 400
        }), 200

    try:
        is_planar = False
        certificate = None
        conflict_edges = set()
        conflict_type = "None"
        algo_name = ""


        if algorithm == 'Left-Right':
            algo_name = "Left-Right (NetworkX)"
            print("Using Left-Right")
        # Check Planarity

            start_time = time.perf_counter()
            is_planar, certificate = nx.check_planarity(G, counterexample=True)
            end_time = time.perf_counter()

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


            if not is_planar:
                if certificate:
                    for u, v in certificate.edges():
                        conflict_edges.add(frozenset([str(u), str(v)]))




        elif algorithm == 'kuratowski_search':
            algo_name = "Kuratowski Search (Brute Force)"
            print("Using kuratowski_search")

            start_time = time.perf_counter()
            # 调用暴力搜索函数
            is_planar, certificate = naive_kuratowski_search(G)
            end_time = time.perf_counter()

            scale = 500


            # === Layout Logic ===
            if is_planar:
                try:

                    tmep, certificate = nx.check_planarity(G, counterexample=True)
                    # ### 修复 1: 检查 certificate 是否存在且是 Embedding 对象
                    if certificate is not None and isinstance(certificate, nx.PlanarEmbedding):
                        pos = nx.planar_layout(certificate)
                    else:
                        # 如果是暴力算法返回了 True, None，我们没有嵌入信息，
                        # 所以只能用普通布局 (Kamada-Kawai 比较好看，或者 Spring)
                        pos = nx.spring_layout(G, seed=42)
                except Exception as e:
                    print(f"Layout fallback: {e}")
                    pos = nx.spring_layout(G, seed=42)
            else:
                # Non-Planar: MUST use spring_layout (Force-Directed)
                pos = nx.spring_layout(G, seed=42)

            # Serialize Nodes (Now always includes x/y)
            nodes = [{"id": str(n), "x": xy[0] * scale, "y": xy[1] * scale} for n, xy in pos.items()]
            
            # 如果非平面，certificate 就是那个剩下的子图 K
            if not is_planar and certificate:
                for u, v in certificate.edges():
                    conflict_edges.add(frozenset([str(u), str(v)]))

        else:
            return jsonify({"error": f"Unknown algorithm: {algorithm}"}), 400

        execution_time_ms = round((end_time - start_time) * 1000, 2)

        # Identify Subgraph Type
        if not is_planar and certificate is not None:
            principal_nodes = [n for n, d in certificate.degree() if d > 2]
            if len(principal_nodes) == 5:
                conflict_type = "K5"
            elif len(principal_nodes) == 6:
                conflict_type = "K3,3"
            else:
                conflict_type = "Complex Non-Planar"
        else:
            # 如果是平面图，或者是其他情况，类型为 None
            conflict_type = "None"
        
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
            "message": "Graph is Planar" if is_planar else f"Non-Planar: {conflict_type}",
            "execution_time_ms": execution_time_ms
        })

    except Exception as e:
        print(f"Algorithm Error: {e}")
        return jsonify({"error": str(e)}), 500



if __name__ == '__main__':
    print("Backend running on http://localhost:5001")
    app.run(debug=True, port=5001)

    #1