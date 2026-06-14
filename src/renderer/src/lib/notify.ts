export function showNotification(title: string, body: string): void {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body });
  } else if (Notification.permission !== 'denied') {
    void Notification.requestPermission().then((p) => {
      if (p === 'granted') new Notification(title, { body });
    });
  }
}
