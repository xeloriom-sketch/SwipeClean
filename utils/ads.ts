import Constants from "expo-constants";
import { AppState, type AppStateStatus } from "react-native";

const IS_EXPO_GO = Constants.executionEnvironment === "storeClient";
const IS_DEV = __DEV__;

const SWIPES_BEFORE_AD = 15;
const RELOAD_AFTER_CLOSE_MS = 1000;
const RETRY_BASE_MS = 30000;
const RETRY_MAX_MS = 15 * 60 * 1000;
const MAX_RETRIES = 8;

let swipeCount = 0;

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
    });

    const offClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      if (gen !== generation) return;
      destroy();
      retryCount = 0;
      scheduleReload(RELOAD_AFTER_CLOSE_MS);
    });

    const offError = ad.addAdEventListener(AdEventType.ERROR, () => {
      if (gen !== generation) return;
      destroy();
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
  if (IS_EXPO_GO || !MobileAds || initialized) return;
  initialized = true;

  if (!appStateSub) {
    appStateSub = AppState.addEventListener("change", onAppStateChange);
  }

  try {
    await MobileAds().initialize();
  } catch {}

  loadAd();
}

export function onSwipeForAd() {
  swipeCount++;
  if (swipeCount % SWIPES_BEFORE_AD !== 0) return;
  if (showing) return;

  if (adLoaded && interstitial) {
    const ad = interstitial;
    adLoaded = false;
    showing = true;
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

  // Missed the slot: make sure one is on the way for the next multiple.
  if (!loading && !timer) loadAd();
}

export function resetAds() {
  clearTimer();
  clearShowWatchdog();
  destroy();
  generation++;
  retryCount = 0;
  swipeCount = 0;
  initialized = false;
  if (appStateSub) {
    appStateSub.remove();
    appStateSub = null;
  }
}
