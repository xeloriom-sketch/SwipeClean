import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { AppState, type AppStateStatus } from "react-native";
import { devLog } from "./devLogger";
import { queueWrite } from "./storageQueue";

const IS_EXPO_GO = Constants.executionEnvironment === "storeClient";
const IS_DEV = __DEV__;

// Le compteur de swipes vit en AsyncStorage, pas seulement en mémoire. Un compteur
// de module repart à zéro à chaque démarrage à froid : quelqu'un qui trie 8 photos
// par session n'atteignait jamais le seuil, l'interstitiel se chargeait (requêtes et
// taux de correspondance côté AdMob) mais n'était jamais affiché — zéro impression.
const ADS_STATE_KEY = "@app_ads_state";

const SWIPES_PER_AD = 15;
// Plancher de confort: 15 swipes peuvent être expédiés en vingt secondes. Le seuil
// n'est pas annulé pour autant — il reste « dû » et part au swipe suivant une fois
// le délai écoulé.
const MIN_GAP_MS = 60 * 1000;

const RELOAD_AFTER_CLOSE_MS = 1000;
const RETRY_BASE_MS = 30000;
const RETRY_MAX_MS = 15 * 60 * 1000;
const MAX_RETRIES = 8;

/** Swipes depuis la dernière pub affichée. */
let swipesSinceAd = 0;
/** Nombre de pubs déjà montrées sur la vie de l'install (journal/diagnostic). */
let adsShown = 0;
let lastShownAt = 0;
/** Seuil franchi mais aucune pub prête: on affiche dès qu'une l'est. */
let due = false;

let InterstitialAd: any = null;
let AdEventType: any = null;
let TestIds: any = null;
let MobileAds: any = null;

if (!IS_EXPO_GO) {
  try {
    const ads = require("react-native-google-mobile-ads");
    InterstitialAd = ads.InterstitialAd;
    AdEventType = ads.AdEventType;
    TestIds = ads.TestIds;
    MobileAds = ads.default;
  } catch {}
}

const AD_UNIT_ID = IS_DEV
  ? (TestIds?.INTERSTITIAL ?? "")
  : "ca-app-pub-3421517351913205/3215308894";

let interstitial: any = null;
let unsubscribe: (() => void) | null = null;
let adLoaded = false;
let loading = false;
// True between show() and CLOSED/FAILED_TO_SHOW. Without it, a swipe landing on the
// next multiple while the ad is on screen called loadAd() -> destroy(), which
// unsubscribed the visible ad's CLOSED listener: the reload loop stopped for good
// and the native instance leaked.
let showing = false;
let initialized = false;
let retryCount = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let appStateSub: { remove: () => void } | null = null;

// Incremented on every load. Listeners from a previous instance compare against
// it and bail out, so an orphaned ad can never mutate the state of the current one.
let generation = 0;

function clearTimer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

// Safety net for SDKs without a FAILED_TO_SHOW event: if CLOSED never arrives after
// show(), release the instance instead of staying stuck with showing = true.
const SHOW_WATCHDOG_MS = 90000;
let showWatchdog: ReturnType<typeof setTimeout> | null = null;

function clearShowWatchdog() {
  if (showWatchdog) {
    clearTimeout(showWatchdog);
    showWatchdog = null;
  }
}

function destroy() {
  clearShowWatchdog();
  if (unsubscribe) {
    try {
      unsubscribe();
    } catch {}
    unsubscribe = null;
  }
  interstitial = null;
  adLoaded = false;
  loading = false;
  showing = false;
}

function scheduleReload(delay: number) {
  clearTimer();
  timer = setTimeout(() => {
    timer = null;
    loadAd();
  }, delay);
}

function scheduleRetry() {
  if (retryCount >= MAX_RETRIES) return;
  const backoff = Math.min(RETRY_BASE_MS * 2 ** retryCount, RETRY_MAX_MS);
  retryCount++;
  scheduleReload(backoff + Math.random() * 1000);
}

function loadAd() {
  if (IS_EXPO_GO || !InterstitialAd || !AD_UNIT_ID) return;
  if (loading || adLoaded || showing) return;

  clearTimer();
  destroy();

  const gen = ++generation;
  loading = true;

  try {
    const ad = InterstitialAd.createForAdRequest(AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: true,
    });

    const offLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
      if (gen !== generation) return;
      adLoaded = true;
      loading = false;
      retryCount = 0;
      devLog("Ads", `pub prête (compteur ${swipesSinceAd}/${nextThreshold()})`);
    });

    const offClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      if (gen !== generation) return;
      destroy();
      retryCount = 0;
      devLog("Ads", "pub fermée, rechargement");
      scheduleReload(RELOAD_AFTER_CLOSE_MS);
    });

    const offError = ad.addAdEventListener(AdEventType.ERROR, () => {
      if (gen !== generation) return;
      destroy();
      devLog("Ads", `échec de chargement (essai ${retryCount + 1})`, "warn");
      scheduleRetry();
    });

    // Only registered when the installed SDK exposes it: addAdEventListener throws on
    // an unknown event type, which would abort loadAd() and stop ads loading entirely.
    // react-native-google-mobile-ads 16.0.2 does not have it; the watchdog below covers
    // that case.
    const failedType = AdEventType.FAILED_TO_SHOW;
    const offFailedToShow = failedType
      ? ad.addAdEventListener(failedType, () => {
          if (gen !== generation) return;
          destroy();
          scheduleRetry();
        })
      : null;

    interstitial = ad;
    unsubscribe = () => {
      offLoaded?.();
      offClosed?.();
      offError?.();
      offFailedToShow?.();
    };

    ad.load();
  } catch {
    loading = false;
    scheduleRetry();
  }
}

function onAppStateChange(state: AppStateStatus) {
  if (state === "active") {
    if (!adLoaded && !loading && !timer && !showing) loadAd();
  } else {
    // Nothing is visible in the background: stop burning requests until we return.
    clearTimer();
  }
}

export async function initAds() {
  if (IS_EXPO_GO || !MobileAds) {
    devLog("Ads", "AdMob indisponible (Expo Go ou binaire sans le module)", "warn");
    return;
  }
  if (initialized) return;
  initialized = true;

  if (!appStateSub) {
    appStateSub = AppState.addEventListener("change", onAppStateChange);
  }

  await loadState();
  devLog("Ads", `init — compteur ${swipesSinceAd}/${nextThreshold()}, ${adsShown} pub(s) déjà vues`);

  try {
    await MobileAds().initialize();
  } catch {}

  loadAd();
}

function persistState() {
  queueWrite(ADS_STATE_KEY, { n: swipesSinceAd, shown: adsShown, t: lastShownAt });
}

async function loadState() {
  try {
    const raw = await AsyncStorage.getItem(ADS_STATE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    // `initAds` n'est pas attendu par l'appelant: quelques swipes peuvent déjà avoir
    // été comptés avant que la lecture aboutisse. Le max évite de les perdre.
    if (typeof parsed?.n === "number") swipesSinceAd = Math.max(swipesSinceAd, parsed.n);
    if (typeof parsed?.shown === "number") adsShown = parsed.shown;
    if (typeof parsed?.t === "number") lastShownAt = parsed.t;
    if (swipesSinceAd >= nextThreshold()) due = true;
  } catch {}
}

function nextThreshold(): number {
  return SWIPES_PER_AD;
}

export function onSwipeForAd() {
  swipesSinceAd++;
  persistState();
  if (swipesSinceAd % 5 === 0) {
    devLog("Ads", `compteur ${swipesSinceAd}/${nextThreshold()}`);
  }

  if (swipesSinceAd >= nextThreshold()) due = true;
  if (!due || showing) return;

  // Trop tôt après la précédente: on reste « dû » et on retentera au swipe suivant.
  if (lastShownAt && Date.now() - lastShownAt < MIN_GAP_MS) {
    const wait = Math.ceil((MIN_GAP_MS - (Date.now() - lastShownAt)) / 1000);
    devLog("Ads", `seuil atteint, report de ${wait}s (écart minimal)`);
    return;
  }

  if (adLoaded && interstitial) {
    const ad = interstitial;
    adLoaded = false;
    showing = true;
    due = false;
    swipesSinceAd = 0;
    adsShown++;
    lastShownAt = Date.now();
    persistState();
    devLog("Ads", `affichage de la pub n°${adsShown}`);
    clearShowWatchdog();
    showWatchdog = setTimeout(() => {
      showWatchdog = null;
      if (!showing) return;
      destroy();
      scheduleReload(RELOAD_AFTER_CLOSE_MS);
    }, SHOW_WATCHDOG_MS);
    try {
      ad.show();
    } catch {
      destroy();
      scheduleRetry();
    }
    return;
  }

  // Rien de prêt: `due` reste armé, donc le prochain swipe affichera la pub dès
  // qu'elle sera chargée au lieu d'attendre un nouveau cycle complet.
  devLog("Ads", `seuil atteint mais aucune pub prête (chargement: ${loading})`, "warn");
  if (!loading && !timer) loadAd();
}

export function resetAds() {
  clearTimer();
  clearShowWatchdog();
  destroy();
  generation++;
  retryCount = 0;
  swipesSinceAd = 0;
  adsShown = 0;
  lastShownAt = 0;
  due = false;
  initialized = false;
  if (appStateSub) {
    appStateSub.remove();
    appStateSub = null;
  }
}
