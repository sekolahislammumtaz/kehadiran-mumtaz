import { NextResponse } from 'next/server';
import { getArchivesList, getArchiveData, archiveAttendance } from '@/lib/data';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const password = searchParams.get('password');
    const archiveName = searchParams.get('archive_name');

    const expectedPassword = process.env.ADMIN_PASSWORD || 'SiMumtaz123';
    if (password !== expectedPassword) {
      return NextResponse.json({ error: 'Password admin tidak valid' }, { status: 401 });
    }

    if (archiveName) {
      const data = await getArchiveData(archiveName);
      return NextResponse.json(data);
    } else {
      const list = await getArchivesList();
      return NextResponse.json(list);
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { password, archive_name, event_name } = body;

    const expectedPassword = process.env.ADMIN_PASSWORD || 'SiMumtaz123';
    if (password !== expectedPassword) {
      return NextResponse.json({ error: 'Password admin tidak valid' }, { status: 401 });
    }

    if (!archive_name || !event_name) {
      return NextResponse.json({ error: 'Parameter pengarsipan tidak lengkap' }, { status: 400 });
    }

    const result = await archiveAttendance(archive_name, event_name);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
