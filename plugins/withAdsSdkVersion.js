// plugins/withAdsSdkVersion.js
//
// react-native-google-mobile-ads 16.5.0 épingle play-services-ads 25.4.0
// (node_modules/react-native-google-mobile-ads/package.json -> sdkVersions.android).
// Cette version est publiée avec des métadonnées Kotlin 2.3.0, alors qu'Expo SDK 54 /
// RN 0.81 compile en Kotlin 2.1 : la tâche :react-native-google-mobile-ads:compileReleaseKotlin
// échoue avec « Module was compiled with an incompatible version of Kotlin. The binary
// version of its metadata is 2.3.0, expected version is 2.1.0 ».
//
// 24.8.0 est la version la plus récente de play-services-ads publiée avec des
// métadonnées Kotlin 2.1.0 (24.9.0 et 25.x sont en 2.2.0 / 2.3.0). L'SDK UMP est du
// Java pur et n'est pas concerné.
//
// À retirer le jour où le projet passera à un Kotlin >= 2.3 (ou à un Expo SDK qui
// l'embarque), pour revenir à l'SDK ads le plus récent.
const { withProjectBuildGradle } = require("expo/config-plugins");

const ADS_VERSION = "24.8.0";
const MARKER = "// swipeclean:force-play-services-ads";

const BLOCK = `
${MARKER}
allprojects {
  configurations.all {
    resolutionStrategy {
      force 'com.google.android.gms:play-services-ads:${ADS_VERSION}'
    }
  }
}
`;

module.exports = function withAdsSdkVersion(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") {
      throw new Error(
        "withAdsSdkVersion: android/build.gradle attendu en Groovy, reçu " +
          cfg.modResults.language
      );
    }
    if (cfg.modResults.contents.includes(MARKER)) return cfg;
    cfg.modResults.contents += BLOCK;
    return cfg;
  });
};
