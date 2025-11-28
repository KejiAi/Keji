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

    // Check if email or phone already exists
    const existingEntry = await sql`
      SELECT email, phone FROM waitlist 
      WHERE email = ${email} OR phone = ${phone}
      LIMIT 1
    `;

    if (existingEntry.length > 0) {
      const entry = existingEntry[0];
      if (entry.email === email) {
        return res.status(409).json({ error: 'This email is already registered on the waitlist' });
      }
      if (entry.phone === phone) {
        return res.status(409).json({ error: 'This phone number is already registered on the waitlist' });
      }
    }

    // Insert the new entry
    await sql`
      INSERT INTO waitlist (name, email, phone)
      VALUES (${name}, ${email}, ${phone})
    `;

    return res.status(200).json({ message: 'Successfully added to waitlist' });
  } catch (err) {
    console.error('Database error:', err);
    const errorMessage = err instanceof Error ? err.message : 'An error occurred';
    return res.status(500).json({ error: errorMessage });
  }
}
