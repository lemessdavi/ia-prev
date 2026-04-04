import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Index from "@/app/index";

const redirectSpy = vi.fn();
const useOperatorAppMock = vi.fn();

vi.mock("expo-router", () => ({
  Redirect: ({ href }: { href: string }) => {
    redirectSpy(href);
    return null;
  },
}));

vi.mock("@/context/operatorAppContext", () => ({
  useOperatorApp: () => useOperatorAppMock(),
}));

describe("Index route", () => {
  beforeEach(() => {
    redirectSpy.mockClear();
    useOperatorAppMock.mockReset();
  });

  it("redirects unauthenticated users to login", () => {
    useOperatorAppMock.mockReturnValue({ isAuthenticated: false });

    render(<Index />);

    expect(redirectSpy).toHaveBeenCalledWith("/login");
  });

  it("redirects authenticated users to tabs", () => {
    useOperatorAppMock.mockReturnValue({ isAuthenticated: true });

    render(<Index />);

    expect(redirectSpy).toHaveBeenCalledWith("/(tabs)");
  });
});
