import admin from 'firebase-admin';

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

/**
 * Admin-only: Create a new user in Firebase Auth + Firestore users collection.
 * Body: { email, password, name, role, phone }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = await auth.verifyIdToken(token);
    const callerDoc = await db.collection('users').doc(decoded.uid).get();

    if (!callerDoc.exists || callerDoc.data().role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admins only' });
    }

    const { email, password, name, role, phone } = req.body;
    if (!email || !password || !role) {
      return res.status(400).json({ error: 'email, password, and role are required' });
    }

    // Create in Firebase Auth
    const newUser = await auth.createUser({ email, password, displayName: name });

    // Store profile in Firestore
    await db.collection('users').doc(newUser.uid).set({
      uid:   newUser.uid,
      name:  name  || '',
      role:  role  || 'coach',
      phone: phone || '',
      email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(201).json({ uid: newUser.uid, message: 'User created successfully' });
  } catch (err) {
    console.error('[admin/create-user] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
