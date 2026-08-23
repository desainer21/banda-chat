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

/* ============================================================
   ATTACHMENT
   Metadata disimpan di kolom content agar tidak perlu
   mengubah struktur tabel messages yang sudah berhasil.
   ============================================================ */

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

  /* ============================================================
     MESSAGE MENU
     ============================================================ */

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

  /* ============================================================
     PROFILE MODAL
     ============================================================ */

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

  const [
    avatarPreview,
    setAvatarPreview,
  ] = useState<string | null>(null);

  const [savingProfile, setSavingProfile] =
    useState(false);

  const [profileError, setProfileError] =
    useState("");

  /* ============================================================
     ATTACHMENT
     ============================================================ */

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

  const [
    recordingVoice,
    setRecordingVoice,
  ] = useState(false);

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

  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    selectedConversationIdRef.current =
      selectedConversation?.id || null;
  }, [selectedConversation]);

  /* ============================================================
     AUTH + INITIAL CHAT
     ============================================================ */

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

  /* ============================================================
     USERS
     ============================================================ */

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

  /* ============================================================
     CONTACT INFO
     ============================================================ */

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

          existing.unreadCount += unreadCount;

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

  /* ============================================================
     PRESENCE
     ============================================================ */

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

    presenceChannelRef.current =
      channel;

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

  /* ============================================================
     TYPING
     ============================================================ */

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
      if (
        sendTypingTimerRef.current
      ) {
        clearTimeout(
          sendTypingTimerRef.current
        );
      }

      void channel.send({
        type: "broadcast",
        event: "typing",
        payload: {
          user_id: currentUserId,
          conversation_id:
            selectedConversation.id,
          is_typing: false,
        },
      });
    }
  }

  /* ============================================================
     START CHAT
     ============================================================ */

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

      setMobileChatOpen(
        true
      );
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

  /* ============================================================
     LOAD MESSAGES
     ============================================================ */

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

      setMessages(
        data || []
      );

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

  /* ============================================================
     REALTIME ALL MESSAGES
     ============================================================ */

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

  /* ============================================================
     REALTIME ACTIVE CONVERSATION
     ============================================================ */

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

  /* ============================================================
     SCROLL
     ============================================================ */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [
    messages,
    typingUserIds,
  ]);

  /* ============================================================
     SEND MESSAGE
     ============================================================ */

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

  /* ============================================================
     ATTACHMENT HELPERS
     ============================================================ */

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
      1024 * 1024 * 1024
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

    let previewUrl: string | null =
      null;

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
    const extension =
      file.name
        .split(".")
        .pop()
        ?.toLowerCase() ||
      "bin";

    const safeName =
      file.name
        .replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        )
        .slice(0, 120);

    const filePath =
      userId +
      "/" +
      conversationId +
      "/" +
      Date.now() +
      "-" +
      safeName +
      "." +
      extension;

    const {
      error: uploadError,
    } =
      await supabase.storage
        .from(
          "chat-attachments"
        )
        .upload(
          filePath,
          file,
          {
            cacheControl:
              "3600",
            upsert: false,
            contentType:
              file.type ||
              "application/octet-stream",
          }
        );

    if (uploadError) {
      throw new Error(
        "Upload lampiran gagal: " +
          uploadError.message
      );
    }

    const {
      data,
    } =
      supabase.storage
        .from(
          "chat-attachments"
        )
        .getPublicUrl(
          filePath
        );

    if (
      !data.publicUrl
    ) {
      throw new Error(
        "URL lampiran tidak ditemukan."
      );
    }

    return data.publicUrl;
  }

  async function sendAttachment() {
    if (
      !pendingAttachment ||
      !selectedConversation ||
      !currentUserId
    ) {
      return;
    }

    if (
      uploadingAttachment
    ) {
      return;
    }

    setUploadingAttachment(
      true
    );
    setErrorMessage("");

    try {
      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      if (!session?.user) {
        router.replace(
          "/login"
        );
        return;
      }

      const senderId =
        session.user.id;

      const url =
        await uploadChatAttachment(
          pendingAttachment.file,
          senderId,
          selectedConversation.id
        );

      const attachment:
        AttachmentData = {
        __banda_attachment:
          true,
        type:
          pendingAttachment.type,
        url,
        name:
          pendingAttachment.file
            .name,
        size:
          pendingAttachment.file
            .size,
        mime:
          pendingAttachment.file
            .type ||
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
            senderId,
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

      cancelPendingAttachment();

      await loadContactInfo(
        senderId
      );
    } catch (error) {
      console.error(
        "Send attachment error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Lampiran gagal dikirim."
      );
    } finally {
      setUploadingAttachment(
        false
      );
    }
  }

  async function startVoiceRecording() {
    if (
      recordingVoice ||
      uploadingAttachment
    ) {
      return;
    }

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setErrorMessage(
        "Browser ini tidak mendukung rekaman suara."
      );
      return;
    }

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            audio: true,
          }
        );

      let mimeType = "";

      const possibleTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
      ];

      for (
        const type of possibleTypes
      ) {
        if (
          MediaRecorder.isTypeSupported(
            type
          )
        ) {
          mimeType = type;
          break;
        }
      }

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
        () => {
          const actualType =
            recorder.mimeType ||
            "audio/webm";

          const extension =
            actualType.includes(
              "mp4"
            )
              ? "m4a"
              : "webm";

          const blob =
            new Blob(
              chunks,
              {
                type:
                  actualType,
              }
            );

          const file =
            new File(
              [
                blob,
              ],
              `rekaman-${Date.now()}.${extension}`,
              {
                type:
                  actualType,
              }
            );

          const previewUrl =
            URL.createObjectURL(
              file
            );

          setPendingAttachment({
            file,
            type: "audio",
            previewUrl,
          });

          stream
            .getTracks()
            .forEach(
              (track) =>
                track.stop()
            );

          mediaRecorderRef.current =
            null;
          setRecordingVoice(
            false
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
        };

      recorder.start();

      setRecordingSeconds(
        0
      );
      setRecordingVoice(
        true
      );
      setAttachmentMenuOpen(
        false
      );

      recordingTimerRef.current =
        setInterval(() => {
          setRecordingSeconds(
            (previous) =>
              previous + 1
          );
        }, 1000);
    } catch (error) {
      console.error(
        "Start recording error:",
        error
      );

      setErrorMessage(
        "Microphone tidak dapat digunakan. Pastikan izin microphone diberikan."
      );
    }
  }

  function stopVoiceRecording() {
    const current =
      mediaRecorderRef.current;

    if (!current) {
      return;
    }

    if (
      current.recorder.state !==
      "inactive"
    ) {
      current.recorder.stop();
    }

    if (
      recordingTimerRef.current
    ) {
      clearInterval(
        recordingTimerRef.current
      );

      recordingTimerRef.current =
        null;
    }
  }

  function formatRecordingTime(
    seconds: number
  ) {
    const minutes =
      Math.floor(
        seconds / 60
      );

    const remaining =
      seconds % 60;

    return (
      String(minutes).padStart(
        2,
        "0"
      ) +
      ":" +
      String(
        remaining
      ).padStart(2, "0")
    );
  }

  /* ============================================================
     ATTACHMENT RENDER
     ============================================================ */

  function renderAttachment(
    attachment: AttachmentData,
    isMine: boolean
  ) {
    if (
      attachment.type ===
      "image"
    ) {
      return (
        <a
          href={
            attachment.url
          }
          target="_blank"
          rel="noopener noreferrer"
          className="block overflow-hidden rounded-xl"
          onClick={(event) =>
            event.stopPropagation()
          }
        >
          <img
            src={
              attachment.url
            }
            alt={
              attachment.name
            }
            className="max-h-[360px] w-full max-w-[300px] rounded-xl object-cover"
          />

          <div
            className={`mt-2 text-xs ${
              isMine
                ? "text-blue-100"
                : "text-slate-400"
            }`}
          >
            {attachment.name}
          </div>
        </a>
      );
    }

    if (
      attachment.type ===
      "video"
    ) {
      return (
        <div>
          <video
            src={
              attachment.url
            }
            controls
            playsInline
            className="max-h-[360px] w-full max-w-[340px] rounded-xl"
          />

          <p
            className={`mt-2 text-xs ${
              isMine
                ? "text-blue-100"
                : "text-slate-400"
            }`}
          >
            {attachment.name}
          </p>
        </div>
      );
    }

    if (
      attachment.type ===
      "audio"
    ) {
      return (
        <div className="min-w-[230px]">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xl">
              🎵
            </span>

            <div className="min-w-0">
              <p
                className={`truncate text-xs font-semibold ${
                  isMine
                    ? "text-white"
                    : "text-slate-700"
                }`}
              >
                {attachment.name}
              </p>

              <p
                className={`text-[10px] ${
                  isMine
                    ? "text-blue-100"
                    : "text-slate-400"
                }`}
              >
                {formatFileSize(
                  attachment.size
                )}
              </p>
            </div>
          </div>

          <audio
            src={
              attachment.url
            }
            controls
            className="w-full"
          />
        </div>
      );
    }

    return (
      <a
        href={
          attachment.url
        }
        target="_blank"
        rel="noopener noreferrer"
        download={
          attachment.name
        }
        className={`flex min-w-[220px] items-center gap-3 rounded-xl p-3 transition ${
          isMine
            ? "bg-blue-700/70 hover:bg-blue-700"
            : "bg-slate-50 hover:bg-slate-100"
        }`}
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-xl">
          📄
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-sm font-semibold ${
              isMine
                ? "text-white"
                : "text-slate-700"
            }`}
          >
            {attachment.name}
          </p>

          <p
            className={`mt-1 text-[10px] ${
              isMine
                ? "text-blue-100"
                : "text-slate-400"
            }`}
          >
            {formatFileSize(
              attachment.size
            )}
          </p>
        </div>

        <span
          className={
            isMine
              ? "text-white"
              : "text-blue-600"
          }
        >
          ↓
        </span>
      </a>
    );
  }

  /* ============================================================
     COPY MESSAGE
     ============================================================ */

  async function copyMessage(
    content: string
  ) {
    try {
      const attachment =
        parseAttachment(
          content
        );

      const textToCopy =
        attachment
          ? attachment.url
          : content;

      await navigator.clipboard.writeText(
        textToCopy
      );

      setOpenMessageMenuId(
        null
      );
    } catch (error) {
      console.error(
        "Copy message error:",
        error
      );

      setErrorMessage(
        "Pesan tidak dapat disalin."
      );
    }
  }

  /* ============================================================
     START EDIT MESSAGE
     ============================================================ */

  function startEditMessage(
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
      setOpenMessageMenuId(
        null
      );

      setErrorMessage(
        "Lampiran tidak dapat diedit."
      );

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

  /* ============================================================
     CANCEL EDIT
     ============================================================ */

  function cancelEditMessage() {
    setEditingMessageId(
      null
    );

    setEditingMessageText(
      ""
    );
  }

  /* ============================================================
     SAVE EDIT MESSAGE
     ============================================================ */

  async function saveEditMessage(
    messageId: string
  ) {
    const content =
      editingMessageText.trim();

    if (!content) {
      setErrorMessage(
        "Pesan tidak boleh kosong."
      );
      return;
    }

    if (
      !currentUserId ||
      savingEdit
    ) {
      return;
    }

    setSavingEdit(true);
    setErrorMessage("");

    try {
      const {
        data,
        error,
      } = await supabase
        .from("messages")
        .update({
          content,
        })
        .eq(
          "id",
          messageId
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
                messageId
                  ? data
                  : message
            )
        );
      }

      cancelEditMessage();

      await loadContactInfo(
        currentUserId
      );
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

  /* ============================================================
     DELETE MESSAGE
     ============================================================ */

  async function deleteMessage(
    message: Message
  ) {
    if (
      message.sender_id !==
      currentUserId
    ) {
      return;
    }

    if (
      deletingMessageId
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Hapus pesan ini?"
      );

    if (!confirmed) {
      setOpenMessageMenuId(
        null
      );
      return;
    }

    setDeletingMessageId(
      message.id
    );

    setOpenMessageMenuId(
      null
    );

    setErrorMessage("");

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
          message.id
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
              message.id
          )
      );

      /*
       * Pesan dihapus terlebih dahulu.
       * File Storage sengaja tidak langsung dihapus agar
       * tidak gagal hanya karena policy Storage berbeda.
       */
      void attachment;

      await loadContactInfo(
        currentUserId
      );
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

  /* ============================================================
     MESSAGE KEYBOARD
     ============================================================ */

  function handleMessageKeyDown(
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

  function handleEditKeyDown(
    event: KeyboardEvent<HTMLTextAreaElement>,
    messageId: string
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      void saveEditMessage(
        messageId
      );
    }

    if (
      event.key === "Escape"
    ) {
      event.preventDefault();
      cancelEditMessage();
    }
  }

  /* ============================================================
     PROFILE
     ============================================================ */

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

    setAvatarPreview(
      profile.avatar_url
    );

    setProfileError("");

    setProfileModalOpen(
      true
    );
  }

  function closeProfileModal() {
    if (savingProfile) {
      return;
    }

    if (
      avatarPreview &&
      avatarPreview.startsWith(
        "blob:"
      )
    ) {
      URL.revokeObjectURL(
        avatarPreview
      );
    }

    setProfileModalOpen(
      false
    );

    setSelectedAvatarFile(
      null
    );

    setAvatarPreview(
      profileAvatarUrl
    );

    setProfileError("");
  }

  function handleAvatarChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    setProfileError("");

    if (
      file.size >
      5 * 1024 * 1024
    ) {
      setProfileError(
        "Ukuran foto maksimal 5 MB."
      );

      event.target.value =
        "";
      return;
    }

    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      setProfileError(
        "File harus berupa gambar."
      );

      event.target.value =
        "";
      return;
    }

    if (
      avatarPreview &&
      avatarPreview.startsWith(
        "blob:"
      )
    ) {
      URL.revokeObjectURL(
        avatarPreview
      );
    }

    const preview =
      URL.createObjectURL(
        file
      );

    setSelectedAvatarFile(
      file
    );

    setAvatarPreview(
      preview
    );
  }

  async function uploadAvatar(
    file: File,
    userId: string
  ) {
    const extension =
      file.name
        .split(".")
        .pop()
        ?.toLowerCase() ||
      "jpg";

    const filePath =
      userId +
      "/avatar-" +
      Date.now() +
      "." +
      extension;

    const {
      error: uploadError,
    } =
      await supabase.storage
        .from("avatars")
        .upload(
          filePath,
          file,
          {
            cacheControl:
              "3600",
            upsert: false,
          }
        );

    if (uploadError) {
      throw new Error(
        "Upload foto gagal: " +
          uploadError.message
      );
    }

    const {
      data,
    } =
      supabase.storage
        .from("avatars")
        .getPublicUrl(
          filePath
        );

    if (
      !data.publicUrl
    ) {
      throw new Error(
        "URL foto profil tidak ditemukan."
      );
    }

    return data.publicUrl;
  }

  async function saveProfile() {
    if (
      !profile ||
      savingProfile
    ) {
      return;
    }

    const cleanName =
      profileName.trim();

    const cleanUsername =
      profileUsername
        .trim()
        .toLowerCase();

    if (!cleanName) {
      setProfileError(
        "Nama lengkap harus diisi."
      );
      return;
    }

    if (!cleanUsername) {
      setProfileError(
        "Username harus diisi."
      );
      return;
    }

    setSavingProfile(true);
    setProfileError("");

    try {
      if (
        cleanUsername !==
        (
          profile.username ||
          ""
        ).toLowerCase()
      ) {
        const {
          data: existingUsername,
          error: usernameError,
        } =
          await supabase
            .from("profiles")
            .select("id")
            .eq(
              "username",
              cleanUsername
            )
            .neq(
              "id",
              profile.id
            )
            .maybeSingle();

        if (usernameError) {
          throw new Error(
            usernameError.message
          );
        }

        if (
          existingUsername
        ) {
          throw new Error(
            "Username sudah digunakan."
          );
        }
      }

      let avatarUrl =
        profile.avatar_url;

      if (
        selectedAvatarFile
      ) {
        avatarUrl =
          await uploadAvatar(
            selectedAvatarFile,
            profile.id
          );
      }

      const {
        data: updatedProfile,
        error,
      } =
        await supabase
          .from("profiles")
          .update({
            full_name:
              cleanName,
            username:
              cleanUsername,
            avatar_url:
              avatarUrl,
          })
          .eq(
            "id",
            profile.id
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

      if (
        updatedProfile
      ) {
        setProfile(
          updatedProfile
        );

        setProfileName(
          updatedProfile.full_name
        );

        setProfileUsername(
          updatedProfile.username ||
            ""
        );

        setProfileAvatarUrl(
          updatedProfile.avatar_url
        );

        setAvatarPreview(
          updatedProfile.avatar_url
        );

        setUsers(
          (previous) =>
            previous.map(
              (user) =>
                user.id ===
                updatedProfile.id
                  ? updatedProfile
                  : user
            )
        );
      }

      setSelectedAvatarFile(
        null
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
          : "Profil gagal diperbarui."
      );
    } finally {
      setSavingProfile(false);
    }
  }

  /* ============================================================
     FORMAT
     ============================================================ */

  function formatTime(
    dateString: string | null
  ) {
    if (!dateString) {
      return "";
    }

    return new Date(
      dateString
    ).toLocaleTimeString(
      "id-ID",
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  function formatContactTime(
    dateString: string | null
  ) {
    if (!dateString) {
      return "";
    }

    const date =
      new Date(dateString);

    const now =
      new Date();

    const isToday =
      date.getDate() ===
        now.getDate() &&
      date.getMonth() ===
        now.getMonth() &&
      date.getFullYear() ===
        now.getFullYear();

    if (isToday) {
      return formatTime(
        dateString
      );
    }

    return date.toLocaleDateString(
      "id-ID",
      {
        day: "2-digit",
        month: "2-digit",
      }
    );
  }

  function getInitial(
    name: string
  ) {
    return (
      name
        ?.charAt(0)
        .toUpperCase() ||
      "B"
    );
  }

  function isUserOnline(
    userId:
      | string
      | undefined
  ) {
    if (!userId) {
      return false;
    }

    return onlineUserIds.has(
      userId
    );
  }

  function isUserTyping(
    userId:
      | string
      | undefined
  ) {
    if (!userId) {
      return false;
    }

    return typingUserIds.has(
      userId
    );
  }

  const filteredUsers =
    users.filter(
      (user) => {
        const keyword =
          search
            .trim()
            .toLowerCase();

        if (!keyword) {
          return true;
        }

        return (
          user.full_name
            .toLowerCase()
            .includes(
              keyword
            ) ||
          user.username
            ?.toLowerCase()
            .includes(
              keyword
            )
        );
      }
    );

  /* ============================================================
     LOGOUT
     ============================================================ */

  async function handleLogout() {
    if (
      selectedConversation &&
      currentUserId
    ) {
      stopTypingBroadcast();
    }

    try {
      if (
        presenceChannelRef.current
      ) {
        await presenceChannelRef.current.untrack();
      }
    } catch (error) {
      console.error(
        "Presence untrack error:",
        error
      );
    }

    if (recordingVoice) {
      stopVoiceRecording();
    }

    const {
      error,
    } =
      await supabase.auth.signOut();

    if (error) {
      setErrorMessage(
        "Gagal keluar: " +
          error.message
      );
      return;
    }

    setOnlineUserIds(
      new Set()
    );

    router.replace(
      "/login"
    );
  }

  function handleMobileBack() {
    setMobileChatOpen(
      false
    );
  }

  /* ============================================================
     LOADING

     TIDAK ADA LOGO DI SINI.
     ============================================================ */

  if (loading) {
    return (
      <main className="flex min-h-[100dvh] h-[100dvh] items-center justify-center overflow-hidden bg-gradient-to-br from-blue-50 via-white to-sky-100">
        <div className="text-center">
          <div className="mx-auto mb-5 h-9 w-9 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />

          <p className="text-sm font-medium text-slate-500">
            Membuka Banda Chat...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      className="flex min-h-[100dvh] h-[100dvh] flex-col overflow-hidden bg-gradient-to-br from-blue-50 via-white to-sky-100 text-slate-900"
      onClick={() => {
        if (
          openMessageMenuId
        ) {
          setOpenMessageMenuId(
            null
          );
        }

        if (
          attachmentMenuOpen
        ) {
          setAttachmentMenuOpen(
            false
          );
        }
      }}
    >
      {/* ========================================================
          HEADER
          ======================================================== */}

      <header className="z-20 shrink-0 border-b border-blue-100 bg-blue-600 shadow-sm">
        <div className="mx-auto flex h-[68px] w-full max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <BandaLogo
              size={42}
            />

            <div>
              <h1 className="text-lg font-bold text-white">
                Banda Chat
              </h1>

              <p className="text-xs text-blue-100">
                Chat modern dan realtime
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* PROFILE */}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                openProfileModal();
              }}
              className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-white/10"
              title="Edit profile"
            >
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold text-white">
                  {profile?.full_name}
                </p>

                {profile?.username && (
                  <p className="text-xs text-blue-100">
                    @
                    {
                      profile.username
                    }
                  </p>
                )}
              </div>

              {profile?.avatar_url ? (
                <img
                  src={
                    profile.avatar_url
                  }
                  alt={
                    profile.full_name
                  }
                  className="h-10 w-10 rounded-full border-2 border-white/70 object-cover shadow-sm"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/70 bg-green-500 font-bold text-white">
                  {getInitial(
                    profile?.full_name ||
                      "B"
                  )}
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={
                handleLogout
              }
              className="rounded-xl px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================
          AREA APLIKASI
          ======================================================== */}

      <div className="min-h-0 flex-1 overflow-hidden p-0 md:p-3 lg:p-4">
        <div className="mx-auto flex h-full w-full max-w-7xl min-h-0 overflow-hidden bg-white shadow-none md:rounded-2xl md:shadow-xl md:shadow-blue-100/70">
          {/* ====================================================
              SIDEBAR
              ==================================================== */}

          <aside
            className={`h-full min-h-0 w-full flex-col border-r border-slate-100 bg-white md:flex md:w-80 md:shrink-0 ${
              mobileChatOpen
                ? "hidden"
                : "flex"
            }`}
          >
            <div className="shrink-0 border-b border-slate-100 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Percakapan
                  </h2>

                  <p className="mt-1 text-xs text-slate-400">
                    Pilih kontak untuk mulai chat
                  </p>
                </div>

                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-lg">
                  💬
                </div>
              </div>

              <div className="relative mt-4">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                  🔍
                </span>

                <input
                  type="text"
                  placeholder="Cari pengguna..."
                  value={search}
                  onChange={(
                    event
                  ) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50/60 p-3">
              <div className="mb-3 flex items-center justify-between px-1">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Kontak Banda Chat
                </h3>

                <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-600">
                  {users.length}
                </span>
              </div>

              {loadingUsers ? (
                <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
                  <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />

                  <p className="text-sm text-slate-500">
                    Memuat pengguna...
                  </p>
                </div>
              ) : filteredUsers.length ===
                0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-2xl">
                    👥
                  </div>

                  <p className="mt-3 text-sm font-semibold text-slate-700">
                    Belum ada pengguna lain
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    Daftar pengguna akan
                    muncul di sini.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredUsers.map(
                    (user) => {
                      const info =
                        contactInfo[
                          user.id
                        ];

                      const isSelected =
                        selectedUser?.id ===
                        user.id;

                      const userOnline =
                        isUserOnline(
                          user.id
                        );

                      return (
                        <button
                          key={
                            user.id
                          }
                          type="button"
                          onClick={() =>
                            void startChat(
                              user
                            )
                          }
                          disabled={
                            startingChat
                          }
                          className={`w-full rounded-2xl border p-3 text-left transition ${
                            isSelected
                              ? "border-blue-200 bg-blue-50 shadow-sm"
                              : "border-slate-100 bg-white hover:border-blue-100 hover:bg-blue-50/50 hover:shadow-sm"
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="relative shrink-0">
                              {user.avatar_url ? (
                                <img
                                  src={
                                    user.avatar_url
                                  }
                                  alt={
                                    user.full_name
                                  }
                                  className="h-11 w-11 rounded-full object-cover"
                                />
                              ) : (
                                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 font-bold text-white shadow-sm">
                                  {getInitial(
                                    user.full_name
                                  )}
                                </div>
                              )}

                              {userOnline && (
                                <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-500" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="truncate text-sm font-semibold text-slate-800">
                                  {
                                    user.full_name
                                  }
                                </p>

                                <div className="flex shrink-0 items-center gap-2">
                                  {info?.lastMessageAt && (
                                    <span className="text-[10px] text-slate-400">
                                      {formatContactTime(
                                        info.lastMessageAt
                                      )}
                                    </span>
                                  )}

                                  {info &&
                                    info.unreadCount >
                                      0 && (
                                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-green-500 px-1 text-[10px] font-bold text-white shadow-sm">
                                        {info.unreadCount >
                                        99
                                          ? "99+"
                                          : info.unreadCount}
                                      </span>
                                    )}
                                </div>
                              </div>

                              <p className="mt-1 truncate text-xs text-slate-400">
                                {info?.lastMessage
                                  ? info.lastMessage
                                  : user.username
                                  ? "@" +
                                    user.username
                                  : "Belum ada pesan"}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>
              )}
            </div>
          </aside>

          {/* ====================================================
              CHAT
              ==================================================== */}

          <section
            className={`h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 ${
              mobileChatOpen
                ? "flex"
                : "hidden"
            } md:flex`}
          >
            {!selectedConversation ? (
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
                <div className="max-w-md px-6 text-center">
                  <div className="mx-auto flex justify-center">
                    <BandaLogo
                      size={90}
                    />
                  </div>

                  <h2 className="mt-6 text-2xl font-bold text-slate-800">
                    Pilih kontak untuk mulai
                    chat
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    Setiap akun hanya muncul
                    satu kali. Klik kontak untuk
                    membuka atau melanjutkan
                    percakapan sebelumnya.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* CHAT HEADER */}

                <div className="shrink-0 border-b border-slate-100 bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:px-5 sm:py-4">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={
                        handleMobileBack
                      }
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 md:hidden"
                      aria-label="Kembali ke daftar kontak"
                    >
                      ←
                    </button>

                    <div className="relative shrink-0">
                      {selectedUser?.avatar_url ? (
                        <img
                          src={
                            selectedUser.avatar_url
                          }
                          alt={
                            selectedUser.full_name
                          }
                          className="h-11 w-11 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 font-bold text-white shadow-sm">
                          {getInitial(
                            selectedUser?.full_name ||
                              "B"
                          )}
                        </div>
                      )}

                      {isUserOnline(
                        selectedUser?.id
                      ) && (
                        <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-500" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <h2 className="truncate font-semibold text-slate-800">
                        {
                          selectedUser?.full_name
                        }
                      </h2>

                      {selectedUser?.username && (
                        <p className="truncate text-xs text-slate-400">
                          @
                          {
                            selectedUser.username
                          }
                        </p>
                      )}

                      {isUserTyping(
                        selectedUser?.id
                      ) ? (
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-blue-500">
                          <span>
                            sedang mengetik
                          </span>

                          <span className="flex items-center gap-1">
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500 [animation-delay:150ms]" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500 [animation-delay:300ms]" />
                          </span>
                        </div>
                      ) : isUserOnline(
                          selectedUser?.id
                        ) ? (
                        <p className="mt-1 text-xs text-green-500">
                          ● Online
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-slate-400">
                          ● Offline
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* PESAN */}

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-gradient-to-br from-sky-50/80 via-white to-blue-50/80 px-4 py-5 pb-6 sm:px-5 sm:py-6">
                  {loadingMessages ? (
                    <div className="flex h-full items-center justify-center">
                      <div className="text-center">
                        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />

                        <p className="text-sm text-slate-400">
                          Memuat pesan...
                        </p>
                      </div>
                    </div>
                  ) : messages.length ===
                    0 ? (
                    <div className="flex h-full items-center justify-center">
                      <div className="text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-2xl shadow-sm">
                          💬
                        </div>

                        <h3 className="mt-5 text-lg font-bold text-slate-800">
                          Mulai percakapan
                        </h3>

                        <p className="mt-2 text-sm text-slate-500">
                          Kirim pesan pertama
                          kepada{" "}
                          {
                            selectedUser?.full_name
                          }.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="mx-auto max-w-3xl space-y-3">
                      {messages.map(
                        (message) => {
                          const isMine =
                            message.sender_id ===
                            currentUserId;

                          const isEditing =
                            editingMessageId ===
                            message.id;

                          const attachment =
                            parseAttachment(
                              message.content
                            );

                          return (
                            <div
                              key={
                                message.id
                              }
                              className={`group flex ${
                                isMine
                                  ? "justify-end"
                                  : "justify-start"
                              }`}
                            >
                              <div className="relative max-w-[88%] sm:max-w-[75%]">
                                {/* EDIT MODE */}

                                {isEditing ? (
                                  <div className="rounded-2xl border border-blue-200 bg-white p-3 shadow-md">
                                    <textarea
                                      value={
                                        editingMessageText
                                      }
                                      onChange={(
                                        event
                                      ) =>
                                        setEditingMessageText(
                                          event.target
                                            .value
                                        )
                                      }
                                      onKeyDown={(
                                        event
                                      ) =>
                                        handleEditKeyDown(
                                          event,
                                          message.id
                                        )
                                      }
                                      autoFocus
                                      rows={
                                        3
                                      }
                                      className="min-h-[80px] w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                                    />

                                    <div className="mt-2 flex justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={
                                          cancelEditMessage
                                        }
                                        disabled={
                                          savingEdit
                                        }
                                        className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                                      >
                                        Batal
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          void saveEditMessage(
                                            message.id
                                          )
                                        }
                                        disabled={
                                          savingEdit ||
                                          !editingMessageText.trim()
                                        }
                                        className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                                      >
                                        {savingEdit
                                          ? "Menyimpan..."
                                          : "Simpan"}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div
                                      className={`rounded-2xl px-4 py-3 shadow-sm ${
                                        isMine
                                          ? "rounded-br-md bg-blue-600 text-white shadow-blue-100"
                                          : "rounded-bl-md border border-slate-200 bg-white text-slate-700"
                                      }`}
                                    >
                                      {attachment ? (
                                        renderAttachment(
                                          attachment,
                                          isMine
                                        )
                                      ) : (
                                        <p className="whitespace-pre-wrap break-words text-sm leading-6">
                                          {
                                            message.content
                                          }
                                        </p>
                                      )}

                                      <div className="mt-1 flex items-center justify-end gap-1">
                                        <span
                                          className={`text-[10px] ${
                                            isMine
                                              ? "text-blue-100"
                                              : "text-slate-400"
                                          }`}
                                        >
                                          {formatTime(
                                            message.created_at
                                          )}
                                        </span>

                                        {message.updated_at &&
                                          message.updated_at !==
                                            message.created_at && (
                                            <span
                                              className={`text-[9px] ${
                                                isMine
                                                  ? "text-blue-100"
                                                  : "text-slate-400"
                                              }`}
                                            >
                                              diedit
                                            </span>
                                          )}

                                        {isMine && (
                                          <span
                                            className={`text-[11px] font-bold ${
                                              message.read_at
                                                ? "text-green-200"
                                                : "text-blue-100"
                                            }`}
                                          >
                                            {message.read_at
                                              ? "✓✓"
                                              : "✓"}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* MENU BUTTON */}

                                    <button
                                      type="button"
                                      onClick={(
                                        event
                                      ) => {
                                        event.stopPropagation();

                                        setOpenMessageMenuId(
                                          (
                                            previous
                                          ) =>
                                            previous ===
                                            message.id
                                              ? null
                                              : message.id
                                        );
                                      }}
                                      className={`absolute top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-sm text-slate-500 opacity-0 shadow-sm transition group-hover:opacity-100 ${
                                        isMine
                                          ? "-left-10"
                                          : "-right-10"
                                      }`}
                                      aria-label="Menu pesan"
                                    >
                                      ⋮
                                    </button>

                                    {/* MENU */}

                                    {openMessageMenuId ===
                                      message.id && (
                                      <div
                                        onClick={(
                                          event
                                        ) =>
                                          event.stopPropagation()
                                        }
                                        className={`absolute top-full z-40 mt-1 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl ${
                                          isMine
                                            ? "right-0"
                                            : "left-0"
                                        }`}
                                      >
                                        <button
                                          type="button"
                                          onClick={() =>
                                            void copyMessage(
                                              message.content
                                            )
                                          }
                                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                        >
                                          📋
                                          <span>
                                            Copy
                                          </span>
                                        </button>

                                        {isMine &&
                                          !attachment && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                startEditMessage(
                                                  message
                                                )
                                              }
                                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                            >
                                              ✏️
                                              <span>
                                                Edit
                                              </span>
                                            </button>
                                          )}

                                        {isMine && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              void deleteMessage(
                                                message
                                              )
                                            }
                                            disabled={
                                              deletingMessageId ===
                                              message.id
                                            }
                                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                                          >
                                            🗑️
                                            <span>
                                              {deletingMessageId ===
                                              message.id
                                                ? "Menghapus..."
                                                : "Hapus"}
                                            </span>
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        }
                      )}

                      {isUserTyping(
                        selectedUser?.id
                      ) && (
                        <div className="flex justify-start">
                          <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
                            <div className="flex items-center gap-1">
                              <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
                              <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
                              <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
                            </div>
                          </div>
                        </div>
                      )}

                      <div
                        ref={
                          messagesEndRef
                        }
                        className="h-px w-full"
                      />
                    </div>
                  )}
                </div>

                {/* INPUT */}

                <div className="shrink-0 border-t border-slate-100 bg-white px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_15px_rgba(15,23,42,0.03)] sm:p-4">
                  <div className="mx-auto max-w-3xl">
                    {/* ATTACHMENT PREVIEW */}

                    {pendingAttachment && (
                      <div className="mb-3 rounded-2xl border border-blue-100 bg-blue-50 p-3">
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            {pendingAttachment.type ===
                              "image" &&
                              pendingAttachment.previewUrl && (
                                <img
                                  src={
                                    pendingAttachment.previewUrl
                                  }
                                  alt="Preview"
                                  className="max-h-48 max-w-full rounded-xl object-cover"
                                />
                              )}

                            {pendingAttachment.type ===
                              "video" &&
                              pendingAttachment.previewUrl && (
                                <video
                                  src={
                                    pendingAttachment.previewUrl
                                  }
                                  controls
                                  className="max-h-48 max-w-full rounded-xl"
                                />
                              )}

                            {pendingAttachment.type ===
                              "audio" &&
                              pendingAttachment.previewUrl && (
                                <audio
                                  src={
                                    pendingAttachment.previewUrl
                                  }
                                  controls
                                  className="w-full"
                                />
                              )}

                            {pendingAttachment.type ===
                              "file" && (
                              <div className="flex items-center gap-3 rounded-xl bg-white p-3">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-xl">
                                  📄
                                </div>

                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-700">
                                    {
                                      pendingAttachment.file
                                        .name
                                    }
                                  </p>

                                  <p className="mt-1 text-xs text-slate-400">
                                    {formatFileSize(
                                      pendingAttachment.file
                                        .size
                                    )}
                                  </p>
                                </div>
                              </div>
                            )}

                            <div className="mt-2 flex items-center justify-between gap-2">
                              <p className="truncate text-xs font-semibold text-slate-600">
                                {
                                  pendingAttachment.file
                                    .name
                                }
                              </p>

                              <button
                                type="button"
                                onClick={
                                  cancelPendingAttachment
                                }
                                disabled={
                                  uploadingAttachment
                                }
                                className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-red-500 hover:bg-red-50"
                              >
                                ✕ Batal
                              </button>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            void sendAttachment()
                          }
                          disabled={
                            uploadingAttachment
                          }
                          className="mt-3 h-11 w-full rounded-xl bg-blue-600 text-sm font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {uploadingAttachment
                            ? "Mengupload & mengirim..."
                            : "Kirim Lampiran"}
                        </button>
                      </div>
                    )}

                    {/* RECORDING */}

                    {recordingVoice && (
                      <div className="mb-3 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-3">
                        <div className="flex h-10 w-10 animate-pulse items-center justify-center rounded-full bg-red-500 text-white">
                          🎙️
                        </div>

                        <div className="flex-1">
                          <p className="text-sm font-bold text-red-700">
                            Sedang merekam suara
                          </p>

                          <p className="text-xs text-red-500">
                            {formatRecordingTime(
                              recordingSeconds
                            )}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={
                            stopVoiceRecording
                          }
                          className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
                        >
                          Selesai
                        </button>
                      </div>
                    )}

                    <div className="relative flex items-end gap-2 sm:gap-3">
                      {/* ATTACHMENT BUTTON */}

                      <div
                        className="relative shrink-0"
                        onClick={(event) =>
                          event.stopPropagation()
                        }
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setAttachmentMenuOpen(
                              (previous) =>
                                !previous
                            )
                          }
                          disabled={
                            sendingMessage ||
                            uploadingAttachment ||
                            recordingVoice
                          }
                          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-xl text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Lampiran"
                        >
                          📎
                        </button>

                        {attachmentMenuOpen && (
                          <div className="absolute bottom-14 left-0 z-50 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
                            <button
                              type="button"
                              onClick={() =>
                                imageInputRef.current?.click()
                              }
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-blue-50"
                            >
                              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-50 text-lg">
                                📷
                              </span>
                              <span>
                                Galeri / Foto
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                videoInputRef.current?.click()
                              }
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-blue-50"
                            >
                              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-lg">
                                🎥
                              </span>
                              <span>
                                Video
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                audioInputRef.current?.click()
                              }
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-blue-50"
                            >
                              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-50 text-lg">
                                🎵
                              </span>
                              <span>
                                Audio / MP3
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                documentInputRef.current?.click()
                              }
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-blue-50"
                            >
                              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-lg">
                                📄
                              </span>
                              <span>
                                Dokumen / File
                              </span>
                            </button>

                            <div className="my-1 border-t border-slate-100" />

                            <button
                              type="button"
                              onClick={() =>
                                void startVoiceRecording()
                              }
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                            >
                              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-lg">
                                🎙️
                              </span>
                              <span>
                                Rekam Suara
                              </span>
                            </button>
                          </div>
                        )}

                        <input
                          ref={
                            imageInputRef
                          }
                          type="file"
                          accept="image/*"
                          onChange={(event) =>
                            handleAttachmentFile(
                              event,
                              "image"
                            )
                          }
                          className="hidden"
                        />

                        <input
                          ref={
                            videoInputRef
                          }
                          type="file"
                          accept="video/*"
                          onChange={(event) =>
                            handleAttachmentFile(
                              event,
                              "video"
                            )
                          }
                          className="hidden"
                        />

                        <input
                          ref={
                            audioInputRef
                          }
                          type="file"
                          accept="audio/*"
                          onChange={(event) =>
                            handleAttachmentFile(
                              event,
                              "audio"
                            )
                          }
                          className="hidden"
                        />

                        <input
                          ref={
                            documentInputRef
                          }
                          type="file"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.7z,.csv"
                          onChange={(event) =>
                            handleAttachmentFile(
                              event,
                              "file"
                            )
                          }
                          className="hidden"
                        />
                      </div>

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
                          handleMessageKeyDown
                        }
                        disabled={
                          sendingMessage ||
                          uploadingAttachment ||
                          recordingVoice
                        }
                        rows={1}
                        placeholder="Tulis pesan..."
                        className="max-h-32 min-h-[48px] flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50 disabled:opacity-50"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          void sendMessage()
                        }
                        disabled={
                          sendingMessage ||
                          uploadingAttachment ||
                          recordingVoice ||
                          !messageText.trim()
                        }
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-xl font-bold text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {sendingMessage
                          ? "..."
                          : "➤"}
                      </button>
                    </div>
                  </div>

                  <p className="mx-auto mt-2 hidden max-w-3xl text-[10px] text-slate-400 sm:block">
                    Enter untuk mengirim ·
                    Shift + Enter untuk
                    baris baru · 📎 untuk
                    foto, video, audio,
                    file, dan rekaman suara
                  </p>
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {/* ========================================================
          ERROR
          ======================================================== */}

      {errorMessage && (
        <div className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-2xl border border-red-200 bg-white p-4 text-sm text-red-600 shadow-2xl">
          <div className="flex items-start gap-3">
            <span>⚠️</span>

            <p className="flex-1">
              {errorMessage}
            </p>

            <button
              type="button"
              onClick={() =>
                setErrorMessage(
                  ""
                )
              }
              className="text-red-400 transition hover:text-red-700"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          EDIT PROFILE MODAL
          ======================================================== */}

      {profileModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!savingProfile) {
              closeProfileModal();
            }
          }}
        >
          <div
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl bg-white shadow-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            {/* HEADER */}

            <div className="border-b border-slate-100 px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Edit Profile
                  </h2>

                  <p className="mt-1 text-xs text-slate-400">
                    Ubah nama, username, dan foto
                    profil.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    closeProfileModal
                  }
                  disabled={
                    savingProfile
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* BODY */}

            <div className="p-6">
              {/* FOTO */}

              <div className="flex flex-col items-center">
                <div className="relative">
                  {avatarPreview ? (
                    <img
                      src={
                        avatarPreview
                      }
                      alt="Preview foto profil"
                      className="h-28 w-28 rounded-full border-4 border-white object-cover shadow-lg ring-1 ring-slate-200"
                    />
                  ) : (
                    <div className="flex h-28 w-28 items-center justify-center rounded-full bg-blue-600 text-4xl font-bold text-white shadow-lg">
                      {getInitial(
                        profileName ||
                          "B"
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                    disabled={
                      savingProfile
                    }
                    className="absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-full border-4 border-white bg-blue-600 text-lg text-white shadow-md hover:bg-blue-700 disabled:opacity-50"
                    aria-label="Ganti foto profil"
                  >
                    📷
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    fileInputRef.current?.click()
                  }
                  disabled={
                    savingProfile
                  }
                  className="mt-3 text-sm font-bold text-blue-600 hover:text-blue-800"
                >
                  Ganti Foto Profil
                </button>

                <p className="mt-1 text-center text-[11px] text-slate-400">
                  Pilih gambar dari galeri HP atau
                  komputer. Maksimal 5 MB.
                </p>

                <input
                  ref={
                    fileInputRef
                  }
                  type="file"
                  accept="image/*"
                  onChange={
                    handleAvatarChange
                  }
                  className="hidden"
                />
              </div>

              {/* ERROR PROFILE */}

              {profileError && (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  ⚠️{" "}
                  {profileError}
                </div>
              )}

              {/* NAMA */}

              <div className="mt-6">
                <label
                  htmlFor="profileName"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Nama Lengkap
                </label>

                <input
                  id="profileName"
                  type="text"
                  value={
                    profileName
                  }
                  onChange={(
                    event
                  ) =>
                    setProfileName(
                      event.target
                        .value
                    )
                  }
                  disabled={
                    savingProfile
                  }
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
                />
              </div>

              {/* USERNAME */}

              <div className="mt-4">
                <label
                  htmlFor="profileUsername"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Username
                </label>

                <input
                  id="profileUsername"
                  type="text"
                  value={
                    profileUsername
                  }
                  onChange={(
                    event
                  ) =>
                    setProfileUsername(
                      event.target.value
                        .replace(
                          /\s/g,
                          ""
                        )
                        .toLowerCase()
                    )
                  }
                  disabled={
                    savingProfile
                  }
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
                />
              </div>

              {/* BUTTON */}

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={
                    closeProfileModal
                  }
                  disabled={
                    savingProfile
                  }
                  className="h-12 flex-1 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void saveProfile()
                  }
                  disabled={
                    savingProfile
                  }
                  className="h-12 flex-1 rounded-xl bg-blue-600 text-sm font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingProfile
                    ? "Menyimpan..."
                    : "Simpan Profile"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}