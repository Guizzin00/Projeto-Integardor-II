import os
from PIL import Image

static_dir = r"c:\Users\guilherme.oliveira\Projeto-Integardor-II\SISCPTI\static"
images = ["default_capa_1.jpg", "default_capa_2.jpg", "default_capa_3.jpg"]

for img_name in images:
    path = os.path.join(static_dir, img_name)
    if os.path.exists(path):
        img = Image.open(path)
        print(f"{img_name}: format={img.format}, size={img.size}, mode={img.mode}")
    else:
        print(f"{img_name} does not exist at {path}")
