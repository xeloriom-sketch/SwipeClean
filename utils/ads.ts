import {
  InterstitialAd,
  AdEventType,
  TestIds,
  RequestOptions,
} from "react-native-google-mobile-ads";

const IS_DEV = __DEV__;

const AD_UNIT_ID = IS_DEV
  ? TestIds.INTERSTITIAL
  : "ca-app-pub-3421517351913205/3215308894";

const SWIPES_BEFORE_AD = 15;

let interstitial: ReturnType<typeof InterstitialAd.createForAdRequest> | null = null;
let adLoaded = false;
let swipeCount = 0;

function loadAd() {
  try {
    interstitial = InterstitialAd.createForAdRequest(AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: true,
    } as RequestOptions);

    interstitial.addAdEventListener(AdEventType.LOADED, () => {
      adLoaded = true;
    });

    interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      adLoaded = false;
      interstitial = null;
      // Précharge la prochaine
      setTimeout(loadAd, 1000);
    });

    interstitial.addAdEventListener(AdEventType.ERROR, () => {
      adLoaded = false;
      interstitial = null;
      setTimeout(loadAd, 30000);
    });

    interstitial.load();
  } catch {}
}

// Précharge dès le démarrage
export function initAds() {
  loadAd();
}

// Appelé à chaque swipe — affiche la pub toutes les 15 photos
export function onSwipeForAd() {
  swipeCount++;
  if (swipeCount % SWIPES_BEFORE_AD === 0 && adLoaded && interstitial) {
    try {
      interstitial.show();
    } catch {}
  }
}
