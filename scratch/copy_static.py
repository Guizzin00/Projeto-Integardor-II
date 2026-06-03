import shutil
import os

src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../SISCPTI/static'))
dst_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../static'))

print(f"Copying static files from {src_dir} to {dst_dir}...")

for root, dirs, files in os.walk(src_dir):
    # Determine the relative path
    rel_path = os.path.relpath(root, src_dir)
    target_dir = os.path.join(dst_dir, rel_path) if rel_path != '.' else dst_dir
    
    os.makedirs(target_dir, exist_ok=True)
    
    for f in files:
        src_file = os.path.join(root, f)
        dst_file = os.path.join(target_dir, f)
        print(f"Copying {f}...")
        shutil.copy2(src_file, dst_file)

print("Static files copied successfully!")
