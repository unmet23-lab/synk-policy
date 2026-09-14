// Small independent refinements also work when the animation library cannot load.
import {initGreeting} from './interactions/greeting.js?v=20260915-presence';
import {initSonicUI} from './interactions/sonic.js?v=20260915-presence';
initGreeting();
initSonicUI();
