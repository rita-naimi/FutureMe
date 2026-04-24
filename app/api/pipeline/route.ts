import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { HealthInputs } from '@/lib/fhir';
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

export async function POST(req: NextRequest) {
  const raw = await req.json();
  const parsed = pipelineRequestSchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid pipeline request payload',
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const result = await runSimulationPipeline(parsed.data);
  return NextResponse.json(result);
}
