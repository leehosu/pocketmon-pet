// AI-GENERATED: macOS GitHub Release와 Homebrew Cask가 공유하는 패키징 설정.
const hasAppleIdNotarization = Boolean(
  process.env.APPLE_ID
  && process.env.APPLE_APP_SPECIFIC_PASSWORD
  && process.env.APPLE_TEAM_ID,
);

module.exports = {
  appId: 'com.leehosu.pocketmonpet',
  productName: 'Pocketmon Pet',
  asar: true,
  artifactName: 'Pocketmon-Pet-${version}-${arch}.${ext}',
  directories: {
    output: 'dist',
    buildResources: 'build',
  },
  files: [
    'src/**/*',
    'package.json',
  ],
  mac: {
    category: 'public.app-category.developer-tools',
    icon: 'build/icon.png',
    hardenedRuntime: true,
    notarize: hasAppleIdNotarization,
    target: [
      { target: 'dmg', arch: ['universal'] },
      { target: 'zip', arch: ['universal'] },
    ],
  },
  dmg: {
    sign: false,
    title: 'Pocketmon Pet ${version}',
  },
};
