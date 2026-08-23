"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = { id: string; full_name: string; username: string | null; avatar_url: string | null };
type CallKind = "audio" | "video";
type CallState = "idle" | "calling" | "incoming" | "connected";
type Signal = { type: "offer" | "answer" | "ice" | "hangup" | "reject"; callId: string; from: string; to: string; kind?: CallKind; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };

const CHANNEL = "banda-chat-calls";

type IncomingOfferWindow = Window & { __bandaIncomingOffer?: RTCSessionDescriptionInit };

export default function CallOverlay({ currentUserId, selectedUser }: { currentUserId: string; selectedUser: Profile | null }) {
  const [state, setState] = useState<CallState>("idle");
  const [kind, setKind] = useState<CallKind>("audio");
  const [peer, setPeer] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const callIdRef = useRef("");
  const peerRef = useRef<Profile | null>(null);
  const kindRef = useRef<CallKind>("audio");
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const send = (payload: Signal) => channelRef.current?.send({ type: "broadcast", event: "signal", payload });

  const cleanup = () => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    pendingIceRef.current = [];
    callIdRef.current = "";
    peerRef.current = null;
    setPeer(null);
    setState("idle");
  };

  async function createPeer(remoteId: string, callKind: CallKind) {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
    });
    pc.onicecandidate = (event) => {
      if (event.candidate && callIdRef.current) send({ type: "ice", callId: callIdRef.current, from: currentUserId, to: remoteId, candidate: event.candidate.toJSON() });
    };
    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (stream) remoteStreamRef.current = stream;
      if (remoteVideoRef.current && stream) remoteVideoRef.current.srcObject = stream;
    };
    pc.onconnectionstatechange = () => {
      if (["failed", "disconnected", "closed"].includes(pc.connectionState)) cleanup();
    };
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callKind === "video" });
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    pcRef.current = pc;
    return pc;
  }

  async function startCall(callKind: CallKind) {
    if (!selectedUser || state !== "idle") return;
    if (!navigator.mediaDevices?.getUserMedia) { setError("Browser tidak mendukung kamera/mikrofon."); return; }
    setError("");
    const id = crypto.randomUUID();
    callIdRef.current = id;
    peerRef.current = selectedUser;
    setPeer(selectedUser);
    setKind(callKind);
    kindRef.current = callKind;
    setState("calling");
    try {
      const pc = await createPeer(selectedUser.id, callKind);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send({ type: "offer", callId: id, from: currentUserId, to: selectedUser.id, kind: callKind, sdp: offer });
    } catch (e) {
      console.error(e);
      cleanup();
      setError("Kamera/mikrofon tidak dapat digunakan. Izinkan akses perangkat lalu coba lagi.");
    }
  }

  async function acceptCall() {
    const other = peerRef.current;
    const offer = (window as IncomingOfferWindow).__bandaIncomingOffer;
    if (!other || !offer) return;
    try {
      const pc = await createPeer(other.id, kindRef.current);
      await pc.setRemoteDescription(offer);
      for (const candidate of pendingIceRef.current) await pc.addIceCandidate(candidate).catch(() => undefined);
      pendingIceRef.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send({ type: "answer", callId: callIdRef.current, from: currentUserId, to: other.id, sdp: answer });
      setState("connected");
    } catch (e) {
      console.error(e);
      rejectCall();
      setError("Panggilan gagal diterima.");
    }
  }

  function rejectCall() {
    const other = peerRef.current;
    if (other && callIdRef.current) send({ type: "reject", callId: callIdRef.current, from: currentUserId, to: other.id });
    cleanup();
  }

  function endCall() {
    const other = peerRef.current;
    if (other && callIdRef.current) send({ type: "hangup", callId: callIdRef.current, from: currentUserId, to: other.id });
    cleanup();
  }

  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase.channel(CHANNEL);
    channelRef.current = channel;
    channel.on("broadcast", { event: "signal" }, async ({ payload }) => {
      const signal = payload as Signal;
      if (!signal || signal.to !== currentUserId) return;
      if (signal.type === "offer") {
        if (state !== "idle") return;
        const incoming: Profile = { id: signal.from, full_name: "Panggilan masuk", username: null, avatar_url: null };
        callIdRef.current = signal.callId;
        peerRef.current = incoming;
        setPeer(incoming);
        setKind(signal.kind || "audio");
        kindRef.current = signal.kind || "audio";
        (window as IncomingOfferWindow).__bandaIncomingOffer = signal.sdp;
        setState("incoming");
        return;
      }
      if (signal.callId !== callIdRef.current) return;
      if (signal.type === "answer" && signal.sdp && pcRef.current) {
        await pcRef.current.setRemoteDescription(signal.sdp);
        for (const candidate of pendingIceRef.current) await pcRef.current.addIceCandidate(candidate).catch(() => undefined);
        pendingIceRef.current = [];
        setState("connected");
      } else if (signal.type === "ice" && signal.candidate) {
        if (pcRef.current?.remoteDescription) await pcRef.current.addIceCandidate(signal.candidate).catch(() => undefined);
        else pendingIceRef.current.push(signal.candidate);
      } else if (signal.type === "hangup" || signal.type === "reject") cleanup();
    });
    channel.subscribe();
    return () => { channel.unsubscribe(); if (channelRef.current === channel) channelRef.current = null; cleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  if (!currentUserId) return null;

  return (
    <>
      {selectedUser && state === "idle" && (
        <div className="fixed bottom-24 right-4 z-40 flex gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-xl backdrop-blur">
          <button type="button" onClick={() => startCall("audio")} className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-xl text-white shadow hover:bg-emerald-600" aria-label="Telepon" title="Telepon">📞</button>
          <button type="button" onClick={() => startCall("video")} className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-xl text-white shadow hover:bg-blue-700" aria-label="Video call" title="Video call">🎥</button>
        </div>
      )}
      {state !== "idle" && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="bg-slate-900 px-5 py-6 text-center text-white">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-2xl">{kind === "video" ? "🎥" : "📞"}</div>
              <h2 className="text-lg font-bold">{peer?.full_name || "Panggilan"}</h2>
              <p className="mt-1 text-sm text-slate-300">{state === "incoming" ? `Panggilan ${kind === "video" ? "video" : "suara"} masuk` : state === "calling" ? "Memanggil..." : "Terhubung"}</p>
            </div>
            {kind === "video" && state !== "incoming" && (
              <div className="relative aspect-video bg-black">
                <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-contain" />
                <video ref={localVideoRef} autoPlay muted playsInline className="absolute bottom-3 right-3 h-24 w-32 rounded-xl bg-slate-800 object-cover shadow-lg" />
              </div>
            )}
            {error && <p className="px-5 pt-4 text-center text-sm text-red-600">{error}</p>}
            <div className="flex justify-center gap-3 p-5">
              {state === "incoming" ? <><button type="button" onClick={rejectCall} className="rounded-full bg-red-500 px-6 py-3 font-bold text-white">Tolak</button><button type="button" onClick={acceptCall} className="rounded-full bg-emerald-500 px-6 py-3 font-bold text-white">Terima</button></> : <button type="button" onClick={endCall} className="rounded-full bg-red-500 px-6 py-3 font-bold text-white">☎ Akhiri</button>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
