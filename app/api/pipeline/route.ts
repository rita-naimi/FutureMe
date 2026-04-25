import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { HealthInputs } from '@/lib/fhir';
import { buildClinicalMarkersFromAppleHealth, buildInputsFromAppleHealth } from '@/lib/backend/appleHealth';
import { runSimulationPipeline } from '@/lib/backend/pipeline';

export const runtime = 'nodejs';

const healthInputsSchema: z.ZodType<HealthInputs> = z.object({
  name: z.string().min(1),
  age: z.number().int().min(1).max(120),
  sex: z.enum(['male', 'female', 'other']),
  heightCm: z.number().min(80).max(250),
  weightKg: z.number().min(20).max(400),
  sleepHours: z.number().min(0).max(24),
  exerciseDaysPerWeek: z.number().min(0).max(7),
  dietQuality: z.number().min(1).max(5),
  stressLevel: z.number().min(1).max(5),
  smokingStatus: z.enum(['never', 'former', 'current']),
  alcoholDrinksPerWeek: z.number().min(0).max(70),
  familyHistoryHeart: z.boolean(),
  familyHistoryDiabetes: z.boolean(),
  familyHistoryCancer: z.boolean(),
  existingConditions: z.array(z.string())
});

const appleHealthSchema = z.object({
  inputs: z
    .object({
      name: z.string().nullable().optional(),
      age: z.number().nullable().optional(),
      sex: z.enum(['male', 'female', 'other']).nullable().optional(),
      heightCm: z.number().nullable().optional(),
      weightKg: z.number().nullable().optional(),
      sleepHours: z.number().nullable().optional(),
      exerciseDaysPerWeek: z.number().nullable().optional(),
      dietQuality: z.number().nullable().optional(),
      stressLevel: z.number().nullable().optional(),
      smokingStatus: z.enum(['never', 'former', 'current']).nullable().optional(),
      alcoholDrinksPerWeek: z.number().nullable().optional(),
      familyHistoryHeart: z.boolean().nullable().optional(),
      familyHistoryDiabetes: z.boolean().nullable().optional(),
      familyHistoryCancer: z.boolean().nullable().optional(),
      existingConditions: z.array(z.string()).optional()
    })
    .optional(),
  clinicalMarkers: z
    .object({
      totalCholesterolMgDl: z.number().nullable().optional(),
      hdlMgDl: z.number().nullable().optional(),
      systolicBloodPressureMmHg: z.number().nullable().optional(),
      onBloodPressureTreatment: z.boolean().nullable().optional(),
      hasDiabetes: z.boolean().nullable().optional()
    })
    .optional()
});

const pipelineRequestSchema = z.object({
  inputs: healthInputsSchema,
  yearsOfHistory: z.union([z.literal(5), z.literal(10)]).optional(),
  kNearest: z.number().int().min(1).max(10).optional(),
  includePubMed: z.boolean().optional(),
  pubMedMaxArticles: z.number().int().min(1).max(5).optional(),
  enableLlmSummary: z.boolean().optional(),
  enableLocalRagCache: z.boolean().optional(),
  clinicalMarkers: z
    .object({
      totalCholesterolMgDl: z.number().positive().optional(),
      hdlMgDl: z.number().positive().optional(),
      systolicBloodPressureMmHg: z.number().positive().optional(),
      onBloodPressureTreatment: z.boolean().optional(),
      hasDiabetes: z.boolean().optional()
    })
    .optional()
});

function normalizePipelineRequest(raw: unknown) {
  if (!raw || typeof raw !== 'object') return raw;
  const data = raw as Record<string, unknown>;

  if (!data.appleHealth) return raw;

  const parsedApple = appleHealthSchema.safeParse(data.appleHealth);
  if (!parsedApple.success) {
    return { __invalidAppleHealth: parsedApple.error.flatten() };
  }

  const inputs = data.inputs ?? buildInputsFromAppleHealth(parsedApple.data);
  const clinicalMarkers =
    (data.clinicalMarkers as Record<string, unknown>) ?? buildClinicalMarkersFromAppleHealth(parsedApple.data);

  const rest = { ...data };
  delete rest.appleHealth;

  return {
    ...rest,
    inputs,
    clinicalMarkers
  };
}

export async function POST(req: NextRequest) {
  const raw = await req.json();
  const normalized = normalizePipelineRequest(raw);

  if ((normalized as { __invalidAppleHealth?: unknown }).__invalidAppleHealth) {
    return NextResponse.json(
      {
        error: 'Invalid Apple Health payload',
        details: (normalized as { __invalidAppleHealth: unknown }).__invalidAppleHealth
      },
      { status: 400 }
    );
  }

  const parsed = pipelineRequestSchema.safeParse(normalized);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid pipeline request payload',
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  try {
    const result = await runSimulationPipeline(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Pipeline analysis failed';
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
