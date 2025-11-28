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


# === 3. Routes ===
# @app.route('/check-planarity', methods=['POST'])
# def check_planarity():
#     if 'file' not in request.files:
#         return jsonify({"error": "No file uploaded"}), 400

#     file = request.files['file']

#     # Use the master dispatcher
#     G = parse_graph_file(file)

#     if G is None or G.number_of_nodes() == 0:
#         return jsonify({
#             "status": "InvalidInput",
#             "message": "Could not parse graph. Check file format or content.",
#             "error_code": 400
#         }), 200

#     try:
#         # Check Planarity
#         is_planar, certificate = nx.check_planarity(G, counterexample=True)
#         scale = 500

#         # === Layout Logic ===
#         if is_planar:
#             try:
#                 # Prefer Planar Layout for clean drawing
#                 pos = nx.planar_layout(certificate)
#             except:
#                 # Fallback if planar_layout fails (rare)
#                 pos = nx.spring_layout(G, seed=42)
#         else:
#             # Non-Planar: MUST use spring_layout (Force-Directed)
#             pos = nx.spring_layout(G, seed=42)

#         # Serialize Nodes (Now always includes x/y)
#         nodes = [{"id": str(n), "x": xy[0] * scale, "y": xy[1] * scale} for n, xy in pos.items()]

#         # Handle Conflicts (if any)
#         conflict_edges = set()
#         conflict_type = "None"

#         if not is_planar:
#             if certificate:
#                 for u, v in certificate.edges():
#                     conflict_edges.add(frozenset([str(u), str(v)]))

#                 # Identify Subgraph Type
#                 principal_nodes = [n for n, d in certificate.degree() if d > 2]
#                 if len(principal_nodes) == 5:
#                     conflict_type = "K5"
#                 elif len(principal_nodes) == 6:
#                     conflict_type = "K3,3"
#                 else:
#                     conflict_type = "Complex Non-Planar"

#         # Serialize Edges
#         edges = []
#         for u, v in G.edges():
#             u_str, v_str = str(u), str(v)
#             is_conflict = frozenset([u_str, v_str]) in conflict_edges
#             edges.append({
#                 "source": u_str,
#                 "target": v_str,
#                 "is_conflict": is_conflict
#             })

#         return jsonify({
#             "status": "planar" if is_planar else "non_planar",
#             "type": conflict_type,
#             "nodes": nodes,
#             "edges": edges,
#             "message": "Graph is Planar" if is_planar else f"Non-Planar: {conflict_type}"
#         })

#     except Exception as e:
#         print(f"Algorithm Error: {e}")
#         return jsonify({"error": str(e)}), 500


@app.route('/check-planarity', methods=['POST'])
def check_planarity():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files['file']
    # [改动1] 获取前端传来的算法参数，默认还是 networkx
    algorithm = request.form.get('algorithm', 'Left-Right')

    G = parse_graph_file(file)

    if G is None or G.number_of_nodes() == 0:
        return jsonify({
            "status": "InvalidInput",
            "message": "Could not parse graph.",
            "error_code": 400
        }), 200

    try:
        is_planar = False
        certificate = None
        conflict_edges = set()
        conflict_type = "None"
        algo_name = "" # 用于返回给前端显示

        # [改动2] 开始计时
        start_time = time.perf_counter()

        # === 分支 A: NetworkX (Left-Right 算法) ===
        if algorithm == 'Left-Right':
            algo_name = "Left-Right (NetworkX)"
            is_planar, certificate = nx.check_planarity(G, counterexample=True)
            
            # 如果非平面，提取冲突边
            if not is_planar and certificate:
                for u, v in certificate.edges():
                    conflict_edges.add(frozenset([str(u), str(v)]))

        # === 分支 B: Kuratowski Search (你的新算法) ===
        elif algorithm == 'kuratowski_search':
            algo_name = "Kuratowski Search (Brute Force)"
            # 调用暴力搜索函数
            is_planar, certificate = naive_kuratowski_search(G)
            
            # 如果非平面，certificate 就是那个剩下的子图 K
            if not is_planar and certificate:
                for u, v in certificate.edges():
                    conflict_edges.add(frozenset([str(u), str(v)]))
        
        # === (可选) 分支 C: Boyer-Myrvold (如果你之前加过 planarity 库) ===
        # elif algorithm == 'boyer_myrvold':
        #     ...

        else:
            return jsonify({"error": f"Unknown algorithm: {algorithm}"}), 400

        # [改动3] 停止计时并计算毫秒数
        end_time = time.perf_counter()
        execution_time_ms = (end_time - start_time) * 1000


        # === 以下是通用的布局与序列化代码 (基本不用动) ===
        scale = 500
        pos = None

        if is_planar:
            try:
                # 只有 NetworkX 算法且成功时，certificate 才是 embedding 对象，才能用 planar_layout
                if algorithm == 'networkx' and isinstance(certificate, nx.PlanarEmbedding):
                    pos = nx.planar_layout(certificate)
                else:
                    # 其他情况（如暴力法算出是平面，但没 embedding）使用 KK 布局
                    pos = nx.kamada_kawai_layout(G)
            except:
                pos = nx.spring_layout(G, seed=42)
        else:
            # 非平面图统一用力导向布局
            pos = nx.spring_layout(G, seed=42)

        # 序列化节点
        nodes = [{"id": str(n), "x": xy[0] * scale, "y": xy[1] * scale} for n, xy in pos.items()]

        # 简单的类型判断逻辑 (仅供展示)
        if not is_planar and certificate:
            # 统计度数大于2的节点数，粗略判断是 K5 还是 K3,3 变体
            d_dict = dict(certificate.degree())
            high_degree = [n for n, d in d_dict.items() if d > 2]
            if len(high_degree) == 5:
                conflict_type = "K5 Structure"
            elif len(high_degree) >= 6:
                conflict_type = "K3,3 Structure"
            else:
                conflict_type = "Non-Planar Subgraph"

        # 序列化边 (标记冲突边)
        edges = []
        for u, v in G.edges():
            u_str, v_str = str(u), str(v)
            # 检查这条边是否在冲突集合中
            is_conflict = frozenset([u_str, v_str]) in conflict_edges
            edges.append({
                "source": u_str,
                "target": v_str,
                "is_conflict": is_conflict
            })

        # [改动4] 返回 JSON 中加入 execution_time_ms
        return jsonify({
            "status": "planar" if is_planar else "non_planar",
            "algorithm_used": algo_name,
            "execution_time_ms": round(execution_time_ms, 2), # 保留两位小数
            "type": conflict_type,
            "nodes": nodes,
            "edges": edges,
            "message": f"Detected by {algo_name}"
        })

    except Exception as e:
        print(f"Algorithm Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    print("Backend running on http://localhost:5001")
    app.run(debug=True, port=5001)

    #1