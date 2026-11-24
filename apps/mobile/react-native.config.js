// Exclude unused react-native-reanimated and react-native-gesture-handler from Android native autolinking.
// DayDone mobile uses Stack/Tabs (react-native-screens) and does not use Drawer, Reanimated, or Gesture Handler.
// This also avoids Windows MAX_PATH (260-char) Ninja failures on their deep C++ paths in pnpm.
module.exports = {
  dependencies: {
    'react-native-reanimated': {
      platforms: {
        android: null,
      },
    },
    'react-native-gesture-handler': {
      platforms: {
        android: null,
      },
    },
  },
};
