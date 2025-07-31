// src/firebase/firebase.service.ts
import { Injectable, Inject } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService {
  constructor(@Inject('FIREBASE_APP') private firebaseApp: admin.app.App) {}

  async sendNotification(token: string, title: string, body: string, data?: { [key: string]: string }) {
    const message: admin.messaging.Message = {
      notification: {
        title: title,
        body: body,
      },
      data: data,
      token: token,
    };

    try {
      const response = await this.firebaseApp.messaging().send(message);
      console.log('Successfully sent message:', response);
      return response;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async sendMulticastNotification(tokens: string[], title: string, body: string, data?: { [key: string]: string }) {
    const message: admin.messaging.MulticastMessage = {
      notification: {
        title: title,
        body: body,
      },
      data: data,
      tokens: tokens,
    };

    try {
      const response = await this.firebaseApp.messaging().sendEachForMulticast(message);
      console.log('Successfully sent multicast message:', response);
      return response;
    } catch (error) {
      console.error('Error sending multicast message:', error);
      throw error;
    }
  }

  // You can add more methods here for topic messaging, etc.
}