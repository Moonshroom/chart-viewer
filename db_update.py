import os
import json
import re
import fitz  # PyMuPDF

def clean_text(text):
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'[^\w\s.,\-]', '', text)
    return text.strip()

def build_full_database(data_folder):
    full_db = []
    
    # Przechodzimy przez lata/podfoldery
    for root_item in os.listdir(data_folder):
        root_path = os.path.join(data_folder, root_item)
        
        if os.path.isdir(root_path):
            print(f"Processing folder: {root_item}...")
            
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
                            "cycle": name_parts[2] if len(name_parts) > 2 else "N/A",
                            "pages": []
                        }
                        
                        try:
                            pdf_document = fitz.open(full_path)
                            for page_number in range(len(pdf_document)):
                                page = pdf_document.load_page(page_number)
                                raw_text = page.get_text()
                                
                                entry["pages"].append({
                                    "page_number": page_number + 1,
                                    "text_snippet": clean_text(raw_text)
                                })
                            pdf_document.close()
                            # TUTAJ DODANO LOGOWANIE:
                            print(f"Finished processing: {file}")
                        except Exception as e:
                            print(f"Error processing {file}: {e}")
                        
                        full_db.append(entry)
            
            # Zapisujemy plik dla danego roku/folderu
            output_filename = f"web/database_{root_item}.json"
            with open(output_filename, 'w', encoding='utf-8') as f:
                json.dump(full_db, f, indent=4, ensure_ascii=False)
            
            print(f" -> Generated: {output_filename} ({len(full_db)} files)")

if __name__ == "__main__":
    # Upewnij się, że folder 'web' istnieje
    if not os.path.exists("web"):
        os.makedirs("web")
        
    build_full_database("data")