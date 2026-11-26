import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const CHANNEL_ID = 'expiry-reminders';
const REMINDER_TYPE = 'pantry-expiry-reminder';
const MAX_PENDING_REMINDERS = 60;
const LEAD_DAYS = {
  '1 day': 1,
  '3 days': 3,
  '1 week': 7,
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Expiry reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function requestExpiryNotificationPermissions() {
  if (Platform.OS === 'web') return false;
  await ensureAndroidChannel();

  const currentPermission = await Notifications.getPermissionsAsync();
  if (currentPermission.status === 'granted') return true;

  const requestedPermission = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
  });

  return requestedPermission.status === 'granted';
}

function reminderDateFor(food, leadDays) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(food.expiresOn || '')) return null;

  const [year, month, day] = food.expiresOn.split('-').map(Number);
  const expiryDate = new Date(year, month - 1, day, 23, 59, 59, 999);
  const now = new Date();
  if (Number.isNaN(expiryDate.getTime()) || expiryDate <= now) return null;

  const reminderDate = new Date(year, month - 1, day, 9, 0, 0, 0);
  reminderDate.setDate(reminderDate.getDate() - leadDays);

  // Do not send a late reminder if its selected lead-time date has already passed.
  return reminderDate > now ? reminderDate : null;
}

function groupFoodsByReminderDate(foods, leadDays) {
  const groups = new Map();

  foods.forEach((food) => {
    const date = reminderDateFor(food, leadDays);
    if (!date || !food.id || !food.name) return;

    const key = date.getTime();
    if (!groups.has(key)) groups.set(key, { date, foods: [] });
    groups.get(key).foods.push(food);
  });

  return [...groups.values()].sort((left, right) => left.date - right.date);
}

async function reconcileExpiryReminders(foods, enabled, reminderLead) {
  // Web builds do not support scheduled local notifications.
  if (Platform.OS === 'web') return { permissionGranted: true };

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const existingReminders = scheduled.filter((item) => item.content.data?.type === REMINDER_TYPE);

  await Promise.all(
    existingReminders.map((item) =>
      Notifications.cancelScheduledNotificationAsync(item.identifier),
    ),
  );

  if (!enabled) return { permissionGranted: true };

  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') return { permissionGranted: false };

  await ensureAndroidChannel();

  const leadDays = LEAD_DAYS[reminderLead] ?? LEAD_DAYS['3 days'];
  const groups = groupFoodsByReminderDate(foods, leadDays).slice(0, MAX_PENDING_REMINDERS);

  await Promise.all(
    groups.map(({ date, foods: expiringFoods }) => {
      const names = expiringFoods.map((food) => `${food.emoji || ''} ${food.name}`.trim());
      const body =
        names.length === 1
          ? `${names[0]} is nearing its best-before date.`
          : `${names.slice(0, 3).join(', ')}${names.length > 3 ? ` and ${names.length - 3} more` : ''} are nearing their best-before dates.`;

      return Notifications.scheduleNotificationAsync({
        content: {
          title: 'Food expiring soon',
          body,
          data: {
            type: REMINDER_TYPE,
            foodIds: expiringFoods.map((food) => food.id),
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date,
          ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
        },
      });
    }),
  );

  return { permissionGranted: true };
}

// Serialize updates so rapid pantry edits cannot leave duplicate or stale reminders.
let reconciliationQueue = Promise.resolve();

export function syncExpiryReminders(foods, enabled, reminderLead) {
  const update = reconciliationQueue.then(() =>
    reconcileExpiryReminders(foods, enabled, reminderLead),
  );
  reconciliationQueue = update.catch(() => {});
  return update;
}
