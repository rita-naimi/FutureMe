"""
Load the exported Synthea trajectory model and generate a recursive future curve.

Input is passed as JSON on stdin:
{
  "modelPath": "models/synthea_trajectory.joblib",
  "startYear": 2026,
  "endYear": 2046,
  "state": {
    "age": 52,
    "sex": "male",
    "systolicBloodPressure": 145,
    "diastolicBloodPressure": 88,
    "bmi": 31.7,
    "totalCholesterol": 220,
    "hdlCholesterol": 42,
    "glucose": 99,
    "smoker": true,
    "diabetes": false,
    "hypertension": true
  }
}
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

INPUT_COLUMNS = [
    "age",
    "sex",
    "SBP",
    "DBP",
    "BMI",
    "total_chol",
    "HDL",
    "glucose",
    "smoker",
    "diabetes",
    "hypertension",
]


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def round1(value: float) -> float:
    return round(value, 1)


def model_row(state: dict[str, Any]) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "age": state["age"],
                "sex": state["sex"],
                "SBP": state["systolicBloodPressure"],
                "DBP": state["diastolicBloodPressure"],
                "BMI": state["bmi"],
                "total_chol": state["totalCholesterol"],
                "HDL": state["hdlCholesterol"],
                "glucose": state["glucose"],
                "smoker": state["smoker"],
                "diabetes": state["diabetes"],
                "hypertension": state["hypertension"],
            }
        ],
        columns=INPUT_COLUMNS,
    )


def serialize_point(year: int, state: dict[str, Any]) -> dict[str, Any]:
    return {
        "year": year,
        "age": int(state["age"]),
        "biomarkers": {
            "systolicBloodPressure": round1(float(state["systolicBloodPressure"])),
            "diastolicBloodPressure": round1(float(state["diastolicBloodPressure"])),
            "bmi": round1(float(state["bmi"])),
            "totalCholesterol": round1(float(state["totalCholesterol"])),
            "hdlCholesterol": round1(float(state["hdlCholesterol"])),
            "glucose": round1(float(state["glucose"])),
            "smoker": bool(state["smoker"]),
            "diabetes": bool(state["diabetes"]),
            "hypertension": bool(state["hypertension"]),
        },
    }


def predict_next(model: Any, state: dict[str, Any]) -> dict[str, Any]:
    prediction = model.predict(model_row(state))[0]
    next_sbp, next_dbp, next_bmi, next_total_chol, next_hdl, next_glucose = [float(value) for value in prediction]

    next_state = {
        **state,
        "age": int(state["age"]) + 1,
        "systolicBloodPressure": round1(clamp(next_sbp, 90, 220)),
        "diastolicBloodPressure": round1(clamp(next_dbp, 50, 140)),
        "bmi": round1(clamp(next_bmi, 16, 60)),
        "totalCholesterol": round1(clamp(next_total_chol, 100, 350)),
        "hdlCholesterol": round1(clamp(next_hdl, 20, 120)),
        "glucose": round1(clamp(next_glucose, 65, 300)),
    }
    next_state["diabetes"] = bool(state["diabetes"]) or next_state["glucose"] >= 126
    next_state["hypertension"] = bool(state["hypertension"]) or next_state["systolicBloodPressure"] >= 130
    return next_state


def main() -> None:
    request = json.load(sys.stdin)
    model_path = Path(request["modelPath"])
    artifact = joblib.load(model_path)
    model = artifact["model"] if isinstance(artifact, dict) and "model" in artifact else artifact
    metadata = artifact.get("metadata", {}) if isinstance(artifact, dict) else {}

    start_year = int(request.get("startYear", 2026))
    end_year = int(request.get("endYear", 2046))
    state = dict(request["state"])

    points = []
    for year in range(start_year, end_year + 1):
        points.append(serialize_point(year, state))
        state = predict_next(model, state)

    json.dump(
        {
            "model": "synthea_gradient_boosting_v1",
            "points": points,
            "metadata": metadata,
        },
        sys.stdout,
    )


if __name__ == "__main__":
    main()
