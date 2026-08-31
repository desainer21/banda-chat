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

type MessageAttachment = {
  type: "image" | "video" | "audio" | "file";
  url: string;
  path?: string;
  name: string;
  size: number;
  mimeType: string;
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

export default function ChatPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [users, setUsers] = useState<Profile[]>([]);
  const [contactInfo, setContactInfo] =
    useState<Record<string, ContactInfo>>({});

  // Menu tiga titik pada daftar kontak.
  const [openContactMenuUserId, setOpenContactMenuUserId] =
    useState<string | null>(null);

  // Menu tiga titik pada header chat.
  const [chatMenuOpen, setChatMenuOpen] =
    useState(false);

  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState("");
  const [messageText, setMessageText] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [startingChat, setStartingChat] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  const [onlineUserIds, setOnlineUserIds] =
    useState<Set<string>>(new Set());

  const [typingUserIds, setTypingUserIds] =
    useState<Set<string>>(new Set());

  /* ============================================================
     MESSAGE MENU
     ============================================================ */

  const [openMessageMenuId, setOpenMessageMenuId] =
    useState<string | null>(null);

  const [editingMessageId, setEditingMessageId] =
    useState<string | null>(null);

  const [editingMessageText, setEditingMessageText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingMessageId, setDeletingMessageId] =
    useState<string | null>(null);

  /* ============================================================
     ATTACHMENT
     ============================================================ */

  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);

  const [selectedAttachmentFile, setSelectedAttachmentFile] =
    useState<File | null>(null);

  const [attachmentPreviewUrl, setAttachmentPreviewUrl] =
    useState<string | null>(null);

  const [imagePreview, setImagePreview] = useState<MessageAttachment | null>(null);

  const [attachmentType, setAttachmentType] =
    useState<MessageAttachment["type"] | null>(null);

  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef =
    useRef<ReturnType<typeof setInterval> | null>(null);

  const attachmentInputRef =
    useRef<HTMLInputElement | null>(null);

  const galleryInputRef =
    useRef<HTMLInputElement | null>(null);

  const videoInputRef =
    useRef<HTMLInputElement | null>(null);

  const audioInputRef =
    useRef<HTMLInputElement | null>(null);

  /* ============================================================
     PROFILE MODAL
     ============================================================ */

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] =
    useState<string | null>(null);

  const [selectedAvatarFile, setSelectedAvatarFile] =
    useState<File | null>(null);

  const [avatarPreview, setAvatarPreview] =
    useState<string | null>(null);

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");

  const messagesEndRef =
    useRef<HTMLDivElement | null>(null);

  const presenceChannelRef =
    useRef<ReturnType<typeof supabase.channel> | null>(null);

  const typingChannelRef =
    useRef<ReturnType<typeof supabase.channel> | null>(null);

  const typingTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendTypingTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

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
     CONTACT RELATIONS
     Status kontak dan batas riwayat disimpan di database.
     Tidak menggunakan localStorage.
     ============================================================ */

  async function getContactRelation(
    ownerId: string,
    contactId: string
  ) {
    const { data, error } = await supabase
      .from("contact_relations")
      .select(
        "owner_id, contact_id, deleted_at, chat_cleared_at, blocked_at"
      )
      .eq("owner_id", ownerId)
      .eq("contact_id", contactId)
      .maybeSingle();

    if (error) {
      console.error("Get contact relation error:", error);
      return null;
    }

    return data;
  }

  async function activateContactRelation(
    ownerId: string,
    contactId: string,
    preserveChatBoundary = false
  ) {
    const existing = await getContactRelation(
      ownerId,
      contactId
    );

    const now = new Date().toISOString();

    if (existing?.blocked_at) {
      throw new Error(
        "Kontak ini sedang diblokir."
      );
    }

    if (existing?.deleted_at) {
      /*
       * Saat pengguna sendiri membuka kembali kontak dari pencarian,
       * batas chat baru dibuat dari waktu aktivasi.
       *
       * Tetapi saat fungsi ini dipanggil karena PESAN BARU masuk,
       * pesan tersebut sudah dibuat beberapa milidetik sebelumnya.
       * Jika chat_cleared_at diubah ke `now`, pesan baru justru bisa
       * ikut tersembunyi karena loadContactInfo() memakai:
       *
       * message.created_at > chat_cleared_at
       *
       * Karena itu alur realtime harus mempertahankan batas lama.
       */
      const updateData = preserveChatBoundary
        ? {
            deleted_at: null,
          }
        : {
            deleted_at: null,
            chat_cleared_at: now,
          };

      const { error } = await supabase
        .from("contact_relations")
        .update(updateData)
        .eq("owner_id", ownerId)
        .eq("contact_id", contactId);

      if (error) {
        throw new Error(
          "Gagal mengaktifkan kembali kontak: " +
            error.message
        );
      }

      return preserveChatBoundary
        ? existing.chat_cleared_at || null
        : now;
    }

    if (!existing) {
      const { error } = await supabase
        .from("contact_relations")
        .insert({
          owner_id: ownerId,
          contact_id: contactId,
          deleted_at: null,
          chat_cleared_at: null,
        });

      if (error) {
        throw new Error(
          "Gagal membuat relasi kontak: " +
            error.message
        );
      }
    }

    return existing?.chat_cleared_at || null;
  }

  async function deleteContactRelation(
    ownerId: string,
    contactId: string
  ) {
    const now = new Date().toISOString();

    const { data: existing, error: selectError } =
      await supabase
        .from("contact_relations")
        .select("owner_id, contact_id")
        .eq("owner_id", ownerId)
        .eq("contact_id", contactId)
        .maybeSingle();

    if (selectError) {
      throw new Error(
        "Gagal membaca relasi kontak: " +
          selectError.message
      );
    }

    if (existing) {
      const { error } = await supabase
        .from("contact_relations")
        .update({
          deleted_at: now,
          chat_cleared_at: now,
        })
        .eq("owner_id", ownerId)
        .eq("contact_id", contactId);

      if (error) {
        throw new Error(
          "Gagal menghapus kontak: " +
            error.message
        );
      }
    } else {
      const { error } = await supabase
        .from("contact_relations")
        .insert({
          owner_id: ownerId,
          contact_id: contactId,
          deleted_at: now,
          chat_cleared_at: now,
        });

      if (error) {
        throw new Error(
          "Gagal menyimpan penghapusan kontak: " +
            error.message
        );
      }
    }

    return now;
  }

  async function blockContactRelation(
    ownerId: string,
    contactId: string
  ) {
    const now = new Date().toISOString();

    const existing = await getContactRelation(
      ownerId,
      contactId
    );

    if (existing) {
      const { error } = await supabase
        .from("contact_relations")
        .update({
          blocked_at: now,
          deleted_at: now,
          chat_cleared_at: now,
        })
        .eq("owner_id", ownerId)
        .eq("contact_id", contactId);

      if (error) {
        throw new Error(
          "Gagal memblokir kontak: " + error.message
        );
      }

      return;
    }

    const { error } = await supabase
      .from("contact_relations")
      .insert({
        owner_id: ownerId,
        contact_id: contactId,
        blocked_at: now,
        deleted_at: now,
        chat_cleared_at: now,
      });

    if (error) {
      throw new Error(
        "Gagal memblokir kontak: " + error.message
      );
    }
  }

  async function blockContactFromHome(user: Profile) {
    if (!currentUserId) return;

    const confirmed = window.confirm(
      `Blokir ${user.full_name}?\\n\\nKontak ini akan dihapus dari beranda dan pesan baru dari akun tersebut tidak akan mengaktifkan kembali kontak ini.`
    );

    if (!confirmed) {
      setOpenContactMenuUserId(null);
      return;
    }

    try {
      await blockContactRelation(
        currentUserId,
        user.id
      );

      setContactInfo((previous) => {
        const next = { ...previous };
        delete next[user.id];
        return next;
      });

      setOpenContactMenuUserId(null);

      if (selectedUser?.id === user.id) {
        setSelectedConversation(null);
        setSelectedUser(null);
        setMessages([]);
        setMessageText("");
        setMobileChatOpen(false);
        setChatMenuOpen(false);
      }
    } catch (error) {
      console.error(
        "Block contact error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal memblokir kontak."
      );
    }
  }

  async function deleteCurrentConversationForMe() {
    if (!selectedConversation || !selectedUser || !currentUserId) {
      return;
    }

    const confirmed = window.confirm(
      `Hapus seluruh percakapan dengan ${selectedUser.full_name} dari akun Anda?\n\nPesan tetap ada pada akun teman Anda.`
    );

    if (!confirmed) return;

    try {
      await deleteContactRelation(
        currentUserId,
        selectedUser.id
      );

      setContactInfo((previous) => {
        const next = { ...previous };
        delete next[selectedUser.id];
        return next;
      });

      setMessages([]);
      setSelectedConversation(null);
      setSelectedUser(null);
      setMessageText("");
      setMobileChatOpen(false);
      setChatMenuOpen(false);
    } catch (error) {
      console.error(
        "Delete current conversation error:",
        error
      );
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal menghapus percakapan."
      );
    }
  }

  async function deleteContactFromHome(user: Profile) {
    if (!currentUserId) return;

    const info = contactInfo[user.id];
    if (!info?.conversationId) return;

    const confirmed = window.confirm(
      `Hapus ${user.full_name} dari daftar kontak?\n\nRiwayat chat tetap ada di database, tetapi riwayat lama akan disembunyikan dari akun Anda. Jika kontak ini ditemukan kembali, chat akan dimulai dari pesan baru.`
    );

    if (!confirmed) return;

    try {
      await deleteContactRelation(
        currentUserId,
        user.id
      );

      setContactInfo((previous) => {
        const next = { ...previous };
        delete next[user.id];
        return next;
      });

      if (selectedConversation?.id === info.conversationId) {
        setSelectedConversation(null);
        setSelectedUser(null);
        setMessages([]);
        setMessageText("");
        setMobileChatOpen(false);
      }
    } catch (error) {
      console.error(
        "Delete contact error:",
        error
      );
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal menghapus kontak."
      );
    }
  }

  /* ============================================================
     ATTACHMENT HELPERS
     ============================================================ */

  function formatFileSize(size: number) {
    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    if (size < 1024 * 1024 * 1024) {
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    }

    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  function createAttachmentContent(
    attachment: MessageAttachment
  ) {
    return JSON.stringify({
      __banda_attachment: true,
      attachment,
    });
  }

  function parseAttachmentContent(
    content: string
  ): MessageAttachment | null {
    try {
      const parsed = JSON.parse(content);

      if (
        parsed &&
        parsed.__banda_attachment === true &&
        parsed.attachment
      ) {
        return parsed.attachment as MessageAttachment;
      }

      return null;
    } catch {
      return null;
    }
  }

  function getAttachmentLabel(
    attachment: MessageAttachment
  ) {
    if (attachment.type === "image") {
      return "📷 Foto";
    }

    if (attachment.type === "video") {
      return "🎥 Video";
    }

    if (attachment.type === "audio") {
      return "🎵 Audio";
    }

    return "📎 File";
  }

  function clearAttachmentPreview() {
    if (
      attachmentPreviewUrl &&
      attachmentPreviewUrl.startsWith("blob:")
    ) {
      URL.revokeObjectURL(attachmentPreviewUrl);
    }

    setAttachmentPreviewUrl(null);
    setSelectedAttachmentFile(null);
    setAttachmentType(null);
  }

  function openAttachmentMenu() {
    setAttachmentMenuOpen((previous) => !previous);
  }

  function chooseAttachment(
    type: "gallery" | "video" | "audio" | "file"
  ) {
    setAttachmentMenuOpen(false);

    if (type === "gallery") {
      galleryInputRef.current?.click();
      return;
    }

    if (type === "video") {
      videoInputRef.current?.click();
      return;
    }

    if (type === "audio") {
      audioInputRef.current?.click();
      return;
    }

    attachmentInputRef.current?.click();
  }

  function handleAttachmentSelected(
    event: ChangeEvent<HTMLInputElement>,
    forcedType?: "image" | "video" | "audio" | "file"
  ) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    setErrorMessage("");

    const maxSize = 100 * 1024 * 1024;

    if (file.size > maxSize) {
      setErrorMessage(
        "Ukuran file maksimal 100 MB."
      );
      return;
    }

    let type: MessageAttachment["type"] = "file";

    if (forcedType) {
      type = forcedType;
    } else if (file.type.startsWith("image/")) {
      type = "image";
    } else if (file.type.startsWith("video/")) {
      type = "video";
    } else if (file.type.startsWith("audio/")) {
      type = "audio";
    }

    if (type === "image" && !file.type.startsWith("image/")) {
      setErrorMessage("File yang dipilih bukan gambar.");
      return;
    }

    if (type === "video" && !file.type.startsWith("video/")) {
      setErrorMessage("File yang dipilih bukan video.");
      return;
    }

    if (type === "audio" && !file.type.startsWith("audio/")) {
      setErrorMessage("File yang dipilih bukan audio.");
      return;
    }

    clearAttachmentPreview();

    setSelectedAttachmentFile(file);
    setAttachmentType(type);

    if (
      type === "image" ||
      type === "video"
    ) {
      const preview = URL.createObjectURL(file);
      setAttachmentPreviewUrl(preview);
    }
  }

  async function uploadChatAttachment(
    file: File,
    userId: string,
    conversationId: string
  ) {
    const extension =
      file.name.split(".").pop()?.toLowerCase() || "bin";

    const safeName = file.name
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .slice(0, 80);

    const filePath =
      `${userId}/${conversationId}/` +
      `${Date.now()}-${safeName || `file.${extension}`}`;

    const { error } =
      await supabase.storage
        .from("chat-attachments")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

    if (error) {
      throw new Error(
        "Upload file gagal: " + error.message
      );
    }

    const { data } =
      supabase.storage
        .from("chat-attachments")
        .getPublicUrl(filePath);

    if (!data.publicUrl) {
      throw new Error(
        "URL file tidak ditemukan."
      );
    }

    return {
      url: data.publicUrl,
      path: filePath,
    };
  }

  async function sendAttachment() {
    if (!selectedAttachmentFile) {
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

    if (uploadingAttachment) {
      return;
    }

    setUploadingAttachment(true);
    setErrorMessage("");

    try {
      const { data: sessionData } =
        await supabase.auth.getSession();

      if (!sessionData.session?.user) {
        router.replace("/login");
        return;
      }

      const senderId =
        sessionData.session.user.id;

      const file = selectedAttachmentFile;

      const uploaded =
        await uploadChatAttachment(
          file,
          senderId,
          selectedConversation.id
        );

      const attachment: MessageAttachment = {
        type: attachmentType || "file",
        url: uploaded.url,
        path: uploaded.path,
        name: file.name,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
      };

      const content =
        createAttachmentContent(
          attachment
        );

      const { data, error } =
        await supabase
          .from("messages")
          .insert({
            conversation_id:
              selectedConversation.id,
            sender_id: senderId,
            content,
          })
          .select(
            "id, conversation_id, sender_id, content, created_at, read_at, updated_at"
          )
          .single();

      if (error) {
        throw new Error(
          "Pesan file gagal dibuat: " +
            error.message
        );
      }

      if (data) {
        setMessages((previous) => {
          const exists = previous.some(
            (message) =>
              message.id === data.id
          );

          if (exists) {
            return previous;
          }

          return [...previous, data];
        });
      }

      clearAttachmentPreview();

      await loadContactInfo(senderId);
    } catch (error) {
      console.error(
        "Send attachment error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "File gagal dikirim."
      );
    } finally {
      setUploadingAttachment(false);
    }
  }

  async function startVoiceRecording() {
    if (!selectedConversation) {
      setErrorMessage(
        "Pilih percakapan terlebih dahulu."
      );
      return;
    }

    if (recording) {
      return;
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setErrorMessage(
        "Browser ini tidak mendukung rekaman suara."
      );
      return;
    }

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

      let mimeType = "";

      if (
        typeof MediaRecorder !== "undefined"
      ) {
        if (
          MediaRecorder.isTypeSupported(
            "audio/webm;codecs=opus"
          )
        ) {
          mimeType =
            "audio/webm;codecs=opus";
        } else if (
          MediaRecorder.isTypeSupported(
            "audio/webm"
          )
        ) {
          mimeType = "audio/webm";
        } else if (
          MediaRecorder.isTypeSupported(
            "audio/mp4"
          )
        ) {
          mimeType = "audio/mp4";
        }
      }

      const recorder = mimeType
        ? new MediaRecorder(
            stream,
            { mimeType }
          )
        : new MediaRecorder(stream);

      mediaRecorderRef.current =
        recorder;

      recordingChunksRef.current = [];

      recorder.ondataavailable = (
        event
      ) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(
            event.data
          );
        }
      };

      recorder.onstop = async () => {
        stream
          .getTracks()
          .forEach((track) =>
            track.stop()
          );

        const finalType =
          recorder.mimeType ||
          "audio/webm";

        const blob = new Blob(
          recordingChunksRef.current,
          {
            type: finalType,
          }
        );

        recordingChunksRef.current = [];

        setRecording(false);

        if (
          recordingTimerRef.current
        ) {
          clearInterval(
            recordingTimerRef.current
          );

          recordingTimerRef.current =
            null;
        }

        setRecordingSeconds(0);

        if (blob.size === 0) {
          setErrorMessage(
            "Rekaman suara kosong."
          );
          return;
        }

        const extension =
          finalType.includes("mp4")
            ? "m4a"
            : "webm";

        const file = new File(
          [blob],
          `voice-${Date.now()}.${extension}`,
          {
            type: finalType,
          }
        );

        setSelectedAttachmentFile(file);
        setAttachmentType("audio");
        setAttachmentPreviewUrl(
          URL.createObjectURL(file)
        );
      };

      recorder.start();

      setRecording(true);
      setRecordingSeconds(0);

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
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !==
        "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
  }

  function cancelVoiceRecording() {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !==
        "inactive"
    ) {
      mediaRecorderRef.current.ondataavailable =
        null;
      mediaRecorderRef.current.onstop =
        null;

      mediaRecorderRef.current.stop();

      setRecording(false);

      if (
        recordingTimerRef.current
      ) {
        clearInterval(
          recordingTimerRef.current
        );

        recordingTimerRef.current =
          null;
      }

      recordingChunksRef.current = [];
      setRecordingSeconds(0);
    }
  }

  function formatRecordingTime(
    seconds: number
  ) {
    const minutes =
      Math.floor(seconds / 60)
        .toString()
        .padStart(2, "0");

    const remaining =
      (seconds % 60)
        .toString()
        .padStart(2, "0");

    return `${minutes}:${remaining}`;
  }

  function downloadAttachment(attachment: MessageAttachment) {
    const link = document.createElement("a");
    link.href = attachment.url;
    link.download = attachment.name;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function renderAttachment(
    attachment: MessageAttachment,
    isMine: boolean
  ) {
    if (attachment.type === "image") {
      return (
        <div className="overflow-hidden rounded-xl">
          <button
            type="button"
            onClick={() => setImagePreview(attachment)}
            className="block cursor-zoom-in"
            aria-label={`Lihat detail ${attachment.name}`}
          >
            <img
              src={attachment.url}
              alt={attachment.name}
              loading="lazy"
              className="max-h-[320px] w-full max-w-[320px] rounded-xl object-contain bg-black/5"
            />
          </button>
          <div className="mt-2 flex items-center gap-2">
            <p className={`min-w-0 flex-1 truncate text-[10px] ${isMine ? "text-blue-100" : "text-slate-400"}`}>
              {attachment.name}
            </p>
            <button
              type="button"
              onClick={() => downloadAttachment(attachment)}
              className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold ${isMine ? "bg-blue-500 text-white hover:bg-blue-400" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              Download
            </button>
          </div>
        </div>
      );
    }

    if (attachment.type === "video") {
      return (
        <div>
          <video
            controls
            playsInline
            preload="metadata"
            className="max-h-[320px] w-full max-w-[420px] rounded-xl bg-black"
          >
            <source src={attachment.url} type={attachment.mimeType || undefined} />
            Browser Anda tidak mendukung pemutaran video ini.
          </video>
          <div className="mt-2 flex items-center gap-2">
            <p className={`min-w-0 flex-1 truncate text-[10px] ${isMine ? "text-blue-100" : "text-slate-400"}`}>
              {attachment.name}
            </p>
            <button
              type="button"
              onClick={() => downloadAttachment(attachment)}
              className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold ${isMine ? "bg-blue-500 text-white hover:bg-blue-400" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              Download
            </button>
          </div>
        </div>
      );
    }

    if (attachment.type === "audio") {
      return (
        <div className="min-w-[220px] max-w-[300px]">
          <div className={`mb-2 flex items-center gap-2 text-xs font-semibold ${isMine ? "text-white" : "text-slate-700"}`}>
            <span className="text-lg">🎙️</span>
            <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
          </div>
          <audio src={attachment.url} controls preload="metadata" className="w-full" />
          <button
            type="button"
            onClick={() => downloadAttachment(attachment)}
            className={`mt-2 w-full rounded-lg px-3 py-2 text-xs font-bold ${isMine ? "bg-blue-500 text-white hover:bg-blue-400" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            Download MP3 / Audio
          </button>
        </div>
      );
    }

    return (
      <div className={`flex max-w-[320px] items-center gap-3 rounded-xl border p-3 ${isMine ? "border-blue-400 bg-blue-500" : "border-slate-200 bg-slate-50"}`}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-xl shadow-sm">📎</div>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-semibold ${isMine ? "text-white" : "text-slate-700"}`}>{attachment.name}</p>
          <p className={`mt-0.5 text-[10px] ${isMine ? "text-blue-100" : "text-slate-400"}`}>{formatFileSize(attachment.size)}</p>
        </div>
        <button
          type="button"
          onClick={() => downloadAttachment(attachment)}
          className="shrink-0 rounded-lg bg-white px-3 py-2 text-[10px] font-bold text-slate-700 shadow-sm hover:bg-slate-100"
        >
          Download
        </button>
      </div>
    );
  }

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
    } =
      supabase.auth.onAuthStateChange(
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

          if (
            event === "SIGNED_OUT"
          ) {
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

      if (
        recordingTimerRef.current
      ) {
        clearInterval(
          recordingTimerRef.current
        );
      }
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
      } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(
          sessionError.message
        );
      }

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      const authUserId =
        session.user.id;

      setCurrentUserId(authUserId);

      const {
        data: myProfile,
        error: profileError,
      } =
        await supabase
          .from("profiles")
          .select(
            "id, full_name, username, avatar_url"
          )
          .eq(
            "id",
            authUserId
          )
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
            session.user.email?.split(
              "@"
            )[0] || "Pengguna",
          username: null,
          avatar_url: null,
        };

      setProfile(
        currentProfile
      );

      await loadUsers(
        authUserId
      );

      await loadContactInfo(
        authUserId
      );
      await syncIncomingMessagesToContacts(
        authUserId
      );
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
      loadingChatRef.current =
        false;
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
      } =
        await supabase
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

  /* ============================================================
     CONTACT INFO
     ============================================================ */

  async function loadContactInfo(
    authUserId: string
  ) {
    try {
      const {
        data: relations,
        error: relationsError,
      } = await supabase
        .from("contact_relations")
        .select(
          "owner_id, contact_id, deleted_at, chat_cleared_at, blocked_at"
        )
        .eq("owner_id", authUserId);

      if (relationsError) {
        console.error(
          "Load contact relations error:",
          relationsError
        );
        return;
      }

      const relationByContact: Record<string, {
        deleted_at: string | null;
        chat_cleared_at: string | null;
        blocked_at: string | null;
      }> = {};

      (relations || []).forEach((relation) => {
        relationByContact[relation.contact_id] = {
          deleted_at: relation.deleted_at,
          chat_cleared_at: relation.chat_cleared_at,
          blocked_at: relation.blocked_at,
        };
      });

      const {
        data: myMemberships,
        error: myMembershipError,
      } =
        await supabase
          .from("conversation_members")
          .select("conversation_id")
          .eq("user_id", authUserId);

      if (myMembershipError) {
        /*
         * Jangan menghentikan seluruh daftar kontak hanya karena
         * conversation_members gagal dibaca. Pesan INSERT tetap bisa
         * menjadi sumber kontak melalui sender_id.
         */
        console.error(
          "Load memberships error:",
          myMembershipError
        );
      }

      if (
        !myMemberships ||
        myMemberships.length === 0
      ) {
        /* Tidak mengosongkan state lama jika query membership gagal. */
        if (!myMembershipError) {
          setContactInfo({});
        }
        return;
      }

      const conversationIds =
        myMemberships.map(
          (item) => item.conversation_id
        );

      const {
        data: allMembers,
        error: allMembersError,
      } =
        await supabase
          .from("conversation_members")
          .select(
            "conversation_id, user_id"
          )
          .in(
            "conversation_id",
            conversationIds
          );

      if (allMembersError) {
        /*
         * conversation_members bukan lagi single point of failure.
         * Jika RLS menolak query ini, conversationToUser akan dibangun
         * dari sender_id pesan masuk di bawah.
         */
        console.error(
          "Load all members error:",
          allMembersError
        );
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
      } =
        await supabase
          .from("messages")
          .select(
            "id, conversation_id, sender_id, content, created_at, read_at, updated_at"
          )
          .in(
            "conversation_id",
            conversationIds
          )
          .order(
            "created_at",
            { ascending: false }
          );

      if (messagesError) {
        console.error(
          "Load contact messages error:",
          messagesError
        );
        return;
      }

      /*
       * SUMBER KONTAK UTAMA UNTUK PESAN MASUK:
       * sender_id sudah berisi ID akun lawan chat. Jadi kita tidak perlu
       * menunggu conversation_members untuk mengetahui siapa pengirimnya.
       * Ini juga membuat pesan baru dapat menghidupkan kembali kontak yang
       * sebelumnya dihapus dari beranda.
       */
      (allMessages || []).forEach((message) => {
        if (message.sender_id !== authUserId) {
          conversationToUser[message.conversation_id] =
            message.sender_id;
        }
      });

      const aggregatedInfo: Record<
        string,
        ContactInfo
      > = {};

      Object.entries(
        conversationToUser
      ).forEach(
        ([conversationId, userId]) => {
          const relation =
            relationByContact[userId];

          /* Kontak yang diblokir tetap tidak boleh muncul otomatis. */
          if (relation?.blocked_at) {
            return;
          }

          const clearedAt =
            relation?.chat_cleared_at
              ? new Date(
                  relation.chat_cleared_at
                ).getTime()
              : null;

          const conversationMessages =
            (allMessages || []).filter(
              (message) => {
                if (
                  message.conversation_id !==
                  conversationId
                ) {
                  return false;
                }

                if (!clearedAt) {
                  return true;
                }

                return (
                  new Date(
                    message.created_at
                  ).getTime() > clearedAt
                );
              }
            );

          if (
            clearedAt &&
            conversationMessages.length === 0
          ) {
            return;
          }

          /*
           * Jika kontak pernah dihapus, pesan baru dari dia adalah sinyal
           * untuk menampilkan kembali kontak tersebut. Jangan menunggu
           * contact_relations berubah lebih dulu.
           */
          if (
            relation?.deleted_at &&
            !conversationMessages.some(
              (message) =>
                message.sender_id !== authUserId
            )
          ) {
            return;
          }

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
              lastMessage?.content ||
              null;
            existing.lastMessageAt =
              currentLastMessageAt;
          }
        }
      );

      setContactInfo((previous) => {
        const next = { ...aggregatedInfo };

        /* Pertahankan kontak realtime yang baru masuk jika query ini
           selesai ketika relasi/database belum sempat terlihat konsisten. */
        Object.entries(
          previous as Record<string, ContactInfo>
        ).forEach(([userId, info]) => {
          if (!next[userId] && info?.conversationId) {
            next[userId] = info;
          }
        });

        return next;
      });
    } catch (error) {
      console.error(
        "Load contact info error:",
        error
      );
    }
  }

  /* ============================================================
     DIRECT INCOMING MESSAGE -> CONTACT FALLBACK

     Daftar kontak penerima tidak lagi bergantung pada
     conversation_members atau keberhasilan UPDATE contact_relations.
     Pesan yang sudah tersimpan di messages sendiri sudah membawa
     sender_id, conversation_id, created_at, dan read_at.
     ============================================================ */
  async function syncIncomingMessagesToContacts(
    authUserId: string
  ) {
    if (!authUserId) return;

    try {
      const {
        data: relations,
        error: relationsError,
      } = await supabase
        .from("contact_relations")
        .select(
          "contact_id, deleted_at, chat_cleared_at, blocked_at"
        )
        .eq("owner_id", authUserId);

      if (relationsError) {
        console.error(
          "Incoming contact relations sync error:",
          relationsError
        );
        return;
      }

      const relationByContact: Record<
        string,
        {
          deleted_at: string | null;
          chat_cleared_at: string | null;
          blocked_at: string | null;
        }
      > = {};

      (relations || []).forEach((relation) => {
        relationByContact[relation.contact_id] = {
          deleted_at: relation.deleted_at,
          chat_cleared_at: relation.chat_cleared_at,
          blocked_at: relation.blocked_at,
        };
      });

      const {
        data: incomingMessages,
        error: incomingMessagesError,
      } = await supabase
        .from("messages")
        .select(
          "id, conversation_id, sender_id, content, created_at, read_at, updated_at"
        )
        .neq("sender_id", authUserId)
        .order("created_at", { ascending: false })
        .limit(200);

      if (incomingMessagesError) {
        console.error(
          "Incoming messages contact sync error:",
          incomingMessagesError
        );
        return;
      }

      if (!incomingMessages || incomingMessages.length === 0) {
        return;
      }

      const grouped: Record<string, ContactInfo> = {};

      incomingMessages.forEach((message) => {
        const senderId = message.sender_id;
        const relation = relationByContact[senderId];

        /* Kontak yang diblokir tidak pernah dibuka otomatis. */
        if (relation?.blocked_at) {
          return;
        }

        const messageTime = new Date(message.created_at).getTime();
        const clearedAt = relation?.chat_cleared_at
          ? new Date(relation.chat_cleared_at).getTime()
          : null;

        /* Pesan sebelum batas hapus kontak tetap tersembunyi. */
        if (clearedAt && messageTime <= clearedAt) {
          return;
        }

        const existing = grouped[senderId];

        if (!existing) {
          grouped[senderId] = {
            conversationId: message.conversation_id,
            lastMessage: message.content,
            lastMessageAt: message.created_at,
            unreadCount: message.read_at ? 0 : 1,
          };
          return;
        }

        if (!message.read_at) {
          existing.unreadCount += 1;
        }
      });

      const senderIds = Object.keys(grouped);

      if (senderIds.length === 0) {
        return;
      }

      /* Pastikan akun pengirim ada di daftar users yang dirender beranda. */
      const knownUserIds = new Set(
        users.map((user) => user.id)
      );
      const missingUserIds = senderIds.filter(
        (id) => !knownUserIds.has(id)
      );

      if (missingUserIds.length > 0) {
        const { data: missingProfiles, error: missingProfilesError } =
          await supabase
            .from("profiles")
            .select("id, full_name, username, avatar_url")
            .in("id", missingUserIds);

        if (missingProfilesError) {
          console.error(
            "Incoming contact profile sync error:",
            missingProfilesError
          );
        } else if (missingProfiles?.length) {
          setUsers((previous) => {
            const byId = new Map(
              previous.map((user) => [user.id, user])
            );
            missingProfiles.forEach((user) => {
              byId.set(user.id, user);
            });
            return Array.from(byId.values()).sort((a, b) =>
              a.full_name.localeCompare(b.full_name)
            );
          });
        }
      }

      setContactInfo((previous) => {
        const next = { ...previous };

        Object.entries(grouped).forEach(([userId, info]) => {
          const existing = next[userId];

          /*
           * Jika state realtime sudah lebih baru daripada hasil polling,
           * jangan mundurkan preview/waktu/unread-nya.
           */
          if (
            existing?.lastMessageAt &&
            info.lastMessageAt &&
            new Date(existing.lastMessageAt).getTime() >
              new Date(info.lastMessageAt).getTime()
          ) {
            return;
          }

          next[userId] = {
            ...info,
            unreadCount: Math.max(
              existing?.unreadCount || 0,
              info.unreadCount
            ),
          };
        });

        return next;
      });
    } catch (error) {
      console.error(
        "Direct incoming message contact sync error:",
        error
      );
    }
  }

  function refreshContactInfoRealtime() {
    if (!currentUserId) {
      return;
    }

    void loadContactInfo(
      currentUserId
    );

    window.setTimeout(() => {
      void loadContactInfo(
        currentUserId
      );
    }, 300);
  }

  /* ============================================================
     PRESENCE
     ============================================================ */

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

      /*
       * Jika kontak sebelumnya dihapus oleh akun ini,
       * mengklik kontak dari hasil pencarian mengaktifkannya
       * kembali dan membuat batas riwayat chat baru.
       */
      await activateContactRelation(
        authUserId,
        user.id
      );

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
      } =
        await supabase
          .from("messages")
          .select(
            "id, conversation_id, sender_id, content, created_at, read_at, updated_at"
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

      /*
       * Jangan memakai selectedUser di sini.
       * setSelectedUser() bersifat asynchronous, sehingga ketika
       * loadMessages() dipanggil tepat setelah startChat(), state
       * bisa masih berisi user sebelumnya. Cari lawan chat langsung
       * dari conversation_members agar batas chat selalu benar.
       */
      let clearedAt: number | null = null;

      const {
        data: conversationMembers,
        error: conversationMembersError,
      } = await supabase
        .from("conversation_members")
        .select("user_id")
        .eq(
          "conversation_id",
          conversationId
        );

      if (conversationMembersError) {
        throw new Error(
          conversationMembersError.message
        );
      }

      const otherMember =
        (conversationMembers || []).find(
          (member) =>
            member.user_id !== authUserId
        );

      if (otherMember?.user_id) {
        const relation =
          await getContactRelation(
            authUserId,
            otherMember.user_id
          );

        if (relation?.chat_cleared_at) {
          clearedAt = new Date(
            relation.chat_cleared_at
          ).getTime();
        }
      }

      const visibleMessages =
        (data || []).filter((message) => {
          if (!clearedAt) return true;

          return (
            new Date(
              message.created_at
            ).getTime() > clearedAt
          );
        });

      setMessages(
        visibleMessages
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
          async (payload) => {
            const newMessage =
              payload.new as Message;

            /*
             * PENTING: jangan query conversation_members untuk menentukan
             * pengirim pesan masuk. Pada event INSERT, sender_id sudah
             * merupakan ID akun yang mengirim pesan.
             *
             * Query conversation_members sebelumnya membuat realtime
             * bergantung pada RLS tabel tersebut. Jika query ditolak atau
             * terlambat, handler langsung return sehingga akun pengirim
             * tidak pernah dimasukkan ke daftar kontak penerima.
             */
            const incomingContactUserId =
              newMessage.sender_id !== currentUserId
                ? newMessage.sender_id
                : null;

            /*
             * Pesan yang kita kirim sendiri.
             */
            if (
              newMessage.sender_id ===
              currentUserId
            ) {
              refreshContactInfoRealtime();
              return;
            }

            /*
             * FIX UTAMA:
             * Penerima sendiri harus mengaktifkan kembali relasinya.
             * Sebelumnya kode hanya mengubah state React, lalu
             * loadContactInfo() membaca deleted_at dan membuang kontak
             * lagi. Sekarang database diperbaiki terlebih dahulu.
             */
            const isCurrentConversation =
              newMessage.conversation_id ===
              selectedConversationIdRef.current;

            /*
             * Chat sedang terbuka: tampilkan pesan dan tandai dibaca.
             */
            if (isCurrentConversation) {
              setMessages((previous) => {
                const exists = previous.some(
                  (message) =>
                    message.id === newMessage.id
                );

                if (exists) {
                  return previous;
                }

                return [
                  ...previous,
                  newMessage,
                ];
              });

              const {
                error,
              } = await supabase.rpc(
                "mark_conversation_read",
                {
                  p_conversation_id:
                    newMessage.conversation_id,
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
                            read_at: now,
                          }
                        : message
                  )
              );

              if (incomingContactUserId) {
                try {
                  await activateContactRelation(
                    currentUserId,
                    incomingContactUserId,
                    true
                  );
                } catch (error) {
                  /* UI chat tidak boleh gagal hanya karena sinkronisasi relasi gagal. */
                  console.error(
                    "Reactivate incoming contact error:",
                    error
                  );
                }
              }

              await loadContactInfo(
                currentUserId
              );
              return;
            }

            /*
             * Chat tidak sedang dibuka: tampilkan kontak dan unread
             * segera. Jangan bergantung pada hasil query daftar kontak
             * untuk menampilkan pesan baru.
             */
            if (incomingContactUserId) {
              setContactInfo((previous) => {
                const existing =
                  previous[incomingContactUserId];

                return {
                  ...previous,
                  [incomingContactUserId]: {
                    conversationId:
                      newMessage.conversation_id,
                    lastMessage:
                      newMessage.content,
                    lastMessageAt:
                      newMessage.created_at,
                    unreadCount:
                      (existing?.unreadCount || 0) + 1,
                  },
                };
              });
            }

            if (incomingContactUserId) {
              try {
                await activateContactRelation(
                  currentUserId,
                  incomingContactUserId,
                  true
                );
              } catch (error) {
                /*
                 * Gagal menulis contact_relations tidak boleh membatalkan
                 * tampilan kontak realtime. Jika diblokir, tetap dibiarkan
                 * tersembunyi pada sinkronisasi berikutnya.
                 */
                console.error(
                  "Sync incoming contact relation error:",
                  error
                );
              }
            }

            /*
             * Rekonsiliasi database dilakukan setelah state realtime
             * dipasang. Delay kecil mencegah hasil query lama menimpa
             * kontak baru yang baru saja masuk.
             */
            window.setTimeout(() => {
              void loadContactInfo(currentUserId);
            }, 350);

            /*
             * Pastikan event terakhir tidak hilang jika ada refresh
             * lain yang selesai bersamaan.
             */
            if (incomingContactUserId) {
              setContactInfo((previous) => {
                const existing =
                  previous[incomingContactUserId];

                return {
                  ...previous,
                  [incomingContactUserId]: {
                    conversationId:
                      newMessage.conversation_id,
                    lastMessage:
                      newMessage.content,
                    lastMessageAt:
                      newMessage.created_at,
                    unreadCount:
                      existing?.unreadCount || 1,
                  },
                };
              });
            }
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

    /*
     * FALLBACK REALTIME:
     * Jika browser/Supabase tidak mengirim postgres_changes INSERT kepada
     * halaman penerima, daftar kontak tetap direkonsiliasi otomatis.
     * Ini tidak mengubah chat/menu yang sudah bekerja dan hanya membaca
     * data terbaru secara berkala.
     */
    const contactSyncTimer = window.setInterval(() => {
      void loadContactInfo(currentUserId);
      void syncIncomingMessagesToContacts(currentUserId);
    }, 2000);

    return () => {
      window.clearInterval(contactSyncTimer);
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

  /* ============================================================
     SEND TEXT MESSAGE
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

      /*
       * Pesan baru selalu mengaktifkan kembali relasi
       * pengirim dengan penerima. Ini membuat kontak
       * langsung kembali ke beranda pengirim.
       */
      if (selectedUser?.id) {
        await activateContactRelation(
          senderId,
          selectedUser.id
        );
      }

      setContactInfo((previous) => {
        const next = { ...previous };

        if (selectedUser) {
          const existing =
            next[selectedUser.id];

          next[selectedUser.id] = {
            conversationId:
              selectedConversation.id,
            lastMessage: content,
            lastMessageAt:
              data?.created_at ||
              new Date().toISOString(),
            unreadCount:
              existing?.unreadCount || 0,
          };
        }

        return next;
      });

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

  /* ============================================================
     COPY MESSAGE
     ============================================================ */

  async function copyMessage(
    content: string
  ) {
    const attachment =
      parseAttachmentContent(
        content
      );

    const textToCopy =
      attachment
        ? attachment.url
        : content;

    try {
      await navigator.clipboard.writeText(
        textToCopy
      );

      setOpenMessageMenuId(null);
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
     START EDIT
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
      parseAttachmentContent(
        message.content
      )
    ) {
      setErrorMessage(
        "File atau media tidak dapat diedit."
      );

      setOpenMessageMenuId(null);
      return;
    }

    setEditingMessageId(
      message.id
    );

    setEditingMessageText(
      message.content
    );

    setOpenMessageMenuId(null);
  }

  function cancelEditMessage() {
    setEditingMessageId(
      null
    );

    setEditingMessageText("");
  }

  /* ============================================================
     SAVE EDIT
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
      } =
        await supabase
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
     DELETE
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
      const {
        error,
      } =
        await supabase
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
     KEYBOARD
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

    setSelectedAvatarFile(null);

    setAvatarPreview(
      profile.avatar_url
    );

    setProfileError("");
    setProfileModalOpen(true);
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

      event.target.value = "";
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

      event.target.value = "";
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

    const { data } =
      supabase.storage
        .from("avatars")
        .getPublicUrl(
          filePath
        );

    if (!data.publicUrl) {
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

        const isContact =
          Boolean(contactInfo[user.id]?.conversationId);

        /* Beranda hanya menampilkan kontak yang sudah memiliki percakapan. */
        if (!keyword) {
          return isContact;
        }

        /* Pencarian harus cocok 100% dengan nama lengkap atau username. */
        return (
          user.full_name
            .trim()
            .toLowerCase() ===
            keyword ||
          user.username
            ?.trim()
            .toLowerCase() ===
            keyword
        );
      }
    );

  /* ============================================================
     OPEN CHAT DARI NOTIFIKASI
     ============================================================
     Mendukung tautan seperti /chat?chat=<sender_user_id>.
     Ini membuat klik notifikasi langsung membuka percakapan, bukan
     kembali ke halaman kosong/beranda.
     ============================================================ */

  useEffect(() => {
    if (!currentUserId || !users.length) return;

    const params = new URLSearchParams(window.location.search);
    const targetUserId =
      params.get("chat") ||
      params.get("sender") ||
      params.get("user");

    if (!targetUserId || targetUserId === currentUserId) return;

    const targetUser = users.find(
      (user) => user.id === targetUserId
    );

    if (!targetUser) return;

    /* Hapus parameter lebih dahulu supaya refresh tidak membuka ulang. */
    params.delete("chat");
    params.delete("sender");
    params.delete("user");
    const query = params.toString();
    window.history.replaceState(
      {},
      "",
      window.location.pathname + (query ? `?${query}` : "")
    );

    void startChat(targetUser);
  }, [currentUserId, users]);

  /* ============================================================
     LOGOUT
     ============================================================ */

  async function handleLogout() {
    if (
      selectedConversation &&
      currentUserId
    ) {
      if (
        typingChannelRef.current
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
     Hanya spinner kecil + teks.
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
    <>
      {imagePreview && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setImagePreview(null)}
        >
          <div
            className="relative flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="min-w-0 pr-3">
                <p className="truncate text-sm font-bold text-slate-800">{imagePreview.name}</p>
                <p className="text-xs text-slate-400">{formatFileSize(imagePreview.size)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadAttachment(imagePreview)}
                  className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
                >
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => setImagePreview(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"
                  aria-label="Tutup pratinjau gambar"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-slate-950 p-3 sm:p-6">
              <img
                src={imagePreview.url}
                alt={imagePreview.name}
                className="max-h-[78vh] max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}

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
      {/* HEADER */}

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
            <a
              href="/chat/grup"
              onClick={(event) => event.stopPropagation()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
              title="Grup Banda Chat"
            >
              <span aria-hidden="true">👥</span>
              <span className="hidden sm:inline">Grup</span>
            </a>

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

      {/* AREA APLIKASI */}

      <div className="min-h-0 flex-1 overflow-hidden p-0 md:p-3 lg:p-4">
        <div className="mx-auto flex h-full w-full max-w-7xl min-h-0 overflow-hidden bg-white shadow-none md:rounded-2xl md:shadow-xl md:shadow-blue-100/70">

          {/* SIDEBAR */}

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
                  {filteredUsers.length}
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
                    Belum ada kontak
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    Cari nama akun atau username secara tepat untuk menambahkan kontak baru.
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
                        <div
                          key={user.id}
                          className={`flex items-stretch gap-1 rounded-2xl border p-1 transition ${
                            isSelected
                              ? "border-blue-200 bg-blue-50 shadow-sm"
                              : "border-slate-100 bg-white hover:border-blue-100 hover:bg-blue-50/50 hover:shadow-sm"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                               setOpenContactMenuUserId(null);
                               void startChat(user);
                             }}
                            disabled={startingChat}
                            className="min-w-0 flex-1 rounded-xl p-2 text-left disabled:cursor-not-allowed disabled:opacity-60"
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
                                  ? parseAttachmentContent(
                                      info.lastMessage
                                    )
                                    ? getAttachmentLabel(
                                        parseAttachmentContent(
                                          info.lastMessage
                                        )!
                                      )
                                    : info.lastMessage
                                  : user.username
                                  ? "@" +
                                    user.username
                                  : "Belum ada pesan"}
                              </p>
                            </div>
                          </div>
                          </button>

                          <div className="relative shrink-0 self-center">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setOpenContactMenuUserId(
                                  (previous) =>
                                    previous === user.id
                                      ? null
                                      : user.id
                                );
                              }}
                              disabled={startingChat}
                              className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                              title={`Menu ${user.full_name}`}
                              aria-label={`Menu ${user.full_name}`}
                            >
                              ⋮
                            </button>

                            {openContactMenuUserId === user.id && (
                              <div
                                onClick={(event) =>
                                  event.stopPropagation()
                                }
                                className="absolute right-0 top-11 z-50 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenContactMenuUserId(null);
                                    void deleteContactFromHome(user);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-3 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50 active:bg-slate-100"
                                >
                                  <span>🗑️</span>
                                  <span>Hapus kontak</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    void blockContactFromHome(user)
                                  }
                                  className="flex w-full items-center gap-2 px-3 py-3 text-left text-xs font-semibold text-red-600 hover:bg-red-50 active:bg-red-100"
                                >
                                  <span>🚫</span>
                                  <span>Blokir kontak</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </div>
          </aside>

          {/* CHAT */}

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
                    Pilih kontak untuk mulai chat
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    Setiap akun hanya muncul satu kali.
                    Klik kontak untuk membuka atau melanjutkan
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

                  <div className="relative ml-auto shrink-0">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setChatMenuOpen(
                          (previous) => !previous
                        );
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                      title="Menu percakapan"
                      aria-label="Menu percakapan"
                    >
                      ⋮
                    </button>

                    {chatMenuOpen && (
                      <div
                        onClick={(event) =>
                          event.stopPropagation()
                        }
                        className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setChatMenuOpen(false);
                            void deleteCurrentConversationForMe();
                          }}
                          className="flex w-full items-center gap-2 px-3 py-3 text-left text-xs font-semibold text-red-600 hover:bg-red-50 active:bg-red-100"
                        >
                          <span>🗑️</span>
                          <span>Hapus seluruh percakapan</span>
                        </button>
                      </div>
                    )}
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
                          Kirim pesan pertama kepada{" "}
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
                            parseAttachmentContent(
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
                                          event
                                            .target
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
                                          {message.content.split(/(https?:\/\/[^\s]+|www\.[^\s]+)/gi).map((part, index) => {
                                            const isUrl = /^(https?:\/\/|www\.)/i.test(part);
                                            if (!isUrl) return <span key={index}>{part}</span>;
                                            const href = part.startsWith("www.") ? `https://${part}` : part;
                                            return (
                                              <a
                                                key={index}
                                                href={href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={`font-semibold underline ${isMine ? "text-sky-200 hover:text-white" : "text-blue-600 hover:text-blue-700"}`}
                                                onClick={(event) => event.stopPropagation()}
                                              >
                                                {part}
                                              </a>
                                            );
                                          })}
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

                                    {/* MENU BUTTON
                                    
                                    PERBAIKAN HP:
                                    tidak memakai opacity-0.
                                    Tombol selalu terlihat sehingga
                                    touch pada HP bisa membuka menu.
                                    */}

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
                                      className={`absolute top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-sm text-slate-500 shadow-sm transition hover:bg-slate-50 ${
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
                                        className={`absolute top-full z-40 mt-2 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl ${
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
                                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50 active:bg-slate-100"
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
                                              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50 active:bg-slate-100"
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
                                            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-red-600 hover:bg-red-50 active:bg-red-100 disabled:opacity-50"
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

                    {selectedAttachmentFile && (
                      <div className="mb-3 rounded-2xl border border-blue-100 bg-blue-50 p-3">
                        <div className="flex items-start gap-3">
                          {attachmentPreviewUrl &&
                          attachmentType ===
                            "image" ? (
                            <img
                              src={
                                attachmentPreviewUrl
                              }
                              alt="Preview"
                              className="h-20 w-20 rounded-xl object-cover"
                            />
                          ) : attachmentPreviewUrl &&
                            attachmentType ===
                              "video" ? (
                            <video
                              src={
                                attachmentPreviewUrl
                              }
                              controls
                              className="h-20 w-28 rounded-xl object-cover"
                            />
                          ) : attachmentPreviewUrl &&
                            attachmentType ===
                              "audio" ? (
                            <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-white text-3xl shadow-sm">
                              🎙️
                            </div>
                          ) : (
                            <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-white text-3xl shadow-sm">
                              📎
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-slate-700">
                              {
                                selectedAttachmentFile.name
                              }
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              {formatFileSize(
                                selectedAttachmentFile.size
                              )}
                            </p>

                            <p className="mt-1 text-[10px] font-semibold text-blue-500">
                              {
                                attachmentType ===
                                "image"
                                  ? "Foto"
                                  : attachmentType ===
                                    "video"
                                  ? "Video"
                                  : attachmentType ===
                                    "audio"
                                  ? "Audio"
                                  : "Dokumen / File"
                              }
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={
                              clearAttachmentPreview
                            }
                            disabled={
                              uploadingAttachment
                            }
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm hover:bg-red-50 hover:text-red-600"
                            aria-label="Batalkan file"
                          >
                            ✕
                          </button>
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
                            ? "Mengunggah..."
                            : "Kirim File"}
                        </button>
                      </div>
                    )}

                    {/* RECORDING */}

                    {recording && (
                      <div className="mb-3 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-3">
                        <div className="flex h-10 w-10 animate-pulse items-center justify-center rounded-full bg-red-500 text-white">
                          🎙️
                        </div>

                        <div className="flex-1">
                          <p className="text-sm font-bold text-red-700">
                            Merekam suara
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
                            cancelVoiceRecording
                          }
                          className="rounded-xl px-3 py-2 text-xs font-bold text-slate-500 hover:bg-white"
                        >
                          Batal
                        </button>

                        <button
                          type="button"
                          onClick={
                            stopVoiceRecording
                          }
                          className="rounded-xl bg-red-500 px-3 py-2 text-xs font-bold text-white hover:bg-red-600"
                        >
                          Selesai
                        </button>
                      </div>
                    )}

                    <div className="relative flex items-end gap-2 sm:gap-3">

                      {/* HIDDEN INPUTS */}

                      <input
                        ref={
                          galleryInputRef
                        }
                        type="file"
                        accept="image/*"
                        onChange={(
                          event
                        ) =>
                          handleAttachmentSelected(
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
                        onChange={(
                          event
                        ) =>
                          handleAttachmentSelected(
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
                        onChange={(
                          event
                        ) =>
                          handleAttachmentSelected(
                            event,
                            "audio"
                          )
                        }
                        className="hidden"
                      />

                      <input
                        ref={
                          attachmentInputRef
                        }
                        type="file"
                        onChange={(
                          event
                        ) =>
                          handleAttachmentSelected(
                            event
                          )
                        }
                        className="hidden"
                      />

                      {/* ATTACHMENT BUTTON */}

                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={(
                            event
                          ) => {
                            event.stopPropagation();

                            if (
                              recording
                            ) {
                              return;
                            }

                            openAttachmentMenu();
                          }}
                          disabled={
                            uploadingAttachment ||
                            recording
                          }
                          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-xl text-slate-500 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Lampiran"
                        >
                          📎
                        </button>

                        {attachmentMenuOpen && (
                          <div
                            onClick={(
                              event
                            ) =>
                              event.stopPropagation()
                            }
                            className="absolute bottom-14 left-0 z-50 w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                chooseAttachment(
                                  "gallery"
                                )
                              }
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-blue-50"
                            >
                              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-pink-50 text-lg">
                                📷
                              </span>

                              <span>
                                Galeri / Foto
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                chooseAttachment(
                                  "video"
                                )
                              }
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-blue-50"
                            >
                              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-lg">
                                🎥
                              </span>

                              <span>
                                Video
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                chooseAttachment(
                                  "audio"
                                )
                              }
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-blue-50"
                            >
                              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50 text-lg">
                                🎵
                              </span>

                              <span>
                                Audio / MP3
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                chooseAttachment(
                                  "file"
                                )
                              }
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-blue-50"
                            >
                              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-lg">
                                📄
                              </span>

                              <span>
                                Dokumen / File
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setAttachmentMenuOpen(
                                  false
                                );
                                void startVoiceRecording();
                              }}
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-blue-50"
                            >
                              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-lg">
                                🎙️
                              </span>

                              <span>
                                Rekam Suara
                              </span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* TEXT INPUT */}

                      <textarea
                        value={
                          messageText
                        }
                        onChange={(
                          event
                        ) =>
                          handleMessageChange(
                            event.target.value
                          )
                        }
                        onKeyDown={
                          handleMessageKeyDown
                        }
                        disabled={
                          sendingMessage ||
                          uploadingAttachment ||
                          recording
                        }
                        rows={1}
                        placeholder="Tulis pesan..."
                        className="max-h-32 min-h-[48px] flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50 disabled:opacity-50"
                      />

                      {/* SEND */}

                      <button
                        type="button"
                        onClick={() =>
                          void sendMessage()
                        }
                        disabled={
                          sendingMessage ||
                          uploadingAttachment ||
                          recording ||
                          !messageText.trim()
                        }
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-xl font-bold text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {sendingMessage
                          ? "..."
                          : "➤"}
                      </button>
                    </div>

                    <p className="mx-auto mt-2 hidden max-w-3xl text-[10px] text-slate-400 sm:block">
                      Enter untuk mengirim ·
                      Shift + Enter untuk baris baru ·
                      📎 untuk lampiran
                    </p>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {/* ERROR */}

      {errorMessage && (
        <div className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-2xl border border-red-200 bg-white p-4 text-sm text-red-600 shadow-2xl">
          <div className="flex items-start gap-3">
            <span>⚠️</span>

            <p className="flex-1">
              {
                errorMessage
              }
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

      {/* PROFILE MODAL */}

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
            <div className="border-b border-slate-100 px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Edit Profile
                  </h2>

                  <p className="mt-1 text-xs text-slate-400">
                    Ubah nama, username, dan foto profil.
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

            <div className="p-6">
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
                  Pilih gambar dari galeri HP atau komputer.
                  Maksimal 5 MB.
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

              {profileError && (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  ⚠️{" "}
                  {
                    profileError
                  }
                </div>
              )}

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
                      event.target.value
                    )
                  }
                  disabled={
                    savingProfile
                  }
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
                />
              </div>

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
    </>
  );
}
