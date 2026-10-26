#!/usr/bin/env bash
# Install the Android SDK packages the Gradle build needs, on a machine (or a
# Claude Code container) that has none. GitHub's ubuntu runners already ship an
# SDK, so CI does not run this. Safe to re-run.
#
# Needs Java 21 and network access to dl.google.com.
#
#   scripts/setup-android-sdk.sh            # installs into $ANDROID_HOME or ~/android-sdk
#   export ANDROID_HOME=~/android-sdk
set -euo pipefail

SDK="${ANDROID_HOME:-$HOME/android-sdk}"

# Command-line tools, pinned to the archive and SHA-1 that Google's own
# package list (dl.google.com/android/repository/repository2-3.xml) gives.
TOOLS_ZIP=commandlinetools-linux-16111833_latest.zip
TOOLS_SHA1=e025545c62a8e64c7559119566a569fb1dec5f60

# What android/ compiles against: compileSdk 36 (android/variables.gradle), and
# the build-tools version the Android Gradle Plugin in android/build.gradle uses.
PACKAGES=("platforms;android-36" "build-tools;35.0.0")

SDKMANAGER="$SDK/cmdline-tools/latest/bin/sdkmanager"

if [ ! -x "$SDKMANAGER" ]; then
  work="$(mktemp -d)"
  trap 'rm -rf "$work"' EXIT
  curl -fsSL -o "$work/tools.zip" "https://dl.google.com/android/repository/$TOOLS_ZIP"
  echo "$TOOLS_SHA1  $work/tools.zip" | sha1sum -c --quiet -
  unzip -q "$work/tools.zip" -d "$work"
  mkdir -p "$SDK/cmdline-tools"
  rm -rf "$SDK/cmdline-tools/latest"
  mv "$work/cmdline-tools" "$SDK/cmdline-tools/latest"
fi

# `yes` exits on SIGPIPE once sdkmanager stops reading, which pipefail would
# otherwise report as a failure.
set +o pipefail
yes | "$SDKMANAGER" --sdk_root="$SDK" --licenses > /dev/null
set -o pipefail

# sdkmanager verifies each package against the checksum in Google's list.
"$SDKMANAGER" --sdk_root="$SDK" "${PACKAGES[@]}"

echo "Android SDK ready. Before building: export ANDROID_HOME=$SDK"
