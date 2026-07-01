import os
import json

def generate_multi_db():
    data_folder = 'data'
    
    if not os.path.exists(data_folder):
        print(f"Error: Folders not found {data_folder}.")
        return

    for root_item in os.listdir(data_folder):
        root_path = os.path.join(data_folder, root_item)
        
        if os.path.isdir(root_path):
            print(f"In progress: {root_item}...")
            year_data = []
            
            for root, dirs, files in os.walk(root_path):
                for file in files:
                    if file.lower().endswith(".pdf"):
                        full_path = os.path.join(root, file).replace("\\", "/")
                        name_parts = file.replace(".pdf", "").split('_')
                        
                        entry = {
                            "name": file,
                            "path": full_path,
                            "folder": os.path.basename(root),
                            "country": name_parts[0] if len(name_parts) > 0 else "N/A",
                            "chart-type": name_parts[1] if len(name_parts) > 1 else "N/A",
                            "cycle": name_parts[2] if len(name_parts) > 2 else "N/A"
                        }
                        year_data.append(entry)
            
            output_filename = f"web/database{root_item}.json"
            with open(output_filename, 'w', encoding='utf-8') as f:
                json.dump(year_data, f, indent=4, ensure_ascii=False)
            
            print(f" -> Generated: {output_filename} ({len(year_data)} files)")

if __name__ == "__main__":
    generate_multi_db()