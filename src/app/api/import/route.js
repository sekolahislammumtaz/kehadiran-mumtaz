import { NextResponse } from 'next/server';
import { importData } from '@/lib/data';

export async function POST(request) {
  try {
    const body = await request.json();
    const { password, rows } = body;

    const expectedPassword = process.env.ADMIN_PASSWORD || 'SiMumtaz123';
    if (password !== expectedPassword) {
      return NextResponse.json({ error: 'Password admin tidak valid' }, { status: 401 });
    }

    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'Data baris tidak valid' }, { status: 400 });
    }

    const result = await importData(rows);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
