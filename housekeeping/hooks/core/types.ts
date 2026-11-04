export type FileKey = 'backlog' | 'playbook'
export type Level = 'error' | 'warning' | 'recommendation'
export type Finding = { level: Level; rule: string; file?: FileKey; line?: number; message: string }

export type Settings = {
  version: 1
  project: string
  mainBranch: string                                   // default 'main'
  files: Record<FileKey, { path: string; skipSections: string[] }>   // '##' heading prefixes not pending
  columns: { id: string; item: string; milestone: string; who: string; landNow: string; trigger: string;
             waitsOn: string; details?: string; filed?: string; priority?: string; triggerType?: string }
  values: { who: { agent: string[]; owner: string[]; both: string[] }; nothing: string[];
            priority?: string[]; triggerType?: string[] }
  ids: string[]                                        // regex sources; a cell is an ID when one matches it whole
  none: string                                         // default 'none'
  done: { file: FileKey; sectionPrefix: string; idColumn: number; landedColumn: number;
          milestoneColumn?: number; fileByIdPrefix?: Partial<Record<FileKey, string>> }[]
  paths: { name: string; shared?: boolean; milestones: { name: string; doneWhen?: string }[] }[]
  whereWeAre?: { file: FileKey; heading: string; marker?: string }
  checklists: { file: FileKey; heading: string; milestone?: string }[]
  notDoing?: { file: FileKey; heading: string }
  decisions?: string
  duties: { triggerPrefix: string }                    // default 'Every'
  defaultUntilDecided: string                          // default 'Default until decided:'
}

export type LandNow = { state: 'yes' | 'choice' | 'no'; why: string; valid: boolean }
export type Row = { id: string; item: string; file: FileKey; section: string; line: number;
  milestones: string[]; who: 'agent' | 'owner' | 'both' | 'unknown'; whoRaw: string; landNow: LandNow;
  trigger: string; waitsOn: string[]; details: string; filed: string; priority: string;
  extra: Record<string, string> }
export type DoneEntry = { file: FileKey; line: number; cells: string[]; ids: string[]; item: string;
  landed: string; milestone: string | null }
export type ChecklistLine = { file: FileKey; heading: string; group: string; line: number;
  ticked: boolean; text: string; ids: string[]; milestone?: string }
export type Parsed = { rows: Row[]; done: DoneEntry[]; checklists: ChecklistLine[];
  whereWeAre: { file: FileKey; line: number; text: string; date: string | null } | null;
  notDoing: { item: string; why: string; reopen: string }[];
  tables: { file: FileKey; line: number; header: string[] }[]; findings: Finding[] }  // tables: the pending ones

export type Counts = { all: number; closed: number; open: number; yes: number; choice: number; no: number;
  perFile: Record<FileKey, { open: number; closed: number; yes: number; choice: number; no: number }>;
  needYou: number; waitsOnRow: number; noMilestone: number; queue: number }
export type Facts = { counts: Counts; unlocks: Record<string, string[]>; opens: Record<string, number>;
  before: Record<string, string[]>; closedIds: string[]; doors: string[]; duties: string[];
  landNow: string[]; queue: string[]; waitingOnRows: string[]; byHand: string[] }
export type Station = { milestone: string; doneWhen?: string; shared: boolean; reached: boolean;
  stops: string[]; chain: number; gate: string | null }
export type Lane = { path: string; stations: Station[]; next: string | null }

export type CommitInfo = { sha: string; date: string; subject: string }
export type Snapshot = { open: Record<string, FileKey>; closed: string[]; whereWeAre: string | null }
export type HistoryEntry = CommitInfo & { opened: string[]; closed: string[]; moved: string[];
  gone: string[]; whereWeAre: boolean }

export type PageRow = { id: string; item: string; file: FileKey; section: string; line: number;
  milestones: string[]; who: Row['who']; landNow: LandNow['state']; landNowWhy: string; trigger: string;
  waitsOn: string[]; unlocks: string[]; opens: number; details: string; filed: string; priority: string;
  defaultUntilDecided: string | null; firstSeen: CommitInfo | null }
export type PageData = { project: string; commit: string; date: string; counts: Counts;
  whereWeAre: Parsed['whereWeAre']; lanes: Lane[]; rows: PageRow[];
  done: { ids: string[]; item: string; landed: string; milestone: string | null; file: FileKey }[];
  landNow: string[]; queue: { id: string; before: string | null; paths: string[]; holdsUp: number }[];
  doors: string[]; waitingOnRows: string[]; byHand: string[];
  duties: { id: string; trigger: string; lastDone: string | null }[];
  checklists: ChecklistLine[]; history: HistoryEntry[]; findings: Finding[]; notDoing: Parsed['notDoing'] }

export type BuildInput = { settings: Settings; files: Record<FileKey, string | null>; head: CommitInfo;
  snapshots: (Snapshot & CommitInfo)[] }
export type BuildOutput = { parsed: Parsed; facts: Facts; lanes: Lane[]; history: HistoryEntry[];
  findings: Finding[]; data: PageData; html: string | null; brief: string; partition: string }
