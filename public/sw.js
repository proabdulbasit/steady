/* Steady — Web Push service worker */
self.addEventListener("push", (event) => {
  let data = { title: "Steady", body: "Your daily briefing is ready.", url: "/profile" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    /* ignore */
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Steady", {
      body: data.body || "",
      icon: "/favicon.ico",
      data: { url: data.url || "/profile" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/profile";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
