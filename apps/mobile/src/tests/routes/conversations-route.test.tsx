/* eslint-disable react/display-name */
import React, { type ReactNode } from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConversationsScreen from "@/app/(tabs)/index";

const selectConversationMock = vi.fn();
const logoutMock = vi.fn();
const pushMock = vi.fn();
const useOperatorAppMock = vi.fn();

vi.mock("expo-router", () => ({
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

describe("Conversations screen", () => {
  beforeEach(() => {
    selectConversationMock.mockReset();
    logoutMock.mockReset();
    pushMock.mockReset();
    useOperatorAppMock.mockReset();
    selectConversationMock.mockResolvedValue(undefined);
    logoutMock.mockResolvedValue(undefined);
  });

  it("opens chat details when pressing a conversation", async () => {
    useOperatorAppMock.mockReturnValue({
      workspace: {
        tenantName: "IA Prev Demo",
        wabaLabel: "WA Demo",
        activeAiProfileName: "IA Assistente",
      },
      conversations: [
        {
          conversationId: "c-1",
          title: "Conversa c-1",
          lastMessagePreview: "Mensagem",
          conversationStatus: "EM_TRIAGEM",
          unreadCount: 0,
        },
      ],
      selectedConversationId: null,
      statusFilter: "ALL",
      setStatusFilter: vi.fn(),
      search: "",
      setSearch: vi.fn(),
      loadingConversations: false,
      errorMessage: null,
      selectConversation: selectConversationMock,
      logout: logoutMock,
    });

    const screen = render(<ConversationsScreen />);

    fireEvent.click(screen.getByText("Conversa c-1"));

    await waitFor(() => {
      expect(selectConversationMock).toHaveBeenCalledWith("c-1");
      expect(pushMock).toHaveBeenCalledWith("/chat/c-1");
    });
  });
});
