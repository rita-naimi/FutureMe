import { NextRequest, NextResponse } from 'next/server';
import type { HealthInputs } from '@/lib/fhir';
import { createTwinProfile } from '@/lib/profile';
import { buildInputsFromAppleHealth } from '@/lib/backend/appleHealth';

export async function POST(req: NextRequest) {
  const payload = (await req.json()) as { inputs?: HealthInputs; appleHealth?: unknown };
  const inputs = payload.inputs ?? (payload.appleHealth ? buildInputsFromAppleHealth(payload.appleHealth as never) : undefined);

  if (!inputs) {
    return NextResponse.json({ error: 'Missing inputs' }, { status: 400 });
  }
  return NextResponse.json(createTwinProfile(inputs));
}
