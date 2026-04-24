import { NextRequest, NextResponse } from 'next/server';
import type { HealthInputs } from '@/lib/fhir';
import { createTwinProfile } from '@/lib/profile';

export async function POST(req: NextRequest) {
  const inputs = (await req.json()) as HealthInputs;
  return NextResponse.json(createTwinProfile(inputs));
}
