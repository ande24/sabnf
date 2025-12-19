const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

// eslint-disable-next-line no-undef
const config = getDefaultConfig(__dirname);

/** @type {import('expo/metro-config').MetroConfig} */

config.resolver.resolveRequest = (context, moduleImport, platform) => {
  // Always import the ESM version of all `@firebase/*` packages
  if (moduleImport.startsWith('@firebase/')) {
    return context.resolveRequest(
      {
        ...context,
        isESMImport: true, // Mark the import method as ESM
      },
      moduleImport,
      platform
    );
  }

  return context.resolveRequest(context, moduleImport, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });