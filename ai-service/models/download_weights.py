"""Unduh weights model AI (seatbelt + smoking). Usage: python ai-service/models/download_weights.py"""
import os
import urllib.request

BASE = os.path.dirname(os.path.abspath(__file__))
WEIGHTS = os.path.join(BASE, "weights")

FILES = {
    "seatbelt_yolov8n.pt": (
        "https://github.com/JonathanMar/seatbelt-training/releases/download/v1.0.0/best.pt",
        "YOLOv8n seatbelt (person_with/without_seatbelt, MIT)",
    ),
    "smoking_yolo.pt": (
        "https://huggingface.co/basant18/Smoking-detection-YOLO26s/resolve/main/weights/best.pt",
        "YOLO smoke/cigarette (Apache-2.0)",
    ),
}


def main():
    os.makedirs(WEIGHTS, exist_ok=True)
    for name, (url, desc) in FILES.items():
        dest = os.path.join(WEIGHTS, name)
        if os.path.isfile(dest):
            print(f"OK   {name} sudah ada ({os.path.getsize(dest) // 1024} KB) — {desc}")
            continue
        print(f"DOWNLOAD {name} — {desc}\n  dari {url}")
        try:
            urllib.request.urlretrieve(url, dest + ".tmp")
            os.replace(dest + ".tmp", dest)
            print(f"OK   {name} tersimpan ({os.path.getsize(dest) // 1024} KB)")
        except Exception as e:
            print(f"GAGAL {name}: {e}")
            if os.path.isfile(dest + ".tmp"):
                os.remove(dest + ".tmp")


if __name__ == "__main__":
    main()
