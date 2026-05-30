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
 * Admin-only: Delete a user from Firebase Auth + Firestore users, coaches, and coach_salary_settings collection.
 * Body: { uid }
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

    const { uid } = req.body;
    if (!uid) {
      return res.status(400).json({ error: 'uid is required' });
    }

    // Delete in Firebase Auth
    await auth.deleteUser(uid);

    // Delete from Firestore 'users' collection
    await db.collection('users').doc(uid).delete();

    // Delete from Firestore 'coaches' collection if it exists
    await db.collection('coaches').doc(uid).delete();
    
    // Delete from Firestore 'coach_salary_settings' if it exists
    await db.collection('coach_salary_settings').doc(uid).delete();

    return res.status(200).json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('[admin/delete-user] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
