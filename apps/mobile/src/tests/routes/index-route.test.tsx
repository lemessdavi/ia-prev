/* eslint-disable react/display-name */
import React, { type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Index from "@/app/index";

const redirectSpy = vi.fn();
const useOperatorAppMock = vi.fn();
const pushMock = vi.fn();

vi.mock("expo-router", () => ({
  Redirect: ({ href }: { href: string }) => {
    redirectSpy(href);
    return null;
  },
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("config", () => ({
  tokens: {
    colors: {
      bg: "#ffffff",
      panel: "#f4f4f5",
      border: "#e4e4e7",
      textMuted: "#71717a",
      primary: "#111111",
    },
  },
}));

vi.mock("@expo/vector-icons", () => ({
  Feather: ({ name }: { name: string }) => <span data-testid="logout-icon" data-icon-name={name} />,
}));

vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("react-native", () => {
  const element =
    (tag: "div" | "span" | "input" | "button") =>
    ({
      children,
      onPress,
      onChangeText,
      value,
      accessibilityRole,
      accessibilityLabel,
      ...props
    }: Record<string, unknown>) => {
      const domProps = {
        ...props,
        ...(typeof accessibilityRole === "string" ? { role: accessibilityRole } : {}),
        ...(typeof accessibilityLabel === "string" ? { "aria-label": accessibilityLabel } : {}),
      };

      if (tag === "button") {
        return (
          <button type="button" onClick={() => (onPress as (() => void) | undefined)?.()} {...domProps}>
            {children as ReactNode}
          </button>
        );
      }
      if (tag === "input") {
        return (
          <input
            value={typeof value === "string" ? value : ""}
            onChange={(event) => (onChangeText as ((next: string) => void) | undefined)?.(event.target.value)}
            {...domProps}
          />
        );
      }
      return React.createElement(tag, domProps, children as ReactNode);
    };

  return {
    View: element("div"),
    Text: element("span"),
    Pressable: element("button"),
    TextInput: element("input"),
    FlatList: ({ data, renderItem }: { data: unknown[]; renderItem: (input: { item: unknown }) => ReactNode }) => (
      <div>{data.map((item, index) => React.createElement(React.Fragment, { key: index }, renderItem({ item })))}</div>
    ),
  };
});

vi.mock("@/context/operatorAppContext", () => ({
  useOperatorApp: () => useOperatorAppMock(),
}));

const authenticatedMockBase = {
  isAuthenticated: true,
  workspace: {
    tenantName: "IA Prev Demo",
    wabaLabel: "WA Demo",
    activeAiProfileName: "IA Assistente",
  },
  conversations: [],
  selectedConversationId: null,
  statusFilter: "ALL" as const,
  setStatusFilter: vi.fn(),
  search: "",
  setSearch: vi.fn(),
  loadingConversations: false,
  blockingErrorMessage: null,
  toastErrorMessage: null,
  clearError: vi.fn(),
  selectConversation: vi.fn(),
  logout: vi.fn(),
};

describe("Index route", () => {
  beforeEach(() => {
    redirectSpy.mockClear();
    pushMock.mockReset();
    useOperatorAppMock.mockReset();
  });

  it("redirects unauthenticated users to login", () => {
    useOperatorAppMock.mockReturnValue({ isAuthenticated: false });

    render(<Index />);

    expect(redirectSpy).toHaveBeenCalledWith("/login");
  });

  it("renders the chats list for authenticated users without tabs redirect", () => {
    useOperatorAppMock.mockReturnValue(authenticatedMockBase);

    render(<Index />);

    expect(redirectSpy).not.toHaveBeenCalled();
  });

  it("renders a logout icon button on the right side of the tenant header row", () => {
    useOperatorAppMock.mockReturnValue(authenticatedMockBase);

    render(<Index />);

    expect(screen.queryByText("Sair")).toBeNull();
    expect(screen.getByLabelText("Logout")).toBeTruthy();
    expect(screen.getByTestId("logout-icon")).toBeTruthy();

    const tenantHeading = screen.getByText("IA Prev Demo");
    const headerRow = tenantHeading.parentElement as HTMLElement;
    expect(headerRow.style.flexDirection).toBe("row");
    expect(headerRow.style.justifyContent).toBe("space-between");
    expect(headerRow.style.alignItems).toBe("center");
  });
});
