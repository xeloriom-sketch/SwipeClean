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

function destroy() {
  if (unsubscribe) {
    try {
      unsubscribe();
    } catch {}
    unsubscribe = null;
  }
  interstitial = null;
  adLoaded = false;
  loading = false;
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
  if (loading || adLoaded) return;

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

    interstitial = ad;
    unsubscribe = () => {
      offLoaded?.();
      offClosed?.();
      offError?.();
    };

    ad.load();
  } catch {
    loading = false;
    scheduleRetry();
  }
}

function onAppStateChange(state: AppStateStatus) {
  if (state === "active") {
    if (!adLoaded && !loading && !timer) loadAd();
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

  if (adLoaded && interstitial) {
    const ad = interstitial;
    adLoaded = false;
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
