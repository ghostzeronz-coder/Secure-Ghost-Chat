import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;

  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return data;
}

export function usePushNotifications(enabled: boolean) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);

  useEffect(() => {
    if (!enabled) return;
    registerForPushNotificationsAsync().then(setExpoPushToken);

    const receivedSub = Notifications.addNotificationReceivedListener(setNotification);
    const responseSub = Notifications.addNotificationResponseReceivedListener(
      (response: Notifications.NotificationResponse) => {
        console.log("Notification response:", response);
      },
    );

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [enabled]);

  return { expoPushToken, notification };
}
