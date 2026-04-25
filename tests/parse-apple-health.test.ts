import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const EXPORT_PATH = '/Users/tahrihassani/Downloads/apple_health_export/export.xml';

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

describe('parse-apple-health script', () => {
  it('parses Apple Health export into summary JSON', () => {
    if (!fs.existsSync(EXPORT_PATH)) {
      return;
    }

    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'futureme-apple-health-'));
    const outputPath = path.join(outputDir, 'summary.json');

    execFileSync(
      'node',
      [
        path.resolve('scripts/parse-apple-health.mjs'),
        '--input',
        EXPORT_PATH,
        '--out',
        outputPath,
        '--days',
        '30',
        '--name',
        'Test User'
      ],
      { stdio: 'inherit' }
    );

    const payload = JSON.parse(fs.readFileSync(outputPath, 'utf8')) as {
      source: string;
      windowDays: number;
      inputs: Record<string, unknown>;
      clinicalMarkers: Record<string, unknown>;
      rawMetrics: Record<string, unknown>;
      missing: string[];
    };

    expect(payload.source).toBe('apple-health');
    expect(payload.windowDays).toBe(30);
    expect(payload.inputs.name).toBe('Test User');
    expect(payload.inputs).toHaveProperty('sleepHours');
    expect(payload.inputs).toHaveProperty('exerciseDaysPerWeek');
    expect(payload.inputs).toHaveProperty('dietQuality');
    expect(payload.inputs).toHaveProperty('stressLevel');
    expect(payload.inputs).toHaveProperty('smokingStatus');
    expect(payload.inputs).toHaveProperty('alcoholDrinksPerWeek');

    expect(isNumberOrNull(payload.inputs.heightCm)).toBe(true);
    expect(isNumberOrNull(payload.inputs.weightKg)).toBe(true);
    expect(isNumberOrNull(payload.rawMetrics.bmi)).toBe(true);

    expect(isNumberOrNull(payload.clinicalMarkers.totalCholesterolMgDl)).toBe(true);
    expect(isNumberOrNull(payload.clinicalMarkers.hdlMgDl)).toBe(true);
    expect(isNumberOrNull(payload.clinicalMarkers.systolicBloodPressureMmHg)).toBe(true);

    expect(payload.missing).toContain('dietQuality');
    expect(payload.missing).toContain('stressLevel');
  });
});
