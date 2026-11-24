// Test stand-in for firebase-admin/firestore: the tests put their fake database on the app object.
export const getFirestore = (app) => app.__db;
