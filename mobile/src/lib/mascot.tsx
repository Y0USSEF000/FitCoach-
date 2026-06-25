import React from "react";
import { Image, ImageStyle, StyleProp } from "react-native";

// Drop your real wolf art into mobile/assets/wolf/ with these exact names.
const WOLVES = {
  hero: require("../../assets/wolf/wolf-hero.png"),
  logo: require("../../assets/wolf/wolf-logo.png"),
  eat: require("../../assets/wolf/wolf-eat.png"),
  flex: require("../../assets/wolf/wolf-flex.png"),
};

export type WolfPose = keyof typeof WOLVES;

export function Mascot({
  pose = "flex", size = 140, style,
}: { pose?: WolfPose; size?: number; style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      source={WOLVES[pose]}
      style={[{ width: size, height: size, resizeMode: "contain" }, style]}
    />
  );
}
