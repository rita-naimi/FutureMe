#!/usr/bin/env python3
"""Generate web-ready Anny body meshes for Meror.

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
    "young": 0.62,
    "adult": 0.72,
    "mature": 0.82,
    "older": 0.92,
    "elder": 1.0,
}

MUSCLE_BANDS = {
    "low": 0.14,
    "toned": 0.32,
    "medium": 0.52,
    "strong": 0.72,
    "high": 0.9,
}

WEIGHT_BANDS = {
    "lean": 0.12,
    "fit": 0.32,
    "average": 0.50,
    "heavy": 0.72,
    "max": 0.9,
}

MUSCLE_DETAIL_KEYS = [
    "l-upperarm-muscle-incr",
    "r-upperarm-muscle-incr",
    "l-lowerarm-muscle-incr",
    "r-lowerarm-muscle-incr",
    "l-upperarm-shoulder-muscle-incr",
    "r-upperarm-shoulder-muscle-incr",
    "measure-upperarm-circ-incr",
    "l-upperleg-muscle-incr",
    "r-upperleg-muscle-incr",
    "l-lowerleg-muscle-incr",
    "r-lowerleg-muscle-incr",
    "l-upperleg-scale-depth-incr",
    "r-upperleg-scale-depth-incr",
]

MASS_DETAIL_KEYS = [
    "l-upperarm-fat-incr",
    "r-upperarm-fat-incr",
    "l-lowerarm-fat-incr",
    "r-lowerarm-fat-incr",
    "l-upperleg-fat-incr",
    "r-upperleg-fat-incr",
    "buttocks-volume-incr",
    "measure-waist-circ-incr",
    "stomach-pregnant-incr",
]

MASS_TONE_KEYS = [
    "stomach-tone-incr",
]


def build_local_changes(model, muscle: str, weight: str) -> dict[str, float]:
    available = set(model.local_change_labels)
    muscle_delta = (MUSCLE_BANDS[muscle] - 0.52) * 0.55
    mass_delta = (WEIGHT_BANDS[weight] - 0.50) * 0.45
    local_changes: dict[str, float] = {}

    for key in MUSCLE_DETAIL_KEYS:
        if key in available:
            local_changes[key] = muscle_delta

    for key in MASS_DETAIL_KEYS:
        if key in available:
            local_changes[key] = mass_delta

    for key in MASS_TONE_KEYS:
        if key in available:
            local_changes[key] = -mass_delta

    return local_changes


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
        output = model(
            phenotype_kwargs=phenotype_kwargs,
            local_changes_kwargs=build_local_changes(model, muscle, weight),
        )

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
