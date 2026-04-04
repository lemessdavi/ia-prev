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

afterEach(() => {
  cleanup();
});
