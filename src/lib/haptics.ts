import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export async function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'medium') {
  try {
    const impactStyles = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    };

    await Haptics.impact({ style: impactStyles[style] });
  } catch (error) {
    console.log('Haptics not available');
  }
}

export async function hapticNotification(type: 'success' | 'warning' | 'error' = 'success') {
  try {
    const notificationTypes = {
      success: NotificationType.Success,
      warning: NotificationType.Warning,
      error: NotificationType.Error,
    };
    await Haptics.notification({ type: notificationTypes[type] });
  } catch (error) {
    console.log('Haptics not available');
  }
}
