import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';

const args = process.argv.slice(2);

function getArgValue(flag, fallback) {
  const index = args.indexOf(flag);
  if (index === -1) return fallback;
  const value = args[index + 1];
  return value ?? fallback;
}

const inputPath = getArgValue('--input', path.join(os.homedir(), 'Downloads/apple_health_export/export.xml'));
const outputPath = getArgValue('--out', path.join('data', 'apple-health', 'summary.json'));
const windowDays = Number(getArgValue('--days', '30'));
const providedName = getArgValue('--name', '');

const WINDOW_MS = windowDays * 24 * 60 * 60 * 1000;
const now = new Date();
const windowStart = new Date(now.getTime() - WINDOW_MS);
const alcoholWindowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

const RECORD_TYPES = {
  height: 'HKQuantityTypeIdentifierHeight',
  weight: 'HKQuantityTypeIdentifierBodyMass',
  bmi: 'HKQuantityTypeIdentifierBodyMassIndex',
  sleep: 'HKCategoryTypeIdentifierSleepAnalysis',
  alcohol: 'HKQuantityTypeIdentifierAlcoholConsumption',
  tobacco: 'HKCategoryTypeIdentifierTobaccoUse',
  systolic: 'HKQuantityTypeIdentifierBloodPressureSystolic',
  diastolic: 'HKQuantityTypeIdentifierBloodPressureDiastolic',
  totalCholesterol: 'HKQuantityTypeIdentifierCholesterol',
  hdl: 'HKQuantityTypeIdentifierHDLCholesterol',
  ldl: 'HKQuantityTypeIdentifierLDLCholesterol',
  triglycerides: 'HKQuantityTypeIdentifierTriglycerides',
  dietEnergy: 'HKQuantityTypeIdentifierDietaryEnergyConsumed'
};

function parseAppleDate(value) {
  if (!value) return null;
  const normalized = value.replace(' ', 'T').replace(' -', '-').replace(' +', '+');
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseAttributes(line) {
  const attrs = {};
  const regex = /([A-Za-z0-9:_-]+)="([^"]*)"/g;
  let match = regex.exec(line);
  while (match) {
    attrs[match[1]] = match[2];
    match = regex.exec(line);
  }
  return attrs;
}

function toNumber(value) {
  if (value === undefined || value === null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function updateLatest(store, value, date) {
  if (value === undefined || date === null) return store;
  if (!store || date > store.date) {
    return { value, date };
  }
  return store;
}

function normalizeHeightCm(value, unit) {
  if (value === undefined) return undefined;
  if (unit === 'cm') return value;
  if (unit === 'm') return value * 100;
  if (unit === 'in') return value * 2.54;
  return value;
}

function normalizeWeightKg(value, unit) {
  if (value === undefined) return undefined;
  if (unit === 'kg') return value;
  if (unit === 'lb') return value * 0.45359237;
  return value;
}

function normalizeEnergyKcal(value, unit) {
  if (value === undefined) return undefined;
  if (unit === 'kcal') return value;
  if (unit === 'kJ') return value / 4.184;
  return value;
}

const sleepByDayHours = new Map();
const workoutDays = new Set();
const dietEnergyByDay = new Map();

let alcoholCountLast7Days = 0;
let meProfile = null;

let latestHeight;
let latestWeight;
let latestBmi;
let latestSystolic;
let latestDiastolic;
let latestTotalChol;
let latestHdl;
let latestLdl;
let latestTriglycerides;

let smokingStatus;

async function parseFile() {
  const stream = fs.createReadStream(inputPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (line.includes('<Me ')) {
      const attrs = parseAttributes(line);
      meProfile = attrs;
      continue;
    }

    if (line.includes('<Record ')) {
      const attrs = parseAttributes(line);
      const type = attrs.type;
      const startDate = parseAppleDate(attrs.startDate);
      const endDate = parseAppleDate(attrs.endDate) ?? startDate;
      const value = attrs.value;
      const unit = attrs.unit;

      if (type === RECORD_TYPES.height) {
        const heightCm = normalizeHeightCm(toNumber(value), unit);
        latestHeight = updateLatest(latestHeight, heightCm, endDate);
        continue;
      }

      if (type === RECORD_TYPES.weight) {
        const weightKg = normalizeWeightKg(toNumber(value), unit);
        latestWeight = updateLatest(latestWeight, weightKg, endDate);
        continue;
      }

      if (type === RECORD_TYPES.bmi) {
        const bmi = toNumber(value);
        latestBmi = updateLatest(latestBmi, bmi, endDate);
        continue;
      }

      if (type === RECORD_TYPES.sleep) {
        if (!startDate || !endDate || endDate < windowStart) continue;
        if (!value || !value.includes('Asleep')) continue;
        const durationHours = Math.max(0, (endDate.getTime() - startDate.getTime()) / 3600000);
        const dayKey = endDate.toISOString().slice(0, 10);
        sleepByDayHours.set(dayKey, (sleepByDayHours.get(dayKey) ?? 0) + durationHours);
        continue;
      }

      if (type === RECORD_TYPES.alcohol) {
        if (!startDate || startDate < alcoholWindowStart) continue;
        const drinks = toNumber(value);
        if (drinks !== undefined && unit === 'count') {
          alcoholCountLast7Days += drinks;
        }
        continue;
      }

      if (type === RECORD_TYPES.dietEnergy) {
        if (!startDate || startDate < windowStart) continue;
        const kcal = normalizeEnergyKcal(toNumber(value), unit);
        const dayKey = startDate.toISOString().slice(0, 10);
        if (kcal !== undefined) {
          dietEnergyByDay.set(dayKey, (dietEnergyByDay.get(dayKey) ?? 0) + kcal);
        }
        continue;
      }

      if (type === RECORD_TYPES.tobacco) {
        if (!value) continue;
        if (value.includes('User')) smokingStatus = 'current';
        if (value.includes('NonUser')) smokingStatus = 'never';
        continue;
      }

      if (type === RECORD_TYPES.systolic) {
        const systolic = toNumber(value);
        latestSystolic = updateLatest(latestSystolic, systolic, endDate);
        continue;
      }

      if (type === RECORD_TYPES.diastolic) {
        const diastolic = toNumber(value);
        latestDiastolic = updateLatest(latestDiastolic, diastolic, endDate);
        continue;
      }

      if (type === RECORD_TYPES.totalCholesterol) {
        const total = toNumber(value);
        latestTotalChol = updateLatest(latestTotalChol, total, endDate);
        continue;
      }

      if (type === RECORD_TYPES.hdl) {
        const hdl = toNumber(value);
        latestHdl = updateLatest(latestHdl, hdl, endDate);
        continue;
      }

      if (type === RECORD_TYPES.ldl) {
        const ldl = toNumber(value);
        latestLdl = updateLatest(latestLdl, ldl, endDate);
        continue;
      }

      if (type === RECORD_TYPES.triglycerides) {
        const triglycerides = toNumber(value);
        latestTriglycerides = updateLatest(latestTriglycerides, triglycerides, endDate);
        continue;
      }

      continue;
    }

    if (line.includes('<Workout ')) {
      const attrs = parseAttributes(line);
      const startDate = parseAppleDate(attrs.startDate);
      if (!startDate || startDate < windowStart) continue;
      const dayKey = startDate.toISOString().slice(0, 10);
      workoutDays.add(dayKey);
      continue;
    }
  }
}

function averageFromMap(map) {
  if (map.size === 0) return undefined;
  const total = Array.from(map.values()).reduce((sum, value) => sum + value, 0);
  return total / map.size;
}

function getAgeFromDob(dob) {
  const parsed = parseAppleDate(dob);
  if (!parsed) return undefined;
  const diff = now.getTime() - parsed.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

function mapSex(value) {
  if (!value) return undefined;
  if (value.includes('Male')) return 'male';
  if (value.includes('Female')) return 'female';
  return 'other';
}

function buildOutput() {
  const heightCm = latestHeight?.value;
  const weightKg = latestWeight?.value;
  const bmi = latestBmi?.value ?? (heightCm && weightKg ? weightKg / Math.pow(heightCm / 100, 2) : undefined);

  const sleepHours = averageFromMap(sleepByDayHours);
  const exerciseDaysPerWeek = workoutDays.size > 0 ? (workoutDays.size / windowDays) * 7 : 0;
  const dietKcalPerDay = averageFromMap(dietEnergyByDay);
  const alcoholDrinksPerWeek = alcoholCountLast7Days;

  const age = meProfile?.dateOfBirth ? getAgeFromDob(meProfile.dateOfBirth) : undefined;
  const sex = mapSex(meProfile?.biologicalSex);

  const inputs = {
    name: providedName || null,
    age: age ?? null,
    sex: sex ?? null,
    heightCm: heightCm ?? null,
    weightKg: weightKg ?? null,
    sleepHours: sleepHours ?? null,
    exerciseDaysPerWeek: Number.isFinite(exerciseDaysPerWeek) ? Number(exerciseDaysPerWeek.toFixed(1)) : null,
    dietQuality: null,
    stressLevel: null,
    smokingStatus: smokingStatus ?? null,
    alcoholDrinksPerWeek: alcoholDrinksPerWeek ?? null,
    familyHistoryHeart: null,
    familyHistoryDiabetes: null,
    familyHistoryCancer: null,
    existingConditions: []
  };

  const clinicalMarkers = {
    totalCholesterolMgDl: latestTotalChol?.value ?? null,
    hdlMgDl: latestHdl?.value ?? null,
    systolicBloodPressureMmHg: latestSystolic?.value ?? null,
    onBloodPressureTreatment: null,
    hasDiabetes: null
  };

  const missing = Object.entries(inputs)
    .filter(([key, value]) => value === null && key !== 'existingConditions')
    .map(([key]) => key);

  const notes = [
    'dietQuality and stressLevel are not directly available in Apple Health exports.',
    'smokingStatus is only inferred if tobacco use records exist (no former status).',
    'alcoholDrinksPerWeek uses HKQuantityTypeIdentifierAlcoholConsumption with unit=count over the last 7 days.'
  ];

  return {
    source: 'apple-health',
    inputFile: inputPath,
    generatedAt: now.toISOString(),
    windowDays,
    inputs,
    clinicalMarkers,
    rawMetrics: {
      bmi: bmi ?? null,
      diastolicBloodPressureMmHg: latestDiastolic?.value ?? null,
      ldlMgDl: latestLdl?.value ?? null,
      triglyceridesMgDl: latestTriglycerides?.value ?? null,
      dietKcalPerDay: dietKcalPerDay ?? null,
      workoutDaysWithActivity: workoutDays.size,
      sleepDaysWithData: sleepByDayHours.size
    },
    missing,
    notes
  };
}

async function main() {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  await parseFile();
  const output = buildOutput();

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Saved parsed summary to ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
