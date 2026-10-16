if ('serviceWorker' in navigator) {
  void navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).catch(() => {});
}
