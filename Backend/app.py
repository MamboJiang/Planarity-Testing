from flask import Flask, request, jsonify
from flask_cors import CORS
import networkx as nx
import io

# initialize flask app
app = Flask(__name__)

CORS(app)


# parse graph from txt
def parse_graph_from_text(content):
    """
    Parses graph data. Strictly differentiates between Adjacency Matrix and Edge List.
    """
    try:
        G = nx.Graph()
        raw_lines = content.strip().split('\n')
        # Filter out empty lines
        lines = [line.strip() for line in raw_lines if line.strip()]

        if not lines:
            return None

        # Analyze dimensions
        num_rows = len(lines)
        first_row_parts = lines[0].split()
        num_cols = len(first_row_parts)

        # Logic: It is a Matrix ONLY if it is a perfect square (Rows == Cols)
        # AND it has more than 1 column.
        is_square_matrix = (num_rows == num_cols) and (num_cols > 1)

        # Optional: Check if the content is numeric.
        # If the first row contains letters (like 'A' 'B'), it's definitely an Edge List.
        is_numeric = True
        for x in first_row_parts:
            if not x.replace('.', '', 1).isdigit():  # Simple check for numbers
                is_numeric = False
                break

        # === Strategy A: Adjacency Matrix ===
        # Must be square and numeric.
        if is_square_matrix and is_numeric:
            print("Detected format: Adjacency Matrix")
            try:
                for r, line in enumerate(lines):
                    values = line.split()
                    if len(values) != num_cols:
                        # If a row has inconsistent length, fallback to Edge List
                        raise ValueError("Row length mismatch")

                    for c, val in enumerate(values):
                        # Assuming non-zero means an edge exists
                        if val != '0':
                            G.add_edge(str(r), str(c))
                return G
            except ValueError:
                print("Matrix parsing failed, falling back to Edge List...")
                G.clear()  # Reset graph to try Strategy B

        # === Strategy B: Edge List (Default) ===
        # Handles "A B", "1 1", "1 2 5" (ignores weight 5)
        print("Detected format: Edge List")
        for line in lines:
            parts = line.split()

            # Need at least 'u v' (2 parts)
            if len(parts) < 2:
                continue

            # We only care about the first two elements: Source and Target.
            # This fixes issues where weights or extra data confused the parser.
            u, v = parts[0].strip(), parts[1].strip()

            # Add edge. NetworkX handles mixed types (int/str) by treating them as hashables.
            # We cast to string to ensure consistency.
            G.add_edge(str(u), str(v))

        if G.number_of_nodes() == 0:
            return None

        return G

    except Exception as e:
        print(f"Critical parsing error: {e}")
        return None

# --- 2. 定义接口：上传文件的入口 ---
@app.route('/check-planarity', methods=['POST'])
def check_planarity():
    # 检查是否有文件上传
    if 'file' not in request.files:
        return jsonify({"error": "没有上传文件"}), 400

    file = request.files['file']

    try:
        # A. 读取文件内容
        # file.read() 读出来是字节，decode 把它变成字符串
        content = file.read().decode('utf-8')

        # B. 解析图数据
        G = parse_graph_from_text(content)

        if G is None:
            # 这里返回你要求的 InvalidInput 字段
            return jsonify({
                "status": "InvalidInput",  # <--- 前端靠这个字段判断
                "message": "文件格式错误：请上传有效的邻接表(.txt)或邻接矩阵。",
                "error_code": 400
            }), 200  # 或者 400，看你们前端想怎么处理 HTTP 状态码

        # --- 核心逻辑 (Member B Work) ---
        is_planar, certificate = nx.check_planarity(G,counterexample=True)

        if is_planar:
            # 如果是平面图，计算坐标
            # 使用 networkx 的 planar_layout (基于 Chrobak-Payne 或 Tutte)
            try:
                pos = nx.planar_layout(certificate)
            except Exception:
                # Fallback if planar_layout fails for some reason (e.g. disconnected components)
                pos = nx.spring_layout(G)
            
            # 格式化给前端
            # 放大坐标以便前端显示 (NetworkX 返回 0-1 范围)
            scale = 500
            nodes = [{"id": str(n), "x": xy[0] * scale, "y": xy[1] * scale} for n, xy in pos.items()]
            edges = [{"source": str(u), "target": str(v)} for u, v in G.edges()]
            
            return jsonify({
                "status": "planar",
                "nodes": nodes,
                "edges": edges,
                "message": "Graph is planar!"
            })
        else:
            # 如果是非平面图
            # certificate 是反例 (Kuratowski subgraph)
            # 标记冲突边

            # === 调试代码 Start ===
            print(f"检测结果: is_planar={is_planar}")
            print(f"反例对象类型: {type(certificate)}")
            if certificate:
                print(f"反例中的边数: {len(certificate.edges())}")
                print(f"反例中的前两条边: {list(certificate.edges())[:2]}")
            else:
                print("警告：certificate 对象为空！")

            # 打印原图的一条边，看看数据类型
            sample_edge = list(G.edges())[0]
            print(f"原图样本边: {sample_edge}, 点的类型: {type(sample_edge[0])}")
            # === 调试代码 End ===

            # (下面是你原本的代码...)
            conflict_edges = set()
            if certificate:
                for u, v in certificate.edges():
                    conflict_edges.add(frozenset([str(u), str(v)]))

            conflict_type = "Unknown"
            if certificate:
                # 统计反例中度数大于 2 的“骨干节点”数量
                # K5: 骨干节点有 5 个（每个度数是 4）
                # K3,3: 骨干节点有 6 个（每个度数是 3）

                # 这里只要统计度数 > 2 的节点个数通常就足够区分了
                principal_nodes = [n for n, d in certificate.degree() if d > 2]
                count = len(principal_nodes)

                if count == 5:
                    conflict_type = "K5"
                elif count == 6:
                    conflict_type = "K3,3"
                else:
                    # 理论上不会走到这，除非图结构非常复杂，暂且标为 Complex
                    conflict_type = "Complex Non-Planar"

            # 调试打印一下，自己看着爽
            print(f"检测到的冲突类型: {conflict_type}")
            # ======================================

            # 2. 构建返回数据 (更新 JSON)
            nodes = [{"id": str(n).strip()} for n in G.nodes()]
            edges = []
            for u, v in G.edges():
                u_str = str(u).strip()
                v_str = str(v).strip()
                is_conflict = frozenset([u_str, v_str]) in conflict_edges
                edges.append({
                    "source": u_str,
                    "target": v_str,
                    "is_conflict": is_conflict
                })

            return jsonify({
                "status": "non_planar",
                "type": conflict_type,  # <--- 把这个新字段传给前端
                "nodes": nodes,
                "edges": edges,
                "message": f"Graph is not planar. Contains a {conflict_type} subgraph."
            })


    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500


# 3. 启动服务
if __name__ == '__main__':
    print("后端服务已启动: http://localhost:5001")
    app.run(debug=True, port=5001)
