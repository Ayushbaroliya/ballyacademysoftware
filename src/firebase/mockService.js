import studentsData from '../mocks/students.json';

// Simulated Firestore Database
const mockDb = {
  students: [...studentsData],
  attendance: [],
  fees: [],
  coaches: [
    { id: "coach_001", coachId: "coach_001", name: "Rajkumar Sharma", phone: "9876543210", specialization: "Batting", assignedBatchIds: ["Morning", "Weekend"] },
    { id: "coach_002", coachId: "coach_002", name: "Dinesh Lad", phone: "8765432109", specialization: "Bowling", assignedBatchIds: ["Evening"] },
    { id: "coach_003", coachId: "coach_003", name: "Karsan Ghavri", phone: "7654321098", specialization: "All-rounder", assignedBatchIds: ["Morning"] },
    { id: "sharmabro_uid", coachId: "sharmabro_uid", name: "Sharma Coach", phone: "9999999999", specialization: "Spin Bowling", assignedBatchIds: ["Morning", "Evening"] }
  ],
  users: [
    { id: "mock_admin", email: "deeptisonkar34@gmail.com", name: "Hello Bally Sir", role: "admin" },
    { id: "coach_001", email: "coach1@academy.com", name: "Rajkumar Sharma", role: "coach" },
    { id: "coach_002", email: "coach2@academy.com", name: "Dinesh Lad", role: "coach" },
    { id: "sharmabro_uid", email: "sharmabro.27@gmail.com", name: "Sharma Coach", role: "coach" }
  ],
  coach_attendance: [],
  coach_salary_settings: [
    { id: "coach_001", coachId: "coach_001", salaryType: "monthly", rate: 30000 },
    { id: "coach_002", coachId: "coach_002", salaryType: "per_session", rate: 1000 },
    { id: "coach_003", coachId: "coach_003", salaryType: "per_hour", rate: 500 },
    { id: "sharmabro_uid", coachId: "sharmabro_uid", salaryType: "monthly", rate: 25000 }
  ],
  coach_salary_payments: []
};

// Mock Firebase Functions
export const mockFirestore = {
  collection: (path) => {
    return {
      get: async () => {
        console.log(`[Mock Firestore] GET collection: ${path}`);
        return {
          docs: mockDb[path].map(doc => ({
            id: doc.id,
            data: () => doc
          }))
        };
      },
      add: async (data) => {
        console.log(`[Mock Firestore] ADD to ${path}:`, data);
        const newDoc = { id: `mock_${Math.random().toString(36).substr(2, 9)}`, ...data };
        mockDb[path].push(newDoc);
        return { id: newDoc.id };
      }
    };
  },
  doc: (path, id) => {
    return {
      get: async () => {
        const doc = mockDb[path].find(d => d.id === id);
        return {
          exists: !!doc,
          data: () => doc
        };
      },
      update: async (data) => {
        const index = mockDb[path].findIndex(d => d.id === id);
        if (index !== -1) {
          mockDb[path][index] = { ...mockDb[path][index], ...data };
        }
      },
      delete: async () => {
        mockDb[path] = mockDb[path].filter(d => d.id !== id);
      }
    };
  }
};

export const mockAuth = {
  currentUser: { uid: 'mock_admin', email: 'deeptisonkar34@gmail.com', displayName: 'Hello Bally Sir' },
  signInWithEmailAndPassword: async (email, password) => {
    console.log(`[Mock Auth] Signing in with: ${email}`);
    if (email === 'deeptisonkar34@gmail.com' || email === 'deeptisonkar@ballyacademy.com') {
      if (password === '12345@ballysir') {
        return { user: { uid: 'mock_admin', email } };
      }
      throw new Error('Firebase: Error (auth/wrong-password).');
    }
    const user = mockDb.users.find(u => u.email === email);
    if (user) {
      return { user: { uid: user.id, email } };
    }
    throw new Error('Firebase: Error (auth/user-not-found).');
  },
  signOut: async () => {
    console.log('[Mock Auth] Signing out');
  },
  onAuthStateChanged: (callback) => {
    callback({ uid: 'mock_admin', email: 'deeptisonkar34@gmail.com' });
    return () => {};
  }
};
