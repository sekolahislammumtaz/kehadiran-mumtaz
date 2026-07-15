import { NextResponse } from 'next/server';
import { getStudents, getSettings, getAttendanceRecap } from '@/lib/data';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const className = searchParams.get('class');
    const filterConfirmed = searchParams.get('filter_confirmed') === 'true';

    // 1. Fetch matching students from database
    const students = await getStudents(className);

    // 2. Filter out already confirmed students if filtering is requested or if className is provided (RSVP page usage)
    if (className || filterConfirmed) {
      const settings = await getSettings();
      const activeEvent = settings.event_name;
      
      // Fetch current RSVP list for the active event
      const confirmedRsvps = await getAttendanceRecap(activeEvent);
      
      // Create a set of "studentName_className" keys for fast lookup
      const confirmedKeys = new Set(
        confirmedRsvps.map(item => `${item.student_name.toLowerCase().trim()}_${item.class_name.toLowerCase().trim()}`)
      );

      if (className) {
        // If className is provided, 'students' is an array of student name strings
        const filtered = students.filter(studentName => {
          const key = `${studentName.toLowerCase().trim()}_${className.toLowerCase().trim()}`;
          return !confirmedKeys.has(key);
        });
        return NextResponse.json(filtered);
      } else {
        // If no className, 'students' is an array of { name, class_name } objects
        const filtered = students.filter(student => {
          const key = `${student.name.toLowerCase().trim()}_${student.class_name.toLowerCase().trim()}`;
          return !confirmedKeys.has(key);
        });
        return NextResponse.json(filtered);
      }
    }

    // Return unfiltered list of students (default for Admin dashboard stats)
    return NextResponse.json(students);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
