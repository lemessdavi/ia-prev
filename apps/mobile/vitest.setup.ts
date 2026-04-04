import React from "react";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

vi.mock("@expo/vector-icons", () => {
  const Icon = ({ name }: { name: string }) => React.createElement("span", { "data-testid": `icon-${name}` });
  return {
    AntDesign: Icon,
    Feather: Icon,
    Ionicons: Icon,
    MaterialIcons: Icon,
  };
});

vi.mock("expo-sharing", () => ({
  isAvailableAsync: vi.fn().mockResolvedValue(true),
  shareAsync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "/tmp/",
  documentDirectory: "/tmp/",
  EncodingType: {
    Base64: "base64",
  },
  writeAsStringAsync: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => {
  cleanup();
});
