importScripts("/imgalign/precache-manifest.6299f7f8ae773a1d29db334074f284d8.js", "https://storage.googleapis.com/workbox-cdn/releases/3.6.3/workbox-sw.js");


workbox.core.setCacheNameDetails({prefix: "imgalign"});


self.__precacheManifest = [].concat(self.__precacheManifest || []);
workbox.precaching.suppressWarnings();

workbox.routing.registerNavigationRoute('/imgalign/index.html');
workbox.precaching.precacheAndRoute(self.__precacheManifest, {});

workbox.googleAnalytics.initialize();

self.addEventListener('install', () => {
  self.skipWaiting();
});
