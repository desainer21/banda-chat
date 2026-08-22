"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import { useRouter } from "next/navigation";

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

  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);

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

  const [loadingMessages, setLoadingMessages] =
    useState(false);

  const [startingChat, setStartingChat] =
    useState(false);

  const [sendingMessage, setSendingMessage] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [mobileChatOpen, setMobileChatOpen] =
    useState(false);

  const [onlineUserIds, setOnlineUserIds] =
    useState<Set<string>>(new Set());

  const [typingUserIds, setTypingUserIds] =
    useState<Set<string>>(new Set());


  const messagesEndRef =
    useRef<HTMLDivElement | null>(null);

  const presenceChannelRef =
    useRef<ReturnType<typeof supabase.channel> | null>(
      null
    );

  const typingChannelRef =
    useRef<ReturnType<typeof supabase.channel> | null>(
      null
    );

  const messagesChannelRef =
    useRef<ReturnType<typeof supabase.channel> | null>(
      null
    );

  const selectedMessagesChannelRef =
    useRef<ReturnType<typeof supabase.channel> | null>(
      null
    );

  const typingTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  const sendTypingTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  const unreadRefreshTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  const selectedConversationIdRef =
    useRef<string | null>(null);


  useEffect(() => {
    selectedConversationIdRef.current =
      selectedConversation?.id || null;
  }, [selectedConversation]);


  /*
   * ============================================================
   * LOAD CHAT
   * ============================================================
   *
   * PERBAIKAN UTAMA:
   *
   * Setelah session ditemukan, unread langsung dimuat.
   * Tidak menunggu pengguna membuka chat.
   *
   * Urutannya:
   *
   * 1. Ambil session
   * 2. Set currentUserId
   * 3. Load unread/contact information SEGERA
   * 4. Load daftar pengguna
   * 5. Sinkronisasi unread sekali lagi
   *
   * Jadi badge tidak perlu menunggu reload.
   */
  useEffect(() => {
    let mounted = true;

    async function initialize() {
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
          if (mounted) {
            router.replace("/login");
          }

          return;
        }

        const authUserId = session.user.id;

        if (!mounted) {
          return;
        }

        setCurrentUserId(authUserId);

        /*
         * PROFILE
         */
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

        if (!mounted) {
          return;
        }

        setProfile(currentProfile);

        /*
         * ========================================================
         * PENTING:
         * LOAD UNREAD DULU
         * ========================================================
         *
         * Jangan menunggu loadUsers selesai.
         */
        await loadContactInfo(authUserId);

        if (!mounted) {
          return;
        }

        /*
         * LOAD DAFTAR KONTAK
         */
        await loadUsers(authUserId);

        if (!mounted) {
          return;
        }

        /*
         * Sinkronisasi unread sekali lagi setelah kontak selesai
         */
        await loadContactInfo(authUserId);

      } catch (error) {
        console.error(
          "Load chat error:",
          error
        );

        if (mounted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Gagal membuka Banda Chat."
          );
        }

      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      mounted = false;
    };
  }, [router]);


  /*
   * ============================================================
   * AUTH STATE
   * ============================================================
   *
   * Memastikan ketika login baru selesai dan session berubah,
   * unread langsung dimuat tanpa reload halaman.
   */
  useEffect(() => {
    const {
      data: { subscription },
    } =
      supabase.auth.onAuthStateChange(
        (event, session) => {
          if (
            event === "SIGNED_IN" &&
            session?.user
          ) {
            const authUserId =
              session.user.id;

            setCurrentUserId(
              authUserId
            );

            /*
             * Jangan menunggu buka chat.
             * Langsung ambil unread.
             */
            window.setTimeout(() => {
              void loadContactInfo(
                authUserId
              );

              void loadUsers(
                authUserId
              );
            }, 0);
          }

          if (
            event === "SIGNED_OUT"
          ) {
            setCurrentUserId("");
            setContactInfo({});
            setUsers([]);
            setProfile(null);
          }
        }
      );

    return () => {
      subscription.unsubscribe();
    };
  }, []);


  /*
   * ============================================================
   * LOAD USERS
   * ============================================================
   */
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
        .neq(
          "id",
          authUserId
        )
        .order(
          "full_name",
          {
            ascending: true,
          }
        );

      if (error) {
        throw new Error(
          error.message
        );
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


  /*
   * ============================================================
   * LOAD CONTACT + UNREAD
   * ============================================================
   *
   * PERBAIKAN BESAR:
   *
   * Fungsi ini sekarang:
   *
   * - mengambil semua conversation milik user
   * - mencari lawan chat
   * - mengambil pesan
   * - menghitung unread
   * - menggabungkan conversation ganda menjadi satu kontak
   *
   * Badge unread TIDAK bergantung pada selectedConversation.
   */
  async function loadContactInfo(
    authUserId: string
  ) {
    try {
      /*
       * Ambil semua membership user
       */
      const {
        data: myMemberships,
        error: myMembershipError,
      } = await supabase
        .from("conversation_members")
        .select(
          "conversation_id"
        )
        .eq(
          "user_id",
          authUserId
        );

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
          (item) =>
            item.conversation_id
        );

      /*
       * Ambil semua member dari conversation
       */
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

      /*
       * conversation_id -> user lawan chat
       */
      const conversationToUser:
        Record<string, string> = {};

      (allMembers || []).forEach(
        (member) => {
          if (
            member.user_id !==
            authUserId
          ) {
            conversationToUser[
              member.conversation_id
            ] = member.user_id;
          }
        }
      );


      /*
       * Ambil semua pesan.
       *
       * Penting:
       * Tidak hanya pesan terakhir.
       * Karena unreadCount harus dihitung dari semua pesan
       * yang belum dibaca.
       */
      const {
        data: allMessages,
        error: messagesError,
      } = await supabase
        .from("messages")
        .select(
          "id, conversation_id, sender_id, content, created_at, read_at"
        )
        .in(
          "conversation_id",
          conversationIds
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

      if (messagesError) {
        console.error(
          "Load contact messages error:",
          messagesError
        );

        return;
      }


      const aggregatedInfo:
        Record<string, ContactInfo> = {};


      /*
       * Proses setiap conversation
       */
      Object.entries(
        conversationToUser
      ).forEach(
        ([
          conversationId,
          userId,
        ]) => {
          const conversationMessages =
            (allMessages || []).filter(
              (message) =>
                message.conversation_id ===
                conversationId
            );


          /*
           * HITUNG UNREAD
           *
           * Hanya:
           * - pesan dari orang lain
           * - read_at masih null
           */
          const unreadCount =
            conversationMessages.filter(
              (message) =>
                message.sender_id !==
                  authUserId &&
                !message.read_at
            ).length;


          /*
           * Pesan terbaru
           */
          const lastMessage =
            conversationMessages.length >
            0
              ? conversationMessages[0]
              : null;


          /*
           * Jika user memiliki lebih dari satu
           * conversation dengan orang yang sama,
           * tetap tampil SATU kontak.
           */
          if (
            !aggregatedInfo[userId]
          ) {
            aggregatedInfo[userId] = {
              conversationId,
              lastMessage:
                lastMessage?.content ||
                null,
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
            lastMessage?.created_at ||
            null;


          /*
           * Gabungkan unread dari conversation
           * lama dan baru.
           */
          existing.unreadCount +=
            unreadCount;


          /*
           * Tentukan conversation dengan
           * pesan terbaru.
           */
          if (
            currentLastMessageAt &&
            (
              !existingLastMessageAt ||
              new Date(
                currentLastMessageAt
              ).getTime() >
                new Date(
                  existingLastMessageAt
                ).getTime()
            )
          ) {
            existing.conversationId =
              conversationId;

            existing.lastMessage =
              lastMessage?.content ||
              null;

            existing.lastMessageAt =
              currentLastMessageAt;
          }
        }
      );


      /*
       * SET STATE SEKALIGUS
       *
       * Ini membuat badge unread langsung
       * muncul setelah query selesai.
       */
      setContactInfo(
        aggregatedInfo
      );

    } catch (error) {
      console.error(
        "Load contact info error:",
        error
      );
    }
  }


  /*
   * ============================================================
   * REALTIME CONTACT REFRESH
   * ============================================================
   */
  function refreshContactInfoRealtime() {
    if (!currentUserId) {
      return;
    }

    if (
      unreadRefreshTimerRef.current
    ) {
      clearTimeout(
        unreadRefreshTimerRef.current
      );
    }

    unreadRefreshTimerRef.current =
      setTimeout(() => {
        void loadContactInfo(
          currentUserId
        );
      }, 250);
  }


  /*
   * ============================================================
   * PRESENCE
   * ============================================================
   */
  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    const channel =
      supabase.channel(
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
              !Array.isArray(
                presences
              )
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

        setOnlineUserIds(
          onlineIds
        );
      }
    );

    channel.subscribe(
      async (status) => {
        if (
          status ===
          "SUBSCRIBED"
        ) {
          try {
            await channel.track({
              user_id:
                currentUserId,
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


  /*
   * ============================================================
   * TYPING
   * ============================================================
   */
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

    if (
      value.trim()
    ) {
      void channel.send({
        type: "broadcast",
        event: "typing",
        payload: {
          user_id:
            currentUserId,
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
          user_id:
            currentUserId,
          conversation_id:
            selectedConversation.id,
          is_typing: false,
        },
      });
    }
  }


  /*
   * ============================================================
   * START CHAT
   * ============================================================
   */
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
      } =
        await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      const authUserId =
        session.user.id;

      if (
        authUserId ===
        user.id
      ) {
        throw new Error(
          "Anda tidak dapat chat dengan diri sendiri."
        );
      }

      const {
        data: conversationId,
        error: rpcError,
      } =
        await supabase.rpc(
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

      const conversation:
        Conversation = {
          id:
            conversationId as string,
          type:
            "direct",
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


  /*
   * ============================================================
   * LOAD MESSAGES
   * ============================================================
   */
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
          "id, conversation_id, sender_id, content, created_at, read_at"
        )
        .eq(
          "conversation_id",
          conversationId
        )
        .order(
          "created_at",
          {
            ascending: true,
          }
        );

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


  /*
   * ============================================================
   * MARK READ
   * ============================================================
   */
  async function markConversationRead(
    conversationId: string,
    authUserId: string
  ) {
    try {
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


      /*
       * Hapus badge langsung dari UI.
       */
      setContactInfo(
        (previous) => {
          const next = {
            ...previous,
          };

          Object.keys(next).forEach(
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


      /*
       * Sinkronisasi dengan database.
       */
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


  /*
   * ============================================================
   * REALTIME SEMUA PESAN
   * ============================================================
   *
   * CHANNEL INI SEKARANG AKTIF SELAMA USER SUDAH LOGIN.
   *
   * Artinya:
   *
   * User A login.
   * User B mengirim pesan.
   * User A tidak membuka chat.
   *
   * Badge unread tetap bertambah.
   */
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

            /*
             * Pesan yang kita kirim sendiri
             * tidak menjadi unread.
             */
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


            /*
             * Kalau chat sedang terbuka,
             * otomatis tandai terbaca.
             */
            if (
              isCurrentConversation
            ) {
              refreshContactInfoRealtime();
              return;
            }


            /*
             * ====================================================
             * UPDATE BADGE LANGSUNG
             * ====================================================
             */
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


                /*
                 * Kalau conversation sudah ada
                 * di daftar kontak.
                 */
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
                      newMessage.content,

                    lastMessageAt:
                      newMessage.created_at,

                    unreadCount:
                      next[
                        matchedUserId
                      ].unreadCount + 1,
                  };

                  return next;
                }


                /*
                 * Kalau conversation belum ada
                 * di contactInfo, jangan menunggu reload.
                 *
                 * Ambil ulang contact info.
                 */
                return next;
              }
            );


            /*
             * Query database untuk memastikan angka
             * tetap akurat.
             */
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
        .subscribe(
          (status) => {
            if (
              status ===
              "SUBSCRIBED"
            ) {
              /*
               * Begitu channel realtime berhasil
               * subscribe, langsung sinkronkan unread.
               */
              void loadContactInfo(
                currentUserId
              );
            }
          }
        );

    messagesChannelRef.current =
      channel;

    return () => {
      messagesChannelRef.current =
        null;

      void supabase.removeChannel(
        channel
      );
    };
  }, [currentUserId]);


  /*
   * ============================================================
   * REALTIME CONVERSATION AKTIF
   * ============================================================
   */
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


            /*
             * Pesan teman ketika chat sedang terbuka
             */
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
                          ...next[userId],
                          unreadCount: 0,
                          lastMessage:
                            newMessage.content,
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
        .subscribe();

    selectedMessagesChannelRef.current =
      channel;

    return () => {
      selectedMessagesChannelRef.current =
        null;

      void supabase.removeChannel(
        channel
      );
    };
  }, [
    selectedConversation,
    currentUserId,
  ]);


  /*
   * ============================================================
   * SCROLL
   * ============================================================
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView(
      {
        behavior: "smooth",
      }
    );
  }, [
    messages,
    typingUserIds,
  ]);


  /*
   * ============================================================
   * SEND MESSAGE
   * ============================================================
   */
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

    if (
      sendTypingTimerRef.current
    ) {
      clearTimeout(
        sendTypingTimerRef.current
      );
    }

    if (
      typingChannelRef.current
    ) {
      void typingChannelRef.current.send({
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
    }

    try {
      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      const senderId =
        session.user.id;

      const {
        data,
        error,
      } =
        await supabase
          .from("messages")
          .insert({
            conversation_id:
              selectedConversation.id,
            sender_id:
              senderId,
            content,
          })
          .select(
            "id, conversation_id, sender_id, content, created_at, read_at"
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


  function handleMessageKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      void sendMessage();
    }
  }


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
    userId: string | undefined
  ) {
    if (!userId) {
      return false;
    }

    return onlineUserIds.has(
      userId
    );
  }


  function isUserTyping(
    userId: string | undefined
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
            .includes(keyword) ||
          user.username
            ?.toLowerCase()
            .includes(keyword)
        );
      }
    );


  /*
   * ============================================================
   * LOGOUT
   * ============================================================
   */
  async function handleLogout() {
    if (
      selectedConversation &&
      currentUserId
    ) {
      if (
        typingChannelRef.current
      ) {
        void typingChannelRef.current.send({
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
      }
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

    setContactInfo({});

    setCurrentUserId("");

    router.replace(
      "/login"
    );
  }


  function handleMobileBack() {
    setMobileChatOpen(false);
  }


  /*
   * ============================================================
   * LOADING
   * ============================================================
   */
  if (loading) {
    return (
      <main className="flex h-screen items-center justify-center overflow-hidden bg-slate-950 text-white">
        <div className="text-center">

          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-blue-500" />

          <p className="text-sm text-slate-400">
            Membuka Banda Chat...
          </p>

        </div>
      </main>
    );
  }


  /*
   * ============================================================
   * UI
   * ============================================================
   */
  return (
    <main className="flex h-screen flex-col overflow-hidden bg-slate-950 text-white">

      {/* HEADER */}

      <header className="z-20 shrink-0 border-b border-white/10 bg-slate-900">

        <div className="mx-auto flex h-[68px] w-full max-w-7xl items-center justify-between px-4">

          <div className="flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-xl font-bold shadow-lg shadow-blue-600/20">
              B
            </div>

            <div>

              <h1 className="font-bold">
                Banda Chat
              </h1>

              <p className="text-xs text-green-400">
                ● Online
              </p>

            </div>

          </div>


          <div className="flex items-center gap-3">

            <div className="hidden text-right sm:block">

              <p className="text-sm font-semibold">
                {profile?.full_name}
              </p>

              {profile?.username && (
                <p className="text-xs text-slate-400">
                  @{profile.username}
                </p>
              )}

            </div>


            {profile?.avatar_url ? (

              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                className="h-10 w-10 rounded-full object-cover"
              />

            ) : (

              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 font-bold">
                {getInitial(
                  profile?.full_name ||
                    "B"
                )}
              </div>

            )}


            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              Keluar
            </button>

          </div>

        </div>

      </header>


      {/* AREA APLIKASI */}

      <div className="min-h-0 flex-1">

        <div className="mx-auto flex h-full w-full max-w-7xl min-h-0">


          {/* SIDEBAR */}

          <aside
            className={`h-full min-h-0 w-full flex-col border-r border-white/10 bg-slate-900 md:flex md:w-80 md:shrink-0 ${
              mobileChatOpen
                ? "hidden"
                : "flex"
            }`}
          >

            <div className="shrink-0 border-b border-white/10 p-4">

              <h2 className="text-lg font-bold">
                Percakapan
              </h2>

              <input
                type="text"
                placeholder="Cari pengguna..."
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                className="mt-4 w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
              />

            </div>


            <div className="min-h-0 flex-1 overflow-y-auto p-4">

              <div className="mb-3 flex items-center justify-between">

                <h3 className="text-sm font-semibold text-slate-300">
                  Kontak Banda Chat
                </h3>

                <span className="text-xs text-slate-500">
                  {users.length}
                </span>

              </div>


              {loadingUsers ? (

                <p className="py-6 text-center text-sm text-slate-500">
                  Memuat pengguna...
                </p>

              ) : filteredUsers.length === 0 ? (

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">

                  <div className="text-3xl">
                    👥
                  </div>

                  <p className="mt-3 text-sm font-semibold">
                    Belum ada pengguna lain
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Daftar pengguna akan muncul di sini.
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
                          key={user.id}
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
                              ? "border-blue-500 bg-blue-500/10"
                              : "border-white/10 bg-white/5 hover:bg-white/10"
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

                                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 font-bold">
                                  {getInitial(
                                    user.full_name
                                  )}
                                </div>

                              )}


                              {userOnline && (

                                <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-slate-900 bg-green-500" />

                              )}

                            </div>


                            <div className="min-w-0 flex-1">

                              <div className="flex items-center justify-between gap-2">

                                <p className="truncate text-sm font-semibold">
                                  {user.full_name}
                                </p>


                                <div className="flex shrink-0 items-center gap-2">

                                  {info?.lastMessageAt && (

                                    <span className="text-[10px] text-slate-500">
                                      {formatContactTime(
                                        info.lastMessageAt
                                      )}
                                    </span>

                                  )}


                                  {info &&
                                    info.unreadCount >
                                      0 && (

                                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-green-500 px-1 text-[10px] font-bold text-slate-950">
                                        {info.unreadCount >
                                        99
                                          ? "99+"
                                          : info.unreadCount}
                                      </span>

                                    )}

                                </div>

                              </div>


                              <p className="mt-1 truncate text-xs text-slate-500">

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


          {/* CHAT */}

          <section
            className={`h-full min-h-0 min-w-0 flex-1 flex-col bg-slate-950 ${
              mobileChatOpen
                ? "flex"
                : "hidden"
            } md:flex`}
          >

            {!selectedConversation ? (

              <div className="flex min-h-0 flex-1 items-center justify-center">

                <div className="max-w-md px-6 text-center">

                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-600 text-3xl font-bold shadow-lg shadow-blue-600/20">
                    B
                  </div>

                  <h2 className="mt-6 text-2xl font-bold">
                    Pilih kontak untuk mulai chat
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    Setiap akun hanya muncul satu kali.
                    Klik kontak untuk membuka atau
                    melanjutkan percakapan sebelumnya.
                  </p>

                </div>

              </div>

            ) : (

              <>

                {/* CHAT HEADER */}

                <div className="shrink-0 border-b border-white/10 bg-slate-900 px-4 py-3 sm:px-5 sm:py-4">

                  <div className="flex items-center gap-3">

                    <button
                      type="button"
                      onClick={
                        handleMobileBack
                      }
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg text-slate-300 transition hover:bg-white/10 hover:text-white md:hidden"
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

                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 font-bold">
                          {getInitial(
                            selectedUser?.full_name ||
                              "B"
                          )}
                        </div>

                      )}


                      {isUserOnline(
                        selectedUser?.id
                      ) && (

                        <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-slate-900 bg-green-500" />

                      )}

                    </div>


                    <div className="min-w-0">

                      <h2 className="truncate font-semibold">
                        {selectedUser?.full_name}
                      </h2>


                      {selectedUser?.username && (
                        <p className="truncate text-xs text-slate-500">
                          @{selectedUser.username}
                        </p>
                      )}


                      {isUserTyping(
                        selectedUser?.id
                      ) ? (

                        <div className="mt-1 flex items-center gap-1.5 text-xs text-blue-400">

                          <span>
                            sedang mengetik
                          </span>

                          <span className="flex items-center gap-1">

                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400" />

                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400 [animation-delay:150ms]" />

                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400 [animation-delay:300ms]" />

                          </span>

                        </div>

                      ) : isUserOnline(
                        selectedUser?.id
                      ) ? (

                        <p className="mt-1 text-xs text-green-400">
                          ● Online
                        </p>

                      ) : (

                        <p className="mt-1 text-xs text-slate-500">
                          ● Offline
                        </p>

                      )}

                    </div>

                  </div>

                </div>


                {/* PESAN */}

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5 sm:py-6">

                  {loadingMessages ? (

                    <div className="flex h-full items-center justify-center">

                      <div className="text-center">

                        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-white/10 border-t-blue-500" />

                        <p className="text-sm text-slate-500">
                          Memuat pesan...
                        </p>

                      </div>

                    </div>

                  ) : messages.length === 0 ? (

                    <div className="flex h-full items-center justify-center">

                      <div className="text-center">

                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-2xl">
                          💬
                        </div>

                        <h3 className="mt-5 text-lg font-bold">
                          Mulai percakapan
                        </h3>

                        <p className="mt-2 text-sm text-slate-500">
                          Kirim pesan pertama kepada{" "}
                          {selectedUser?.full_name}.
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


                          return (

                            <div
                              key={
                                message.id
                              }
                              className={`flex ${
                                isMine
                                  ? "justify-end"
                                  : "justify-start"
                              }`}
                            >

                              <div
                                className={`max-w-[85%] rounded-2xl px-4 py-3 sm:max-w-[75%] ${
                                  isMine
                                    ? "rounded-br-md bg-blue-600 text-white"
                                    : "rounded-bl-md bg-white/10 text-slate-200"
                                }`}
                              >

                                <p className="whitespace-pre-wrap break-words text-sm leading-6">
                                  {message.content}
                                </p>


                                <div className="mt-1 flex items-center justify-end gap-1">

                                  <span
                                    className={`text-[10px] ${
                                      isMine
                                        ? "text-blue-100"
                                        : "text-slate-500"
                                    }`}
                                  >
                                    {formatTime(
                                      message.created_at
                                    )}
                                  </span>


                                  {isMine && (

                                    <span
                                      className={`text-[11px] font-bold ${
                                        message.read_at
                                          ? "text-green-300"
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

                            </div>

                          );
                        }
                      )}


                      {isUserTyping(
                        selectedUser?.id
                      ) && (

                        <div className="flex justify-start">

                          <div className="rounded-2xl rounded-bl-md bg-white/10 px-4 py-3">

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
                      />

                    </div>

                  )}

                </div>


                {/* INPUT */}

                <div className="shrink-0 border-t border-white/10 bg-slate-900 p-3 sm:p-4">

                  <div className="mx-auto flex max-w-3xl items-end gap-2 sm:gap-3">

                    <textarea
                      value={
                        messageText
                      }
                      onChange={(event) =>
                        handleMessageChange(
                          event.target.value
                        )
                      }
                      onKeyDown={
                        handleMessageKeyDown
                      }
                      disabled={
                        sendingMessage
                      }
                      rows={1}
                      placeholder="Tulis pesan..."
                      className="max-h-32 min-h-[48px] flex-1 resize-none rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500 disabled:opacity-50"
                    />


                    <button
                      type="button"
                      onClick={() =>
                        void sendMessage()
                      }
                      disabled={
                        sendingMessage ||
                        !messageText.trim()
                      }
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-xl font-bold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {sendingMessage
                        ? "..."
                        : "➤"}
                    </button>

                  </div>


                  <p className="mx-auto mt-2 hidden max-w-3xl text-[10px] text-slate-600 sm:block">
                    Enter untuk mengirim · Shift +
                    Enter untuk baris baru
                  </p>

                </div>

              </>

            )}

          </section>

        </div>

      </div>


      {/* ERROR */}

      {errorMessage && (

        <div className="fixed bottom-5 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-2xl border border-red-500/20 bg-red-950/95 p-4 text-sm text-red-300 shadow-2xl">

          <div className="flex items-start gap-3">

            <span>
              ⚠️
            </span>

            <p className="flex-1">
              {errorMessage}
            </p>

            <button
              type="button"
              onClick={() =>
                setErrorMessage("")
              }
              className="text-red-400 hover:text-white"
            >
              ✕
            </button>

          </div>

        </div>

      )}

    </main>
  );
}