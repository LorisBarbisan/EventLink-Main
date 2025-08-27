// Clear all browser cache and localStorage for EvenLink
// Run this in browser console to clear all traces

console.log('🧹 Clearing all EvenLink data...');

// Clear localStorage
localStorage.clear();
console.log('✅ localStorage cleared');

// Clear sessionStorage  
sessionStorage.clear();
console.log('✅ sessionStorage cleared');

// Clear IndexedDB
if (window.indexedDB) {
  indexedDB.databases().then(databases => {
    databases.forEach(db => {
      indexedDB.deleteDatabase(db.name);
      console.log(`✅ IndexedDB ${db.name} cleared`);
    });
  });
}

// Clear service worker caches
if ('caches' in window) {
  caches.keys().then(names => {
    names.forEach(name => {
      caches.delete(name);
      console.log(`✅ Cache ${name} cleared`);
    });
  });
}

// Clear cookies for current domain
document.cookie.split(";").forEach(cookie => {
  const eqPos = cookie.indexOf("=");
  const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
  document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
});
console.log('✅ Cookies cleared');

console.log('🎉 All EvenLink data cleared! Refresh the page.');

// Force reload to ensure clean state
setTimeout(() => {
  window.location.reload(true);
}, 1000);