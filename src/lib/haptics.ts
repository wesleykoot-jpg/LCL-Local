import { Haptics, ImpactStyle } from '@capacitor/haptics';

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
    await Haptics.notification({ type });
  } catch (error) {
    console.log('Haptics not available');
  }
}

export async function hapticSelection() {
  try {
    await Haptics.selectionStart();
    setTimeout(() => Haptics.selectionEnd(), 100);
  } catch (error) {
    console.log('Haptics not available');
  }
}
