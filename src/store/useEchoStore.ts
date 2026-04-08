import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type JournalEntry = {
  id: string;
  songTitle: string;
  artist: string;
  lyricLine: string;
  positionMs: number;
  trackUri: string;
  capturedAt: string;
  weather?: string;
  forWhom?: string;
  feeling?: string;
};

export type Whisper = {
  id: string;
  songId: string;
  songTitle: string;
  artist: string;
  trackUri: string;
  forWhom: string;
  note: string;
  lyricLine?: string;
  positionMs: number;
  createdAt: string;
};

export type LyricMode = "dual" | "original" | "translated";

type EchoState = {
  /* Journal */
  journalOpen: boolean;
  setJournalOpen: (open: boolean) => void;
  entries: JournalEntry[];
  addEntry: (entry: Omit<JournalEntry, "id">) => void;
  removeEntry: (id: string) => void;

  /* Whispers */
  whispers: Whisper[];
  addWhisper: (w: Omit<Whisper, "id">) => void;
  removeWhisper: (id: string) => void;
  whisperPanelOpen: boolean;
  setWhisperPanelOpen: (open: boolean) => void;
  whisperModalOpen: boolean;
  setWhisperModalOpen: (open: boolean) => void;
  whisperModeActive: boolean;
  toggleWhisperMode: () => void;

  /* Dual-language lyrics */
  lyricMode: LyricMode;
  setLyricMode: (mode: LyricMode) => void;

  /* Album focus */
  albumFocus: boolean;
  setAlbumFocus: (open: boolean) => void;

  /* Performance */
  performanceMode: boolean;
  togglePerformanceMode: () => void;
};

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useEchoStore = create<EchoState>()(
  persist(
    (set) => ({
      journalOpen: false,
      setJournalOpen: (open) => set({ journalOpen: open }),
      entries: [],
      addEntry: (entry) =>
        set((s) => ({
          entries: [{ ...entry, id: newId() }, ...s.entries],
        })),
      removeEntry: (id) =>
        set((s) => ({
          entries: s.entries.filter((e) => e.id !== id),
        })),

      whispers: [],
      addWhisper: (w) =>
        set((s) => ({
          whispers: [{ ...w, id: newId() }, ...s.whispers],
        })),
      removeWhisper: (id) =>
        set((s) => ({
          whispers: s.whispers.filter((w) => w.id !== id),
        })),
      whisperPanelOpen: false,
      setWhisperPanelOpen: (open) => set({ whisperPanelOpen: open }),
      whisperModalOpen: false,
      setWhisperModalOpen: (open) => set({ whisperModalOpen: open }),
      whisperModeActive: false,
      toggleWhisperMode: () =>
        set((s) => ({ whisperModeActive: !s.whisperModeActive })),

      lyricMode: "dual" as LyricMode,
      setLyricMode: (mode) => set({ lyricMode: mode }),

      albumFocus: false,
      setAlbumFocus: (open) => set({ albumFocus: open }),

      performanceMode: false,
      togglePerformanceMode: () =>
        set((s) => ({ performanceMode: !s.performanceMode })),
    }),
    {
      name: "echo-haze-journal",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        entries: state.entries,
        whispers: state.whispers,
        lyricMode: state.lyricMode,
        performanceMode: state.performanceMode,
      }),
    }
  )
);
