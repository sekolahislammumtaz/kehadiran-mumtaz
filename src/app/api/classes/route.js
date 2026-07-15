import { NextResponse } from 'next/server';
import { getClasses } from '@/lib/data';

export async function GET() {
  try {
    const classes = await getClasses();
    return NextResponse.json(classes);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
