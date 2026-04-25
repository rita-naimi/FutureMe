import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

type DateEntry = { value: number; date: Date } | undefined;

const RECORD_TYPES = {
  height: 'HKQuantityTypeIdentifierHeight',
  weight: 'HKQuantityTypeIdentifierBodyMass',
  bmi: 'HKQuantityTypeIdentifierBodyMassIndex',
  sleep: 'HKCategoryTypeIdentifierSleepAnalysis',
  alcohol: 'HKQuantityTypeIdentifierAlcoholConsumption',
  tobacco: 'HKCategoryTypeIdentifierTobaccoUse',
  systolic: 'HKQuantityTypeIdentifierBloodPressureSystolic',
  totalCholesterol: 'HKQuantityTypeIdentifierCholesterol',
  hdl: 'HKQuantityTypeIdentifierHDLCholesterol',
} as const;

function parseAppleDate(value: string | undefined): Date | null {
  if (!value) return null;
  const normalized = value.replace(' ', 'T').replace(' -', '-').replace(' +', '+');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseAttributes(line: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /([A-Za-z0-9:_-]+)="([^"]*)"/g;
  let match = regex.exec(line);
  while (match) {
    attrs[match[1]] = match[2];
    match = regex.exec(line);
  }
  return attrs;
}

function toNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function updateLatest(store: DateEntry, value: number | undefined, date: Date | null): DateEntry {
  if (value === undefined || date === null) return store;
  if (!store || date > store.date) return { value, date };
  return store;
}

function normalizeHeightCm(value: number | undefined, unit: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (unit === 'cm') return value;
  if (unit === 'm') return value * 100;
  if (unit === 'in') return value * 2.54;
  return value;
}

function normalizeWeightKg(value: number | undefined, unit: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (unit === 'kg') return value;
  if (unit === 'lb') return value * 0.45359237;
  return value;
}

function averageFromMap(map: Map<string, number>): number | undefined {
  if (map.size === 0) return undefined;
  const total = Array.from(map.values()).reduce((sum, v) => sum + v, 0);
  return total / map.size;
}

function getAgeFromDob(dob: string, now: Date): number | undefined {
  const parsed = parseAppleDate(dob);
  if (!parsed) return undefined;
  const diff = now.getTime() - parsed.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

function mapSex(value: string | undefined): 'male' | 'female' | 'other' | undefined {
  if (!value) return undefined;
  if (value.toLowerCase().includes('male') && !value.toLowerCase().includes('female')) return 'male';
  if (value.toLowerCase().includes('female')) return 'female';
  return 'other';
}

function parseXml(text: string) {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const alcoholWindowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const sleepByDay = new Map<string, number>();
  const workoutDays = new Set<string>();
  let alcoholCount = 0;
  let meProfile: Record<string, string> | null = null;
  let latestHeight: DateEntry;
  let latestWeight: DateEntry;
  let latestBmi: DateEntry;
  let latestSystolic: DateEntry;
  let latestTotalChol: DateEntry;
  let latestHdl: DateEntry;
  let smokingStatus: string | undefined;

  for (const line of text.split('\n')) {
    if (line.includes('<Me ')) {
      meProfile = parseAttributes(line);
      continue;
    }

    if (line.includes('<Record ')) {
      const attrs = parseAttributes(line);
      const { type, value, unit } = attrs;
      const startDate = parseAppleDate(attrs.startDate);
      const endDate = parseAppleDate(attrs.endDate) ?? startDate;

      if (type === RECORD_TYPES.height) {
        latestHeight = updateLatest(latestHeight, normalizeHeightCm(toNumber(value), unit), endDate);
      } else if (type === RECORD_TYPES.weight) {
        latestWeight = updateLatest(latestWeight, normalizeWeightKg(toNumber(value), unit), endDate);
      } else if (type === RECORD_TYPES.bmi) {
        latestBmi = updateLatest(latestBmi, toNumber(value), endDate);
      } else if (type === RECORD_TYPES.sleep) {
        if (startDate && endDate && endDate >= windowStart && value?.includes('Asleep')) {
          const hours = Math.max(0, (endDate.getTime() - startDate.getTime()) / 3600000);
          const key = endDate.toISOString().slice(0, 10);
          sleepByDay.set(key, (sleepByDay.get(key) ?? 0) + hours);
        }
      } else if (type === RECORD_TYPES.alcohol) {
        if (startDate && startDate >= alcoholWindowStart && unit === 'count') {
          alcoholCount += toNumber(value) ?? 0;
        }
      } else if (type === RECORD_TYPES.tobacco) {
        if (value?.includes('NonUser')) smokingStatus = 'never';
        else if (value?.includes('User')) smokingStatus = 'current';
      } else if (type === RECORD_TYPES.systolic) {
        latestSystolic = updateLatest(latestSystolic, toNumber(value), endDate);
      } else if (type === RECORD_TYPES.totalCholesterol) {
        latestTotalChol = updateLatest(latestTotalChol, toNumber(value), endDate);
      } else if (type === RECORD_TYPES.hdl) {
        latestHdl = updateLatest(latestHdl, toNumber(value), endDate);
      }
      continue;
    }

    if (line.includes('<Workout ')) {
      const attrs = parseAttributes(line);
      const startDate = parseAppleDate(attrs.startDate);
      if (startDate && startDate >= windowStart) {
        workoutDays.add(startDate.toISOString().slice(0, 10));
      }
    }
  }

  const heightCm = latestHeight?.value;
  const weightKg = latestWeight?.value;
  const sleepAvg = averageFromMap(sleepByDay);
  const exerciseDaysPerWeek =
    workoutDays.size > 0 ? Number(((workoutDays.size / 30) * 7).toFixed(1)) : null;

  // latestBmi used only as a fallback display; not returned directly
  void latestBmi;

  const inputs = {
    name: null as string | null,
    age: meProfile?.dateOfBirth ? (getAgeFromDob(meProfile.dateOfBirth, now) ?? null) : null,
    sex: mapSex(meProfile?.biologicalSex) ?? null,
    heightCm: heightCm != null ? Number(heightCm.toFixed(1)) : null,
    weightKg: weightKg != null ? Number(weightKg.toFixed(1)) : null,
    sleepHours: sleepAvg != null ? Number(sleepAvg.toFixed(1)) : null,
    exerciseDaysPerWeek,
    dietQuality: null as number | null,
    stressLevel: null as number | null,
    smokingStatus: smokingStatus ?? null,
    alcoholDrinksPerWeek: alcoholCount > 0 ? alcoholCount : null,
    familyHistoryHeart: null as boolean | null,
    familyHistoryDiabetes: null as boolean | null,
    familyHistoryCancer: null as boolean | null,
    existingConditions: [] as string[]
  };

  const clinicalMarkers = {
    totalCholesterolMgDl: latestTotalChol?.value ?? null,
    hdlMgDl: latestHdl?.value ?? null,
    systolicBloodPressureMmHg: latestSystolic?.value ?? null,
    onBloodPressureTreatment: null as boolean | null,
    hasDiabetes: null as boolean | null
  };

  const missing = (Object.entries(inputs) as [string, unknown][])
    .filter(([key, val]) => val === null && key !== 'existingConditions')
    .map(([key]) => key);

  return { inputs, clinicalMarkers, missing };
}

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data with a file field' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'Missing "file" field in form data' }, { status: 400 });
  }

  let text: string;
  try {
    text = await file.text();
  } catch {
    return NextResponse.json({ error: 'Could not read file content' }, { status: 400 });
  }

  if (!text.includes('<HealthData') && !text.includes('<Record') && !text.includes('<Workout')) {
    return NextResponse.json(
      { error: 'File does not appear to be an Apple Health XML export' },
      { status: 422 }
    );
  }

  try {
    const result = parseXml(text);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'XML parse failed';
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
