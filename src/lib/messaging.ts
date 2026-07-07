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
        if (Notification.permission === 'denied') {
            console.log('Notification permission is denied by the user.');
            return;
        }
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const cacheKey = `fcm_token_saved_${userId}`;
            const cachedToken = localStorage.getItem(cacheKey);

            const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
            if (currentToken) {
                if (cachedToken !== currentToken) {
                    // Save the token to Firestore
                    const tokenRef = doc(db, 'users', userId, 'fcmTokens', currentToken);
                    await setDoc(tokenRef, {
                        token: currentToken,
                        lastSeen: serverTimestamp(),
                    });
                    localStorage.setItem(cacheKey, currentToken);
                    console.log('FCM Token saved and cached:', currentToken);
                } else {
                    console.log('FCM Token already cached and active.');
                }
            } else {
                console.log('No registration token available.');
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
