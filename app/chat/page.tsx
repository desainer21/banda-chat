"use client";

import {
  ChangeEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import BandaLogo from "@/components/BandaLogo";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string;
  username: string | null;
  avatar_url: string | null;
};

type Conversation = {
  id: string;
  type: string;
  name: string | null;
  created_by: string | null;
  created_at: string;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
  updated_at?: string | null;
};

type ContactInfo = {
  conversationId: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
};

type PresenceData = {
  user_id?: string;
  online_at?: string;
};

type AttachmentType =
  | "image"
  | "video"
  | "audio"
  | "file";

type AttachmentData = {
  __banda_attachment: true;
  type: AttachmentType;
  url: string;
  name: string;
  size: number;
  mime: string;
};

type PendingAttachment = {
  file: File;
  type: AttachmentType;
  previewUrl: string | null;
};

type AttachmentMenuType =
  | "image"
  | "video"
  | "audio"
  | "file"
  | null;

type MediaRecorderWithData = {
  recorder: MediaRecorder;
  chunks: Blob[];
  stream: MediaStream;
};

const CHAT_BUCKET = "chat-attachments";

export default function ChatPage() {
  const router = useRouter();

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [currentUserId, setCurrentUserId] =
    useState("");

  const [users, setUsers] =
    useState<Profile[]>([]);

  const [contactInfo, setContactInfo] =
    useState<Record<string, ContactInfo>>({});

  const [selectedUser, setSelectedUser] =
    useState<Profile | null>(null);

  const [
    selectedConversation,
    setSelectedConversation,
  ] = useState<Conversation | null>(null);

  const [messages, setMessages] =
    useState<Message[]>([]);

  const [search, setSearch] =
    useState("");

  const [messageText, setMessageText] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [loadingUsers, setLoadingUsers] =
    useState(false);

  const [
    loadingMessages,
    setLoadingMessages,
  ] = useState(false);

  const [startingChat, setStartingChat] =
    useState(false);

  const [
    sendingMessage,
    setSendingMessage,
  ] = useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [
    mobileChatOpen,
    setMobileChatOpen,
  ] = useState(false);

  const [
    onlineUserIds,
    setOnlineUserIds,
  ] = useState<Set<string>>(new Set());

  const [
    typingUserIds,
    setTypingUserIds,
  ] = useState<Set<string>>(new Set());

  const [
    openMessageMenuId,
    setOpenMessageMenuId,
  ] = useState<string | null>(null);

  const [
    editingMessageId,
    setEditingMessageId,
  ] = useState<string | null>(null);

  const [
    editingMessageText,
    setEditingMessageText,
  ] = useState("");

  const [savingEdit, setSavingEdit] =
    useState(false);

  const [
    deletingMessageId,
    setDeletingMessageId,
  ] = useState<string | null>(null);

  const [
    profileModalOpen,
    setProfileModalOpen,
  ] = useState(false);

  const [profileName, setProfileName] =
    useState("");

  const [
    profileUsername,
    setProfileUsername,
  ] = useState("");

  const [
    profileAvatarUrl,
    setProfileAvatarUrl,
  ] = useState<string | null>(null);

  const [
    selectedAvatarFile,
    setSelectedAvatarFile,
  ] = useState<File | null>(null);

  const [avatarPreview, setAvatarPreview] =
    useState<string | null>(null);

  const [savingProfile, setSavingProfile] =
    useState(false);

  const [profileError, setProfileError] =
    useState("");

  const [
    attachmentMenuOpen,
    setAttachmentMenuOpen,
  ] = useState(false);

  const [
    pendingAttachment,
    setPendingAttachment,
  ] = useState<PendingAttachment | null>(null);

  const [
    uploadingAttachment,
    setUploadingAttachment,
  ] = useState(false);

  const [recordingVoice, setRecordingVoice] =
    useState(false);

  const [
    recordingSeconds,
    setRecordingSeconds,
  ] = useState(0);

  const imageInputRef =
    useRef<HTMLInputElement | null>(null);

  const videoInputRef =
    useRef<HTMLInputElement | null>(null);

  const audioInputRef =
    useRef<HTMLInputElement | null>(null);

  const documentInputRef =
    useRef<HTMLInputElement | null>(null);

  const mediaRecorderRef =
    useRef<MediaRecorderWithData | null>(null);

  const recordingTimerRef =
    useRef<ReturnType<typeof setInterval> | null>(
      null
    );

  const messagesEndRef =
    useRef<HTMLDivElement | null>(null);

  const presenceChannelRef =
    useRef<
      ReturnType<typeof supabase.channel> | null
    >(null);

  const typingChannelRef =
    useRef<
      ReturnType<typeof supabase.channel> | null
    >(null);

  const typingTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  const sendTypingTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  const selectedConversationIdRef =
    useRef<string | null>(null);

  const loadingChatRef = useRef(false);

  useEffect(() => {
    selectedConversationIdRef.current =
      selectedConversation?.id || null;
  }, [selectedConversation]);

  useEffect(() => {
    return () => {
      if (pendingAttachment?.previewUrl) {
        URL.revokeObjectURL(
          pendingAttachment.previewUrl
        );
      }

      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }

      if (recordingTimerRef.current) {
        clearInterval(
          recordingTimerRef.current
        );
      }

      if (typingTimerRef.current) {
        clearTimeout(
          typingTimerRef.current
        );
      }

      if (sendTypingTimerRef.current) {
        clearTimeout(
          sendTypingTimerRef.current
        );
      }

      const recorder =
        mediaRecorderRef.current;

      if (recorder) {
        try {
          recorder.stream
            .getTracks()
            .forEach((track) =>
              track.stop()
            );
        } catch {}
      }
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initializeChat() {
      await loadChat();
    }

    void initializeChat();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) {
          return;
        }

        if (
          event === "SIGNED_IN" ||
          event === "INITIAL_SESSION" ||
          event === "TOKEN_REFRESHED"
        ) {
          if (
            session?.user &&
            !loadingChatRef.current
          ) {
            void loadChat();
          }
        }

        if (event === "SIGNED_OUT") {
          setCurrentUserId("");
          setProfile(null);
          setContactInfo({});
          setUsers([]);
          router.replace("/login");
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  async function loadChat() {
    if (loadingChatRef.current) {
      return;
    }

    loadingChatRef.current = true;

    try {
      setLoading(true);
      setErrorMessage("");

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(sessionError.message);
      }

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      const authUserId = session.user.id;

      setCurrentUserId(authUserId);

      const {
        data: myProfile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(
          "id, full_name, username, avatar_url"
        )
        .eq("id", authUserId)
        .maybeSingle();

      if (profileError) {
        console.error(
          "Profile error:",
          profileError
        );
      }

      const currentProfile: Profile =
        myProfile || {
          id: authUserId,
          full_name:
            session.user.email?.split("@")[0] ||
            "Pengguna",
          username: null,
          avatar_url: null,
        };

      setProfile(currentProfile);

      await loadUsers(authUserId);
      await loadContactInfo(authUserId);
    } catch (error) {
      console.error(
        "Load chat error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal membuka Banda Chat."
      );
    } finally {
      setLoading(false);
      loadingChatRef.current = false;
    }
  }

  async function loadUsers(
    authUserId: string
  ) {
    setLoadingUsers(true);

    try {
      const {
        data,
        error,
      } = await supabase
        .from("profiles")
        .select(
          "id, full_name, username, avatar_url"
        )
        .neq("id", authUserId)
        .order("full_name", {
          ascending: true,
        });

      if (error) {
        throw new Error(error.message);
      }

      setUsers(data || []);
    } catch (error) {
      console.error(
        "Load users error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? "Gagal memuat pengguna: " +
              error.message
          : "Gagal memuat pengguna."
      );
    } finally {
      setLoadingUsers(false);
    }
  }

  async function loadContactInfo(
    authUserId: string
  ) {
    try {
      const {
        data: myMemberships,
        error: myMembershipError,
      } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", authUserId);

      if (myMembershipError) {
        console.error(
          "Load memberships error:",
          myMembershipError
        );
        return;
      }

      if (
        !myMemberships ||
        myMemberships.length === 0
      ) {
        setContactInfo({});
        return;
      }

      const conversationIds =
        myMemberships.map(
          (item) => item.conversation_id
        );

      const {
        data: allMembers,
        error: allMembersError,
      } = await supabase
        .from("conversation_members")
        .select(
          "conversation_id, user_id"
        )
        .in(
          "conversation_id",
          conversationIds
        );

      if (allMembersError) {
        console.error(
          "Load all members error:",
          allMembersError
        );
        return;
      }

      const conversationToUser: Record<
        string,
        string
      > = {};

      allMembers?.forEach((member) => {
        if (
          member.user_id !== authUserId
        ) {
          conversationToUser[
            member.conversation_id
          ] = member.user_id;
        }
      });

      const {
        data: allMessages,
        error: messagesError,
      } = await supabase
        .from("messages")
        .select(
          "id, conversation_id, sender_id, content, created_at, read_at, updated_at"
        )
        .in(
          "conversation_id",
          conversationIds
        )
        .order("created_at", {
          ascending: false,
        });

      if (messagesError) {
        console.error(
          "Load contact messages error:",
          messagesError
        );
        return;
      }

      const aggregatedInfo: Record<
        string,
        ContactInfo
      > = {};

      Object.entries(
        conversationToUser
      ).forEach(
        ([conversationId, userId]) => {
          const conversationMessages =
            (allMessages || []).filter(
              (message) =>
                message.conversation_id ===
                conversationId
            );

          const unreadCount =
            conversationMessages.filter(
              (message) =>
                message.sender_id !==
                  authUserId &&
                !message.read_at
            ).length;

          const lastMessage =
            conversationMessages.length > 0
              ? conversationMessages[0]
              : null;

          if (!aggregatedInfo[userId]) {
            aggregatedInfo[userId] = {
              conversationId,
              lastMessage:
                lastMessage
                  ? getMessagePreviewText(
                      lastMessage.content
                    )
                  : null,
              lastMessageAt:
                lastMessage?.created_at ||
                null,
              unreadCount,
            };

            return;
          }

          const existing =
            aggregatedInfo[userId];

          const existingLastMessageAt =
            existing.lastMessageAt;

          const currentLastMessageAt =
            lastMessage?.created_at || null;

          existing.unreadCount +=
            unreadCount;

          if (
            currentLastMessageAt &&
            (!existingLastMessageAt ||
              new Date(
                currentLastMessageAt
              ).getTime() >
                new Date(
                  existingLastMessageAt
                ).getTime())
          ) {
            existing.conversationId =
              conversationId;

            existing.lastMessage =
              lastMessage
                ? getMessagePreviewText(
                    lastMessage.content
                  )
                : null;

            existing.lastMessageAt =
              currentLastMessageAt;
          }
        }
      );

      setContactInfo(aggregatedInfo);
    } catch (error) {
      console.error(
        "Load contact info error:",
        error
      );
    }
  }

  function refreshContactInfoRealtime() {
    if (!currentUserId) {
      return;
    }

    void loadContactInfo(currentUserId);

    window.setTimeout(() => {
      void loadContactInfo(currentUserId);
    }, 300);
  }

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    const channel = supabase.channel(
      "banda-chat-online",
      {
        config: {
          presence: {
            key: currentUserId,
          },
        },
      }
    );

    presenceChannelRef.current = channel;

    channel.on(
      "presence",
      {
        event: "sync",
      },
      () => {
        const state =
          channel.presenceState() as Record<
            string,
            PresenceData[]
          >;

        const onlineIds =
          new Set<string>();

        Object.keys(state).forEach(
          (key) => {
            const presences =
              state[key];

            if (
              !Array.isArray(presences)
            ) {
              return;
            }

            presences.forEach(
              (
                presence: PresenceData
              ) => {
                if (
                  typeof presence.user_id ===
                  "string"
                ) {
                  onlineIds.add(
                    presence.user_id
                  );
                }
              }
            );
          }
        );

        setOnlineUserIds(onlineIds);
      }
    );

    channel.subscribe(
      async (status) => {
        if (
          status === "SUBSCRIBED"
        ) {
          try {
            await channel.track({
              user_id: currentUserId,
              online_at:
                new Date().toISOString(),
            });
          } catch (error) {
            console.error(
              "Presence track error:",
              error
            );
          }
        }
      }
    );

    return () => {
      presenceChannelRef.current =
        null;

      void supabase.removeChannel(
        channel
      );
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    const channel =
      supabase.channel(
        "banda-chat-typing"
      );

    typingChannelRef.current =
      channel;

    channel.on(
      "broadcast",
      {
        event: "typing",
      },
      (payload) => {
        const payloadData =
          payload.payload as {
            user_id?: string;
            conversation_id?: string;
            is_typing?: boolean;
          };

        const typingUserId =
          payloadData.user_id;

        const conversationId =
          payloadData.conversation_id;

        if (
          !typingUserId ||
          typingUserId ===
            currentUserId
        ) {
          return;
        }

        if (
          conversationId !==
          selectedConversationIdRef.current
        ) {
          return;
        }

        setTypingUserIds(
          (previous) => {
            const next =
              new Set(previous);

            if (
              payloadData.is_typing
            ) {
              next.add(
                typingUserId
              );
            } else {
              next.delete(
                typingUserId
              );
            }

            return next;
          }
        );

        if (
          typingTimerRef.current
        ) {
          clearTimeout(
            typingTimerRef.current
          );
        }

        if (
          payloadData.is_typing
        ) {
          typingTimerRef.current =
            setTimeout(() => {
              setTypingUserIds(
                new Set()
              );
            }, 1800);
        }
      }
    );

    channel.subscribe();

    return () => {
      typingChannelRef.current =
        null;

      if (
        typingTimerRef.current
      ) {
        clearTimeout(
          typingTimerRef.current
        );
      }

      if (
        sendTypingTimerRef.current
      ) {
        clearTimeout(
          sendTypingTimerRef.current
        );
      }

      void supabase.removeChannel(
        channel
      );
    };
  }, [currentUserId]);

  useEffect(() => {
    setTypingUserIds(
      new Set()
    );
  }, [
    selectedConversation?.id,
  ]);

  function handleMessageChange(
    value: string
  ) {
    setMessageText(value);

    if (
      !selectedConversation ||
      !currentUserId
    ) {
      return;
    }

    const channel =
      typingChannelRef.current;

    if (!channel) {
      return;
    }

    if (value.trim()) {
      void channel.send({
        type: "broadcast",
        event: "typing",
        payload: {
          user_id: currentUserId,
          conversation_id:
            selectedConversation.id,
          is_typing: true,
        },
      });

      if (
        sendTypingTimerRef.current
      ) {
        clearTimeout(
          sendTypingTimerRef.current
        );
      }

      sendTypingTimerRef.current =
        setTimeout(() => {
          void channel.send({
            type: "broadcast",
            event: "typing",
            payload: {
              user_id:
                currentUserId,
              conversation_id:
                selectedConversation.id,
              is_typing: false,
            },
          });
        }, 1200);
    } else {
      stopTypingBroadcast();
    }
  }

  async function startChat(
    user: Profile
  ) {
    if (!currentUserId) {
      setErrorMessage(
        "Sesi pengguna tidak ditemukan."
      );
      return;
    }

    if (startingChat) {
      return;
    }

    setStartingChat(true);
    setSelectedUser(user);
    setErrorMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      const authUserId =
        session.user.id;

      if (
        authUserId === user.id
      ) {
        throw new Error(
          "Anda tidak dapat chat dengan diri sendiri."
        );
      }

      const {
        data: conversationId,
        error: rpcError,
      } = await supabase.rpc(
        "create_direct_conversation",
        {
          target_user_id:
            user.id,
        }
      );

      if (rpcError) {
        throw new Error(
          rpcError.message
        );
      }

      if (!conversationId) {
        throw new Error(
          "Conversation ID tidak ditemukan."
        );
      }

      const conversation: Conversation =
        {
          id:
            conversationId as string,
          type: "direct",
          name:
            user.full_name,
          created_by:
            authUserId,
          created_at:
            new Date().toISOString(),
        };

      setSelectedConversation(
        conversation
      );

      setMessages([]);

      await loadMessages(
        conversation.id,
        authUserId
      );

      setMobileChatOpen(true);
    } catch (error) {
      console.error(
        "Start chat error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? "Gagal membuka chat: " +
              error.message
          : "Gagal membuka chat."
      );
    } finally {
      setStartingChat(false);
    }
  }

  async function loadMessages(
    conversationId: string,
    authUserId: string
  ) {
    setLoadingMessages(true);

    try {
      const {
        data,
        error,
      } = await supabase
        .from("messages")
        .select(
          "id, conversation_id, sender_id, content, created_at, read_at, updated_at"
        )
        .eq(
          "conversation_id",
          conversationId
        )
        .order("created_at", {
          ascending: true,
        });

      if (error) {
        throw new Error(
          error.message
        );
      }

      setMessages(data || []);

      await markConversationRead(
        conversationId,
        authUserId
      );
    } catch (error) {
      console.error(
        "Load messages error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? "Gagal memuat pesan: " +
              error.message
          : "Gagal memuat pesan."
      );
    } finally {
      setLoadingMessages(false);
    }
  }

  async function markConversationRead(
    conversationId: string,
    authUserId: string
  ) {
    try {
      const {
        error,
      } = await supabase.rpc(
        "mark_conversation_read",
        {
          p_conversation_id:
            conversationId,
        }
      );

      if (error) {
        console.error(
          "Mark read error:",
          error
        );
        return;
      }

      const now =
        new Date().toISOString();

      setMessages(
        (previous) =>
          previous.map(
            (message) => {
              if (
                message.conversation_id ===
                  conversationId &&
                message.sender_id !==
                  authUserId &&
                !message.read_at
              ) {
                return {
                  ...message,
                  read_at: now,
                };
              }

              return message;
            }
          )
      );

      setContactInfo(
        (previous) => {
          const next = {
            ...previous,
          };

          Object.keys(
            next
          ).forEach(
            (userId) => {
              if (
                next[userId]
                  .conversationId ===
                conversationId
              ) {
                next[userId] = {
                  ...next[userId],
                  unreadCount: 0,
                };
              }
            }
          );

          return next;
        }
      );

      await loadContactInfo(
        authUserId
      );
    } catch (error) {
      console.error(
        "Mark conversation read error:",
        error
      );
    }
  }

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    const channel =
      supabase
        .channel(
          "all-chat-messages-" +
            currentUserId
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
          },
          (payload) => {
            const newMessage =
              payload.new as Message;

            if (
              newMessage.sender_id ===
              currentUserId
            ) {
              refreshContactInfoRealtime();
              return;
            }

            const isCurrentConversation =
              newMessage.conversation_id ===
              selectedConversationIdRef.current;

            if (
              isCurrentConversation
            ) {
              refreshContactInfoRealtime();
              return;
            }

            setContactInfo(
              (previous) => {
                const next = {
                  ...previous,
                };

                const matchedUserId =
                  Object.keys(
                    next
                  ).find(
                    (userId) =>
                      next[userId]
                        .conversationId ===
                      newMessage.conversation_id
                  );

                if (
                  matchedUserId
                ) {
                  next[
                    matchedUserId
                  ] = {
                    ...next[
                      matchedUserId
                    ],
                    lastMessage:
                      getMessagePreviewText(
                        newMessage.content
                      ),
                    lastMessageAt:
                      newMessage.created_at,
                    unreadCount:
                      next[
                        matchedUserId
                      ].unreadCount +
                      1,
                  };
                }

                return next;
              }
            );

            refreshContactInfoRealtime();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
          },
          () => {
            refreshContactInfoRealtime();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "messages",
          },
          () => {
            refreshContactInfoRealtime();
          }
        )
        .subscribe();

    return () => {
      void supabase.removeChannel(
        channel
      );
    };
  }, [currentUserId]);

  useEffect(() => {
    if (
      !selectedConversation ||
      !currentUserId
    ) {
      return;
    }

    const conversationId =
      selectedConversation.id;

    const channel =
      supabase
        .channel(
          "selected-conversation-" +
            conversationId +
            "-" +
            currentUserId
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter:
              "conversation_id=eq." +
              conversationId,
          },
          async (payload) => {
            const newMessage =
              payload.new as Message;

            setMessages(
              (previous) => {
                const exists =
                  previous.some(
                    (message) =>
                      message.id ===
                      newMessage.id
                  );

                if (exists) {
                  return previous;
                }

                return [
                  ...previous,
                  newMessage,
                ];
              }
            );

            if (
              newMessage.sender_id !==
              currentUserId
            ) {
              const {
                error,
              } =
                await supabase.rpc(
                  "mark_conversation_read",
                  {
                    p_conversation_id:
                      conversationId,
                  }
                );

              if (error) {
                console.error(
                  "Realtime mark read error:",
                  error
                );
              }

              const now =
                new Date().toISOString();

              setMessages(
                (previous) =>
                  previous.map(
                    (message) =>
                      message.id ===
                      newMessage.id
                        ? {
                            ...message,
                            read_at:
                              now,
                          }
                        : message
                  )
              );

              setContactInfo(
                (previous) => {
                  const next = {
                    ...previous,
                  };

                  Object.keys(
                    next
                  ).forEach(
                    (userId) => {
                      if (
                        next[userId]
                          .conversationId ===
                        conversationId
                      ) {
                        next[userId] = {
                          ...next[
                            userId
                          ],
                          unreadCount: 0,
                          lastMessage:
                            getMessagePreviewText(
                              newMessage.content
                            ),
                          lastMessageAt:
                            newMessage.created_at,
                        };
                      }
                    }
                  );

                  return next;
                }
              );
            } else {
              refreshContactInfoRealtime();
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter:
              "conversation_id=eq." +
              conversationId,
          },
          (payload) => {
            const updatedMessage =
              payload.new as Message;

            setMessages(
              (previous) =>
                previous.map(
                  (message) =>
                    message.id ===
                    updatedMessage.id
                      ? updatedMessage
                      : message
                )
            );

            refreshContactInfoRealtime();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "messages",
            filter:
              "conversation_id=eq." +
              conversationId,
          },
          (payload) => {
            const deletedMessage =
              payload.old as {
                id?: string;
              };

            if (
              deletedMessage.id
            ) {
              setMessages(
                (previous) =>
                  previous.filter(
                    (message) =>
                      message.id !==
                      deletedMessage.id
                  )
              );
            } else {
              void loadMessages(
                conversationId,
                currentUserId
              );
            }

            refreshContactInfoRealtime();
          }
        )
        .subscribe();

    return () => {
      void supabase.removeChannel(
        channel
      );
    };
  }, [
    selectedConversation,
    currentUserId,
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView(
      {
        behavior: "smooth",
        block: "end",
      }
    );
  }, [
    messages,
    typingUserIds,
  ]);

  function stopTypingBroadcast() {
    if (
      sendTypingTimerRef.current
    ) {
      clearTimeout(
        sendTypingTimerRef.current
      );
    }

    if (
      typingChannelRef.current &&
      selectedConversation &&
      currentUserId
    ) {
      void typingChannelRef.current.send(
        {
          type: "broadcast",
          event: "typing",
          payload: {
            user_id:
              currentUserId,
            conversation_id:
              selectedConversation.id,
            is_typing: false,
          },
        }
      );
    }
  }

  async function sendMessage() {
    const content =
      messageText.trim();

    if (!content) {
      return;
    }

    if (!selectedConversation) {
      setErrorMessage(
        "Pilih percakapan terlebih dahulu."
      );
      return;
    }

    if (!currentUserId) {
      setErrorMessage(
        "Sesi pengguna tidak ditemukan."
      );
      return;
    }

    if (sendingMessage) {
      return;
    }

    setSendingMessage(true);
    setErrorMessage("");

    stopTypingBroadcast();

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      const senderId =
        session.user.id;

      const {
        data,
        error,
      } = await supabase
        .from("messages")
        .insert({
          conversation_id:
            selectedConversation.id,
          sender_id:
            senderId,
          content,
        })
        .select(
          "id, conversation_id, sender_id, content, created_at, read_at, updated_at"
        )
        .single();

      if (error) {
        throw new Error(
          error.message
        );
      }

      if (data) {
        setMessages(
          (previous) => {
            const exists =
              previous.some(
                (message) =>
                  message.id ===
                  data.id
              );

            if (exists) {
              return previous;
            }

            return [
              ...previous,
              data,
            ];
          }
        );
      }

      setMessageText("");

      await loadContactInfo(
        senderId
      );
    } catch (error) {
      console.error(
        "Send message error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? "Pesan gagal dikirim: " +
              error.message
          : "Pesan gagal dikirim."
      );
    } finally {
      setSendingMessage(false);
    }
  }

  function parseAttachment(
    content: string
  ): AttachmentData | null {
    try {
      const parsed =
        JSON.parse(content);

      if (
        parsed &&
        parsed.__banda_attachment ===
          true &&
        typeof parsed.url ===
          "string" &&
        typeof parsed.name ===
          "string" &&
        typeof parsed.type ===
          "string"
      ) {
        return parsed as AttachmentData;
      }

      return null;
    } catch {
      return null;
    }
  }

  function getMessagePreviewText(
    content: string
  ) {
    const attachment =
      parseAttachment(content);

    if (!attachment) {
      return content;
    }

    if (
      attachment.type ===
      "image"
    ) {
      return "📷 Foto";
    }

    if (
      attachment.type ===
      "video"
    ) {
      return "🎥 Video";
    }

    if (
      attachment.type ===
      "audio"
    ) {
      return "🎵 Audio";
    }

    return (
      "📎 " + attachment.name
    );
  }

  function getAttachmentType(
    file: File
  ): AttachmentType {
    if (
      file.type.startsWith(
        "image/"
      )
    ) {
      return "image";
    }

    if (
      file.type.startsWith(
        "video/"
      )
    ) {
      return "video";
    }

    if (
      file.type.startsWith(
        "audio/"
      )
    ) {
      return "audio";
    }

    return "file";
  }

  function formatFileSize(
    size: number
  ) {
    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(
        size / 1024
      ).toFixed(1)} KB`;
    }

    if (
      size <
      1024 *
        1024 *
        1024
    ) {
      return `${(
        size /
        (1024 * 1024)
      ).toFixed(1)} MB`;
    }

    return `${(
      size /
      (1024 *
        1024 *
        1024)
    ).toFixed(1)} GB`;
  }

  function getMaxFileSize(
    type: AttachmentType
  ) {
    if (
      type === "video"
    ) {
      return 100 * 1024 * 1024;
    }

    if (
      type === "audio"
    ) {
      return 50 * 1024 * 1024;
    }

    if (
      type === "image"
    ) {
      return 20 * 1024 * 1024;
    }

    return 50 * 1024 * 1024;
  }

  function handleAttachmentFile(
    event: ChangeEvent<HTMLInputElement>,
    forcedType?: AttachmentType
  ) {
    const file =
      event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    const type =
      forcedType ||
      getAttachmentType(file);

    const maxSize =
      getMaxFileSize(type);

    if (
      file.size > maxSize
    ) {
      setErrorMessage(
        `Ukuran ${
          type === "video"
            ? "video"
            : type === "audio"
            ? "audio"
            : type === "image"
            ? "foto"
            : "file"
        } maksimal ${formatFileSize(
          maxSize
        )}.`
      );
      return;
    }

    let previewUrl:
      | string
      | null = null;

    if (
      type === "image" ||
      type === "video" ||
      type === "audio"
    ) {
      previewUrl =
        URL.createObjectURL(
          file
        );
    }

    if (
      pendingAttachment?.previewUrl
    ) {
      URL.revokeObjectURL(
        pendingAttachment.previewUrl
      );
    }

    setPendingAttachment({
      file,
      type,
      previewUrl,
    });

    setAttachmentMenuOpen(
      false
    );

    setErrorMessage("");
  }

  function cancelPendingAttachment() {
    if (
      pendingAttachment?.previewUrl
    ) {
      URL.revokeObjectURL(
        pendingAttachment.previewUrl
      );
    }

    setPendingAttachment(
      null
    );
  }

  async function uploadChatAttachment(
    file: File,
    userId: string,
    conversationId: string
  ) {
    const originalExtension =
      file.name
        .split(".")
        .pop()
        ?.toLowerCase() ||
      "bin";

    const baseName =
      file.name
        .replace(
          /\.[^/.]+$/,
          ""
        )
        .replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        )
        .slice(0, 100) ||
      "file";

    const filePath =
      userId +
      "/" +
      conversationId +
      "/" +
      Date.now() +
      "-" +
      baseName +
      "." +
      originalExtension;

    const {
      error: uploadError,
    } = await supabase.storage
      .from(CHAT_BUCKET)
      .upload(
        filePath,
        file,
        {
          cacheControl:
            "3600",
          contentType:
            file.type ||
            "application/octet-stream",
          upsert: false,
        }
      );

    if (uploadError) {
      throw new Error(
        "Upload Storage gagal: " +
          uploadError.message
      );
    }

    const {
      data: publicUrlData,
    } = supabase.storage
      .from(CHAT_BUCKET)
      .getPublicUrl(
        filePath
      );

    const publicUrl =
      publicUrlData.publicUrl;

    if (!publicUrl) {
      throw new Error(
        "URL file tidak berhasil dibuat."
      );
    }

    return {
      url: publicUrl,
      path: filePath,
    };
  }

  async function sendPendingAttachment() {
    if (
      !pendingAttachment ||
      !selectedConversation ||
      !currentUserId
    ) {
      return;
    }

    if (uploadingAttachment) {
      return;
    }

    setUploadingAttachment(
      true
    );
    setErrorMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      const userId =
        session.user.id;

      const upload =
        await uploadChatAttachment(
          pendingAttachment.file,
          userId,
          selectedConversation.id
        );

      const attachment:
        AttachmentData = {
        __banda_attachment:
          true,
        type:
          pendingAttachment.type,
        url: upload.url,
        name:
          pendingAttachment.file.name,
        size:
          pendingAttachment.file.size,
        mime:
          pendingAttachment.file.type ||
          "application/octet-stream",
      };

      const {
        data,
        error,
      } = await supabase
        .from("messages")
        .insert({
          conversation_id:
            selectedConversation.id,
          sender_id:
            userId,
          content:
            JSON.stringify(
              attachment
            ),
        })
        .select(
          "id, conversation_id, sender_id, content, created_at, read_at, updated_at"
        )
        .single();

      if (error) {
        await supabase.storage
          .from(CHAT_BUCKET)
          .remove([
            upload.path,
          ]);

        throw new Error(
          "File berhasil di-upload tetapi pesan gagal disimpan: " +
            error.message
        );
      }

      if (data) {
        setMessages(
          (previous) => {
            const exists =
              previous.some(
                (message) =>
                  message.id ===
                  data.id
              );

            if (exists) {
              return previous;
            }

            return [
              ...previous,
              data,
            ];
          }
        );
      }

      cancelPendingAttachment();

      await loadContactInfo(
        userId
      );
    } catch (error) {
      console.error(
        "Send attachment error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? "File gagal dikirim: " +
              error.message
          : "File gagal dikirim."
      );
    } finally {
      setUploadingAttachment(
        false
      );
    }
  }

  function openAttachmentPicker(
    type: AttachmentMenuType
  ) {
    setAttachmentMenuOpen(false);

    if (type === "image") {
      imageInputRef.current?.click();
    }

    if (type === "video") {
      videoInputRef.current?.click();
    }

    if (type === "audio") {
      audioInputRef.current?.click();
    }

    if (type === "file") {
      documentInputRef.current?.click();
    }
  }

  function getSupportedAudioMimeType() {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
    ];

    for (const mime of candidates) {
      if (
        typeof MediaRecorder !==
          "undefined" &&
        MediaRecorder.isTypeSupported(
          mime
        )
      ) {
        return mime;
      }
    }

    return "";
  }

  async function startVoiceRecording() {
    if (
      recordingVoice ||
      uploadingAttachment
    ) {
      return;
    }

    if (!selectedConversation) {
      setErrorMessage(
        "Pilih percakapan terlebih dahulu."
      );
      return;
    }

    try {
      if (
        typeof navigator ===
          "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        throw new Error(
          "Browser tidak mendukung perekaman audio."
        );
      }

      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            audio: true,
          }
        );

      const mimeType =
        getSupportedAudioMimeType();

      const recorder =
        mimeType
          ? new MediaRecorder(
              stream,
              {
                mimeType,
              }
            )
          : new MediaRecorder(
              stream
            );

      const chunks: Blob[] = [];

      mediaRecorderRef.current = {
        recorder,
        chunks,
        stream,
      };

      recorder.ondataavailable =
        (event) => {
          if (
            event.data &&
            event.data.size > 0
          ) {
            chunks.push(
              event.data
            );
          }
        };

      recorder.onstop =
        async () => {
          const actualMime =
            recorder.mimeType ||
            mimeType ||
            "audio/webm";

          const blob =
            new Blob(
              chunks,
              {
                type: actualMime,
              }
            );

          stream
            .getTracks()
            .forEach((track) =>
              track.stop()
            );

          if (
            recordingTimerRef.current
          ) {
            clearInterval(
              recordingTimerRef.current
            );
            recordingTimerRef.current =
              null;
          }

          setRecordingVoice(
            false
          );
          setRecordingSeconds(
            0
          );

          if (
            blob.size === 0
          ) {
            setErrorMessage(
              "Rekaman audio kosong."
            );
            return;
          }

          const extension =
            actualMime.includes(
              "mp4"
            )
              ? "m4a"
              : actualMime.includes(
                  "ogg"
                )
              ? "ogg"
              : "webm";

          const voiceFile =
            new File(
              [
                blob,
              ],
              `voice-${Date.now()}.${extension}`,
              {
                type:
                  actualMime,
              }
            );

          const maxSize =
            getMaxFileSize(
              "audio"
            );

          if (
            voiceFile.size >
            maxSize
          ) {
            setErrorMessage(
              "Ukuran rekaman terlalu besar."
            );
            return;
          }

          const previewUrl =
            URL.createObjectURL(
              voiceFile
            );

          setPendingAttachment({
            file:
              voiceFile,
            type: "audio",
            previewUrl,
          });

          setErrorMessage("");
        };

      recorder.start(250);

      setRecordingVoice(
        true
      );
      setRecordingSeconds(
        0
      );

      recordingTimerRef.current =
        setInterval(() => {
          setRecordingSeconds(
            (previous) => {
              if (
                previous >=
                300
              ) {
                window.setTimeout(
                  () =>
                    stopVoiceRecording(),
                  0
                );
                return previous;
              }

              return (
                previous + 1
              );
            }
          );
        }, 1000);
    } catch (error) {
      console.error(
        "Start recording error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? "Tidak dapat merekam audio: " +
              error.message
          : "Tidak dapat merekam audio."
      );
    }
  }

  function stopVoiceRecording() {
    const recorder =
      mediaRecorderRef.current;

    if (!recorder) {
      return;
    }

    try {
      if (
        recorder.recorder.state !==
        "inactive"
      ) {
        recorder.recorder.stop();
      }
    } catch (error) {
      console.error(
        "Stop recording error:",
        error
      );
    }
  }

  function formatRecordingTime(
    seconds: number
  ) {
    const minutes =
      Math.floor(
        seconds / 60
      )
        .toString()
        .padStart(2, "0");

    const remaining =
      (seconds % 60)
        .toString()
        .padStart(2, "0");

    return `${minutes}:${remaining}`;
  }

  async function deleteMessage(
    messageId: string
  ) {
    if (
      !currentUserId ||
      deletingMessageId
    ) {
      return;
    }

    const message =
      messages.find(
        (item) =>
          item.id ===
          messageId
      );

    if (!message) {
      return;
    }

    if (
      message.sender_id !==
      currentUserId
    ) {
      setOpenMessageMenuId(null);
      return;
    }

    setDeletingMessageId(
      messageId
    );

    try {
      const attachment =
        parseAttachment(
          message.content
        );

      const {
        error,
      } = await supabase
        .from("messages")
        .delete()
        .eq(
          "id",
          messageId
        )
        .eq(
          "sender_id",
          currentUserId
        );

      if (error) {
        throw new Error(
          error.message
        );
      }

      setMessages(
        (previous) =>
          previous.filter(
            (item) =>
              item.id !==
              messageId
          )
      );

      if (
        attachment?.url
      ) {
        const marker =
          `/${CHAT_BUCKET}/`;

        const index =
          attachment.url.indexOf(
            marker
          );

        if (
          index !== -1
        ) {
          const path =
            attachment.url.slice(
              index +
                marker.length
            );

          if (path) {
            await supabase.storage
              .from(
                CHAT_BUCKET
              )
              .remove([
                decodeURIComponent(
                  path
                ),
              ]);
          }
        }
      }

      setOpenMessageMenuId(
        null
      );

      refreshContactInfoRealtime();
    } catch (error) {
      console.error(
        "Delete message error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? "Pesan gagal dihapus: " +
              error.message
          : "Pesan gagal dihapus."
      );
    } finally {
      setDeletingMessageId(
        null
      );
    }
  }

  function beginEditMessage(
    message: Message
  ) {
    if (
      message.sender_id !==
      currentUserId
    ) {
      return;
    }

    if (
      parseAttachment(
        message.content
      )
    ) {
      return;
    }

    setEditingMessageId(
      message.id
    );

    setEditingMessageText(
      message.content
    );

    setOpenMessageMenuId(
      null
    );
  }

  function cancelEditMessage() {
    setEditingMessageId(
      null
    );

    setEditingMessageText("");
  }

  async function saveEditMessage() {
    const content =
      editingMessageText.trim();

    if (
      !editingMessageId ||
      !content ||
      savingEdit
    ) {
      return;
    }

    setSavingEdit(true);

    try {
      const {
        data,
        error,
      } = await supabase
        .from("messages")
        .update({
          content,
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          editingMessageId
        )
        .eq(
          "sender_id",
          currentUserId
        )
        .select(
          "id, conversation_id, sender_id, content, created_at, read_at, updated_at"
        )
        .single();

      if (error) {
        throw new Error(
          error.message
        );
      }

      if (data) {
        setMessages(
          (previous) =>
            previous.map(
              (message) =>
                message.id ===
                data.id
                  ? data
                  : message
            )
        );
      }

      cancelEditMessage();
      refreshContactInfoRealtime();
    } catch (error) {
      console.error(
        "Edit message error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? "Pesan gagal diedit: " +
              error.message
          : "Pesan gagal diedit."
      );
    } finally {
      setSavingEdit(false);
    }
  }

  function openProfileModal() {
    if (!profile) {
      return;
    }

    setProfileName(
      profile.full_name || ""
    );

    setProfileUsername(
      profile.username || ""
    );

    setProfileAvatarUrl(
      profile.avatar_url
    );

    setSelectedAvatarFile(
      null
    );

    setAvatarPreview(null);
    setProfileError("");
    setProfileModalOpen(true);
  }

  function handleAvatarChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      setProfileError(
        "Avatar harus berupa gambar."
      );
      return;
    }

    if (
      file.size >
      5 * 1024 * 1024
    ) {
      setProfileError(
        "Ukuran avatar maksimal 5 MB."
      );
      return;
    }

    if (avatarPreview) {
      URL.revokeObjectURL(
        avatarPreview
      );
    }

    setSelectedAvatarFile(
      file
    );

    setAvatarPreview(
      URL.createObjectURL(
        file
      )
    );

    setProfileError("");
  }

  async function saveProfile() {
    if (
      !currentUserId ||
      savingProfile
    ) {
      return;
    }

    const name =
      profileName.trim();

    const username =
      profileUsername.trim();

    if (!name) {
      setProfileError(
        "Nama tidak boleh kosong."
      );
      return;
    }

    setSavingProfile(true);
    setProfileError("");

    try {
      let avatarUrl =
        profileAvatarUrl;

      if (selectedAvatarFile) {
        const extension =
          selectedAvatarFile.name
            .split(".")
            .pop()
            ?.toLowerCase() ||
          "jpg";

        const avatarPath =
          currentUserId +
          "/" +
          Date.now() +
          "." +
          extension;

        const {
          error:
            avatarUploadError,
        } = await supabase.storage
          .from("avatars")
          .upload(
            avatarPath,
            selectedAvatarFile,
            {
              contentType:
                selectedAvatarFile.type,
              upsert: false,
            }
          );

        if (
          avatarUploadError
        ) {
          throw new Error(
            "Upload avatar gagal: " +
              avatarUploadError.message
          );
        }

        const {
          data,
        } = supabase.storage
          .from("avatars")
          .getPublicUrl(
            avatarPath
          );

        avatarUrl =
          data.publicUrl;
      }

      const {
        data,
        error,
      } = await supabase
        .from("profiles")
        .update({
          full_name: name,
          username:
            username || null,
          avatar_url:
            avatarUrl,
        })
        .eq(
          "id",
          currentUserId
        )
        .select(
          "id, full_name, username, avatar_url"
        )
        .single();

      if (error) {
        throw new Error(
          error.message
        );
      }

      setProfile(
        data as Profile
      );

      setProfileModalOpen(
        false
      );
    } catch (error) {
      console.error(
        "Save profile error:",
        error
      );

      setProfileError(
        error instanceof Error
          ? error.message
          : "Profil gagal disimpan."
      );
    } finally {
      setSavingProfile(false);
    }
  }

  function handleTextareaKeyDown(
    event: KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      void sendMessage();
    }
  }

  function selectContact(
    user: Profile
  ) {
    void startChat(user);
  }

  function closeMobileChat() {
    setMobileChatOpen(false);
    setSelectedUser(null);
    setSelectedConversation(null);
    setMessages([]);
    setTypingUserIds(
      new Set()
    );
  }

  function getUserInitials(
    user: Profile | null
  ) {
    if (!user) {
      return "B";
    }

    const value =
      user.full_name ||
      user.username ||
      "B";

    return value
      .trim()
      .slice(0, 1)
      .toUpperCase();
  }

  function getContactLastTime(
    userId: string
  ) {
    const info =
      contactInfo[userId];

    if (!info?.lastMessageAt) {
      return "";
    }

    const date =
      new Date(
        info.lastMessageAt
      );

    return date.toLocaleTimeString(
      "id-ID",
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  const filteredUsers =
    users.filter((user) => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return true;
      }

      return (
        user.full_name
          .toLowerCase()
          .includes(query) ||
        (user.username || "")
          .toLowerCase()
          .includes(query)
      );
    });

  function renderAttachment(
    attachment: AttachmentData
  ) {
    if (
      attachment.type ===
      "image"
    ) {
      return (
        <a
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <img
            src={attachment.url}
            alt={attachment.name}
            className="max-h-[320px] max-w-full rounded-xl object-contain"
          />
        </a>
      );
    }

    if (
      attachment.type ===
      "video"
    ) {
      return (
        <video
          controls
          preload="metadata"
          className="max-h-[360px] max-w-full rounded-xl"
          src={attachment.url}
        >
          Browser Anda tidak mendukung video.
        </video>
      );
    }

    if (
      attachment.type ===
      "audio"
    ) {
      return (
        <div className="w-full min-w-[240px] max-w-[330px]">
          <audio
            controls
            preload="metadata"
            className="w-full"
            src={attachment.url}
          />
          <div className="mt-2 text-xs opacity-75">
            {attachment.name}
          </div>
        </div>
      );
    }

    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        download
        className="flex items-center gap-3 rounded-xl border border-white/20 bg-black/10 p-3"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 text-xl">
          📎
        </div>

        <div className="min-w-0">
          <div className="truncate font-semibold">
            {attachment.name}
          </div>

          <div className="text-xs opacity-70">
            {formatFileSize(
              attachment.size
            )}
          </div>
        </div>
      </a>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-16 w-16 animate-pulse">
            <BandaLogo />
          </div>

          <div className="text-sm text-slate-400">
            Membuka Banda Chat...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex h-screen overflow-hidden">
        {/* ======================================================
            SIDEBAR
        ====================================================== */}

        <aside
          className={[
            "flex w-full flex-col border-r border-slate-200 bg-white md:w-[350px] lg:w-[390px]",
            mobileChatOpen
              ? "hidden md:flex"
              : "flex",
          ].join(" ")}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 shrink-0">
                <BandaLogo />
              </div>

              <div>
                <div className="text-lg font-bold">
                  Banda Chat
                </div>

                <div className="text-xs text-slate-500">
                  Pesan pribadi
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={
                openProfileModal
              }
              className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-blue-600 font-bold text-white"
              title="Profil"
            >
              {profile?.avatar_url ? (
                <img
                  src={
                    profile.avatar_url
                  }
                  alt={
                    profile.full_name
                  }
                  className="h-full w-full object-cover"
                />
              ) : (
                getUserInitials(
                  profile
                )
              )}
            </button>
          </div>

          <div className="border-b border-slate-200 p-3">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                🔎
              </span>

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Cari teman..."
                className="w-full rounded-xl bg-slate-100 py-3 pl-10 pr-3 text-sm outline-none ring-blue-500 transition focus:ring-2"
              />
            </div>
          </div>

          {errorMessage && (
            <div className="mx-3 mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {errorMessage}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {loadingUsers ? (
              <div className="p-6 text-center text-sm text-slate-400">
                Memuat kontak...
              </div>
            ) : filteredUsers.length ===
              0 ? (
              <div className="p-8 text-center">
                <div className="text-4xl">
                  👥
                </div>

                <div className="mt-3 font-semibold text-slate-700">
                  Belum ada pengguna
                </div>

                <div className="mt-1 text-xs text-slate-400">
                  Pengguna lain akan muncul di sini.
                </div>
              </div>
            ) : (
              filteredUsers.map(
                (user) => {
                  const info =
                    contactInfo[
                      user.id
                    ];

                  const online =
                    onlineUserIds.has(
                      user.id
                    );

                  const selected =
                    selectedUser?.id ===
                    user.id;

                  return (
                    <button
                      type="button"
                      key={user.id}
                      onClick={() =>
                        selectContact(
                          user
                        )
                      }
                      disabled={
                        startingChat
                      }
                      className={[
                        "flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50",
                        selected
                          ? "bg-blue-50"
                          : "",
                      ].join(" ")}
                    >
                      <div className="relative h-12 w-12 shrink-0">
                        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-blue-600 font-bold text-white">
                          {user.avatar_url ? (
                            <img
                              src={
                                user.avatar_url
                              }
                              alt={
                                user.full_name
                              }
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            getUserInitials(
                              user
                            )
                          )}
                        </div>

                        <span
                          className={[
                            "absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white",
                            online
                              ? "bg-emerald-500"
                              : "bg-slate-300",
                          ].join(" ")}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate font-semibold">
                            {
                              user.full_name
                            }
                          </div>

                          <div className="shrink-0 text-[10px] text-slate-400">
                            {getContactLastTime(
                              user.id
                            )}
                          </div>
                        </div>

                        <div className="mt-1 flex items-center justify-between gap-2">
                          <div className="truncate text-xs text-slate-500">
                            {info?.lastMessage ||
                              (user.username
                                ? `@${user.username}`
                                : "Mulai percakapan")}
                          </div>

                          {info &&
                            info.unreadCount >
                              0 && (
                              <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-bold text-white">
                                {info.unreadCount >
                                99
                                  ? "99+"
                                  : info.unreadCount}
                              </span>
                            )}
                        </div>
                      </div>
                    </button>
                  );
                }
              )
            )}
          </div>
        </aside>

        {/* ======================================================
            CHAT
        ====================================================== */}

        <section
          className={[
            "relative flex min-w-0 flex-1 flex-col bg-slate-50",
            mobileChatOpen
              ? "flex"
              : "hidden md:flex",
          ].join(" ")}
        >
          {!selectedUser ||
          !selectedConversation ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <div className="h-24 w-24">
                <BandaLogo />
              </div>

              <h1 className="mt-5 text-2xl font-bold text-slate-800">
                Banda Chat
              </h1>

              <p className="mt-2 max-w-sm text-sm text-slate-500">
                Pilih kontak di sebelah kiri untuk mulai mengobrol.
              </p>
            </div>
          ) : (
            <>
              {/* HEADER */}

              <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 py-3 md:px-5">
                <button
                  type="button"
                  onClick={
                    closeMobileChat
                  }
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-slate-100 md:hidden"
                >
                  ←
                </button>

                <div className="relative h-11 w-11 shrink-0">
                  <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-blue-600 font-bold text-white">
                    {selectedUser.avatar_url ? (
                      <img
                        src={
                          selectedUser.avatar_url
                        }
                        alt={
                          selectedUser.full_name
                        }
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      getUserInitials(
                        selectedUser
                      )
                    )}
                  </div>

                  <span
                    className={[
                      "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white",
                      onlineUserIds.has(
                        selectedUser.id
                      )
                        ? "bg-emerald-500"
                        : "bg-slate-300",
                    ].join(" ")}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">
                    {
                      selectedUser.full_name
                    }
                  </div>

                  <div className="text-xs text-slate-500">
                    {typingUserIds.size >
                    0
                      ? "sedang mengetik..."
                      : onlineUserIds.has(
                          selectedUser.id
                        )
                      ? "online"
                      : selectedUser.username
                      ? `@${selectedUser.username}`
                      : "offline"}
                  </div>
                </div>
              </header>

              {/* ERROR */}

              {errorMessage && (
                <div className="absolute left-1/2 top-16 z-30 w-[calc(100%-32px)] max-w-lg -translate-x-1/2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 shadow-lg">
                  <div className="flex items-start justify-between gap-3">
                    <span>
                      {errorMessage}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setErrorMessage(
                          ""
                        )
                      }
                      className="font-bold"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}

              {/* MESSAGES */}

              <div className="flex-1 overflow-y-auto px-3 py-4 md:px-6">
                {loadingMessages ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-400">
                    Memuat pesan...
                  </div>
                ) : messages.length ===
                  0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <div className="text-4xl">
                      👋
                    </div>

                    <div className="mt-3 font-semibold text-slate-700">
                      Belum ada pesan
                    </div>

                    <div className="mt-1 text-xs text-slate-400">
                      Kirim pesan pertama Anda.
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map(
                      (message) => {
                        const mine =
                          message.sender_id ===
                          currentUserId;

                        const attachment =
                          parseAttachment(
                            message.content
                          );

                        const isEditing =
                          editingMessageId ===
                          message.id;

                        return (
                          <div
                            key={
                              message.id
                            }
                            className={[
                              "mb-3 flex",
                              mine
                                ? "justify-end"
                                : "justify-start",
                            ].join(" ")}
                          >
                            <div
                              className={[
                                "group relative max-w-[85%] md:max-w-[70%]",
                                mine
                                  ? "items-end"
                                  : "items-start",
                              ].join(" ")}
                            >
                              <div
                                className={[
                                  "relative rounded-2xl px-4 py-2.5 shadow-sm",
                                  mine
                                    ? "rounded-br-md bg-blue-600 text-white"
                                    : "rounded-bl-md bg-white text-slate-800",
                                ].join(" ")}
                              >
                                {attachment ? (
                                  <div className="min-w-[180px]">
                                    {renderAttachment(
                                      attachment
                                    )}

                                    <div
                                      className={[
                                        "mt-2 text-[10px]",
                                        mine
                                          ? "text-blue-100"
                                          : "text-slate-400",
                                      ].join(" ")}
                                    >
                                      {formatFileSize(
                                        attachment.size
                                      )}
                                    </div>
                                  </div>
                                ) : isEditing ? (
                                  <div className="min-w-[220px]">
                                    <textarea
                                      value={
                                        editingMessageText
                                      }
                                      onChange={(
                                        event
                                      ) =>
                                        setEditingMessageText(
                                          event
                                            .target
                                            .value
                                        )
                                      }
                                      autoFocus
                                      className="w-full resize-none rounded-xl border border-white/30 bg-white/10 p-2 text-sm text-current outline-none"
                                      rows={3}
                                    />

                                    <div className="mt-2 flex justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={
                                          cancelEditMessage
                                        }
                                        className="rounded-lg bg-black/10 px-3 py-1.5 text-xs"
                                      >
                                        Batal
                                      </button>

                                      <button
                                        type="button"
                                        disabled={
                                          savingEdit
                                        }
                                        onClick={() =>
                                          void saveEditMessage()
                                        }
                                        className="rounded-lg bg-white/20 px-3 py-1.5 text-xs font-semibold"
                                      >
                                        {savingEdit
                                          ? "Menyimpan..."
                                          : "Simpan"}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                                    {
                                      message.content
                                    }
                                  </div>
                                )}

                                <div
                                  className={[
                                    "mt-1 flex items-center justify-end gap-1 text-[9px]",
                                    mine
                                      ? "text-blue-100"
                                      : "text-slate-400",
                                  ].join(" ")}
                                >
                                  {message.updated_at &&
                                  new Date(
                                    message.updated_at
                                  ).getTime() >
                                    new Date(
                                      message.created_at
                                    ).getTime()
                                    ? "diedit · "
                                    : ""}

                                  {new Date(
                                    message.created_at
                                  ).toLocaleTimeString(
                                    "id-ID",
                                    {
                                      hour: "2-digit",
                                      minute:
                                        "2-digit",
                                    }
                                  )}

                                  {mine && (
                                    <span
                                      className={
                                        message.read_at
                                          ? "text-cyan-200"
                                          : ""
                                      }
                                    >
                                      {message.read_at
                                        ? "✓✓"
                                        : "✓"}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {mine &&
                                !isEditing && (
                                  <div className="absolute right-1 top-1 hidden -translate-y-full group-hover:block">
                                    <div className="relative">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setOpenMessageMenuId(
                                            openMessageMenuId ===
                                              message.id
                                              ? null
                                              : message.id
                                          )
                                        }
                                        className="rounded-full bg-white px-2 py-1 text-xs shadow"
                                      >
                                        ⋮
                                      </button>

                                      {openMessageMenuId ===
                                        message.id && (
                                        <div className="absolute right-0 z-40 mt-1 w-32 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-xs text-slate-700 shadow-xl">
                                          {!attachment && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                beginEditMessage(
                                                  message
                                                )
                                              }
                                              className="block w-full px-3 py-2 text-left hover:bg-slate-50"
                                            >
                                              ✏️ Edit
                                            </button>
                                          )}

                                          <button
                                            type="button"
                                            disabled={
                                              deletingMessageId ===
                                              message.id
                                            }
                                            onClick={() =>
                                              void deleteMessage(
                                                message.id
                                              )
                                            }
                                            className="block w-full px-3 py-2 text-left text-red-600 hover:bg-red-50"
                                          >
                                            {deletingMessageId ===
                                            message.id
                                              ? "Menghapus..."
                                              : "🗑️ Hapus"}
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                            </div>
                          </div>
                        );
                      }
                    )}

                    {typingUserIds.size >
                      0 && (
                      <div className="mb-3 flex justify-start">
                        <div className="rounded-2xl rounded-bl-md bg-white px-4 py-3 text-xs text-slate-400 shadow-sm">
                          sedang mengetik...
                        </div>
                      </div>
                    )}

                    <div
                      ref={
                        messagesEndRef
                      }
                    />
                  </>
                )}
              </div>

              {/* ATTACHMENT PREVIEW */}

              {pendingAttachment && (
                <div className="border-t border-slate-200 bg-white px-3 py-3 md:px-5">
                  <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <button
                      type="button"
                      onClick={
                        cancelPendingAttachment
                      }
                      disabled={
                        uploadingAttachment
                      }
                      className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white"
                    >
                      ×
                    </button>

                    <div className="flex items-center gap-3">
                      {pendingAttachment.type ===
                      "image" ? (
                        <img
                          src={
                            pendingAttachment.previewUrl ||
                            ""
                          }
                          alt={
                            pendingAttachment
                              .file
                              .name
                          }
                          className="h-20 w-20 rounded-xl object-cover"
                        />
                      ) : pendingAttachment.type ===
                        "video" ? (
                        <video
                          src={
                            pendingAttachment.previewUrl ||
                            ""
                          }
                          className="h-20 w-20 rounded-xl object-cover"
                          muted
                        />
                      ) : pendingAttachment.type ===
                        "audio" ? (
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-3xl">
                          🎵
                        </div>
                      ) : (
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-3xl">
                          📎
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-slate-800">
                          {
                            pendingAttachment
                              .file
                              .name
                          }
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          {formatFileSize(
                            pendingAttachment
                              .file
                              .size
                          )}
                        </div>

                        {pendingAttachment.type ===
                          "audio" && (
                          <audio
                            controls
                            src={
                              pendingAttachment.previewUrl ||
                              ""
                            }
                            className="mt-2 h-9 w-full max-w-[300px]"
                          />
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={
                          uploadingAttachment
                        }
                        onClick={() =>
                          void sendPendingAttachment()
                        }
                        className="shrink-0 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {uploadingAttachment
                          ? "Mengirim..."
                          : "Kirim"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* INPUT */}

              <div className="border-t border-slate-200 bg-white px-3 py-3 md:px-5">
                <div className="relative">
                  {attachmentMenuOpen && (
                    <div className="absolute bottom-14 left-0 z-50 w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                      <button
                        type="button"
                        onClick={() =>
                          openAttachmentPicker(
                            "image"
                          )
                        }
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm hover:bg-slate-50"
                      >
                        <span className="text-xl">
                          🖼️
                        </span>
                        <span>
                          Foto / Gambar
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          openAttachmentPicker(
                            "video"
                          )
                        }
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm hover:bg-slate-50"
                      >
                        <span className="text-xl">
                          🎥
                        </span>
                        <span>
                          Video
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          openAttachmentPicker(
                            "audio"
                          )
                        }
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm hover:bg-slate-50"
                      >
                        <span className="text-xl">
                          🎵
                        </span>
                        <span>
                          Audio
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          openAttachmentPicker(
                            "file"
                          )
                        }
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm hover:bg-slate-50"
                      >
                        <span className="text-xl">
                          📎
                        </span>
                        <span>
                          Dokumen / File
                        </span>
                      </button>
                    </div>
                  )}

                  <div className="flex items-end gap-2 rounded-2xl bg-slate-100 p-2">
                    <button
                      type="button"
                      onClick={() =>
                        setAttachmentMenuOpen(
                          (previous) =>
                            !previous
                        )
                      }
                      disabled={
                        recordingVoice ||
                        uploadingAttachment
                      }
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl hover:bg-white disabled:opacity-40"
                      title="Lampiran"
                    >
                      ＋
                    </button>

                    <textarea
                      value={
                        messageText
                      }
                      onChange={(
                        event
                      ) =>
                        handleMessageChange(
                          event.target
                            .value
                        )
                      }
                      onKeyDown={
                        handleTextareaKeyDown
                      }
                      placeholder={
                        recordingVoice
                          ? "Sedang merekam..."
                          : "Tulis pesan..."
                      }
                      disabled={
                        recordingVoice ||
                        uploadingAttachment ||
                        sendingMessage
                      }
                      rows={1}
                      className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-slate-400"
                    />

                    {recordingVoice ? (
                      <button
                        type="button"
                        onClick={
                          stopVoiceRecording
                        }
                        className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-red-500 px-3 text-sm font-semibold text-white"
                      >
                        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
                        {
                          formatRecordingTime(
                            recordingSeconds
                          )
                        }
                      </button>
                    ) : messageText.trim() ? (
                      <button
                        type="button"
                        disabled={
                          sendingMessage
                        }
                        onClick={() =>
                          void sendMessage()
                        }
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white disabled:opacity-50"
                      >
                        ➤
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={
                          uploadingAttachment
                        }
                        onClick={() =>
                          void startVoiceRecording()
                        }
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-xl text-white disabled:opacity-50"
                        title="Rekam suara"
                      >
                        🎙️
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-1 text-center text-[10px] text-slate-400">
                  Enter untuk mengirim · Shift + Enter untuk baris baru
                </div>
              </div>

              {/* HIDDEN FILE INPUTS */}

              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) =>
                  handleAttachmentFile(
                    event,
                    "image"
                  )
                }
              />

              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(event) =>
                  handleAttachmentFile(
                    event,
                    "video"
                  )
                }
              />

              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(event) =>
                  handleAttachmentFile(
                    event,
                    "audio"
                  )
                }
              />

              <input
                ref={documentInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.7z,.csv,.epub"
                className="hidden"
                onChange={(event) =>
                  handleAttachmentFile(
                    event,
                    "file"
                  )
                }
              />
            </>
          )}
        </section>
      </div>

      {/* ========================================================
          PROFILE MODAL
      ======================================================== */}

      {profileModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-bold">
                  Profil Saya
                </h2>

                <p className="text-xs text-slate-500">
                  Ubah informasi akun Anda
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setProfileModalOpen(
                    false
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xl"
              >
                ×
              </button>
            </div>

            <div className="p-5">
              <div className="flex justify-center">
                <label className="relative cursor-pointer">
                  <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-blue-600 text-4xl font-bold text-white">
                    {avatarPreview ||
                    profileAvatarUrl ? (
                      <img
                        src={
                          avatarPreview ||
                          profileAvatarUrl ||
                          ""
                        }
                        alt="Avatar"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      getUserInitials(
                        profile
                      )
                    )}
                  </div>

                  <span className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white shadow">
                    📷
                  </span>

                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={
                      handleAvatarChange
                    }
                  />
                </label>
              </div>

              {profileError && (
                <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-600">
                  {profileError}
                </div>
              )}

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Nama
                  </label>

                  <input
                    value={
                      profileName
                    }
                    onChange={(event) =>
                      setProfileName(
                        event.target
                          .value
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Username
                  </label>

                  <input
                    value={
                      profileUsername
                    }
                    onChange={(event) =>
                      setProfileUsername(
                        event.target
                          .value
                      )
                    }
                    placeholder="username"
                    className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setProfileModalOpen(
                      false
                    )
                  }
                  className="flex-1 rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700"
                >
                  Batal
                </button>

                <button
                  type="button"
                  disabled={
                    savingProfile
                  }
                  onClick={() =>
                    void saveProfile()
                  }
                  className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {savingProfile
                    ? "Menyimpan..."
                    : "Simpan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}