import { NextResponse } from 'next/server';
import { getSettings, saveSettings } from '@/lib/data';

export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { password, ...settings } = body;

    const expectedPassword = process.env.ADMIN_PASSWORD || 'SiMumtaz123';
    if (password !== expectedPassword) {
      return NextResponse.json({ error: 'Password admin tidak valid' }, { status: 401 });
    }

    await saveSettings(settings);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
