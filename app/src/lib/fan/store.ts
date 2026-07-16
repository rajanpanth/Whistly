import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { scorePrediction } from "./scoring";
import type {
    FanChallenge,
    FanPrediction,
    FanProfile,
    FanReaction,
    FanRecap,
    FanRoom,
    FanRoomMember,
    FanScore,
    FanOutcome,
} from "./types";

export class FanStoreError extends Error {
    constructor(public code: string, message = code) {
        super(message);
        this.name = "FanStoreError";
    }
}

type MemoryFanState = {
    challenges: Map<string, FanChallenge>;
    predictions: Map<string, FanPrediction>;
    rooms: Map<string, FanRoom>;
    members: Map<string, FanRoomMember>;
    scores: Map<string, FanScore>;
    profiles: Map<string, FanProfile>;
    reactions: FanReaction[];
};

function memoryState(): MemoryFanState {
    const root = globalThis as typeof globalThis & { __whistlyFanStore?: MemoryFanState };
    if (!root.__whistlyFanStore) {
        root.__whistlyFanStore = {
            challenges: new Map(),
            predictions: new Map(),
            rooms: new Map(),
            members: new Map(),
            scores: new Map(),
            profiles: new Map(),
            reactions: [],
        };
    }
    return root.__whistlyFanStore;
}

const configured = () =>
    Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
            (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    );

function challengeFromRow(row: Record<string, any>): FanChallenge {
    return {
        id: row.id,
        fixtureId: row.fixture_id,
        challengeType: row.challenge_type,
        durationMinutes: row.duration_minutes,
        startTs: Number(row.start_ts),
        endTs: Number(row.end_ts),
        startClockSeconds: row.start_clock_seconds,
        startHomeScore: row.start_home_score,
        startAwayScore: row.start_away_score,
        endHomeScore: row.end_home_score,
        endAwayScore: row.end_away_score,
        status: row.status,
        winningOutcome: row.winning_outcome,
        resolutionSource: row.resolution_source,
        resolvedAt: row.resolved_at ? Number(row.resolved_at) : null,
        createdAt: Number(row.created_at),
    };
}

function predictionFromRow(row: Record<string, any>): FanPrediction {
    return {
        id: row.id,
        challengeId: row.challenge_id,
        wallet: row.wallet,
        selectedOutcome: row.selected_outcome,
        submittedAt: Number(row.submitted_at),
        correct: row.correct,
        basePoints: row.base_points,
        streakMultiplierBps: row.streak_multiplier_bps,
        awardedPoints: row.awarded_points,
        scoredAt: row.scored_at ? Number(row.scored_at) : null,
    };
}

export class FanStore {
    private db: SupabaseClient | null;
    readonly durable: boolean;

    constructor(forceMemory = false) {
        this.durable = !forceMemory && configured();
        this.db = this.durable ? getSupabaseAdmin() : null;
        if (!this.durable && process.env.NODE_ENV === "production" && process.env.FAN_ALLOW_MEMORY_STORE !== "true") {
            throw new FanStoreError(
                "fan_storage_not_configured",
                "Supabase is required for Whistly Matchday in production."
            );
        }
    }

    mode() {
        return this.durable ? "supabase" : "memory";
    }

    async listChallenges(fixtureId: string): Promise<FanChallenge[]> {
        if (!this.db) {
            return [...memoryState().challenges.values()]
                .filter((item) => item.fixtureId === fixtureId)
                .sort((a, b) => a.endTs - b.endTs);
        }
        const { data, error } = await this.db
            .from("fan_challenges")
            .select("*")
            .eq("fixture_id", fixtureId)
            .order("end_ts", { ascending: true });
        if (error) throw new FanStoreError("challenge_read_failed", error.message);
        return (data ?? []).map(challengeFromRow);
    }

    async getChallenge(id: string): Promise<FanChallenge | null> {
        if (!this.db) return memoryState().challenges.get(id) ?? null;
        const { data, error } = await this.db.from("fan_challenges").select("*").eq("id", id).maybeSingle();
        if (error) throw new FanStoreError("challenge_read_failed", error.message);
        return data ? challengeFromRow(data) : null;
    }

    async createChallenge(challenge: FanChallenge): Promise<FanChallenge> {
        if (!this.db) {
            const state = memoryState();
            const active = [...state.challenges.values()].find(
                (item) =>
                    item.fixtureId === challenge.fixtureId &&
                    item.durationMinutes === challenge.durationMinutes &&
                    ["OPEN", "LOCKED", "RESOLVING"].includes(item.status)
            );
            if (active) return active;
            state.challenges.set(challenge.id, challenge);
            return challenge;
        }
        const { data, error } = await this.db
            .from("fan_challenges")
            .upsert(
                {
                    id: challenge.id,
                    fixture_id: challenge.fixtureId,
                    challenge_type: challenge.challengeType,
                    duration_minutes: challenge.durationMinutes,
                    start_ts: challenge.startTs,
                    end_ts: challenge.endTs,
                    start_clock_seconds: challenge.startClockSeconds,
                    start_home_score: challenge.startHomeScore,
                    start_away_score: challenge.startAwayScore,
                    status: challenge.status,
                    resolution_source: challenge.resolutionSource,
                    created_at: challenge.createdAt,
                },
                { onConflict: "id", ignoreDuplicates: true }
            )
            .select("*")
            .maybeSingle();
        if (error) throw new FanStoreError("challenge_create_failed", error.message);
        return data ? challengeFromRow(data) : (await this.getChallenge(challenge.id))!;
    }

    async submitPrediction(params: {
        challenge: FanChallenge;
        wallet: string;
        selectedOutcome: FanOutcome;
        now?: number;
    }): Promise<FanPrediction> {
        const now = params.now ?? Date.now();
        if (params.challenge.status !== "OPEN" || now >= params.challenge.endTs) {
            throw new FanStoreError("challenge_locked");
        }
        const id = `${params.challenge.id}:${params.wallet}`;
        const prediction: FanPrediction = {
            id,
            challengeId: params.challenge.id,
            wallet: params.wallet,
            selectedOutcome: params.selectedOutcome,
            submittedAt: now,
            correct: null,
            basePoints: 0,
            streakMultiplierBps: 10_000,
            awardedPoints: 0,
            scoredAt: null,
        };
        if (!this.db) {
            const state = memoryState();
            if (state.predictions.has(id)) throw new FanStoreError("duplicate_prediction");
            state.predictions.set(id, prediction);
            return prediction;
        }
        const { data, error } = await this.db
            .from("fan_predictions")
            .insert({
                id,
                challenge_id: prediction.challengeId,
                wallet: prediction.wallet,
                selected_outcome: prediction.selectedOutcome,
                submitted_at: prediction.submittedAt,
            })
            .select("*")
            .single();
        if (error?.code === "23505") throw new FanStoreError("duplicate_prediction");
        if (error) throw new FanStoreError("prediction_create_failed", error.message);
        return predictionFromRow(data);
    }

    async listPredictions(wallet: string, fixtureId?: string): Promise<FanPrediction[]> {
        if (!this.db) {
            const state = memoryState();
            return [...state.predictions.values()].filter((prediction) => {
                if (prediction.wallet !== wallet) return false;
                if (!fixtureId) return true;
                return state.challenges.get(prediction.challengeId)?.fixtureId === fixtureId;
            });
        }
        let query = this.db.from("fan_predictions").select("*, fan_challenges!inner(fixture_id)").eq("wallet", wallet);
        if (fixtureId) query = query.eq("fan_challenges.fixture_id", fixtureId);
        const { data, error } = await query.order("submitted_at", { ascending: false });
        if (error) throw new FanStoreError("prediction_read_failed", error.message);
        return (data ?? []).map(predictionFromRow);
    }

    async resolveChallenge(params: {
        challenge: FanChallenge;
        winningOutcome: FanOutcome;
        endHomeScore: number;
        endAwayScore: number;
        resolvedAt?: number;
    }) {
        const resolvedAt = params.resolvedAt ?? Date.now();
        if (params.challenge.status === "RESOLVED") return;
        if (!this.db) {
            const state = memoryState();
            const stored = state.challenges.get(params.challenge.id);
            if (!stored || stored.status === "RESOLVED") return;
            state.challenges.set(stored.id, {
                ...stored,
                status: "RESOLVED",
                winningOutcome: params.winningOutcome,
                endHomeScore: params.endHomeScore,
                endAwayScore: params.endAwayScore,
                resolvedAt,
            });
            for (const prediction of state.predictions.values()) {
                if (prediction.challengeId !== stored.id || prediction.scoredAt) continue;
                const memberships = [...state.members.values()].filter((member) =>
                    member.wallet === prediction.wallet &&
                    state.rooms.get(member.roomId)?.fixtureId === stored.fixtureId
                );
                let scoreBase = memberships[0]
                    ? state.scores.get(`${memberships[0].roomId}:${prediction.wallet}`)
                    : undefined;
                const scoring = scorePrediction({
                    selectedOutcome: prediction.selectedOutcome,
                    winningOutcome: params.winningOutcome,
                    currentStreak: scoreBase?.currentStreak ?? 0,
                    longestStreak: scoreBase?.longestStreak ?? 0,
                });
                state.predictions.set(prediction.id, {
                    ...prediction,
                    correct: scoring.correct,
                    basePoints: scoring.basePoints,
                    streakMultiplierBps: scoring.multiplierBps,
                    awardedPoints: scoring.awardedPoints,
                    scoredAt: resolvedAt,
                });
                for (const member of memberships) {
                    const key = `${member.roomId}:${prediction.wallet}`;
                    const current = state.scores.get(key) ?? {
                        roomId: member.roomId,
                        wallet: prediction.wallet,
                        displayName: member.displayName,
                        totalPoints: 0,
                        correctPredictions: 0,
                        totalPredictions: 0,
                        currentStreak: 0,
                        longestStreak: 0,
                        updatedAt: resolvedAt,
                    };
                    const roomScoring = scorePrediction({
                        selectedOutcome: prediction.selectedOutcome,
                        winningOutcome: params.winningOutcome,
                        currentStreak: current.currentStreak,
                        longestStreak: current.longestStreak,
                    });
                    state.scores.set(key, {
                        ...current,
                        totalPoints: current.totalPoints + roomScoring.awardedPoints,
                        correctPredictions: current.correctPredictions + (roomScoring.correct ? 1 : 0),
                        totalPredictions: current.totalPredictions + 1,
                        currentStreak: roomScoring.currentStreak,
                        longestStreak: roomScoring.longestStreak,
                        updatedAt: resolvedAt,
                    });
                }
            }
            return;
        }
        const { error } = await this.db.rpc("fan_resolve_challenge_atomic", {
            p_challenge_id: params.challenge.id,
            p_winning_outcome: params.winningOutcome,
            p_end_home_score: params.endHomeScore,
            p_end_away_score: params.endAwayScore,
            p_resolved_at: resolvedAt,
        });
        if (error) throw new FanStoreError("challenge_resolve_failed", error.message);
    }

    async voidChallenge(challenge: FanChallenge, voidedAt = Date.now()) {
        if (["RESOLVED", "VOID", "CANCELLED"].includes(challenge.status)) return;
        if (!this.db) {
            const stored = memoryState().challenges.get(challenge.id);
            if (!stored || ["RESOLVED", "VOID", "CANCELLED"].includes(stored.status)) return;
            memoryState().challenges.set(challenge.id, { ...stored, status: "VOID", resolvedAt: voidedAt });
            return;
        }
        const { error } = await this.db.from("fan_challenges").update({ status: "VOID", resolved_at: voidedAt })
            .eq("id", challenge.id).in("status", ["SCHEDULED", "OPEN", "LOCKED", "RESOLVING"]);
        if (error) throw new FanStoreError("challenge_void_failed", error.message);
    }

    async createRoom(params: { fixtureId: string; creatorWallet: string; name: string; displayName: string }) {
        const now = Date.now();
        const id = crypto.randomUUID();
        const inviteCode = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
        const room: FanRoom = {
            id,
            inviteCode,
            creatorWallet: params.creatorWallet,
            fixtureId: params.fixtureId,
            name: params.name,
            visibility: "PRIVATE",
            status: "OPEN",
            createdAt: now,
            updatedAt: now,
        };
        if (!this.db) {
            const state = memoryState();
            state.rooms.set(id, room);
            await this.joinRoom({ room, wallet: params.creatorWallet, displayName: params.displayName, role: "OWNER" });
            return room;
        }
        const { error } = await this.db.from("fan_rooms").insert({
            id,
            invite_code: inviteCode,
            creator_wallet: params.creatorWallet,
            fixture_id: params.fixtureId,
            name: params.name,
            visibility: "PRIVATE",
            status: "OPEN",
            created_at: now,
            updated_at: now,
        });
        if (error) throw new FanStoreError("room_create_failed", error.message);
        await this.joinRoom({ room, wallet: params.creatorWallet, displayName: params.displayName, role: "OWNER" });
        return room;
    }

    async getRoom(value: string): Promise<FanRoom | null> {
        if (!this.db) {
            return [...memoryState().rooms.values()].find((room) => room.id === value || room.inviteCode === value.toUpperCase()) ?? null;
        }
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
        const query = this.db.from("fan_rooms").select("*");
        const { data, error } = await (isUuid
            ? query.eq("id", value)
            : query.eq("invite_code", value.toUpperCase()))
            .maybeSingle();
        if (error) throw new FanStoreError("room_read_failed", error.message);
        return data ? {
            id: data.id,
            inviteCode: data.invite_code,
            creatorWallet: data.creator_wallet,
            fixtureId: data.fixture_id,
            name: data.name,
            visibility: data.visibility,
            status: data.status,
            createdAt: Number(data.created_at),
            updatedAt: Number(data.updated_at),
        } : null;
    }

    async joinRoom(params: { room: FanRoom; wallet: string; displayName: string; role?: "OWNER" | "MEMBER" }) {
        if (params.room.status !== "OPEN") throw new FanStoreError("room_closed");
        const member: FanRoomMember = {
            roomId: params.room.id,
            wallet: params.wallet,
            displayName: params.displayName,
            role: params.role ?? "MEMBER",
            joinedAt: Date.now(),
        };
        if (!this.db) {
            const state = memoryState();
            state.members.set(`${member.roomId}:${member.wallet}`, member);
            if (!state.scores.has(`${member.roomId}:${member.wallet}`)) {
                state.scores.set(`${member.roomId}:${member.wallet}`, {
                    roomId: member.roomId,
                    wallet: member.wallet,
                    displayName: member.displayName,
                    totalPoints: 0,
                    correctPredictions: 0,
                    totalPredictions: 0,
                    currentStreak: 0,
                    longestStreak: 0,
                    updatedAt: Date.now(),
                });
            }
            return member;
        }
        const { error } = await this.db.from("fan_room_members").upsert({
            room_id: member.roomId,
            wallet: member.wallet,
            display_name: member.displayName,
            role: member.role,
            joined_at: member.joinedAt,
        }, { onConflict: "room_id,wallet", ignoreDuplicates: true });
        if (error) throw new FanStoreError("room_join_failed", error.message);
        await this.db.from("fan_room_scores").upsert({
            room_id: member.roomId,
            wallet: member.wallet,
            display_name: member.displayName,
            updated_at: Date.now(),
        }, { onConflict: "room_id,wallet", ignoreDuplicates: true });
        return member;
    }

    async leaderboard(roomId: string): Promise<FanScore[]> {
        if (!this.db) {
            return [...memoryState().scores.values()]
                .filter((score) => score.roomId === roomId)
                .sort((a, b) => b.totalPoints - a.totalPoints || b.correctPredictions - a.correctPredictions);
        }
        const { data, error } = await this.db
            .from("fan_room_scores")
            .select("*")
            .eq("room_id", roomId)
            .order("total_points", { ascending: false })
            .order("correct_predictions", { ascending: false });
        if (error) throw new FanStoreError("leaderboard_read_failed", error.message);
        return (data ?? []).map((row) => ({
            roomId: row.room_id,
            wallet: row.wallet,
            displayName: row.display_name,
            totalPoints: row.total_points,
            correctPredictions: row.correct_predictions,
            totalPredictions: row.total_predictions,
            currentStreak: row.current_streak,
            longestStreak: row.longest_streak,
            updatedAt: Number(row.updated_at),
        }));
    }

    async addReaction(reaction: FanReaction) {
        if (!this.db) {
            memoryState().reactions.push(reaction);
            return;
        }
        const { error } = await this.db.from("fan_reactions").insert({
            id: reaction.id,
            fixture_id: reaction.fixtureId,
            wallet: reaction.wallet,
            reaction_type: reaction.reactionType,
            created_at: reaction.createdAt,
        });
        if (error) throw new FanStoreError("reaction_create_failed", error.message);
    }

    async reactionCounts(fixtureId: string): Promise<Record<string, number>> {
        let reactions: Array<{ reactionType: string }>;
        if (!this.db) {
            reactions = memoryState().reactions.filter((item) => item.fixtureId === fixtureId);
        } else {
            const { data, error } = await this.db.from("fan_reactions").select("reaction_type").eq("fixture_id", fixtureId);
            if (error) throw new FanStoreError("reaction_read_failed", error.message);
            reactions = (data ?? []).map((row) => ({ reactionType: row.reaction_type }));
        }
        return reactions.reduce<Record<string, number>>((counts, item) => {
            counts[item.reactionType] = (counts[item.reactionType] ?? 0) + 1;
            return counts;
        }, {});
    }

    async upsertProfile(profile: FanProfile) {
        if (!this.db) {
            memoryState().profiles.set(profile.wallet, profile);
            return profile;
        }
        const { error } = await this.db.from("fan_profiles").upsert({
            wallet: profile.wallet,
            display_name: profile.displayName,
            favorite_team: profile.favoriteTeam,
            avatar_seed: profile.avatarSeed,
            created_at: profile.createdAt,
            updated_at: profile.updatedAt,
        });
        if (error) throw new FanStoreError("profile_write_failed", error.message);
        return profile;
    }

    async getProfile(wallet: string): Promise<FanProfile | null> {
        if (!this.db) return memoryState().profiles.get(wallet) ?? null;
        const { data, error } = await this.db.from("fan_profiles").select("*").eq("wallet", wallet).maybeSingle();
        if (error) throw new FanStoreError("profile_read_failed", error.message);
        return data ? {
            wallet: data.wallet,
            displayName: data.display_name,
            favoriteTeam: data.favorite_team,
            avatarSeed: data.avatar_seed,
            createdAt: Number(data.created_at),
            updatedAt: Number(data.updated_at),
        } : null;
    }

    async recap(wallet: string, fixtureId: string, roomId: string | null): Promise<FanRecap> {
        const predictions = await this.listPredictions(wallet, fixtureId);
        const scored = predictions.filter((item) => item.scoredAt !== null);
        const correct = scored.filter((item) => item.correct).length;
        let totalPoints = scored.reduce((sum, item) => sum + item.awardedPoints, 0);
        let longestStreak = 0;
        let finalRank: number | null = null;
        if (roomId) {
            const board = await this.leaderboard(roomId);
            const index = board.findIndex((item) => item.wallet === wallet);
            if (index >= 0) {
                totalPoints = board[index].totalPoints;
                longestStreak = board[index].longestStreak;
                finalRank = index + 1;
            }
        }
        return {
            fixtureId,
            wallet,
            roomId,
            totalPoints,
            correctPredictions: correct,
            totalPredictions: scored.length,
            accuracy: scored.length ? Math.round((correct / scored.length) * 100) : 0,
            longestStreak,
            finalRank,
        };
    }
}

export function getFanStore() {
    return new FanStore(false);
}

export function createMemoryFanStore() {
    return new FanStore(true);
}
