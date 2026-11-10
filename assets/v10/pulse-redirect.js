const destination = new URL('https://workspace.synk.im/pulse-app/');
destination.search = window.location.search;
destination.hash = window.location.hash;
document.querySelector('#pulse-link').href = destination.href;
window.location.replace(destination.href);
