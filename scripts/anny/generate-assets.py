#!/usr/bin/env python3
"""Generate web-ready Anny body meshes for FutureMe.

The app loads these static GLB variants at runtime and picks the closest match
for the user's sex, biological age, body mass, and musculature.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import anny
import roma
import torch
import trimesh


ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "public" / "models" / "anny"
MANIFEST_PATH = OUT_DIR / "manifest.json"

SEXES = {
    "male": 0.0,
    "female": 1.0,
}

AGE_BANDS = {
    "young": 0.64,
    "mature": 0.78,
    "older": 0.96,
}

MUSCLE_BANDS = {
    "low": 0.18,
    "medium": 0.52,
    "high": 0.88,
}

WEIGHT_BANDS = {
    "lean": 0.22,
    "average": 0.50,
    "heavy": 0.82,
}


def export_body(model, sex: str, age: str, muscle: str, weight: str) -> dict[str, object]:
    phenotype_kwargs = {
        "gender": SEXES[sex],
        "age": AGE_BANDS[age],
        "muscle": MUSCLE_BANDS[muscle],
        "weight": WEIGHT_BANDS[weight],
        "height": 0.54,
        "proportions": 0.48,
    }

    with torch.no_grad():
        output = model(phenotype_kwargs=phenotype_kwargs)

    vertices = output["vertices"].squeeze(dim=0).cpu().numpy()
    faces = model.faces.cpu().numpy()
    mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)

    # Anny is Z-up. GLB viewers in Three.js are Y-up, so rotate once at export.
    view_transform = roma.Rigid(
        roma.euler_to_rotmat("x", [-90.0], degrees=True),
        torch.zeros(3),
    ).to_homogeneous().numpy()
    mesh.apply_transform(view_transform)

    skin = [0.82, 0.62, 0.48, 1.0] if sex == "female" else [0.72, 0.53, 0.40, 1.0]
    if age == "older":
        skin = [min(c + 0.08, 1.0) for c in skin[:3]] + [1.0]

    mesh.visual = trimesh.visual.TextureVisuals(
        material=trimesh.visual.material.PBRMaterial(
            baseColorFactor=skin,
            metallicFactor=0.0,
            roughnessFactor=0.82,
            doubleSided=True,
        )
    )

    filename = f"{sex}-{age}-{weight}-{muscle}.glb"
    mesh.export(OUT_DIR / filename)

    return {
        "id": filename.removesuffix(".glb"),
        "url": f"/models/anny/{filename}",
        "sex": sex,
        "ageBand": age,
        "weightBand": weight,
        "muscleBand": muscle,
        "phenotype": phenotype_kwargs,
    }


def main() -> None:
    os.environ.setdefault("ANNY_CACHE_DIR", str(ROOT / ".anny-cache"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    model = anny.create_fullbody_model(rig="default", topology="default", local_changes=True)
    model = model.to(dtype=torch.float32)
    model.eval()

    assets = []
    for sex in SEXES:
        for age in AGE_BANDS:
            for weight in WEIGHT_BANDS:
                for muscle in MUSCLE_BANDS:
                    assets.append(export_body(model, sex, age, muscle, weight))

    MANIFEST_PATH.write_text(
        json.dumps(
            {
                "source": "naver/anny",
                "topology": "default",
                "count": len(assets),
                "assets": assets,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print(f"Generated {len(assets)} Anny GLB assets in {OUT_DIR}")


if __name__ == "__main__":
    main()
