"""Lädt das Embedding-Modell zum Mitbündeln (einmalig vor dem Build).

Legt es flach (ohne Symlinks) unter installer/model_cache/multilingual-e5-small ab
und entfernt Duplikate/Ballast, sodass nur ~470 MB (safetensors) übrig bleiben.

Aufruf:  python installer/download_model.py
"""
import os
import shutil

os.environ["HF_HUB_DISABLE_SYMLINKS"] = "1"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

from huggingface_hub import snapshot_download

HERE = os.path.dirname(os.path.abspath(__file__))
TARGET = os.path.join(HERE, "model_cache", "multilingual-e5-small")
MARKER = os.path.join(TARGET, "model.safetensors")


def main():
    if os.path.exists(MARKER):
        print("Modell bereits vorhanden:", TARGET)
        return

    snapshot_download(
        "intfloat/multilingual-e5-small",
        local_dir=TARGET,
        ignore_patterns=[
            "onnx/*", "openvino/*", "coreml/*", ".eval_results/*",
            "*.onnx", "*.h5", "tf_model.*", "rust_model.ot", "*.msgpack",
        ],
    )

    # Ballast entfernen: pytorch_model.bin ist Duplikat von model.safetensors
    for junk in ["pytorch_model.bin", "README.md", ".gitattributes"]:
        p = os.path.join(TARGET, junk)
        if os.path.exists(p):
            os.remove(p)
    cache = os.path.join(TARGET, ".cache")
    if os.path.isdir(cache):
        shutil.rmtree(cache, ignore_errors=True)

    print("Modell bereit:", TARGET)


if __name__ == "__main__":
    main()
