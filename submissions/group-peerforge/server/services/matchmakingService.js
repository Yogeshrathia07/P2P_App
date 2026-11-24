// In-memory matchmaking queue and pending matches state
const queue = [];
const pendingMatches = new Map();

/**
 * Add a developer to the matchmaking queue
 */
export const addToQueue = ({ socketId, userId, userDetails, track, difficulty }) => {
  // Clean up any existing entries for this socket or user
  removeFromQueue(socketId);
  const existingIdx = queue.findIndex((item) => String(item.userId) === String(userId));
  if (existingIdx !== -1) {
    queue.splice(existingIdx, 1);
  }

  const entry = {
    socketId,
    userId: String(userId),
    userDetails: {
      name: userDetails?.name || "Developer",
      email: userDetails?.email || "",
      avatarUrl: userDetails?.profile?.avatarUrl || "",
      targetRoles: userDetails?.profile?.targetRoles || [],
    },
    track,
    difficulty,
    joinedAt: Date.now(),
  };

  queue.push(entry);
  console.log(`[Matchmaker] User queued: ${entry.userDetails.name} (${track} - ${difficulty}). Queue size: ${queue.length}`);

  return findMatch();
};

/**
 * Remove a developer from the matchmaking queue (e.g. disconnect or cancel)
 */
export const removeFromQueue = (socketId) => {
  const index = queue.findIndex((item) => item.socketId === socketId);
  if (index !== -1) {
    const removed = queue.splice(index, 1)[0];
    console.log(`[Matchmaker] User left queue: ${removed.userDetails.name}. Queue size: ${queue.length}`);
    return removed;
  }
  return null;
};

/**
 * Find compatible peers in the queue
 */
export const findMatch = () => {
  const now = Date.now();
  const RELAXATION_THRESHOLD_MS = 45 * 1000; // 45 seconds

  for (let i = 0; i < queue.length; i++) {
    for (let j = i + 1; j < queue.length; j++) {
      const userA = queue[i];
      const userB = queue[j];

      // Same track required
      if (userA.track !== userB.track) continue;

      const waitA = now - userA.joinedAt;
      const waitB = now - userB.joinedAt;
      const isRelaxed = waitA > RELAXATION_THRESHOLD_MS || waitB > RELAXATION_THRESHOLD_MS;

      // Exact difficulty match OR relaxed difficulty
      if (userA.difficulty === userB.difficulty || isRelaxed) {
        // Remove both from queue
        queue.splice(j, 1);
        queue.splice(i, 1);

        const matchId = `match_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const pendingMatch = {
          matchId,
          userA,
          userB,
          track: userA.track,
          difficulty: isRelaxed ? "Mixed" : userA.difficulty,
          acceptedUsers: new Set(),
          expiresAt: Date.now() + 15000, // 15 seconds
        };

        pendingMatches.set(matchId, pendingMatch);
        console.log(`[Matchmaker] Match created: ${matchId} between ${userA.userDetails.name} & ${userB.userDetails.name}`);
        return pendingMatch;
      }
    }
  }

  return null;
};

/**
 * Handle acceptance by one peer
 */
export const handleAccept = ({ matchId, userId }) => {
  const match = pendingMatches.get(matchId);
  if (!match) return null;

  match.acceptedUsers.add(String(userId));

  // Check if both users accepted
  const userAId = String(match.userA.userId);
  const userBId = String(match.userB.userId);

  if (match.acceptedUsers.has(userAId) && match.acceptedUsers.has(userBId)) {
    pendingMatches.delete(matchId);
    const roomId = `room_${matchId}`;
    return {
      confirmed: true,
      roomId,
      match,
    };
  }

  return {
    confirmed: false,
    acceptedCount: match.acceptedUsers.size,
    match,
  };
};

/**
 * Handle decline or timeout of a match
 */
export const handleDecline = ({ matchId, userId }) => {
  const match = pendingMatches.get(matchId);
  if (!match) return null;

  pendingMatches.delete(matchId);

  // Identify who didn't decline (the other user to re-queue)
  const isUserA = String(match.userA.userId) === String(userId);
  const otherUser = isUserA ? match.userB : match.userA;

  // Re-queue other peer with priority (joinedAt backdated)
  if (otherUser) {
    otherUser.joinedAt = Date.now() - 40000; // Prioritize in queue
    queue.unshift(otherUser);
    console.log(`[Matchmaker] Re-queued partner: ${otherUser.userDetails.name} at front of queue`);
  }

  return {
    cancelled: true,
    reQueuedUser: otherUser,
  };
};

/**
 * Clean up matches associated with a socket upon disconnect
 */
export const cleanupSocketMatches = (socketId) => {
  for (const [matchId, match] of pendingMatches.entries()) {
    if (match.userA.socketId === socketId || match.userB.socketId === socketId) {
      handleDecline({
        matchId,
        userId: match.userA.socketId === socketId ? match.userA.userId : match.userB.userId,
      });
    }
  }
};

export default {
  addToQueue,
  removeFromQueue,
  findMatch,
  handleAccept,
  handleDecline,
  cleanupSocketMatches,
};

