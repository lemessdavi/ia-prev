/* eslint-disable react/display-name */
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TabsLayout from "@/app/(tabs)/_layout";

const useOperatorAppMock = vi.fn();
const redirectSpy = vi.fn();
const screenNames: string[] = [];

vi.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

vi.mock("config", () => ({
  tokens: {
    colors: {
      primary: "#111111",
      textMuted: "#555555",
      border: "#dddddd",
    },
  },
}));

vi.mock("@/context/operatorAppContext", () => ({
  useOperatorApp: () => useOperatorAppMock(),
}));

vi.mock("expo-router", () => {
  const Tabs = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  Tabs.Screen = ({ name }: { name: string }) => {
    screenNames.push(name);
    return null;
  };

  return {
    Tabs,
    Redirect: ({ href }: { href: string }) => {
      redirectSpy(href);
      return null;
    },
  };
});

describe("Tabs layout", () => {
  beforeEach(() => {
    useOperatorAppMock.mockReset();
    redirectSpy.mockReset();
    screenNames.length = 0;
  });

  it("redirects unauthenticated users to login", () => {
    useOperatorAppMock.mockReturnValue({ isAuthenticated: false });

    render(<TabsLayout />);

    expect(redirectSpy).toHaveBeenCalledWith("/login");
  });

  it("has only one tab for the chats list", () => {
    useOperatorAppMock.mockReturnValue({ isAuthenticated: true });

    render(<TabsLayout />);

    expect(screenNames).toEqual(["index"]);
  });
});
