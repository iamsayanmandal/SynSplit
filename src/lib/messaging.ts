import { getToken } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { messaging, db } from '../firebase';

// Web Push Certificate Key pair from Firebase Console
const VAPID_KEY = 'BIj59IOmlAiBWwEWlyJU0tNFbPLlb-Ggsv8mFjUSarbM-1tydWsTqIVVeCzM7zJItJkhtMREqriWiCRA280rRtQ';

export async function requestPermissionAndSaveToken(userId: string) {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
            if (currentToken) {
                // Save the token to Firestore
                const tokenRef = doc(db, 'users', userId, 'fcmTokens', currentToken);
                await setDoc(tokenRef, {
                    token: currentToken,
                    lastSeen: serverTimestamp(),
                });
                console.log('FCM Token saved:', currentToken);
            } else {
                console.log('No registration token available. Request permission to generate one.');
            }
        } else {
            console.log('Unable to get permission to notify.');
        }
    } catch (error) {
        console.error('An error occurred while retrieving token. ', error);
    }
}
