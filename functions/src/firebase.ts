import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const firebaseApp = getApps()[0] ?? initializeApp();

export const db = getFirestore(firebaseApp);
