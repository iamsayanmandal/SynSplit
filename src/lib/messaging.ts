import { getToken } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { messaging, db } from '../firebase';

// Web Push Certificate Key pair from Firebase Console
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';

export async function requestPermissionAndSaveToken(userId: string) {
    try {
        if (!messaging) {
            console.log('Push messaging not supported on this browser.');
            return;
        }
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
    } catch (error: any) {
        if (error?.message?.includes('Installations') || error?.message?.includes('PERMISSION_DENIED')) {
            console.warn('[FCM] Push notification token generation is unavailable. If you want push notifications, please enable the "Firebase Installations API" in your Google Cloud Console for this API key.');
        } else {
            console.error('[FCM] Error retrieving token:', error);
        }
    }
}
