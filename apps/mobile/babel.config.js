// babel-preset-expo (SDK 57) auto-injects the react-native-worklets plugin when
// react-native-worklets is installed, so it is NOT listed manually here.
// jsxImportSource: 'nativewind' enables className on RN components (NativeWind v4).
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
  };
};
