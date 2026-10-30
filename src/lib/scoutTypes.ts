import type { RankEntry, Scout, ScoutRecent } from "@/lib/riot";

export type ScoutRequestPlayer = { puuid?: string | null; championId: number; team: "mine" | "enemy"; position?: string; name?: string | null };

export type ScoutPlayerOut = {
  puuid: string | null;
  team: "mine" | "enemy";
  championId: number;
  champion: string; // ID pro Data Dragon
  championName: string;
  position: string;
  name: string | null;
  me: boolean;
  rank: RankEntry | null;
  recent: ScoutRecent[];
  top: Scout["top"];
  failed: boolean; // scouting se nepodařilo načíst (limit Riotu)
};

export type ScoutResponse = {
  version: string;
  players: ScoutPlayerOut[];
  advice: string[];
  build: { champion: string; championName: string; games: number; wins: number; keystone: number; secondary: number; items: number[] } | null;
  runes: Record<string, string>;
};
