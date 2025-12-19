import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import firebase_app from 'firebase/config';

/**
 * Generates a bet ID in the format: YYYY-MM-XXXX
 * Example: 2025-10-0034
 * 
 * The counter is stored in Firestore and increments for each new bet per month
 */
export const generateBetId = async (): Promise<string> => {
  const db = getFirestore(firebase_app);
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  
  // Counter document path: counters/bet_counter_YYYY_MM
  const counterDocId = `bet_counter_${year}_${month}`;
  const counterRef = doc(db, 'counters', counterDocId);
  
  try {
    // Get current counter value
    const counterSnap = await getDoc(counterRef);
    let counter = 1;
    
    if (counterSnap.exists()) {
      counter = counterSnap.data().count + 1;
    }
    
    // Update counter
    await setDoc(counterRef, { count: counter }, { merge: true });
    
    // Format: YYYY-MM-XXXX
    const betId = `${year}-${month}-${String(counter).padStart(4, '0')}`;
    
    return betId;
  } catch (error) {
    console.error('Error generating bet ID:', error);
    // Fallback to timestamp-based ID if counter fails
    return `${year}-${month}-${Date.now().toString().slice(-4)}`;
  }
};
