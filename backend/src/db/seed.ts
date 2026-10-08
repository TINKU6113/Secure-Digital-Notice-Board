import bcrypt from 'bcryptjs';
import { pool } from './pool.js';

async function seedDatabase() {
  console.log('🌱 Seeding database with initial users and notices...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Password hashes using standard bcrypt with salt rounds 10
    const adminHash = await bcrypt.hash('Admin@123', 10);
    const facultyHash = await bcrypt.hash('Faculty@123', 10);
    const studentHash = await bcrypt.hash('Student@123', 10);

    // 2. Insert Users (upsert on email)
    const users = [
      {
        email: 'admin@college.edu',
        password_hash: adminHash,
        full_name: 'System Administrator',
        role: 'ADMIN',
        department: 'General',
      },
      {
        email: 'faculty.cse@college.edu',
        password_hash: facultyHash,
        full_name: 'Dr. Alan Turing',
        role: 'FACULTY',
        department: 'CSE',
      },
      {
        email: 'faculty.cys@college.edu',
        password_hash: facultyHash,
        full_name: 'Prof. Ada Lovelace',
        role: 'FACULTY',
        department: 'CYS',
      },
      {
        email: 'student@college.edu',
        password_hash: studentHash,
        full_name: 'John Doe',
        role: 'STUDENT',
        department: 'CSE',
      },
      {
        email: 'student.cys@college.edu',
        password_hash: studentHash,
        full_name: 'Jane Smith',
        role: 'STUDENT',
        department: 'CYS',
      },
    ];

    const userMap: Record<string, string> = {};

    for (const u of users) {
      const res = await client.query(
        `
        INSERT INTO users (email, password_hash, full_name, role, department)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (email) DO UPDATE 
        SET password_hash = EXCLUDED.password_hash,
            full_name = EXCLUDED.full_name,
            role = EXCLUDED.role,
            department = EXCLUDED.department,
            updated_at = NOW()
        RETURNING id, email;
        `,
        [u.email, u.password_hash, u.full_name, u.role, u.department]
      );
      userMap[res.rows[0].email] = res.rows[0].id;
    }

    console.log('✅ Users seeded successfully:', Object.keys(userMap));

    // 3. Clear and Insert Sample Notices
    await client.query('DELETE FROM notices');

    const now = new Date();
    const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days ahead
    const pastDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000); // 14 days ago
    const pastExpiry = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago expired

    const notices = [
      {
        title: 'End-Semester Examination Schedule for CSE',
        content: 'The end-semester lab and theory examinations for the Computer Science & Engineering department are scheduled to commence from November 15. Detailed room allocations and instructions are posted in the department office.',
        author_id: userMap['faculty.cse@college.edu'],
        department: 'CSE',
        category: 'Examination',
        priority: 'Important',
        status: 'PUBLISHED',
        scheduled_at: pastDate,
        expires_at: futureDate,
      },
      {
        title: 'Campus Security Advisory - Cyber Defense Protocol',
        content: 'All faculty and students are requested to be cautious regarding phishing emails impersonating college administration. Multi-Factor Authentication (MFA) will be enforced across all student portals starting next week.',
        author_id: userMap['admin@college.edu'],
        department: 'General',
        category: 'Emergency',
        priority: 'Urgent',
        status: 'PUBLISHED',
        scheduled_at: pastDate,
        expires_at: futureDate,
      },
      {
        title: 'Hands-on Workshop: Web Application Security & Threat Modeling',
        content: 'The Department of Cyber Security is conducting a 3-day practical workshop on STRIDE threat modeling, DFD analysis, and OWASP Top 10 mitigation. Registration is restricted to 40 participants.',
        author_id: userMap['faculty.cys@college.edu'],
        department: 'CYS',
        category: 'Workshop',
        priority: 'Normal',
        status: 'SCHEDULED',
        scheduled_at: futureDate,
        expires_at: new Date(futureDate.getTime() + 10 * 24 * 60 * 60 * 1000),
      },
      {
        title: 'Annual College Hackathon 2026 - Draft Call for Proposals',
        content: 'Draft internal outline for problem statements in cloud security, IoT networks, and automated software verification. Not yet ready for public distribution.',
        author_id: userMap['faculty.cse@college.edu'],
        department: 'CSE',
        category: 'Event',
        priority: 'Normal',
        status: 'DRAFT',
        scheduled_at: null,
        expires_at: null,
      },
      {
        title: 'National Holiday Announcement - Campus Closed',
        content: 'The college campus will remain closed on October 2 for Gandhi Jayanti. All regular classes and laboratory sessions stand suspended.',
        author_id: userMap['admin@college.edu'],
        department: 'General',
        category: 'Holiday',
        priority: 'Normal',
        status: 'ARCHIVED',
        scheduled_at: pastDate,
        expires_at: pastExpiry,
      },
    ];

    for (const n of notices) {
      await client.query(
        `
        INSERT INTO notices (
          title, content, author_id, department, category, priority, status, scheduled_at, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
        `,
        [
          n.title,
          n.content,
          n.author_id,
          n.department,
          n.category,
          n.priority,
          n.status,
          n.scheduled_at,
          n.expires_at,
        ]
      );
    }

    // 4. Initial Audit Log
    await client.query(
      `
      INSERT INTO audit_logs (
        user_id, user_email, user_role, action, resource_type, resource_id, status, ip_address, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
      `,
      [
        userMap['admin@college.edu'],
        'admin@college.edu',
        'ADMIN',
        'SYSTEM_SEED',
        'SYSTEM',
        'SYSTEM_INIT',
        'SUCCESS',
        '127.0.0.1',
        JSON.stringify({ description: 'Initial seed data populated for SSE exam lab environment' }),
      ]
    );

    await client.query('COMMIT');
    console.log('🎉 Database seeded successfully with demo users and sample notices!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedDatabase();
