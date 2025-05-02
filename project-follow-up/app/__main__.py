import os
import json
import sys
import threading
import webbrowser
from flask import Flask, request, jsonify, send_from_directory

def get_base_path():
    """Uygulamanın çalıştığı temel yolu bul"""
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__, static_folder='static')

# Veri dosyası yolu
BASE_PATH = get_base_path()
DATA_DIR = os.path.join(BASE_PATH, 'data')
DATA_FILE = os.path.join(DATA_DIR, 'projects.json')

def initialize_data_file():
    """Veri dosyasını oluştur/kontrol et"""
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'w') as f:
            json.dump({"projects": [], "next_id": 1}, f, indent=2)

def read_data():
    """Verileri oku"""
    with open(DATA_FILE, 'r') as f:
        data = json.load(f)
        # Eski verileri yeni formata dönüştür
        if "next_id" not in data:
            data["next_id"] = max([int(p["id"]) for p in data["projects"]] + [0]) + 1
        return data

def write_data(data):
    """Verileri yaz"""
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)

def get_next_id(db):
    """Bir sonraki benzersiz ID'yi al ve güncelle"""
    next_id = db.get("next_id", 1)
    db["next_id"] = next_id + 1
    return str(next_id)

# API Endpoint'leri
@app.route('/api/projects', methods=['GET'])
def get_projects():
    """Tüm projeleri getir"""
    return jsonify(read_data())

@app.route('/api/projects', methods=['POST'])
def add_project():
    data = request.get_json()
    db = read_data()

    new_project = {
        "id": get_next_id(db),
        "name": data["name"],
        "owner": data.get("owner", ""),
        "tasks": [],
        "meetings": {}  # Toplantılar için başlangıç
    }

    db["projects"].append(new_project)
    write_data(db)
    return jsonify(new_project), 201

@app.route('/api/projects/<project_id>/meetings', methods=['PUT'])
def update_meeting_notes(project_id):
    data = request.get_json()  # {"week": "2025-04", "note": "Yeni içerik"} veya {"note": null}
    db = read_data()

    for project in db["projects"]:
        if project["id"] == project_id:
            if "meetings" not in project:
                project["meetings"] = {}

            week_key = data.get("week")
            
            # Eğer note null ise, yani silme işlemi yapılıyorsa
            if "note" in data and data["note"] is None:
                if week_key in project["meetings"]:
                    del project["meetings"][week_key]
                    write_data(db)
                    return jsonify({"message": f"{week_key} silindi."}), 200
                else:
                    return jsonify({"error": f"{week_key} bulunamadı."}), 404

            # Eğer note varsa, yeni not ekle veya güncelle
            if "note" in data and week_key:
                project["meetings"][week_key] = data["note"]
                write_data(db)
                return jsonify(project["meetings"]), 200

    return jsonify({"error": "Proje bulunamadı"}), 404

@app.route('/api/projects/<project_id>/tasks', methods=['POST'])
def add_task(project_id):
    """Projeye yeni görev ekle"""
    data = request.get_json()
    db = read_data()
    
    for project in db["projects"]:
        if project["id"] == project_id:
            # Projeye özgü görev ID'si oluştur
            task_id = 1
            if project["tasks"]:
                task_id = max([int(t["id"]) for t in project["tasks"]]) + 1
            
            new_task = {
                "id": str(task_id),
                "title": data["title"],
                "status": "To Do"
            }
            project["tasks"].append(new_task)
            write_data(db)
            return jsonify(new_task), 201
    
    return jsonify({"error": "Project not found"}), 404

@app.route('/api/tasks/<task_id>', methods=['PUT'])
def update_task(task_id):
    """Görevi güncelle"""
    data = request.get_json()
    db = read_data()
    
    for project in db["projects"]:
        for task in project["tasks"]:
            if task["id"] == task_id:
                task.update(data)
                write_data(db)
                return jsonify(task)
    
    return jsonify({"error": "Task not found"}), 404

@app.route('/api/projects/<project_id>', methods=['DELETE'])
def delete_project(project_id):
    db = read_data()
    db["projects"] = [p for p in db["projects"] if p["id"] != project_id]
    write_data(db)
    return jsonify({"message": "Proje silindi"}), 200

@app.route('/api/tasks/<task_id>', methods=['DELETE'])
def delete_task(task_id):
    db = read_data()
    for project in db["projects"]:
        original_len = len(project["tasks"])
        project["tasks"] = [t for t in project["tasks"] if t["id"] != task_id]
        if len(project["tasks"]) != original_len:
            write_data(db)
            return jsonify({"message": "Görev silindi"}), 200
    return jsonify({"error": "Görev bulunamadı"}), 404

@app.route('/api/projects/<project_id>', methods=['PUT'])
def update_project(project_id):
    data = request.get_json()
    db = read_data()
    for project in db["projects"]:
        if project["id"] == project_id:
            project.update({
                "name": data.get("name", project["name"]),
                "owner": data.get("owner", project.get("owner", ""))
            })
            write_data(db)
            return jsonify(project)
    return jsonify({"error": "Proje bulunamadı"}), 404

@app.route('/api/projects/<project_id>', methods=['GET'])
def get_project(project_id):
    db = read_data()
    for project in db["projects"]:
        if project["id"] == project_id:
            return jsonify(project)
    return jsonify({"error": "Proje bulunamadı"}), 404

# Frontend dosyalarını sun
@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

def open_browser():
    """Uygulama başladığında tarayıcıyı aç"""
    webbrowser.open_new('http://localhost:5000')

if __name__ == '__main__':
    initialize_data_file()
    
    # Debug modunda değilken tarayıcıyı aç
    if not app.debug:
        threading.Timer(1.0, open_browser).start()
    
    app.run(port=5000)
