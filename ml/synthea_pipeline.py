"""
Prototype Synthea -> FHIR -> patient-year -> next-year trajectory model pipeline.

This file is intentionally separate from the Next.js app. It trains and exports a
lightweight tabular model that can later replace the TypeScript surrogate in
lib/backend/trajectory.ts.

Expected install for local experiments:
  pip install pandas scikit-learn joblib
"""

from __future__ import annotations

import argparse
import json
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.multioutput import MultiOutputRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


OBSERVATION_CODE_MAP = {
    # Common LOINC codes emitted by Synthea can vary by version/export profile.
    # Keep displays as fallback because hackathon data often has mixed coding.
    "8480-6": "SBP",
    "8462-4": "DBP",
    "39156-5": "BMI",
    "29463-7": "weight",
    "8302-2": "height",
    "8867-4": "heart_rate",
    "2093-3": "total_chol",
    "2085-9": "HDL",
    "2089-1": "LDL",
    "2339-0": "glucose",
    "4548-4": "hba1c",
}

DISPLAY_FALLBACKS = {
    "systolic blood pressure": "SBP",
    "diastolic blood pressure": "DBP",
    "body mass index": "BMI",
    "body weight": "weight",
    "body height": "height",
    "heart rate": "heart_rate",
    "total cholesterol": "total_chol",
    "hdl cholesterol": "HDL",
    "ldl cholesterol": "LDL",
    "glucose": "glucose",
    "hemoglobin a1c": "hba1c",
}

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

TARGET_COLUMNS = ["SBP_next", "DBP_next", "BMI_next", "total_chol_next", "HDL_next", "glucose_next"]


@dataclass(frozen=True)
class PatientMeta:
    patient_id: str
    birth_year: int | None
    sex: str


def run_synthea(synthea_dir: Path, output_dir: Path, population: int = 1000, seed: int = 42) -> None:
    """Generate synthetic FHIR patients with Synthea."""
    output_dir.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "./run_synthea",
            "-p",
            str(population),
            "-s",
            str(seed),
            "--exporter.fhir.export",
            "true",
            "--exporter.csv.export",
            "false",
            "--exporter.baseDirectory",
            str(output_dir),
        ],
        cwd=synthea_dir,
        check=True,
    )


def iter_fhir_bundles(fhir_dir: Path) -> Iterable[dict[str, Any]]:
    for path in sorted(fhir_dir.glob("**/*.json")):
        with path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
        if payload.get("resourceType") == "Bundle":
            yield payload


def build_patient_year_table(fhir_dir: Path) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []

    for bundle in iter_fhir_bundles(fhir_dir):
        resources = [entry.get("resource", {}) for entry in bundle.get("entry", [])]
        patient = next((resource for resource in resources if resource.get("resourceType") == "Patient"), None)
        if not patient:
            continue

        meta = extract_patient_meta(patient)
        observations_by_year = extract_observations_by_year(resources)
        conditions_by_year = extract_conditions_by_year(resources)

        for year, metrics in observations_by_year.items():
            row = {
                "patient_id": meta.patient_id,
                "year": year,
                "age": year - meta.birth_year if meta.birth_year else None,
                "sex": meta.sex,
                "SBP": metrics.get("SBP"),
                "DBP": metrics.get("DBP"),
                "BMI": metrics.get("BMI") or derive_bmi(metrics.get("height"), metrics.get("weight")),
                "total_chol": metrics.get("total_chol"),
                "HDL": metrics.get("HDL"),
                "glucose": metrics.get("glucose"),
                "smoker": conditions_by_year.get(year, {}).get("smoker", False),
                "diabetes": conditions_by_year.get(year, {}).get("diabetes", False),
                "hypertension": conditions_by_year.get(year, {}).get("hypertension", False),
            }
            rows.append(row)

    table = pd.DataFrame(rows)
    if table.empty:
        return table

    table = table.sort_values(["patient_id", "year"]).reset_index(drop=True)
    return complete_patient_year_table(table)


def create_temporal_pairs(patient_year: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    current_rows: list[pd.Series] = []
    next_rows: list[pd.Series] = []

    for _, group in patient_year.groupby("patient_id"):
        group = group.sort_values("year")
        by_year = {int(row["year"]): row for _, row in group.iterrows()}
        for year, row in by_year.items():
            next_row = by_year.get(year + 1)
            if next_row is None:
                continue
            current_rows.append(row)
            next_rows.append(next_row)

    if not current_rows:
        return pd.DataFrame(columns=INPUT_COLUMNS), pd.DataFrame(columns=TARGET_COLUMNS)

    x = pd.DataFrame(current_rows)[INPUT_COLUMNS].reset_index(drop=True)
    next_df = pd.DataFrame(next_rows)
    y = next_df[["SBP", "DBP", "BMI", "total_chol", "HDL", "glucose"]].copy()
    y.columns = TARGET_COLUMNS
    complete_targets = y.notna().all(axis=1)
    return x.loc[complete_targets.to_numpy()].reset_index(drop=True), y.loc[complete_targets].reset_index(drop=True)


def train_trajectory_model(x: pd.DataFrame, y: pd.DataFrame) -> Pipeline:
    numeric_features = [column for column in INPUT_COLUMNS if column != "sex"]
    categorical_features = ["sex"]

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "numeric",
                Pipeline([("imputer", SimpleImputer(strategy="median")), ("scaler", StandardScaler())]),
                numeric_features,
            ),
            (
                "categorical",
                Pipeline([("imputer", SimpleImputer(strategy="most_frequent")), ("onehot", OneHotEncoder(handle_unknown="ignore"))]),
                categorical_features,
            ),
        ]
    )

    regressor = MultiOutputRegressor(
        GradientBoostingRegressor(random_state=42, n_estimators=180, learning_rate=0.05, max_depth=3)
    )

    model = Pipeline([("preprocess", preprocessor), ("regressor", regressor)])
    model.fit(x, y)
    return model


def evaluate_model(model: Pipeline, x_test: pd.DataFrame, y_test: pd.DataFrame) -> dict[str, float]:
    predictions = pd.DataFrame(model.predict(x_test), columns=TARGET_COLUMNS)
    metrics: dict[str, float] = {}

    for column in TARGET_COLUMNS:
        metrics[f"{column}_mae"] = float(mean_absolute_error(y_test[column], predictions[column]))
        metrics[f"{column}_r2"] = float(r2_score(y_test[column], predictions[column]))

    return metrics


def export_model(model: Pipeline, output_path: Path, metadata: dict[str, Any]) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": model, "metadata": metadata}, output_path)


def extract_patient_meta(patient: dict[str, Any]) -> PatientMeta:
    birth_date = patient.get("birthDate")
    birth_year = int(birth_date[:4]) if isinstance(birth_date, str) and len(birth_date) >= 4 else None
    return PatientMeta(
        patient_id=str(patient.get("id", "unknown")),
        birth_year=birth_year,
        sex=str(patient.get("gender", "unknown")),
    )


def extract_observations_by_year(resources: list[dict[str, Any]]) -> dict[int, dict[str, float]]:
    by_year: dict[int, dict[str, list[float]]] = {}

    for resource in resources:
        if resource.get("resourceType") != "Observation":
            continue
        year = resource_year(resource)
        if year is None:
            continue

        metric = observation_metric_name(resource)
        value = quantity_value(resource)
        if metric is not None and value is not None:
            by_year.setdefault(year, {}).setdefault(metric, []).append(value)

        for component in resource.get("component", []) or []:
            component_metric = observation_metric_name(component)
            component_value = quantity_value(component)
            if component_metric is None or component_value is None:
                continue
            by_year.setdefault(year, {}).setdefault(component_metric, []).append(component_value)

    return {
        year: {metric: float(pd.Series(values).median()) for metric, values in metrics.items()}
        for year, metrics in by_year.items()
    }


def extract_conditions_by_year(resources: list[dict[str, Any]]) -> dict[int, dict[str, bool]]:
    by_year: dict[int, dict[str, bool]] = {}

    for resource in resources:
        if resource.get("resourceType") != "Condition":
            continue
        year = resource_year(resource)
        text = json.dumps(resource.get("code", {})).lower()
        if year is None:
            continue

        flags = by_year.setdefault(year, {})
        if "diabetes" in text:
            flags["diabetes"] = True
        if "hypertension" in text or "high blood pressure" in text:
            flags["hypertension"] = True
        if "smoker" in text or "tobacco" in text:
            flags["smoker"] = True

    return by_year


def complete_patient_year_table(table: pd.DataFrame) -> pd.DataFrame:
    completed: list[pd.DataFrame] = []
    numeric_columns = ["SBP", "DBP", "BMI", "total_chol", "HDL", "glucose"]
    boolean_columns = ["smoker", "diabetes", "hypertension"]

    for patient_id, group in table.groupby("patient_id"):
        group = group.sort_values("year").set_index("year")
        full_years = range(int(group.index.min()), int(group.index.max()) + 1)
        full = group.reindex(full_years)
        full.index.name = "year"
        full["patient_id"] = patient_id
        full["sex"] = full["sex"].ffill().bfill()

        age_anchor = group["age"].dropna()
        if age_anchor.empty:
            full["age"] = None
        else:
            first_year = int(age_anchor.index[0])
            first_age = int(age_anchor.iloc[0])
            full["age"] = [first_age + (int(year) - first_year) for year in full.index]

        full[numeric_columns] = full[numeric_columns].ffill().bfill()
        for column in boolean_columns:
            full[column] = full[column].apply(lambda value: bool(value) if pd.notna(value) else False).cummax()

        completed.append(full.reset_index())

    return pd.concat(completed, ignore_index=True).sort_values(["patient_id", "year"]).reset_index(drop=True)


def observation_metric_name(resource: dict[str, Any]) -> str | None:
    code = resource.get("code", {})
    for coding in code.get("coding", []) or []:
        loinc = coding.get("code")
        if loinc in OBSERVATION_CODE_MAP:
            return OBSERVATION_CODE_MAP[loinc]

    display_text = json.dumps(code).lower()
    for needle, metric in DISPLAY_FALLBACKS.items():
        if needle in display_text:
            return metric
    return None


def quantity_value(resource: dict[str, Any]) -> float | None:
    quantity = resource.get("valueQuantity")
    if not isinstance(quantity, dict):
        return None
    value = quantity.get("value")
    return float(value) if isinstance(value, (int, float)) else None


def resource_year(resource: dict[str, Any]) -> int | None:
    date_value = (
        resource.get("effectiveDateTime")
        or resource.get("recordedDate")
        or resource.get("onsetDateTime")
        or resource.get("authoredOn")
        or resource.get("performedDateTime")
    )
    if isinstance(date_value, str) and len(date_value) >= 4:
        return int(date_value[:4])
    return None


def derive_bmi(height_cm: float | None, weight_kg: float | None) -> float | None:
    if not height_cm or not weight_kg:
        return None
    height_m = height_cm / 100
    return weight_kg / (height_m * height_m)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fhir-dir", type=Path, required=True)
    parser.add_argument("--model-out", type=Path, default=Path("models/synthea_trajectory.joblib"))
    parser.add_argument("--patient-year-out", type=Path, default=Path("data/patient_year.csv"))
    args = parser.parse_args()

    patient_year = build_patient_year_table(args.fhir_dir)
    args.patient_year_out.parent.mkdir(parents=True, exist_ok=True)
    patient_year.to_csv(args.patient_year_out, index=False)

    x, y = create_temporal_pairs(patient_year)
    x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=0.2, random_state=42)
    model = train_trajectory_model(x_train, y_train)
    metrics = evaluate_model(model, x_test, y_test)

    export_model(
        model,
        args.model_out,
        {
            "source": "Synthea synthetic FHIR",
            "input_columns": INPUT_COLUMNS,
            "target_columns": TARGET_COLUMNS,
            "metrics": metrics,
            "disclaimer": "Prototype synthetic trajectory model, not a clinical prediction device.",
        },
    )
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
