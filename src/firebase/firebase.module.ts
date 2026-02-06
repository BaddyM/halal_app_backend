// src/firebase/firebase.module.ts
import { Module, Global } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { join } from 'path'; // Import path module
import { FirebaseService } from './firebase.service';

// Make this module global if you want to inject FirebaseService across your app
@Global()
@Module({
    providers: [
        {
            provide: 'FIREBASE_APP', // Provide a token for the Firebase app instance
            useFactory: () => {
                // Construct the path to your service account key file
                // Make sure this path is correct relative to your NestJS app's root.
                const serviceAccountPath = join(__dirname, '..', 'config', 'zimbena-gardens-firebase-adminsdk-fbsvc-0a71156385.json');;

                // Check if the file exists (optional, but good for debugging)
                try {
                    require(serviceAccountPath); // This will throw if file not found/invalid JSON
                } catch (e) {
                    console.error(`Error loading Firebase service account key from ${serviceAccountPath}:`, e);
                    process.exit(1); // Exit if critical config is missing
                }

                const serviceAccount = require(serviceAccountPath);

                return admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                    // You might also set databaseURL or storageBucket if you use other Firebase services
                    // For example: databaseURL: "https://<DATABASE_NAME>.firebaseio.com",
                });
            },
        },
        FirebaseService, // Your service to wrap FCM logic
    ],
    exports: ['FIREBASE_APP', FirebaseService],
})
export class FirebaseModule { }