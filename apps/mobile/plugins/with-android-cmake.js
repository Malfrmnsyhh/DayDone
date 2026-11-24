const { withProjectBuildGradle } = require('expo/config-plugins');

const MARKER = '// [daydone] Pin CMake 3.31.6 (Ninja 1.12+)';

const SNIPPET = `
${MARKER} and shorten CMake staging directories
// so Windows + pnpm monorepo paths do not fail on Ninja 1.10's 260-char MAX_PATH limit.
subprojects { subproject ->
  ["com.android.library", "com.android.application"].each { pluginId ->
    subproject.plugins.withId(pluginId) {
      def androidExt = subproject.extensions.findByName("android")
      if (androidExt != null) {
        def shortId = Integer.toHexString(subproject.name.hashCode() & 0xff)
        androidExt.externalNativeBuild.cmake.version = "3.31.6"
        androidExt.externalNativeBuild.cmake.buildStagingDirectory = new File(
          rootProject.layout.buildDirectory.get().asFile,
          "c/\${shortId}"
        )
      }
    }
  }
}
`;

function withAndroidCmake(config) {
  return withProjectBuildGradle(config, (gradleConfig) => {
    const contents = gradleConfig.modResults.contents;
    if (contents.includes(MARKER)) {
      return gradleConfig;
    }

    const anchor = 'apply plugin: "expo-root-project"';
    if (contents.includes(anchor)) {
      gradleConfig.modResults.contents = contents.replace(
        anchor,
        `${SNIPPET.trim()}\n\n${anchor}`,
      );
    } else {
      gradleConfig.modResults.contents = `${contents}\n${SNIPPET}`;
    }
    return gradleConfig;
  });
}

module.exports = withAndroidCmake;
