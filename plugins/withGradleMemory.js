// plugins/withGradleMemory.js
//
// Le template Expo genere un gradle.properties avec un metaspace tres serre
// (-XX:MaxMetaspaceSize=512m). Avec le nombre de modules natifs de ce projet
// (expo-updates + KSP, expo-modules-core, reanimated, video, ads, flash-list...),
// le daemon Gradle epuise son metaspace et le build tombe sur :
//   Execution failed for task ':expo-updates:kspReleaseKotlin'  > Metaspace
//   Execution failed for task ':app:collectReleaseDependencies' > Metaspace
//
// android/ etant regenere a chaque prebuild, le reglage doit passer par un
// plugin de config pour survivre aux builds locaux comme cloud.
const { withGradleProperties } = require("expo/config-plugins");

const PROPS = {
  "org.gradle.jvmargs":
    "-Xmx4096m -XX:MaxMetaspaceSize=2048m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8",
};

module.exports = function withGradleMemory(config) {
  return withGradleProperties(config, (cfg) => {
    for (const [key, value] of Object.entries(PROPS)) {
      const existing = cfg.modResults.find(
        (item) => item.type === "property" && item.key === key
      );
      if (existing) {
        existing.value = value;
      } else {
        cfg.modResults.push({ type: "property", key, value });
      }
    }
    return cfg;
  });
};
