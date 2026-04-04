/* eslint-disable react/display-name */
import React, { type ReactNode } from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChatScreen from "@/app/chat/[conversationId]";

const backMock = vi.fn();
const selectConversationMock = vi.fn();
const setConversationTriageResultMock = vi.fn();
const useOperatorAppMock = vi.fn();

vi.mock("expo-router", () => ({
  Redirect: () => null,
  useRouter: () => ({
    back: backMock,
  }),
  useLocalSearchParams: () => ({
    conversationId: "c-1",
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

vi.mock("utils", () => ({
  resolveThreadMessageOrigin: () => "operator",
  shouldRenderMessageOnRight: () => true,
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
      onSubmitEditing,
      value,
      editable,
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
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                (onSubmitEditing as (() => void) | undefined)?.();
              }
            }}
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
    Modal: ({ children, visible }: { children: ReactNode; visible?: boolean }) => (visible ? <div>{children}</div> : null),
    TextInput: element("input"),
    ScrollView: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Linking: {
      openURL: vi.fn(),
    },
  };
});

vi.mock("@/context/operatorAppContext", () => ({
  useOperatorApp: () => useOperatorAppMock(),
}));

describe("Chat route", () => {
  beforeEach(() => {
    backMock.mockReset();
    selectConversationMock.mockReset();
    setConversationTriageResultMock.mockReset();
    useOperatorAppMock.mockReset();
    selectConversationMock.mockResolvedValue(undefined);
    setConversationTriageResultMock.mockResolvedValue(undefined);
  });

  it("opens triage bottom sheet and updates selected status", async () => {
    useOperatorAppMock.mockReturnValue({
      isAuthenticated: true,
      thread: {
        conversationId: "c-1",
        title: "Conversa c-1",
        triageResult: "REVISAO_HUMANA",
        messages: [],
      },
      selectedConversationId: "c-1",
      workspace: {
        operator: {
          userId: "u-1",
          fullName: "Ana Lima",
        },
      },
      sendMessage: vi.fn(),
      takeHandoff: vi.fn(),
      setConversationTriageResult: setConversationTriageResultMock,
      loadingThread: false,
      loadingAction: false,
      errorMessage: null,
      selectConversation: selectConversationMock,
    });

    const screen = render(<ChatScreen />);

    expect(screen.queryByText("Marcar apto")).toBeNull();
    expect(screen.queryByText("Selecionar status da triagem")).toBeNull();

    fireEvent.click(screen.getByText("Triagem manual"));

    expect(screen.getByText("Selecionar status da triagem")).toBeDefined();
    expect(screen.getByText("Status atual")).toBeDefined();

    fireEvent.click(screen.getByText("Apto"));

    await waitFor(() => {
      expect(setConversationTriageResultMock).toHaveBeenCalledWith("APTO");
    });

    await waitFor(() => {
      expect(screen.queryByText("Selecionar status da triagem")).toBeNull();
    });
  });
});
