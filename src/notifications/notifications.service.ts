import { Injectable } from '@nestjs/common';
const admin = require("firebase-admin");

@Injectable()
export class NotificationsService {
  async sendNotification(title: string, body: string, fcmToken: string) {
    const message = {
      notification: { title, body },
      token: fcmToken,
    };

    try {
      const response = await admin.messaging().send(message);
      return { success: true, response };
    } catch (error) {
      return { success: false, error };
    }
  }
}
