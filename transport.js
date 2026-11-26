/**
 * Unified WebRTC Peer-to-Peer Transport Layer.
 * Supports:
 * - Zero-config serverless discovery via Trystero (Nostr relays or MQTT-over-WSS brokers)
 * - 100% relay-free Manual WebRTC SDP Offer/Answer handshake (for restricted Wi-Fi / offline LAN)
 * - Public STUN servers + user-configurable TURN relay (Problem 5)
 * - Application-layer AES-256-GCM payload encryption (Problem 11)
 * - Soft Mesh Cap (Problem 7) & DataChannel backpressure (Problem 6)
 * - Per-peer rate limiting & packet validation (Problem 9)
 */

import { decryptEnvelope, encryptEnvelope } from './crypto.js';
import { createRateLimiter, validatePacket } from './sanitize.js';

export const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

export const APP_NAMESPACE = 'peerdesk-upes-p2p-v1';
export const MAX_MESH_PEERS = 8;

async function importFirstAvailable(urls) {
  let lastErr = null;
  for (const url of urls) {
    try {
      const mod = await import(url);
      if (mod && typeof mod.joinRoom === 'function') {
        return mod;
      }
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Failed to load WebRTC signaling module');
}

export function buildRtcConfig(turnConfig = null) {
  const iceServers = [...DEFAULT_ICE_SERVERS];
  if (turnConfig && turnConfig.url && turnConfig.url.trim()) {
    const entry = { urls: turnConfig.url.trim() };
    if (turnConfig.username) entry.username = turnConfig.username.trim();
    if (turnConfig.credential) entry.credential = turnConfig.credential.trim();
    iceServers.push(entry);
  }
  return { iceServers };
}

/** Wait for ICE gathering to finish (or time out gracefully after 3.5s) for single-copy SDP tokens. */
function waitForIceGathering(pc, timeoutMs = 3500) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', onChange);
      resolve();
    }, timeoutMs);

    function onChange() {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(timer);
        pc.removeEventListener('icegatheringstatechange', onChange);
        resolve();
      }
    }
    pc.addEventListener('icegatheringstatechange', onChange);
  });
}

function encodeToken(obj) {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function decodeToken(token) {
  const bin = atob(token.trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return JSON.parse(new TextDecoder().decode(bytes));
}

export class P2PTransport {
  constructor({
    mode = 'nostr',
    roomTopic,
    aesKey = null,
    turnConfig = null,
    localPeerId,
    maxPeers = MAX_MESH_PEERS,
    onPeerJoin = () => {},
    onPeerLeave = () => {},
    onPacket = () => {},
    onStatus = () => {},
    onError = () => {},
  }) {
    this.mode = mode;
    this.roomTopic = roomTopic;
    this.aesKey = aesKey;
    this.rtcConfig = buildRtcConfig(turnConfig);
    this.localPeerId = localPeerId;
    this.maxPeers = maxPeers;

    this.onPeerJoin = onPeerJoin;
    this.onPeerLeave = onPeerLeave;
    this.onPacket = onPacket;
    this.onStatus = onStatus;
    this.onError = onError;

    this.rateLimiter = createRateLimiter({ maxTokens: 120, refillPerSec: 60 });
    this.trysteroRoom = null;
    this.sendCtrlAction = null;
    this.sendFileAction = null;

    // Manual RTCPeerConnection map: peerId -> { pc, ctrlDc, fileDc, connected }
    this.manualPeers = new Map();
    this.pendingManualOffers = new Map(); // tempId -> { pc, ctrlDc, fileDc }
    this.connectedPeerIds = new Set();
    this.closed = false;
  }

  async start() {
    if (this.mode === 'manual') {
      this.onStatus({
        state: 'ready-manual',
        detail: 'Manual WebRTC mode active (zero signaling servers). Create or paste an Invite/Answer token.',
      });
      return;
    }

    this.onStatus({
      state: 'connecting',
      detail: `Connecting via ${this.mode.toUpperCase()} public signaling relays...`,
    });

    const cdnList =
      this.mode === 'mqtt'
        ? [
            'https://esm.run/@trystero-p2p/mqtt@0.26.0',
            'https://cdn.jsdelivr.net/npm/@trystero-p2p/mqtt@0.26.0/+esm',
            'https://cdn.jsdelivr.net/npm/trystero@0.22.0/mqtt.min.js',
          ]
        : [
            'https://esm.run/@trystero-p2p/nostr@0.26.0',
            'https://cdn.jsdelivr.net/npm/@trystero-p2p/nostr@0.26.0/+esm',
            'https://cdn.jsdelivr.net/npm/trystero@0.22.0/nostr.min.js',
          ];

    const mod = await importFirstAvailable(cdnList);
    if (this.closed) return;

    this.trysteroRoom = mod.joinRoom(
      {
        appId: APP_NAMESPACE,
        rtcConfig: this.rtcConfig,
      },
      this.roomTopic
    );

    const [sendCtrl, getCtrl] = this.trysteroRoom.makeAction('pd-ctrl');
    const [sendFile, getFile] = this.trysteroRoom.makeAction('pd-file');
    this.sendCtrlAction = sendCtrl;
    this.sendFileAction = sendFile;

    const onJoin = this.trysteroRoom.onPeerJoin || this.trysteroRoom.onUserJoin;
    const onLeave = this.trysteroRoom.onPeerLeave || this.trysteroRoom.onUserLeave;

    if (typeof onJoin === 'function') {
      onJoin((peerId) => {
        if (this.connectedPeerIds.size >= this.maxPeers && !this.connectedPeerIds.has(peerId)) {
          this.onStatus({
            state: 'mesh-cap',
            detail: `Mesh soft-cap (${this.maxPeers} peers) reached; limiting extra direct links.`,
          });
        }
        this.connectedPeerIds.add(peerId);
        this.onPeerJoin(peerId);
      });
    }

    if (typeof onLeave === 'function') {
      onLeave((peerId) => {
        this.connectedPeerIds.delete(peerId);
        this.rateLimiter.reset(peerId);
        this.onPeerLeave(peerId);
      });
    }

    getCtrl((payload, peerId) => this._handleIncoming(payload, peerId));
    getFile((payload, peerId) => this._handleIncoming(payload, peerId));

    this.onStatus({
      state: 'listening',
      detail: `Listening on ${this.mode.toUpperCase()} signaling. Share the Room Code or Invite Link to connect.`,
    });
  }

  async _handleIncoming(rawPayload, peerId) {
    if (this.closed) return;
    if (!this.rateLimiter.allow(peerId)) {
      this.onError(`Rate limit exceeded for peer ${String(peerId).slice(0, 8)}`);
      return;
    }

    let packet = rawPayload;
    if (this.aesKey) {
      try {
        packet = await decryptEnvelope(this.aesKey, rawPayload);
      } catch {
        this.onError(`Rejected undecryptable packet from ${String(peerId).slice(0, 8)} (wrong passcode?)`);
        return;
      }
    } else if (rawPayload && rawPayload.enc) {
      this.onError(`Peer ${String(peerId).slice(0, 8)} sent encrypted traffic, but no passcode is set.`);
      return;
    }

    const check = validatePacket(packet);
    if (!check.ok) {
      this.onError(`Dropped invalid packet from ${String(peerId).slice(0, 8)}: ${check.reason}`);
      return;
    }

    this.onPacket(packet, peerId);
  }

  /** Send a control packet (chat, note, stroke, sync, tombstone) to all peers or a specific peerId. */
  async sendControl(packet, targetPeerId = undefined) {
    if (this.closed) return;
    const wirePayload = this.aesKey ? await encryptEnvelope(this.aesKey, packet) : packet;

    if (this.trysteroRoom && this.sendCtrlAction) {
      try {
        await this.sendCtrlAction(wirePayload, targetPeerId);
      } catch (err) {
        this.onError(`Control send error: ${err?.message || err}`);
      }
    }

    this._sendManual('ctrl', wirePayload, targetPeerId);
  }

  /** Send a file chunk packet over the dedicated file DataChannel with backpressure. */
  async sendFilePacket(packet, targetPeerId = undefined) {
    if (this.closed) return;
    const wirePayload = this.aesKey ? await encryptEnvelope(this.aesKey, packet) : packet;

    if (this.trysteroRoom && this.sendFileAction) {
      try {
        await this.sendFileAction(wirePayload, targetPeerId);
        // Yield briefly so SCTP buffer doesn't saturate during multi-MB bursts
        await new Promise((r) => setTimeout(r, 8));
      } catch (err) {
        this.onError(`File send error: ${err?.message || err}`);
      }
    }

    await this._sendManualWithBackpressure('file', wirePayload, targetPeerId);
  }

  _sendManual(channelKind, wirePayload, targetPeerId) {
    const serialized = JSON.stringify(wirePayload);
    for (const [peerId, entry] of this.manualPeers) {
      if (targetPeerId && peerId !== targetPeerId) continue;
      const dc = channelKind === 'file' ? entry.fileDc : entry.ctrlDc;
      if (dc && dc.readyState === 'open') {
        dc.send(serialized);
      }
    }
  }

  async _sendManualWithBackpressure(channelKind, wirePayload, targetPeerId) {
    const serialized = JSON.stringify(wirePayload);
    for (const [peerId, entry] of this.manualPeers) {
      if (targetPeerId && peerId !== targetPeerId) continue;
      const dc = channelKind === 'file' ? entry.fileDc : entry.ctrlDc;
      if (!dc || dc.readyState !== 'open') continue;
      if (dc.bufferedAmount > 256 * 1024) {
        await new Promise((resolve) => {
          dc.bufferedAmountLowThreshold = 64 * 1024;
          const onLow = () => {
            dc.removeEventListener('bufferedamountlow', onLow);
            resolve();
          };
          dc.addEventListener('bufferedamountlow', onLow);
          setTimeout(resolve, 1500);
        });
      }
      if (dc.readyState === 'open') dc.send(serialized);
    }
  }

  /**
   * Manual Mode Step 1 (Host/Offerer): Create an SDP Offer token (with ICE candidates gathered).
   */
  async createManualOffer() {
    if (this.connectedPeerIds.size >= this.maxPeers) {
      throw new Error(`Mesh cap of ${this.maxPeers} peers reached.`);
    }
    const sessionId = `man-${crypto.randomUUID().slice(0, 8)}`;
    const pc = new RTCPeerConnection(this.rtcConfig);
    const ctrlDc = pc.createDataChannel('pd-ctrl', { ordered: true });
    const fileDc = pc.createDataChannel('pd-file', { ordered: true });

    const remotePeerId = `manual-${sessionId}`;
    this._wireManualConnection(pc, ctrlDc, fileDc, remotePeerId);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIceGathering(pc);

    this.pendingManualOffers.set(sessionId, { pc, ctrlDc, fileDc, remotePeerId });
    return {
      sessionId,
      token: encodeToken({
        v: 1,
        kind: 'offer',
        sessionId,
        peerId: this.localPeerId,
        sdp: pc.localDescription,
      }),
    };
  }

  /**
   * Manual Mode Step 2 (Joiner/Answerer): Accept Offer token, return Answer token.
   */
  async acceptManualOffer(offerToken) {
    if (this.connectedPeerIds.size >= this.maxPeers) {
      throw new Error(`Mesh cap of ${this.maxPeers} peers reached.`);
    }
    const parsed = decodeToken(offerToken);
    if (!parsed || parsed.kind !== 'offer' || !parsed.sdp) {
      throw new Error('Invalid Offer token');
    }
    const remotePeerId = String(parsed.peerId || `manual-${parsed.sessionId || Date.now()}`);
    const pc = new RTCPeerConnection(this.rtcConfig);

    const entry = { pc, ctrlDc: null, fileDc: null, connected: false };
    this.manualPeers.set(remotePeerId, entry);
    this._wireManualPeerLifecycle(pc, entry, remotePeerId);

    pc.ondatachannel = (ev) => {
      if (ev.channel.label === 'pd-file') {
        entry.fileDc = ev.channel;
        this._wireManualDataChannel(ev.channel, entry, remotePeerId);
      } else {
        entry.ctrlDc = ev.channel;
        this._wireManualDataChannel(ev.channel, entry, remotePeerId);
      }
    };

    await pc.setRemoteDescription(parsed.sdp);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await waitForIceGathering(pc);

    return encodeToken({
      v: 1,
      kind: 'answer',
      sessionId: parsed.sessionId,
      peerId: this.localPeerId,
      sdp: pc.localDescription,
    });
  }

  /**
   * Manual Mode Step 3 (Offerer): Accept Answer token to finalize direct DataChannel.
   */
  async acceptManualAnswer(sessionId, answerToken) {
    const parsed = decodeToken(answerToken);
    if (!parsed || parsed.kind !== 'answer' || !parsed.sdp) {
      throw new Error('Invalid Answer token');
    }
    const pending = this.pendingManualOffers.get(sessionId || parsed.sessionId);
    if (!pending) {
      throw new Error('No matching pending offer found for this Answer token');
    }
    this.pendingManualOffers.delete(sessionId || parsed.sessionId);

    const actualRemoteId = String(parsed.peerId || pending.remotePeerId);
    // Re-key manualPeers under actualRemoteId if needed
    if (this.manualPeers.has(pending.remotePeerId)) {
      const entry = this.manualPeers.get(pending.remotePeerId);
      this.manualPeers.delete(pending.remotePeerId);
      this.manualPeers.set(actualRemoteId, entry);
    }
    await pending.pc.setRemoteDescription(parsed.sdp);
    return actualRemoteId;
  }

  _wireManualConnection(pc, ctrlDc, fileDc, peerId) {
    const entry = { pc, ctrlDc, fileDc, connected: false };
    this.manualPeers.set(peerId, entry);
    this._wireManualPeerLifecycle(pc, entry, peerId);
    this._wireManualDataChannel(ctrlDc, entry, peerId);
    this._wireManualDataChannel(fileDc, entry, peerId);
  }

  _wireManualPeerLifecycle(pc, entry, peerId) {
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        if (entry.connected) {
          entry.connected = false;
          this.connectedPeerIds.delete(peerId);
          this.onPeerLeave(peerId);
        }
      }
    };
  }

  _wireManualDataChannel(dc, entry, peerId) {
    if (!dc) return;
    dc.onopen = () => {
      if (!entry.connected) {
        entry.connected = true;
        this.connectedPeerIds.add(peerId);
        this.onPeerJoin(peerId);
      }
    };
    dc.onclose = () => {
      const bothClosed =
        (!entry.ctrlDc || entry.ctrlDc.readyState === 'closed') &&
        (!entry.fileDc || entry.fileDc.readyState === 'closed');
      if (entry.connected && bothClosed) {
        entry.connected = false;
        this.connectedPeerIds.delete(peerId);
        this.onPeerLeave(peerId);
      }
    };
    dc.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data);
        this._handleIncoming(parsed, peerId);
      } catch {
        this.onError(`Invalid JSON from manual peer ${peerId}`);
      }
    };
  }

  /** Inspect underlying RTCPeerConnections for ICE/NAT diagnostics. */
  async getDiagnostics() {
    const peerConnections = new Map();
    if (this.trysteroRoom && typeof this.trysteroRoom.getPeers === 'function') {
      const peers = this.trysteroRoom.getPeers();
      for (const [id, pc] of Object.entries(peers)) {
        peerConnections.set(id, pc);
      }
    }
    for (const [id, entry] of this.manualPeers) {
      peerConnections.set(id, entry.pc);
    }

    const report = [];
    for (const [peerId, pc] of peerConnections) {
      let candidateType = 'unknown';
      let rttMs = null;
      try {
        const stats = await pc.getStats();
        let activePairId = null;
        const candidates = new Map();
        stats.forEach((stat) => {
          if (stat.type === 'transport' && stat.selectedCandidatePairId) {
            activePairId = stat.selectedCandidatePairId;
          }
          if (stat.type === 'local-candidate') {
            candidates.set(stat.id, stat);
          }
        });
        stats.forEach((stat) => {
          if (stat.type === 'candidate-pair' && (stat.id === activePairId || stat.nominated)) {
            if (typeof stat.currentRoundTripTime === 'number') {
              rttMs = Math.round(stat.currentRoundTripTime * 1000);
            }
            const localCand = candidates.get(stat.localCandidateId);
            if (localCand && localCand.candidateType) {
              candidateType = localCand.candidateType;
            }
          }
        });
      } catch {
        // Ignore stats access errors
      }
      report.push({
        peerId,
        iceState: pc.iceConnectionState || 'unknown',
        connState: pc.connectionState || 'unknown',
        candidateType,
        rttMs,
      });
    }
    return report;
  }

  /** Attempt ICE restart across active peer connections. */
  async restartIce() {
    let count = 0;
    if (this.trysteroRoom && typeof this.trysteroRoom.getPeers === 'function') {
      const peers = this.trysteroRoom.getPeers();
      for (const pc of Object.values(peers)) {
        if (typeof pc.restartIce === 'function') {
          pc.restartIce();
          count++;
        }
      }
    }
    for (const entry of this.manualPeers.values()) {
      if (typeof entry.pc.restartIce === 'function') {
        entry.pc.restartIce();
        count++;
      }
    }
    return count;
  }

  getConnectedCount() {
    return this.connectedPeerIds.size;
  }

  async destroy() {
    this.closed = true;
    if (this.trysteroRoom && typeof this.trysteroRoom.leave === 'function') {
      try {
        await this.trysteroRoom.leave();
      } catch {
        // ignore leave error
      }
    }
    for (const entry of this.manualPeers.values()) {
      try {
        entry.pc.close();
      } catch {
        // ignore
      }
    }
    for (const pending of this.pendingManualOffers.values()) {
      try {
        pending.pc.close();
      } catch {
        // ignore
      }
    }
    this.manualPeers.clear();
    this.pendingManualOffers.clear();
    this.connectedPeerIds.clear();
  }
}
