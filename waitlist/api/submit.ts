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
