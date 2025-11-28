import { neon } from '@neondatabase/serverless';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { name, email, phone } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({ error: 'Name, email, and phone are required' });
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return res.status(500).json({ error: 'DATABASE_URL is not configured' });
    }

    const sql = neon(databaseUrl);

    // Create table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS waitlist (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        phone VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Insert the new entry
    await sql`
      INSERT INTO waitlist (name, email, phone)
      VALUES (${name}, ${email}, ${phone})
      ON CONFLICT (email) DO NOTHING
    `;

    return res.status(200).json({ message: 'Successfully added to waitlist' });
  } catch (err) {
    console.error('Database error:', err);
    const errorMessage = err instanceof Error ? err.message : 'An error occurred';
    return res.status(500).json({ error: errorMessage });
  }
}
