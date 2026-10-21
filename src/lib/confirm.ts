import { Alert } from 'react-native';

// Yes/no question shown inside the app (browser pop-ups are blocked in some places,
// so the web version draws its own dialog through <ConfirmHost />).
export interface ConfirmRequest {
  message: string;
  yesLabel: string;
  noLabel: string;
  onYes: () => void;
}

let show: ((req: ConfirmRequest) => void) | null = null;

export function registerConfirmHost(fn: ((req: ConfirmRequest) => void) | null) {
  show = fn;
}

export function confirm(message: string, onYes: () => void, yesLabel = 'OK', noLabel = 'Cancel') {
  if (show) {
    show({ message, onYes, yesLabel, noLabel });
    return;
  }
  Alert.alert('', message, [
    { text: noLabel, style: 'cancel' },
    { text: yesLabel, style: 'destructive', onPress: onYes },
  ]);
}
