import admin from 'firebase-admin';

// Initialize Firebase Admin SDK (singleton)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db   = admin.firestore();
const auth = admin.auth();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Verify Bearer token
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = await auth.verifyIdToken(token);

    // Fetch user role from Firestore
    const userDoc = await db.collection('users').doc(decoded.uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admins only' });
    }

    const { collection = 'students' } = req.query;
    const allowed = ['students', 'coaches', 'attendance', 'payments'];
    if (!allowed.includes(collection)) {
      return res.status(400).json({ error: 'Invalid collection' });
    }

    const snap = await db.collection(collection).get();
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({ data });
  } catch (err) {
    console.error('[export] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
