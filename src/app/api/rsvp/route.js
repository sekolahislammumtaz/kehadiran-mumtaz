import { NextResponse } from 'next/server';
import { saveAttendance, getAttendanceRecap, deleteAttendance } from '@/lib/data';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const password = searchParams.get('password');
    const eventName = searchParams.get('event');

    const expectedPassword = process.env.ADMIN_PASSWORD || 'SiMumtaz123';
    if (password !== expectedPassword) {
      return NextResponse.json({ error: 'Password admin tidak valid' }, { status: 401 });
    }

    const recap = await getAttendanceRecap(eventName);
    return NextResponse.json(recap);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { student_name, class_name, attendance_option, event_name } = body;

    if (!student_name || !class_name || !attendance_option || !event_name) {
      return NextResponse.json({ error: 'Data konfirmasi tidak lengkap' }, { status: 400 });
    }

    const result = await saveAttendance({
      student_name,
      class_name,
      attendance_option,
      event_name
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const password = searchParams.get('password');
    const studentName = searchParams.get('student_name');
    const className = searchParams.get('class_name');
    const eventName = searchParams.get('event_name');

    const expectedPassword = process.env.ADMIN_PASSWORD || 'SiMumtaz123';
    if (password !== expectedPassword) {
      return NextResponse.json({ error: 'Password admin tidak valid' }, { status: 401 });
    }

    if (!studentName || !className || !eventName) {
      return NextResponse.json({ error: 'Parameter penghapusan tidak lengkap' }, { status: 400 });
    }

    const result = await deleteAttendance(studentName, className, eventName);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
