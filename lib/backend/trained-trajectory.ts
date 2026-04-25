import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { CompleteTrajectoryState } from './trajectory';

export type TrainedTrajectoryPoint = {
  year: number;
  age: number;
  biomarkers: {
    systolicBloodPressure: number;
    diastolicBloodPressure: number;
    bmi: number;
    totalCholesterol: number;
    hdlCholesterol: number;
    glucose: number;
    smoker: boolean;
    diabetes: boolean;
    hypertension: boolean;
  };
};

export type TrainedTrajectoryResult = {
  model: 'synthea_gradient_boosting_v1';
  points: TrainedTrajectoryPoint[];
  metadata?: {
    metrics?: Record<string, number>;
    input_columns?: string[];
    target_columns?: string[];
    disclaimer?: string;
  };
};

const DEFAULT_MODEL_PATH = path.join(process.cwd(), 'models', 'synthea_trajectory.joblib');
const PREDICT_SCRIPT_PATH = path.join(process.cwd(), 'ml', 'predict_trajectory.py');

export async function generateTrainedTrajectory(
  initial: CompleteTrajectoryState,
  startYear: number,
  endYear: number
): Promise<TrainedTrajectoryResult | null> {
  const modelPath = process.env.SYNTHEA_TRAJECTORY_MODEL_PATH ?? DEFAULT_MODEL_PATH;
  const pythonBin = process.env.PYTHON_BIN ?? 'python3';

  if (!existsSync(modelPath) || !existsSync(PREDICT_SCRIPT_PATH)) {
    return null;
  }

  const request = {
    modelPath,
    startYear,
    endYear,
    state: {
      age: initial.age,
      sex: initial.sex === 'unknown' ? 'other' : initial.sex,
      systolicBloodPressure: initial.systolicBloodPressure,
      diastolicBloodPressure: initial.diastolicBloodPressure,
      bmi: initial.bmi,
      totalCholesterol: initial.totalCholesterol,
      hdlCholesterol: initial.hdlCholesterol,
      glucose: initial.glucose,
      smoker: initial.smoker,
      diabetes: initial.diabetes,
      hypertension: initial.hypertension
    }
  };

  return new Promise((resolve) => {
    const child = spawn(pythonBin, [PREDICT_SCRIPT_PATH], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', () => resolve(null));
    child.on('close', (code) => {
      if (code !== 0) {
        if (process.env.NODE_ENV !== 'test') {
          console.warn(`Synthea trajectory model failed: ${stderr.trim()}`);
        }
        resolve(null);
        return;
      }

      try {
        resolve(JSON.parse(stdout) as TrainedTrajectoryResult);
      } catch {
        resolve(null);
      }
    });
    child.stdin.end(JSON.stringify(request));
  });
}
