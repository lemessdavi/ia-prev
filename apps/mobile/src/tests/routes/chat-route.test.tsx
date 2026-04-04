/* eslint-disable react/display-name */
import React, { type ReactNode } from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChatScreen from "@/app/chat/[conversationId]";

const backMock = vi.fn();
const selectConversationMock = vi.fn();
const setConversationTriageResultMock = vi.fn();
const useOperatorAppMock = vi.fn();
const scrollToEndMock = vi.fn();
const scrollToMock = vi.fn();
let latestScrollHandler: ((event: {
  nativeEvent: { contentOffset: { y: number }; layoutMeasurement: { height: number }; contentSize: { height: number } };
}) => void) | null = null;

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
      testID,
      accessibilityRole,
      accessibilityLabel,
      ...props
    }: Record<string, unknown>) => {
      const domProps = {
        ...props,
        ...(typeof testID === "string" ? { "data-testid": testID } : {}),
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

  const ScrollView = React.forwardRef(
    (
      {
        children,
        onScroll,
        onContentSizeChange,
        contentContainerStyle,
        scrollEventThrottle,
        testID,
        ...props
      }: {
        children: ReactNode;
        onScroll?: (event: {
          nativeEvent: { contentOffset: { y: number }; layoutMeasurement: { height: number }; contentSize: { height: number } };
        }) => void;
        onContentSizeChange?: (contentWidth: number, contentHeight: number) => void;
        contentContainerStyle?: Record<string, unknown>;
        scrollEventThrottle?: number;
        testID?: string;
      },
      ref,
    ) => {
      latestScrollHandler = onScroll ?? null;
      React.useImperativeHandle(ref, () => ({
        scrollToEnd: scrollToEndMock,
        scrollTo: scrollToMock,
      }));
      React.useEffect(() => {
        onContentSizeChange?.(320, 1_000);
      }, [onContentSizeChange]);
      return (
        <div {...props} {...(typeof testID === "string" ? { "data-testid": testID } : {})} style={contentContainerStyle}>
          {children}
        </div>
      );
    },
  );

  return {
    View: element("div"),
    Text: element("span"),
    Pressable: element("button"),
    Modal: ({ children, visible }: { children: ReactNode; visible?: boolean }) => (visible ? <div>{children}</div> : null),
    TextInput: element("input"),
    ScrollView,
    Linking: {
      openURL: vi.fn(),
    },
  };
});

vi.mock("@expo/vector-icons", () => ({
  Ionicons: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

vi.mock("@/context/operatorAppContext", () => ({
  useOperatorApp: () => useOperatorAppMock(),
}));

describe("Chat route", () => {
  beforeEach(() => {
    backMock.mockReset();
    selectConversationMock.mockReset();
    setConversationTriageResultMock.mockReset();
    useOperatorAppMock.mockReset();
    scrollToEndMock.mockReset();
    scrollToMock.mockReset();
    latestScrollHandler = null;
    selectConversationMock.mockResolvedValue(undefined);
    setConversationTriageResultMock.mockResolvedValue(undefined);
  });

  function mockAuthenticatedContext(overrides?: Record<string, unknown>) {
    useOperatorAppMock.mockReturnValue({
      isAuthenticated: true,
      thread: {
        conversationId: "c-1",
        title: "Conversa c-1",
        triageResult: "REVISAO_HUMANA",
        messages: [
          {
            id: "m-1",
            senderId: "operator-1",
            body: "Primeira mensagem",
            createdAt: Date.UTC(2026, 0, 1),
            attachment: null,
          },
          {
            id: "m-2",
            senderId: "operator-1",
            body: "Segunda mensagem",
            createdAt: Date.UTC(2026, 0, 1, 0, 1),
            attachment: null,
          },
        ],
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
      exportConversationAttachmentArchive: vi.fn(async () => ({
        conversationId: "c-1",
        tenantId: "tenant-1",
        formatVersion: "conversation.attachments.zip.v1",
        generatedAtIso: "2026-01-01T00:00:00.000Z",
        zipFileName: "arquivos-conversa-c-1.zip",
        zipDownloadUrl: "https://storage.example.com/arquivos-conversa-c-1.zip",
        attachmentCount: 1,
        attachments: [],
      })),
      loadingThread: false,
      loadingAction: false,
      blockingErrorMessage: null,
      toastErrorMessage: null,
      clearError: vi.fn(),
      selectConversation: selectConversationMock,
      ...overrides,
    });
  }

  it("opens triage bottom sheet and updates selected status", async () => {
    mockAuthenticatedContext({
      thread: {
        conversationId: "c-1",
        title: "Conversa c-1",
        triageResult: "REVISAO_HUMANA",
        messages: [],
      },
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

  it("renders send button with icon only and without back button", () => {
    mockAuthenticatedContext();

    const screen = render(<ChatScreen />);

    expect(screen.queryByText("Voltar")).toBeNull();
    expect(screen.queryByText("Enviar")).toBeNull();
    expect(screen.getByRole("button", { name: "Enviar mensagem" })).toBeDefined();
    expect(screen.getByTestId("icon-send")).toBeDefined();
  });

  it("does not render a PDF export action", () => {
    mockAuthenticatedContext();

    const screen = render(<ChatScreen />);

    expect(screen.queryByText("Compartilhar PDF")).toBeNull();
  });

  it("starts at latest messages and allows jumping back to the end after scrolling up", async () => {
    mockAuthenticatedContext();

    const screen = render(<ChatScreen />);

    await waitFor(() => {
      expect(scrollToEndMock).toHaveBeenCalled();
    });
    expect(screen.queryByTestId("chat-scroll-to-latest-button")).toBeNull();
    expect(latestScrollHandler).not.toBeNull();

    await act(async () => {
      latestScrollHandler?.({
        nativeEvent: {
          contentOffset: { y: 0 },
          layoutMeasurement: { height: 300 },
          contentSize: { height: 1_000 },
        },
      });
    });

    const jumpToLatestButton = screen.getByTestId("chat-scroll-to-latest-button");
    expect(jumpToLatestButton).toBeDefined();
    const scrollCallsBeforeJump = scrollToEndMock.mock.calls.length;

    fireEvent.click(jumpToLatestButton);

    await waitFor(() => {
      expect(scrollToEndMock.mock.calls.length).toBeGreaterThan(scrollCallsBeforeJump);
    });
    expect(screen.queryByTestId("chat-scroll-to-latest-button")).toBeNull();
  });

  it("uses native scrollTo fallback when jumping to latest messages", async () => {
    mockAuthenticatedContext();

    const screen = render(<ChatScreen />);
    expect(latestScrollHandler).not.toBeNull();

    await act(async () => {
      latestScrollHandler?.({
        nativeEvent: {
          contentOffset: { y: 0 },
          layoutMeasurement: { height: 300 },
          contentSize: { height: 1_000 },
        },
      });
    });

    fireEvent.click(screen.getByTestId("chat-scroll-to-latest-button"));

    await waitFor(() => {
      expect(scrollToMock).toHaveBeenCalled();
    });
  });
});
