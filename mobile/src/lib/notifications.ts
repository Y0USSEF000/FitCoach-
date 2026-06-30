import * as Device from "expo-device";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { Lang, t } from "./i18n";
import type { NotificationPrefs } from "./api";

// Expo Go (SDK 53+) removed push notifications and prints a loud error the
// moment `expo-notifications` is imported. So we only load it OUTSIDE Expo Go
// (i.e. in a development/standalone build). In Expo Go these functions become
// safe no-ops — the rest of the app works normally.
const isExpoGo = Constants.executionEnvironment === "storeClient";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Notifications: typeof import("expo-notifications") | null = isExpoGo
  ? null
  : require("expo-notifications");

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function requestPermissions(): Promise<boolean> {
  if (!Notifications) return false;
  if (!Device.isDevice) return false;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("reminders", {
      name: "Reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#22c55e",
    });
  }
  const { status } = await Notifications.getPermissionsAsync();
  if (status === "granted") return true;
  const { status: asked } = await Notifications.requestPermissionsAsync();
  return asked === "granted";
}

function parseHM(hm: string): { hour: number; minute: number } {
  const [h, m] = (hm || "").split(":").map((n) => parseInt(n, 10));
  return { hour: isNaN(h) ? 8 : h, minute: isNaN(m) ? 0 : m };
}

/**
 * Cancel all and re-schedule based on prefs:
 *  - "time to eat"       → daily at each meal time
 *  - "time to drink"     → repeating every N hours
 *  - "did you eat today" → daily at 20:00
 */
export async function rescheduleAll(lang: Lang, prefs: NotificationPrefs) {
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (prefs.mealReminders) {
    for (const time of prefs.mealTimes) {
      const { hour, minute } = parseHM(time);
      await Notifications.scheduleNotificationAsync({
        content: { title: t(lang, "notif_eat_title"), body: t(lang, "notif_eat_body"), data: { kind: "eat" } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
      });
    }
  }

  if (prefs.waterReminders) {
    const seconds = Math.max(1, prefs.waterIntervalHours) * 3600;
    await Notifications.scheduleNotificationAsync({
      content: { title: t(lang, "notif_water_title"), body: t(lang, "notif_water_body"), data: { kind: "water" } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, repeats: true },
    });
  }

  if (prefs.didYouEatToday) {
    await Notifications.scheduleNotificationAsync({
      content: { title: t(lang, "notif_check_title"), body: t(lang, "notif_check_body"), data: { kind: "check" } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 20, minute: 0 },
    });
  }
}

/** Fire an immediate "did you eat today?" nudge if nothing logged. */
export async function nudgeIfNotEaten(lang: Lang, mealsToday: number) {
  if (!Notifications) return;
  if (mealsToday > 0) return;
  await Notifications.scheduleNotificationAsync({
    content: { title: t(lang, "notif_check_title"), body: t(lang, "notif_check_body"), data: { kind: "check" } },
    trigger: null,
  });
}
