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
    假设用户上传的文件是简单的“边列表”格式，例如：
    0 1
    1 2
    2 0
    每一行代表一条边，连接两个点。
    """
    G = nx.Graph()
    lines = content.split('\n')
    for line in lines:
        parts = line.strip().split()
        if len(parts) >= 2:
            # 读取两个点，转成整数（或者保持字符串也可以）
            u, v = parts[0], parts[1]
            G.add_edge(u, v)
    return G


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

        # 简单的验证：如果图是空的
        if G.number_of_nodes() == 0:
            return jsonify({"error": "解析失败，图是空的"}), 400

        # --- 核心逻辑 (Member B Work) ---
        is_planar, certificate = nx.check_planarity(G)

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
            conflict_edges = set()
            if certificate:
                for u, v in certificate.edges():
                    conflict_edges.add(frozenset([str(u), str(v)]))
            
            nodes = [{"id": str(n)} for n in G.nodes()]
            edges = []
            for u, v in G.edges():
                is_conflict = frozenset([str(u), str(v)]) in conflict_edges
                edges.append({
                    "source": str(u), 
                    "target": str(v), 
                    "is_conflict": is_conflict
                })

            return jsonify({
                "status": "non_planar",
                "nodes": nodes,
                "edges": edges,
                "message": "Graph is not planar."
            })

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500


# 3. 启动服务
if __name__ == '__main__':
    print("后端服务已启动: http://localhost:5001")
    app.run(debug=True, port=5001)
