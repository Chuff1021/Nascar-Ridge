import {
  Banknote,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDot,
  Crown,
  Download,
  Gauge,
  Headphones,
  Lock,
  LogOut,
  MessageCircle,
  Pause,
  Plus,
  RadioTower,
  RefreshCw,
  Send,
  ShieldCheck,
  Save,
  Trophy,
  Upload,
  UserRound,
  UsersRound,
  Volume2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type Hls from 'hls.js'
import './App.css'

type View = 'garage' | 'league' | 'live' | 'chat' | 'admin' | 'account'

type Player = {
  id: string
  name: string
  handle: string
  color: string
  passcode: string
  isAdmin?: boolean
}

type Driver = {
  number: string
  name: string
  team: string
}

// A leftover "community" car co-owned by a small team of neighbors who split
// the pot if it wins the race.
type CommunityTeam = {
  driver: Driver
  memberIds: string[]
}

type Week = {
  id: string
  race: string
  track: string
  date: string
  seriesId: SeriesId
  participantIds: string[]
  paidBy: string[]
  assignments: Record<string, Driver[]>
  communityTeams?: CommunityTeam[]
  // When this week's lineup was last drawn/published. Lets a fresh re-draw win
  // a sync over an equal-size older draw instead of being held back by the
  // "keep the richest lineup" rule.
  drawnAt?: string
  winnerId?: string
  secondId?: string
  // Auto-recorded from the live finish: the car that won and the owner(s) who
  // take the pot (one id for an individual car, the whole team for a community car).
  winningDriverNumber?: string
  winnerTeamIds?: string[]
  secondDriverNumber?: string
  secondTeamIds?: string[]
}

type ChatMessage = {
  id: string
  playerId: string
  body: string
  sentAt: string
}

type AppState = {
  players: Player[]
  weeks: Week[]
  activeWeekId: string
  currentUserId?: string
  messages: ChatMessage[]
}

// The shared, cross-device slice of league state stored in Vercel KV via
// /api/state — everything friends should see in common, minus per-device fields.
type SharedState = {
  players?: Player[]
  weeks?: Week[]
  activeWeekId?: string
}

type LiveVehicle = {
  position: number
  vehicleNumber: string
  driverName: string
  manufacturer?: string
  startingPosition?: number
  lapsCompleted: number
  lastLapSpeed?: number
  delta?: string
}

type LiveRace = {
  lapNumber: number
  lapsInRace: number
  lapsToGo: number
  flagState: number
  raceId?: number
  raceName?: string
  trackName?: string
  liveSeriesId?: SeriesId
  vehicles: LiveVehicle[]
  updatedAt: string
}

type AudioChannel = {
  streamNumber: number
  driverNumber: string
  driverName: string
  url: string
  requiresAuth: boolean
}

// One concurrently-playing scanner stream. The analyser lets us read the live
// audio level so we can highlight whichever driver is actually talking.
type ScannerPlayer = {
  audio: HTMLAudioElement
  hls?: Hls
  analyser?: AnalyserNode
  data?: Uint8Array<ArrayBuffer>
  // Timestamp of the last moment this stream was loud enough to count as
  // "talking" — used to hold the highlight briefly so it doesn't flicker
  // between words.
  lastLoud?: number
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const STORAGE_KEY = 'shuyler-ridge-raceday-v4-state'
const BACKUP_KEY = 'shuyler-ridge-raceday-backup'
const SESSION_KEY = 'shuyler-ridge-raceday-session'
const INVITE_CODE = 'raceday'
const NASCAR_SEASON = new Date().getFullYear()

function driverKey(name: string) {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function headshotUrl(driverId: number, seriesId: SeriesId) {
  const source = `https://cf.nascar.com/data/images/drivers/${NASCAR_SEASON}/${seriesId}/${driverId}.png`
  // Tiles render the face at ~46px; serve a 96px edge-cached/resized copy
  // through Vercel's image optimizer instead of the full 320KB PNG. In local
  // dev (no optimizer) fall back to the raw CDN url.
  if (import.meta.env.DEV) return source
  return `/_vercel/image?url=${encodeURIComponent(source)}&w=96&q=75`
}

function carBadgeUrl(number: string, seriesId: SeriesId) {
  return `https://cf.nascar.com/data/images/carbadges/${seriesId}/${number}.png`
}

const players: Player[] = [
  { id: 'cody', name: 'Cody', handle: 'Pole Sitter', color: '#ef233c', passcode: 'raceday' },
  { id: 'emily', name: 'Emily', handle: 'High Line', color: '#1d4ed8', passcode: 'raceday' },
  { id: 'cory', name: 'Cory', handle: 'Bumper Tag', color: '#facc15', passcode: 'raceday' },
  { id: 'sku', name: 'Sku', handle: 'Pit Wizard', color: '#7c3aed', passcode: 'raceday' },
  { id: 'tyler', name: 'Tyler', handle: 'Wide Open', color: '#0f8b5f', passcode: 'raceday' },
  { id: 'hillary', name: 'Hillary', handle: 'Draft Queen', color: '#ec4899', passcode: 'raceday' },
  { id: 'colton', name: 'Colton', handle: 'Commissioner', color: '#0891b2', passcode: 'raceday', isAdmin: true },
  { id: 'shannon', name: 'Shannon', handle: 'Loose Lug', color: '#f97316', passcode: 'raceday' },
  { id: 'nate', name: 'Nate', handle: 'Short Track', color: '#334155', passcode: 'raceday' },
  { id: 'lundy', name: 'Lundy', handle: 'Wall Rider', color: '#84cc16', passcode: 'raceday' },
]

const neighborColors = ['#ef233c', '#1d4ed8', '#facc15', '#7c3aed', '#0f8b5f', '#ec4899', '#0891b2', '#f97316', '#84cc16']

const drivers: Driver[] = [
  { number: '1', name: 'Ross Chastain', team: 'Trackhouse Racing' },
  { number: '2', name: 'Austin Cindric', team: 'Team Penske' },
  { number: '3', name: 'Austin Dillon', team: 'Richard Childress Racing' },
  { number: '4', name: 'Noah Gragson', team: 'Front Row Motorsports' },
  { number: '5', name: 'Kyle Larson', team: 'Hendrick Motorsports' },
  { number: '6', name: 'Brad Keselowski', team: 'RFK Racing' },
  { number: '7', name: 'Daniel Suarez', team: 'Spire Motorsports' },
  { number: '9', name: 'Chase Elliott', team: 'Hendrick Motorsports' },
  { number: '10', name: 'Ty Dillon', team: 'Kaulig Racing' },
  { number: '11', name: 'Denny Hamlin', team: 'Joe Gibbs Racing' },
  { number: '12', name: 'Ryan Blaney', team: 'Team Penske' },
  { number: '16', name: 'AJ Allmendinger', team: 'Kaulig Racing' },
  { number: '17', name: 'Chris Buescher', team: 'RFK Racing' },
  { number: '19', name: 'Chase Briscoe', team: 'Joe Gibbs Racing' },
  { number: '20', name: 'Christopher Bell', team: 'Joe Gibbs Racing' },
  { number: '21', name: 'Josh Berry', team: 'Wood Brothers Racing' },
  { number: '22', name: 'Joey Logano', team: 'Team Penske' },
  { number: '23', name: 'Bubba Wallace', team: '23XI Racing' },
  { number: '24', name: 'William Byron', team: 'Hendrick Motorsports' },
  { number: '34', name: 'Todd Gilliland', team: 'Front Row Motorsports' },
  { number: '35', name: 'Riley Herbst', team: '23XI Racing' },
  { number: '38', name: 'Zane Smith', team: 'Front Row Motorsports' },
  { number: '41', name: 'Cole Custer', team: 'Haas Factory Team' },
  { number: '42', name: 'John Hunter Nemechek', team: 'Legacy Motor Club' },
  { number: '43', name: 'Erik Jones', team: 'Legacy Motor Club' },
  { number: '45', name: 'Tyler Reddick', team: '23XI Racing' },
  { number: '47', name: 'Ricky Stenhouse Jr.', team: 'Hyak Motorsports' },
  { number: '48', name: 'Alex Bowman', team: 'Hendrick Motorsports' },
  { number: '51', name: 'Cody Ware', team: 'Rick Ware Racing' },
  { number: '54', name: 'Ty Gibbs', team: 'Joe Gibbs Racing' },
  { number: '60', name: 'Ryan Preece', team: 'RFK Racing' },
  { number: '71', name: 'Michael McDowell', team: 'Spire Motorsports' },
  { number: '77', name: 'Carson Hocevar', team: 'Spire Motorsports' },
  { number: '78', name: 'Daniel Dye', team: 'Live Fast Motorsports' },
  { number: '88', name: 'Connor Zilisch', team: 'Trackhouse Racing' },
  { number: '97', name: 'Shane van Gisbergen', team: 'Trackhouse Racing' },
]

const allPlayerIds = players.map((player) => player.id)

const remainingCupSchedule = [
  { id: 'w5', race: 'Cracker Barrel 400', track: 'Nashville Superspeedway', date: 'May 31' },
  { id: 'w6', race: 'FireKeepers Casino 400', track: 'Michigan International Speedway', date: 'Jun 7' },
  { id: 'w7', race: 'The Great American Getaway 400', track: 'Pocono Raceway', date: 'Jun 14' },
  { id: 'w8', race: 'San Diego', track: 'Naval Base Coronado', date: 'Jun 21' },
  { id: 'w9', race: 'Sonoma', track: 'Sonoma Raceway', date: 'Jun 28' },
  { id: 'w10', race: 'Chicagoland', track: 'Chicagoland Speedway', date: 'Jul 5' },
  { id: 'w11', race: 'EchoPark Atlanta', track: 'EchoPark Speedway', date: 'Jul 12' },
  { id: 'w12', race: 'North Wilkesboro', track: 'North Wilkesboro Speedway', date: 'Jul 19' },
  { id: 'w13', race: 'Indianapolis', track: 'Indianapolis Motor Speedway', date: 'Jul 26' },
  { id: 'w14', race: 'Iowa', track: 'Iowa Speedway', date: 'Aug 9' },
  { id: 'w15', race: 'Richmond', track: 'Richmond Raceway', date: 'Aug 15' },
  { id: 'w16', race: 'New Hampshire', track: 'New Hampshire Motor Speedway', date: 'Aug 23' },
  { id: 'w17', race: 'Daytona', track: 'Daytona International Speedway', date: 'Aug 29' },
  { id: 'w18', race: 'Darlington', track: 'Darlington Raceway', date: 'Sep 6' },
  { id: 'w19', race: 'WWTR St. Louis', track: 'World Wide Technology Raceway', date: 'Sep 13' },
  { id: 'w20', race: 'Bristol Night Race', track: 'Bristol Motor Speedway', date: 'Sep 19' },
  { id: 'w21', race: 'Kansas', track: 'Kansas Speedway', date: 'Sep 27' },
  { id: 'w22', race: 'Las Vegas', track: 'Las Vegas Motor Speedway', date: 'Oct 4' },
  { id: 'w23', race: 'Charlotte Roval', track: 'Charlotte Motor Speedway Road Course', date: 'Oct 11' },
  { id: 'w24', race: 'Phoenix', track: 'Phoenix Raceway', date: 'Oct 18' },
  { id: 'w25', race: 'Talladega', track: 'Talladega Superspeedway', date: 'Oct 25' },
  { id: 'w26', race: 'Martinsville', track: 'Martinsville Speedway', date: 'Nov 1' },
  { id: 'w27', race: 'Homestead-Miami Championship', track: 'Homestead-Miami Speedway', date: 'Nov 8' },
]

type SeriesId = 1 | 2 | 3

const seriesMeta: Record<SeriesId, { short: string; name: string; day: string }> = {
  3: { short: 'Trucks', name: 'Craftsman Truck Series', day: 'Friday' },
  2: { short: 'Xfinity', name: 'Xfinity Series', day: 'Saturday' },
  1: { short: 'Cup', name: 'Cup Series', day: 'Sunday' },
}

const currentCupWeekId = 'w7'

// Sunday Cup only. Truck/Xfinity choices are intentionally hidden from the
// active race workflow so the draw cannot land on the wrong series.
const raceWeekend: Array<{ seriesId: SeriesId; id: string; race: string; track: string; date: string }> = [
  { seriesId: 1, id: currentCupWeekId, race: 'The Great American Getaway 400', track: 'Pocono Raceway', date: 'Jun 14' },
]

const starterState: AppState = {
  activeWeekId: currentCupWeekId,
  players,
  weeks: [
    createOpenWeek('w1', 'Daytona 500', 'Daytona International Speedway', 'Feb 15'),
    createOpenWeek('w2', 'Pennzoil 400', 'Las Vegas Motor Speedway', 'Mar 2'),
    createOpenWeek('w3', 'Food City 500', 'Bristol Motor Speedway', 'Apr 12'),
    createOpenWeek('w4', 'Coca-Cola 600', 'Charlotte Motor Speedway', 'May 24'),
    ...remainingCupSchedule.map((race) =>
      race.id === 'w5'
        ? createOpenWeek('w5', 'Cracker Barrel 400', 'Nashville Superspeedway', 'May 31', 1)
        : createOpenWeek(race.id, race.race, race.track, race.date),
    ),
  ],
  messages: [],
}

const publicViews: Array<{ id: View; label: string; Icon: typeof Gauge }> = [
  { id: 'garage', label: 'Garage', Icon: Gauge },
  { id: 'league', label: 'League', Icon: Trophy },
  { id: 'live', label: 'Live', Icon: RadioTower },
  { id: 'chat', label: 'Chat', Icon: MessageCircle },
  { id: 'account', label: 'Account', Icon: UserRound },
]

const adminView = { id: 'admin' as const, label: 'Admin', Icon: Lock }

function entriesToObject<T>(entries: Array<[string, T]>) {
  return entries.reduce<Record<string, T>>((result, [key, value]) => {
    result[key] = value
    return result
  }, {})
}

function createOpenWeek(id: string, race: string, track: string, date: string, seriesId: SeriesId = 1): Week {
  return {
    id,
    race,
    track,
    date,
    seriesId,
    participantIds: allPlayerIds,
    paidBy: [],
    assignments: entriesToObject(players.map((player) => [player.id, [] as Driver[]])),
  }
}

function weekPickCount(week: Week) {
  const individual = Object.values(week.assignments ?? {}).reduce((total, picks) => total + (picks?.length ?? 0), 0)
  return individual + (week.communityTeams?.length ?? 0)
}

// Gather every saved snapshot on this device: the current key, the backup, and
// any older versioned keys left behind by past releases. This is how draws
// survive a storage-key change in a future deploy — we never read just one key.
function collectSavedStates(): AppState[] {
  const ordered: string[] = [STORAGE_KEY, BACKUP_KEY]
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (key && key.startsWith('shuyler-ridge-raceday') && key.includes('state') && !ordered.includes(key)) {
      ordered.push(key)
    }
  }

  const states: AppState[] = []
  for (const key of ordered) {
    const raw = window.localStorage.getItem(key)
    if (!raw) {
      continue
    }
    try {
      const parsed = JSON.parse(raw) as AppState
      if (parsed && Array.isArray(parsed.weeks)) {
        states.push(parsed)
      }
    } catch {
      // Skip anything that isn't valid saved state.
    }
  }
  return states
}

// Decide whether an incoming week's lineup should replace the one we already
// have. Never replace a real draw with an empty one; otherwise the NEWER draw
// wins (by drawnAt), a timestamped re-draw beats a legacy un-timestamped one,
// and as a last resort the richer pick count wins. This is what lets a fresh
// re-draw propagate instead of being stuck behind an equal-size older draw.
function preferIncomingDraw(existing: Week, incoming: Week): boolean {
  const existingPicks = weekPickCount(existing)
  const incomingPicks = weekPickCount(incoming)
  if (incomingPicks === 0) {
    return false
  }
  if (existingPicks === 0) {
    return true
  }
  if (incoming.drawnAt && existing.drawnAt) {
    return incoming.drawnAt > existing.drawnAt
  }
  if (incoming.drawnAt && !existing.drawnAt) {
    return true
  }
  if (!incoming.drawnAt && existing.drawnAt) {
    return false
  }
  return incomingPicks > existingPicks
}

// Merge snapshots so no race's result is ever lost. Race results (winner/second)
// are always kept additively; the lineup follows preferIncomingDraw.
function mergeSavedStates(states: AppState[]): AppState {
  const base = states[0]
  const byId = new Map<string, Week>()
  base.weeks.forEach((week) => byId.set(week.id, week))

  states.slice(1).forEach((state) => {
    state.weeks.forEach((week) => {
      const existing = byId.get(week.id)
      if (!existing) {
        byId.set(week.id, week)
        return
      }
      const winnerFields = {
        winnerId: existing.winnerId ?? week.winnerId,
        secondId: existing.secondId ?? week.secondId,
        winningDriverNumber: existing.winningDriverNumber ?? week.winningDriverNumber,
        winnerTeamIds: existing.winnerTeamIds ?? week.winnerTeamIds,
        secondDriverNumber: existing.secondDriverNumber ?? week.secondDriverNumber,
        secondTeamIds: existing.secondTeamIds ?? week.secondTeamIds,
      }
      if (preferIncomingDraw(existing, week)) {
        byId.set(week.id, {
          ...existing,
          assignments: week.assignments,
          communityTeams: week.communityTeams ?? existing.communityTeams,
          drawnAt: week.drawnAt ?? existing.drawnAt,
          paidBy: existing.paidBy?.length ? existing.paidBy : week.paidBy,
          ...winnerFields,
        })
      } else {
        byId.set(week.id, { ...existing, ...winnerFields })
      }
    })
  })

  const messages = states.reduce<ChatMessage[]>(
    (all, snapshot) => mergeMessages(all, snapshot.messages ?? []),
    [],
  )

  return { ...base, weeks: Array.from(byId.values()), messages }
}

// Fold the shared league blob (from /api/state) into this device's state. Local
// always wins for per-device fields — who's logged in here, which week this
// phone is viewing, and the local chat cache — while draws/players/results are
// merged with the same "keep the richest lineup, never drop one" rule as
// mergeSavedStates. This is how a neighbor's phone picks up the commissioner's
// draw without ever clobbering anything it already had.
function mergeSharedState(local: AppState, remote: SharedState): AppState {
  const remoteSnapshot: AppState = {
    ...local,
    weeks: Array.isArray(remote.weeks) ? remote.weeks : [],
    messages: [],
  }
  const merged = mergeSavedStates([local, remoteSnapshot])
  const localIds = new Set(local.players.map((player) => player.id))
  const extraPlayers = (remote.players ?? []).filter((player) => player && player.id && !localIds.has(player.id))
  const players = extraPlayers.length ? [...local.players, ...extraPlayers] : local.players

  // Note: we intentionally keep this device's own active week. Every phone
  // independently follows the live race (see the auto-follow effect), so we
  // don't adopt a remote active week — that used to fight the live-race jump
  // and could snap everyone onto a stale week.
  return { ...merged, players }
}

// The slice of state we share across phones. currentUserId (per-device login)
// and messages (their own endpoint) are intentionally excluded.
function toSharedState(state: AppState): SharedState {
  return { players: state.players, weeks: state.weeks, activeWeekId: state.activeWeekId }
}

function loadState(): AppState {
  const states = collectSavedStates()
  if (states.length === 0) {
    return starterState
  }

  const merged = states.length === 1 ? states[0] : mergeSavedStates(states)

  try {
    return normalizeSavedState(merged)
  } catch {
    // Migration failed — never discard the user's draws. Fall back to the raw
    // merged state so saveState can't overwrite real picks with starter data.
    return merged
  }
}

function normalizeSavedState(saved: AppState): AppState {
  const savedCustomPlayers = (saved.players ?? []).filter((player) => !players.some((defaultPlayer) => defaultPlayer.id === player.id))
  const mergedPlayers = [...players, ...savedCustomPlayers]
  const canonicalIds = new Set(mergedPlayers.map((player) => player.id))

  const weeks: Week[] = saved.weeks.map((week) => ({
    ...week,
    seriesId: (week.seriesId ?? 1) as SeriesId,
    participantIds: week.participantIds.filter((id) => canonicalIds.has(id)),
    paidBy: week.paidBy.filter((id) => canonicalIds.has(id)),
    assignments: entriesToObject(mergedPlayers.map((player) => [player.id, week.assignments[player.id] ?? []])),
  }))

  let activeWeekId = saved.activeWeekId
  let addedWeekendRace = false

  raceWeekend.forEach((meta) => {
    const existing = weeks.find((week) => week.id === meta.id)
    if (existing) {
      existing.seriesId = meta.seriesId
      existing.race = meta.race
      existing.track = meta.track
      existing.date = meta.date
      return
    }

    const week: Week = {
      id: meta.id,
      race: meta.race,
      track: meta.track,
      date: meta.date,
      seriesId: meta.seriesId,
      participantIds: mergedPlayers.map((player) => player.id),
      paidBy: [],
      assignments: entriesToObject(mergedPlayers.map((player) => [player.id, [] as Driver[]])),
    }
    const insertAt = weeks.findIndex((candidate) => candidate.id === 'w5')
    if (insertAt >= 0) {
      weeks.splice(insertAt, 0, week)
    } else {
      weeks.push(week)
    }
    addedWeekendRace = true
  })

  if (addedWeekendRace || activeWeekId !== currentCupWeekId) {
    activeWeekId = currentCupWeekId
  }

  return {
    ...saved,
    players: mergedPlayers,
    weeks,
    activeWeekId,
  }
}

function loadSession() {
  return window.localStorage.getItem(SESSION_KEY) ?? undefined
}

function loadInitialView(): View {
  const requested = new URLSearchParams(window.location.search).get('view')
  const allowed: View[] = ['garage', 'league', 'live', 'chat', 'admin', 'account']

  return allowed.includes(requested as View) ? (requested as View) : 'garage'
}

function saveState(state: AppState) {
  const serialized = JSON.stringify(state)
  window.localStorage.setItem(STORAGE_KEY, serialized)
  // Keep a second copy under a key that no migration touches, so draws and chat
  // history survive even if the primary key is ever wiped or a future migration
  // misbehaves.
  if (hasAnyDraw(state) || state.messages.length > 0) {
    window.localStorage.setItem(BACKUP_KEY, serialized)
  }
}

function hasAnyDraw(state: AppState) {
  return state.weeks.some((week) => Object.values(week.assignments).some((assigned) => assigned.length > 0))
}

function createPlayerId(name: string, existingIds: string[]) {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || `neighbor-${Date.now()}`

  if (!existingIds.includes(base)) {
    return base
  }

  let index = 2
  while (existingIds.includes(`${base}-${index}`)) {
    index += 1
  }

  return `${base}-${index}`
}

function createNeighbor(name: string, existingPlayers: Player[]): Player {
  const id = createPlayerId(
    name,
    existingPlayers.map((player) => player.id),
  )

  return {
    id,
    name: name.trim(),
    handle: 'New Neighbor',
    color: neighborColors[existingPlayers.length % neighborColors.length],
    passcode: INVITE_CODE,
  }
}

function randomInt(max: number) {
  if (window.crypto?.getRandomValues) {
    const array = new Uint32Array(1)
    window.crypto.getRandomValues(array)
    return array[0] % max
  }

  return Math.floor(Math.random() * max)
}

function seededValue(seed: string) {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash)
}

function shuffle<T>(items: T[], seed?: string) {
  const result = [...items]
  let offset = seed ? seededValue(seed) : randomInt(999999)

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = seed ? offset % (i + 1) : randomInt(i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
    offset = Math.imul(offset + i + 17, 48271) >>> 0
  }

  return result
}

// The authoritative field of cars for a draw is the live-feed entry list, not
// the scanner mapping (which also carries Race Control, MRN, spotters, etc.).
function fieldFromLiveRace(liveRace: LiveRace | undefined): Driver[] {
  const seen = new Set<string>()
  const field: Driver[] = []
  for (const vehicle of liveRace?.vehicles ?? []) {
    const number = (vehicle.vehicleNumber ?? '').trim()
    const name = (vehicle.driverName ?? '').trim()
    if (!number || number === '--' || !name || name === 'Unknown driver' || seen.has(number)) {
      continue
    }
    seen.add(number)
    field.push({ number, name, team: vehicle.manufacturer ?? '' })
  }
  return field
}

function drawPoolForWeek(week: Week, liveRace: LiveRace | undefined): { pool: Driver[]; source: string } {
  const liveField = fieldFromLiveRace(liveRace)
  const liveMatchesWeek =
    liveRace?.liveSeriesId === week.seriesId &&
    Boolean(liveRace.trackName) &&
    normalizeTrackKey(liveRace.trackName) === normalizeTrackKey(week.track)

  if (liveMatchesWeek && liveField.length >= 15) {
    return { pool: liveField, source: 'live Cup field' }
  }

  return { pool: drivers, source: 'verified Cup entry list' }
}

// Split N players into `teamCount` teams as evenly as possible: the first few
// teams absorb the remainder. e.g. 12 players into 5 teams -> 3,3,2,2,2.
function partitionTeams(playerIds: string[], teamCount: number): string[][] {
  if (teamCount <= 0) {
    return []
  }
  const teams: string[][] = []
  const base = Math.floor(playerIds.length / teamCount)
  const extra = playerIds.length % teamCount
  let index = 0
  for (let i = 0; i < teamCount; i += 1) {
    const size = base + (i < extra ? 1 : 0)
    teams.push(playerIds.slice(index, index + size))
    index += size
  }
  return teams
}

// New draw model: every participant gets an EVEN number of individual cars
// (floor(field / players)); the leftover cars become shared "community" cars,
// one per team, with the players split into that many teams.
function dealField(
  roster: Player[],
  participantIds: string[],
  driverPool: Driver[],
  seed?: string,
): { assignments: Record<string, Driver[]>; communityTeams: CommunityTeam[] } {
  const participants = roster.filter((player) => participantIds.includes(player.id))
  const assignments = entriesToObject(roster.map((player) => [player.id, [] as Driver[]]))

  if (participants.length === 0 || driverPool.length === 0) {
    return { assignments, communityTeams: [] }
  }

  const playerOrder = shuffle(participants, seed ? `${seed}-players` : undefined)
  const driverOrder = shuffle(driverPool, seed ? `${seed}-drivers` : undefined)

  const n = playerOrder.length
  const base = Math.floor(driverOrder.length / n)
  const individualCount = base * n

  // Each player gets exactly `base` individual cars.
  playerOrder.forEach((player, i) => {
    assignments[player.id] = driverOrder.slice(i * base, i * base + base)
  })

  // Whatever's left over is shared by teams of neighbors — one car per team.
  const leftover = driverOrder.slice(individualCount)
  const teams = partitionTeams(
    playerOrder.map((player) => player.id),
    leftover.length,
  )
  const communityTeams: CommunityTeam[] = leftover.map((driver, i) => ({
    driver,
    memberIds: teams[i] ?? [],
  }))

  return { assignments, communityTeams }
}

function createNewWeek(race: string, roster: Player[]): Week {
  const clean = race.trim()
  return {
    id: `week-${Math.random().toString(36).slice(2)}`,
    race: clean,
    track: 'Next race',
    date: 'TBD',
    seriesId: 1,
    participantIds: roster.map((player) => player.id),
    paidBy: [],
    assignments: entriesToObject(roster.map((player) => [player.id, [] as Driver[]])),
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

// Split amounts can be fractional (a $45 pot two ways is $22.50), so show cents
// when they aren't whole dollars instead of rounding and misstating the math.
function formatSplit(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function createChatMessage(playerId: string, body: string): ChatMessage {
  return {
    id: window.crypto?.randomUUID?.() ?? `message-${Math.random().toString(36).slice(2)}`,
    playerId,
    body,
    sentAt: new Date().toISOString(),
  }
}

// Union two message lists by id and order them oldest-first. Used both to merge
// the shared (server) feed with the local cache and to recover history across
// storage-key changes, so a message is never dropped once it has been seen.
function mergeMessages(a: ChatMessage[] = [], b: ChatMessage[] = []): ChatMessage[] {
  const byId = new Map<string, ChatMessage>()
  for (const message of [...a, ...b]) {
    if (message && message.id) {
      byId.set(message.id, message)
    }
  }
  return Array.from(byId.values()).sort((x, y) =>
    x.sentAt < y.sentAt ? -1 : x.sentAt > y.sentAt ? 1 : 0,
  )
}

// Display helper: ISO timestamps render as a friendly time (plus date if it
// wasn't today). Legacy time-only strings ("3:45 PM") are shown as-is.
function formatChatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (date.toDateString() === new Date().toDateString()) {
    return time
  }
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${time}`
}

// Collapse a track name to a comparison key so the live feed's "Michigan Int'l
// Speedway" matches the season schedule's "Michigan International Speedway".
function normalizeTrackKey(track: string | undefined): string {
  return (track ?? '')
    .toLowerCase()
    .replace(/int'?l|international/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function flagLabel(flagState: number) {
  const flags: Record<number, string> = {
    1: 'Green',
    2: 'Yellow',
    3: 'Red',
    4: 'Finish',
    6: 'Stopped',
    8: 'Warm up',
    9: 'Inactive',
  }

  return flags[flagState] ?? 'Unknown'
}

function normalizeLiveRace(data: unknown): LiveRace {
  const feed = data as {
    lap_number?: number
    laps_in_race?: number
    laps_to_go?: number
    flag_state?: number
    race_id?: number
    run_name?: string
    track_name?: string
    series_id?: number
    vehicles?: Array<{
      running_position?: number
      vehicle_number?: string
      vehicle_manufacturer?: string
      starting_position?: number
      laps_completed?: number
      last_lap_speed?: number
      delta?: string
      driver?: { full_name?: string }
    }>
  }

  const seriesId = feed.series_id
  return {
    lapNumber: feed.lap_number ?? 0,
    lapsInRace: feed.laps_in_race ?? 0,
    lapsToGo: feed.laps_to_go ?? 0,
    flagState: feed.flag_state ?? 9,
    raceId: feed.race_id,
    raceName: feed.run_name?.trim() || undefined,
    trackName: feed.track_name?.trim() || undefined,
    liveSeriesId: seriesId === 1 || seriesId === 2 || seriesId === 3 ? seriesId : undefined,
    updatedAt: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    vehicles: (feed.vehicles ?? [])
      .map((vehicle, index) => ({
        position: vehicle.running_position ?? index + 1,
        vehicleNumber: vehicle.vehicle_number ?? '--',
        driverName: vehicle.driver?.full_name ?? 'Unknown driver',
        manufacturer: vehicle.vehicle_manufacturer,
        startingPosition: vehicle.starting_position,
        lapsCompleted: vehicle.laps_completed ?? 0,
        lastLapSpeed: vehicle.last_lap_speed,
        delta: vehicle.delta,
      }))
      .sort((a, b) => a.position - b.position),
  }
}

function normalizeAudioChannels(data: unknown): AudioChannel[] {
  const mapping = data as {
    audio_config?: Array<{
      stream_number?: number
      driver_number?: string
      driver_name?: string
      base_url?: string
      stream_ios?: string
      stream_safari?: string
      requiresAuth?: boolean
    }>
  }

  return (mapping.audio_config ?? [])
    .map((channel) => {
      const baseUrl = channel.base_url ?? ''
      const streamPath = channel.stream_ios ?? channel.stream_safari ?? ''

      return {
        streamNumber: channel.stream_number ?? 0,
        driverNumber: channel.driver_number ?? '',
        driverName: channel.driver_name ?? 'Unknown',
        url: streamPath.startsWith('http') ? streamPath : `${baseUrl}${streamPath}`,
        requiresAuth: Boolean(channel.requiresAuth),
      }
    })
    .filter((channel) => channel.driverNumber && channel.url)
}

function getLiveVehicle(liveRace: LiveRace | undefined, driver: Driver) {
  return liveRace?.vehicles.find((vehicle) => vehicle.vehicleNumber === driver.number)
}

// Who holds a given car this week: a single player (individual car) or a whole
// team (community car). Returns undefined if the car wasn't part of the draw.
type CarOwnership = { memberIds: string[]; isCommunity: boolean; driver?: Driver }
function ownersOfCar(week: Week, carNumber: string): CarOwnership | undefined {
  for (const [playerId, picks] of Object.entries(week.assignments ?? {})) {
    const match = picks.find((driver) => driver.number === carNumber)
    if (match) {
      return { memberIds: [playerId], isCommunity: false, driver: match }
    }
  }
  const team = (week.communityTeams ?? []).find((entry) => entry.driver.number === carNumber)
  if (team) {
    return { memberIds: team.memberIds, isCommunity: true, driver: team.driver }
  }
  return undefined
}

function startingPositionLabel(vehicle: LiveVehicle | undefined) {
  return vehicle?.startingPosition ? `Start ${vehicle.startingPosition}` : 'Start --'
}

function hasDraw(week: Week) {
  return Object.values(week.assignments).some((assigned) => assigned.length > 0)
}

function isLiveTimingActive(race: LiveRace | undefined) {
  if (!race) {
    return false
  }

  const isCompleted = race.lapsInRace > 0 && race.lapNumber >= race.lapsInRace && race.lapsToGo === 0

  return race.flagState !== 9 && !isCompleted
}

// True once a race is over (checkered flag, or all scheduled laps run). Used to
// lock in the pot winner from the final running order.
function isRaceFinal(race: LiveRace | undefined) {
  if (!race) {
    return false
  }
  if (race.flagState === 4) {
    return true
  }
  return race.lapsInRace > 0 && race.lapsToGo === 0 && race.lapNumber >= race.lapsInRace
}

function DriverFace({
  driverId,
  seriesId,
  color,
  initial,
}: {
  driverId: number | undefined
  seriesId: SeriesId
  color: string
  initial: string
}) {
  const [failed, setFailed] = useState(false)

  if (!driverId || failed) {
    return (
      <div className="driver-face fallback" style={{ background: color }}>
        {initial}
      </div>
    )
  }

  return (
    <div className="driver-face">
      <img src={headshotUrl(driverId, seriesId)} alt="" loading="lazy" onError={() => setFailed(true)} />
    </div>
  )
}

function CarBadge({ number, seriesId }: { number: string; seriesId: SeriesId }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return <span className="car-badge text">{number}</span>
  }

  return (
    <img
      className="car-badge"
      src={carBadgeUrl(number, seriesId)}
      alt={`Car number ${number}`}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

function App() {
  // Multi-stream scanner mixer: each selected driver gets its own audio element
  // + hls instance + Web Audio analyser, keyed by car number, so several can
  // play at once and we can tell who's actually talking.
  const scannerPlayersRef = useRef<Map<string, ScannerPlayer>>(new Map())
  const audioCtxRef = useRef<AudioContext | null>(null)
  const liveFollowRef = useRef<number | undefined>(undefined)
  // Always-current view of local messages + who's logged in, so the background
  // chat sync can re-send unacknowledged messages without a stale closure.
  const chatSyncRef = useRef<{ messages: ChatMessage[]; currentUserId?: string }>({ messages: [] })
  const installPromptRef = useRef<BeforeInstallPromptEvent | null>(null)
  const backupInputRef = useRef<HTMLInputElement | null>(null)
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [backupNote, setBackupNote] = useState('')
  const [state, setState] = useState<AppState>(() => {
    const loaded = loadState()
    return { ...loaded, currentUserId: loadSession() ?? loaded.currentUserId }
  })
  const [view, setView] = useState<View>(() => loadInitialView())
  const [loginPlayerId, setLoginPlayerId] = useState(players[0].id)
  const [loginCode, setLoginCode] = useState('')
  const [loginError, setLoginError] = useState('')
  const [chatText, setChatText] = useState('')
  const [newWeekName, setNewWeekName] = useState('')
  const [newNeighborName, setNewNeighborName] = useState('')
  const [neighborError, setNeighborError] = useState('')
  const [selectedLiveWeekId, setSelectedLiveWeekId] = useState<string>()
  const [liveRace, setLiveRace] = useState<LiveRace>()
  const [liveStatus, setLiveStatus] = useState('Connecting to NASCAR timing...')
  const [audioChannels, setAudioChannels] = useState<AudioChannel[]>([])
  const [scannerStatus, setScannerStatus] = useState('Loading NASCAR scanner channels...')
  const [activeScanners, setActiveScanners] = useState<string[]>([])
  const [speakingNumbers, setSpeakingNumbers] = useState<string[]>([])
  const [audioError, setAudioError] = useState('')
  const isAudioPlaying = activeScanners.length > 0
  const [canInstall, setCanInstall] = useState(false)
  const [isRefreshingLive, setIsRefreshingLive] = useState(false)
  const [showInstallHelp, setShowInstallHelp] = useState(false)
  const [driverIdByName, setDriverIdByName] = useState<Record<string, number>>({})

  // On first load, write the (possibly recovered/merged) state straight back so
  // pre-existing draws are mirrored into the backup key and any draws recovered
  // from an older storage key are consolidated into the current one.
  useEffect(() => {
    saveState(state)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activeWeek = state.weeks.find((week) => week.id === state.activeWeekId) ?? state.weeks[0]
  const selectedLiveWeek = state.weeks.find((week) => week.id === (selectedLiveWeekId ?? state.activeWeekId)) ?? activeWeek
  const currentUser = state.players.find((player) => player.id === state.currentUserId)
  const isLoggedIn = Boolean(currentUser)
  const isAdmin = Boolean(currentUser?.isAdmin)
  const activeView = !isAdmin && view === 'admin' ? 'garage' : view
  const navViews = isAdmin
    ? [publicViews[0], publicViews[1], publicViews[2], publicViews[3], adminView]
    : publicViews
  const participants = state.players.filter((player) => activeWeek.participantIds.includes(player.id))
  const myDrivers = currentUser ? activeWeek.assignments[currentUser.id] ?? [] : []
  const myCommunityTeam = currentUser
    ? activeWeek.communityTeams?.find((team) => team.memberIds.includes(currentUser.id))
    : undefined
  const selectedLiveParticipants = state.players.filter((player) => selectedLiveWeek.participantIds.includes(player.id))
  const selectedLiveDrawn = hasDraw(selectedLiveWeek)
  const activeWeekIndex = state.weeks.findIndex((week) => week.id === activeWeek.id)
  const selectedLiveWeekIndex = state.weeks.findIndex((week) => week.id === selectedLiveWeek.id)
  const selectedLiveStatus =
    selectedLiveWeekIndex < activeWeekIndex
      ? 'Past Race'
      : selectedLiveWeek.id === activeWeek.id
        ? 'Active Week'
        : 'Upcoming'
  const pastWeeks = state.weeks.slice(0, Math.max(0, activeWeekIndex)).reverse()
  const futureWeeks = state.weeks.slice(Math.max(0, activeWeekIndex + 1))
  const activeLiveRace = isLiveTimingActive(liveRace) ? liveRace : undefined
  const selectedRaceLive = selectedLiveWeek.id === activeWeek.id ? activeLiveRace : undefined
  const myLiveCars = activeLiveRace?.vehicles.filter((vehicle) =>
    myDrivers.some((driver) => driver.number === vehicle.vehicleNumber),
  )
  const allScanChannel = audioChannels.find((channel) => channel.driverNumber === 'All Scan')
  const talkingChannels = audioChannels.filter((channel) => speakingNumbers.includes(channel.driverNumber))
  const myAudioChannels = myDrivers
    .map((driver) => audioChannels.find((channel) => channel.driverNumber === driver.number))
    .filter((channel): channel is AudioChannel => Boolean(channel))
  const liveAudioChannels = (activeLiveRace?.vehicles ?? [])
    .map((vehicle) => audioChannels.find((channel) => channel.driverNumber === vehicle.vehicleNumber))
    .filter((channel): channel is AudioChannel => Boolean(channel))
  const allDriverChannels = audioChannels
    .filter((channel) => channel.driverNumber && channel.driverNumber !== 'All Scan')
    .slice()
    .sort((a, b) => Number(a.driverNumber) - Number(b.driverNumber))
  const liveVehicles = selectedRaceLive?.vehicles ?? []
  const liveLeader = selectedRaceLive?.vehicles[0]
  const liveProgress = selectedRaceLive?.lapsInRace
    ? Math.min(100, (selectedRaceLive.lapNumber / selectedRaceLive.lapsInRace) * 100)
    : 0
  const projectedPoolStandings = selectedLiveParticipants
    .map((player) => {
      const assigned = selectedLiveWeek.assignments[player.id] ?? []
      const liveCars = assigned
        .map((driver) => getLiveVehicle(selectedRaceLive, driver))
        .filter((vehicle): vehicle is LiveVehicle => Boolean(vehicle))
      const bestPosition = liveCars.length > 0 ? Math.min(...liveCars.map((vehicle) => vehicle.position)) : undefined
      const bestCar = liveCars.find((vehicle) => vehicle.position === bestPosition)

      return { player, bestPosition, bestCar, assignedCount: assigned.length }
    })
    .sort((a, b) => (a.bestPosition ?? 999) - (b.bestPosition ?? 999) || a.player.name.localeCompare(b.player.name))

  useEffect(() => {
    let active = true

    async function loadLiveRace() {
      try {
        const response = await fetch('/api/live-feed', { cache: 'no-store' })
        if (!response.ok) {
          throw new Error(`Live feed returned ${response.status}`)
        }

        const data = await response.json()
        if (active) {
          const normalizedRace = normalizeLiveRace(data)
          setLiveRace(normalizedRace)
          setLiveStatus(
            isLiveTimingActive(normalizedRace)
              ? 'Live NASCAR timing feed'
              : 'NASCAR timing is not live for this race yet.',
          )
        }
      } catch {
        if (active) {
          setLiveStatus('Live timing is waiting for the next available NASCAR feed.')
        }
      }
    }

    loadLiveRace()
    const timer = window.setInterval(loadLiveRace, 30000)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      installPromptRef.current = event as BeforeInstallPromptEvent
      setCanInstall(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  }, [])

  useEffect(() => {
    let active = true

    async function loadAudioChannels() {
      try {
        const response = await fetch('/api/audio-mapping', { cache: 'no-store' })
        if (!response.ok) {
          throw new Error(`Scanner mapping returned ${response.status}`)
        }

        const data = await response.json()
        const channels = normalizeAudioChannels(data)

        if (active) {
          setAudioChannels(channels)
          setScannerStatus(
            channels.length > 0
              ? `${channels.length} NASCAR scanner channels loaded`
              : 'Scanner channels are waiting for the next live NASCAR session.',
          )
        }
      } catch {
        if (active) {
          setScannerStatus('Scanner mapping is unavailable right now.')
        }
      }
    }

    loadAudioChannels()
    const timer = window.setInterval(loadAudioChannels, 60000)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  // Keep the background chat sync's view of local messages + identity fresh.
  useEffect(() => {
    chatSyncRef.current = { messages: state.messages, currentUserId: state.currentUserId }
  }, [state.messages, state.currentUserId])

  // Keep the shared league chat in sync in the BACKGROUND (not just while the
  // Chat tab is open), so messages arrive everywhere and are already there when
  // you open the tab. Also re-send any of MY messages the server hasn't
  // acknowledged yet — inserts are idempotent (deduped by id), so retrying can't
  // create duplicates. This is what makes a dropped send eventually land.
  useEffect(() => {
    let active = true

    async function pullChat() {
      try {
        const response = await fetch('/api/chat', { cache: 'no-store' })
        if (!response.ok) {
          return
        }
        const data = await response.json()
        if (!active || !Array.isArray(data.messages)) {
          return
        }
        const serverIds = new Set<string>(data.messages.map((message: ChatMessage) => message.id))
        const { messages: localMessages, currentUserId } = chatSyncRef.current
        const unsent = localMessages.filter(
          (message) => message.playerId === currentUserId && !serverIds.has(message.id),
        )
        for (const message of unsent) {
          void fetch('/api/chat', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(message),
          }).catch(() => {})
        }

        setState((prev) => {
          const merged = mergeMessages(prev.messages, data.messages)
          if (merged.length === prev.messages.length) {
            return prev
          }
          const next = { ...prev, messages: merged }
          saveState(next)
          return next
        })
      } catch {
        // Offline or store unreachable — stay on the local cache and retry next tick.
      }
    }

    pullChat()
    const timer = window.setInterval(pullChat, 5000)
    const onFocus = () => pullChat()
    window.addEventListener('focus', onFocus)

    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  // Keep the shared league state (draws, players, results) in sync across every
  // phone: pull the shared blob on load, on focus, and on a steady interval,
  // merging it into local state. If the KV store isn't linked yet the endpoint
  // reports configured:false and we quietly stay on the local copy.
  useEffect(() => {
    let active = true

    async function pullSharedState() {
      try {
        const response = await fetch('/api/state', { cache: 'no-store' })
        if (!response.ok) {
          return
        }
        const data = await response.json()
        if (!active || !data?.configured) {
          return
        }
        const remote = data.state
        const remoteEmpty =
          !remote || !Array.isArray(remote.weeks) || remote.weeks.every((week: Week) => weekPickCount(week) === 0)
        if (remoteEmpty) {
          // The shared store is empty — fresh, or it was purged and recreated.
          // If THIS phone already holds a drawn lineup, re-seed the store so the
          // league repopulates without anyone having to draw again.
          setState((prev) => {
            if (hasAnyDraw(prev)) {
              void fetch('/api/state', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(toSharedState(prev)),
              }).catch(() => {})
            }
            return prev
          })
          return
        }
        setState((prev) => {
          const merged = mergeSharedState(prev, remote as SharedState)
          if (JSON.stringify(merged.weeks) === JSON.stringify(prev.weeks) && merged.players.length === prev.players.length) {
            return prev
          }
          saveState(merged)
          return merged
        })
      } catch {
        // Offline or store not linked — stay on the local copy.
      }
    }

    pullSharedState()
    const timer = window.setInterval(pullSharedState, 15000)
    const onFocus = () => pullSharedState()
    window.addEventListener('focus', onFocus)

    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  // Auto-follow the live race: NASCAR's feed tells us which race is on track
  // right now, so we match it to the correct week ALREADY in the season schedule
  // (by track + series) and jump to it the first time a new race appears. We
  // never rename or overwrite another week — last week's race keeps its name and
  // results; this week's race just becomes the active one.
  useEffect(() => {
    if (!liveRace || liveRace.vehicles.length === 0 || !liveRace.liveSeriesId) {
      return
    }
    const trackKey = normalizeTrackKey(liveRace.trackName)
    if (!trackKey) {
      return
    }
    const match = state.weeks.find(
      (week) => week.seriesId === liveRace.liveSeriesId && normalizeTrackKey(week.track) === trackKey,
    )
    if (!match) {
      return
    }
    // Only jump once per race, and only if we aren't already there.
    if (liveRace.raceId === undefined || liveFollowRef.current === liveRace.raceId) {
      return
    }
    liveFollowRef.current = liveRace.raceId
    if (state.activeWeekId === match.id) {
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((prev) => {
      const next = { ...prev, activeWeekId: match.id }
      saveState(next)
      return next
    })
  }, [liveRace, state.weeks, state.activeWeekId])

  // While any scanners are playing, poll each stream's audio level and mark the
  // drivers who are currently talking. Updates state only when the set changes
  // so we don't churn React every animation frame.
  useEffect(() => {
    if (activeScanners.length === 0) {
      return undefined
    }
    let frame = 0
    const HOLD_MS = 700 // keep the highlight on briefly between words
    const LOUD_RMS = 6 // ~5% amplitude — above scanner hiss, below voice
    const tick = () => {
      const now = performance.now()
      const talking: string[] = []
      for (const [number, player] of scannerPlayersRef.current.entries()) {
        if (player.analyser && player.data) {
          player.analyser.getByteTimeDomainData(player.data)
          let sumSquares = 0
          for (let i = 0; i < player.data.length; i += 1) {
            const deviation = player.data[i] - 128
            sumSquares += deviation * deviation
          }
          const rms = Math.sqrt(sumSquares / player.data.length)
          if (rms > LOUD_RMS) {
            player.lastLoud = now
          }
        }
        if (player.lastLoud && now - player.lastLoud < HOLD_MS) {
          talking.push(number)
        }
      }
      setSpeakingNumbers((current) => {
        if (current.length === talking.length && current.every((n) => talking.includes(n))) {
          return current
        }
        return talking
      })
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [activeScanners.length])

  // Tear every scanner down on unmount.
  useEffect(() => {
    const players = scannerPlayersRef.current
    return () => {
      for (const player of players.values()) {
        player.hls?.destroy()
        player.audio.pause()
      }
      players.clear()
      audioCtxRef.current?.close().catch(() => {})
    }
  }, [])

  useEffect(() => {
    let active = true

    async function loadDriverIds() {
      try {
        const response = await fetch('/api/drivers', { cache: 'no-store' })
        if (!response.ok) {
          return
        }

        const data = (await response.json()) as { drivers?: Array<{ id: number; name: string }> }
        const map: Record<string, number> = {}
        for (const driver of data.drivers ?? []) {
          const key = driverKey(driver.name)
          if (key && !map[key]) {
            map[key] = driver.id
          }
        }

        if (active) {
          setDriverIdByName(map)
        }
      } catch {
        // Headshots simply fall back to the number plate if this fails.
      }
    }

    loadDriverIds()

    return () => {
      active = false
    }
  }, [])

  const standings = useMemo(() => {
    return state.players
      .map((player) => {
        const wins = state.weeks.filter((week) => week.winnerId === player.id).length
        const seconds = state.weeks.filter((week) => week.secondId === player.id).length
        const starts = state.weeks.filter(
          (week) =>
            week.participantIds.includes(player.id) &&
            (Boolean(week.winnerId) || Object.values(week.assignments).some((assigned) => assigned.length > 0)),
        ).length
        const paid = state.weeks.filter((week) => week.paidBy.includes(player.id)).length
        const moneyBack = seconds * 5
        const winnings = state.weeks.reduce((total, week) => {
          if (week.winnerId !== player.id) {
            return total
          }

          return total + Math.max(0, week.paidBy.length * 5 - 5)
        }, 0)

        return { ...player, wins, seconds, starts, paid, moneyBack, winnings, score: wins * 5 + seconds * 2 }
      })
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  }, [state.players, state.weeks])

  function pushSharedState(next: AppState) {
    if (pushTimerRef.current) {
      window.clearTimeout(pushTimerRef.current)
    }
    // Debounce so a burst of edits (e.g. drawing every week) becomes one push.
    pushTimerRef.current = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/state', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(toSharedState(next)),
        })
        if (!response.ok) {
          return
        }
        const data = await response.json()
        if (!data?.configured || !data.state || !Array.isArray(data.state.weeks)) {
          return
        }
        // Fold the server's merged result back in so this phone also picks up
        // anything another phone pushed in the meantime.
        setState((prev) => {
          const merged = mergeSharedState(prev, data.state as SharedState)
          saveState(merged)
          return merged
        })
      } catch {
        // Offline or store not linked — the local save already happened, and the
        // next successful push/pull will carry these changes to the shared blob.
      }
    }, 600)
  }

  function updateState(next: AppState) {
    setState(next)
    saveState(next)
    pushSharedState(next)
  }

  function updateWeek(weekId: string, updater: (week: Week) => Week) {
    updateState({
      ...state,
      weeks: state.weeks.map((week) => (week.id === weekId ? updater(week) : week)),
    })
  }

  function drawWeek() {
    updateWeek(activeWeek.id, (week) => {
      // Draws must come from the real Cup field only. Scanner/audio mappings
      // include non-driver channels, so they are never used for assignments.
      const { pool } = drawPoolForWeek(week, liveRace)
      const { assignments, communityTeams } = dealField(state.players, week.participantIds, pool)

      return {
        ...week,
        assignments,
        communityTeams,
        drawnAt: new Date().toISOString(),
        winnerId: undefined,
        secondId: undefined,
        winningDriverNumber: undefined,
        winnerTeamIds: undefined,
        secondDriverNumber: undefined,
        secondTeamIds: undefined,
      }
    })
  }

  // Force the active week's current lineup out to every phone without re-rolling
  // it. This bypasses the normal "newer/richer merge" path and tells the server
  // that the commissioner's active week is the official one.
  async function republishDraw() {
    if (!hasDraw(activeWeek)) {
      return
    }
    if (pushTimerRef.current) {
      window.clearTimeout(pushTimerRef.current)
      pushTimerRef.current = null
    }

    const next: AppState = {
      ...state,
      weeks: state.weeks.map((week) =>
        week.id === activeWeek.id ? { ...week, drawnAt: new Date().toISOString() } : week,
      ),
    }
    setState(next)
    saveState(next)

    try {
      const response = await fetch('/api/state', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...toSharedState(next), forceWeekId: activeWeek.id }),
      })
      if (!response.ok) {
        return
      }
      const data = await response.json()
      if (!data?.configured || !data.state || !Array.isArray(data.state.weeks)) {
        return
      }
      setState((prev) => {
        const merged = mergeSharedState(prev, data.state as SharedState)
        saveState(merged)
        return merged
      })
    } catch {
      // Local copy is saved. The next successful publish/sync can still push it.
    }
  }

  // When the race goes final, lock in the pot result from the running order:
  // the owner(s) of the P1 car win, P2 gets second. For a community car the
  // whole team is recorded. We only write once (guarded by winningDriverNumber)
  // and only when the finishing car was actually part of this week's draw, which
  // also stops a different series' feed from recording a bogus result.
  useEffect(() => {
    if (!isRaceFinal(liveRace) || !liveRace || !hasDraw(activeWeek) || activeWeek.winningDriverNumber) {
      return
    }
    const winnerCar = liveRace.vehicles.find((vehicle) => vehicle.position === 1)
    const secondCar = liveRace.vehicles.find((vehicle) => vehicle.position === 2)
    if (!winnerCar) {
      return
    }
    const winnerOwners = ownersOfCar(activeWeek, winnerCar.vehicleNumber)
    if (!winnerOwners) {
      return
    }
    const secondOwners = secondCar ? ownersOfCar(activeWeek, secondCar.vehicleNumber) : undefined

    // Recording the final result in response to the live feed is the intended
    // behavior here; the guards above ensure it runs at most once per week.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    updateWeek(activeWeek.id, (week) => ({
      ...week,
      winningDriverNumber: winnerCar.vehicleNumber,
      winnerTeamIds: winnerOwners.memberIds,
      winnerId: winnerOwners.memberIds[0],
      secondDriverNumber: secondOwners ? secondCar?.vehicleNumber : week.secondDriverNumber,
      secondTeamIds: secondOwners ? secondOwners.memberIds : week.secondTeamIds,
      secondId: secondOwners ? secondOwners.memberIds[0] : week.secondId,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveRace, activeWeek.id, activeWeek.winningDriverNumber])

  function togglePaid(playerId: string) {
    if (!activeWeek.participantIds.includes(playerId)) {
      return
    }

    updateWeek(activeWeek.id, (week) => {
      const paidBy = week.paidBy.includes(playerId)
        ? week.paidBy.filter((id) => id !== playerId)
        : [...week.paidBy, playerId]

      return { ...week, paidBy }
    })
  }

  function toggleParticipant(playerId: string) {
    updateWeek(activeWeek.id, (week) => {
      const isParticipating = week.participantIds.includes(playerId)
      const participantIds = isParticipating
        ? week.participantIds.filter((id) => id !== playerId)
        : [...week.participantIds, playerId]
      const paidBy = week.paidBy.filter((id) => participantIds.includes(id))
      const assignments = {
        ...week.assignments,
        [playerId]: isParticipating ? [] : week.assignments[playerId] ?? [],
      }

      return { ...week, participantIds, paidBy, assignments }
    })
  }

  async function addMessage(body: string) {
    const clean = body.trim()
    if (!clean || !currentUser) {
      return
    }

    // Show it immediately and persist locally, so the message is never lost even
    // if the network drops before it reaches the shared store.
    const message = createChatMessage(currentUser.id, clean)
    updateState({ ...state, messages: mergeMessages(state.messages, [message]) })
    setChatText('')

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(message),
      })
      if (!response.ok) {
        return
      }
      const data = await response.json()
      if (Array.isArray(data.messages)) {
        setState((prev) => {
          const next = { ...prev, messages: mergeMessages(prev.messages, data.messages) }
          saveState(next)
          return next
        })
      }
    } catch {
      // Offline or store not linked yet — the message stays in the local cache
      // and will reach the shared feed on the next successful send or sync.
    }
  }

  function handleChatSubmit(event: FormEvent) {
    event.preventDefault()
    addMessage(chatText)
  }

  function addWeek(event: FormEvent) {
    event.preventDefault()
    const clean = newWeekName.trim()
    if (!clean) {
      return
    }

    const week = createNewWeek(clean, state.players)

    updateState({
      ...state,
      activeWeekId: week.id,
      weeks: [...state.weeks, week],
    })
    setNewWeekName('')
  }

  function addNeighbor(event: FormEvent) {
    event.preventDefault()
    const clean = newNeighborName.trim()

    if (!clean) {
      setNeighborError('Enter a neighbor name.')
      return
    }

    if (state.players.some((player) => player.name.toLowerCase() === clean.toLowerCase())) {
      setNeighborError('That neighbor is already in the league.')
      return
    }

    const neighbor = createNeighbor(clean, state.players)

    updateState({
      ...state,
      players: [...state.players, neighbor],
      weeks: state.weeks.map((week) => ({
        ...week,
        participantIds: week.id === activeWeek.id ? [...week.participantIds, neighbor.id] : week.participantIds,
        assignments: {
          ...week.assignments,
          [neighbor.id]: [],
        },
      })),
    })
    setNewNeighborName('')
    setNeighborError('')
  }

  function handleLogin(event: FormEvent) {
    event.preventDefault()
    const player = state.players.find((item) => item.id === loginPlayerId)

    if (!player || loginCode.trim().toLowerCase() !== player.passcode) {
      setLoginError('Use the league invite code.')
      return
    }

    const next = { ...state, currentUserId: player.id }
    window.localStorage.setItem(SESSION_KEY, player.id)
    updateState(next)
    setLoginCode('')
    setLoginError('')
  }

  function logout() {
    window.localStorage.removeItem(SESSION_KEY)
    setState({ ...state, currentUserId: undefined })
    setView('garage')
  }

  function exportBackup() {
    const stamp = new Date().toISOString().slice(0, 10)
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `shuyler-ridge-backup-${stamp}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setBackupNote('Backup saved. Keep this file to restore your draws on any device.')
  }

  function importBackup(event: FormEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) {
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as AppState
        const restored = normalizeSavedState(parsed)
        // Preserve who is currently signed in on this device.
        updateState({ ...restored, currentUserId: state.currentUserId })
        setBackupNote('Backup restored. Your draws are back.')
      } catch {
        setBackupNote('That file could not be read as a Shuyler Ridge backup.')
      }
    }
    reader.readAsText(file)
    input.value = ''
  }

  // Web Audio context, created lazily on first play (and resumed inside the user
  // gesture). Used purely to read each stream's level for the "who's talking"
  // highlight — playback still routes out through the analyser to the speakers.
  function ensureAudioContext() {
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (Ctx) {
        audioCtxRef.current = new Ctx()
      }
    }
    audioCtxRef.current?.resume().catch(() => {})
    return audioCtxRef.current
  }

  async function startScanner(channel: AudioChannel) {
    if (scannerPlayersRef.current.has(channel.driverNumber)) {
      return
    }

    const audio = document.createElement('audio')
    audio.crossOrigin = 'anonymous'
    audio.preload = 'none'
    audio.setAttribute('playsinline', '')
    // iOS is far more reliable at playing + exposing audio to Web Audio when the
    // element is actually in the document, so keep a hidden one attached.
    audio.style.display = 'none'
    document.body.appendChild(audio)
    const player: ScannerPlayer = { audio }
    scannerPlayersRef.current.set(channel.driverNumber, player)
    setActiveScanners((current) => (current.includes(channel.driverNumber) ? current : [...current, channel.driverNumber]))
    setAudioError('')

    // Tap the element for level analysis. If this throws (older Safari / native
    // HLS), the stream still plays — we just can't light up the speaker.
    const ctx = ensureAudioContext()
    if (ctx) {
      try {
        const source = ctx.createMediaElementSource(audio)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 512
        analyser.smoothingTimeConstant = 0.4
        source.connect(analyser)
        analyser.connect(ctx.destination)
        player.analyser = analyser
        player.data = new Uint8Array(analyser.frequencyBinCount)
      } catch {
        // Analysis unavailable on this platform; playback is unaffected.
      }
    }

    try {
      const { default: HlsPlayer } = await import('hls.js')
      if (HlsPlayer.isSupported()) {
        const hls = new HlsPlayer({ enableWorker: true, liveSyncDurationCount: 2 })
        hls.on(HlsPlayer.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            setAudioError(`#${channel.driverNumber} scanner dropped — it may be offline or between sessions.`)
            stopScanner(channel.driverNumber)
          }
        })
        hls.loadSource(channel.url)
        hls.attachMedia(audio)
        player.hls = hls
        await audio.play()
        return
      }

      if (audio.canPlayType('application/vnd.apple.mpegurl')) {
        audio.src = channel.url
        await audio.play()
        return
      }

      setAudioError('This browser cannot play NASCAR HLS scanner streams.')
      stopScanner(channel.driverNumber)
    } catch {
      setAudioError('Tap the driver again to start the scanner, or try during a live session.')
      stopScanner(channel.driverNumber)
    }
  }

  function stopScanner(driverNumber: string) {
    const player = scannerPlayersRef.current.get(driverNumber)
    if (!player) {
      return
    }
    player.hls?.destroy()
    player.audio.pause()
    player.audio.removeAttribute('src')
    try {
      player.audio.load()
      player.audio.remove()
    } catch {
      // ignore teardown races
    }
    scannerPlayersRef.current.delete(driverNumber)
    setActiveScanners((current) => current.filter((number) => number !== driverNumber))
    setSpeakingNumbers((current) => current.filter((number) => number !== driverNumber))
  }

  function stopAllScanners() {
    for (const number of Array.from(scannerPlayersRef.current.keys())) {
      stopScanner(number)
    }
  }

  // Add or remove a driver from the live mix (used by the multi-select grid).
  function toggleScanner(channel: AudioChannel) {
    if (scannerPlayersRef.current.has(channel.driverNumber)) {
      stopScanner(channel.driverNumber)
    } else {
      void startScanner(channel)
    }
  }

  // Single-exclusive listen (Garage / community / "All Scan" quick buttons):
  // tapping plays just that channel; tapping the only active one stops it.
  function playScanner(channel: AudioChannel) {
    const wasOnlyActive =
      scannerPlayersRef.current.size === 1 && scannerPlayersRef.current.has(channel.driverNumber)
    stopAllScanners()
    if (!wasOnlyActive) {
      void startScanner(channel)
    }
  }

  async function refreshLiveNow() {
    setIsRefreshingLive(true)
    try {
      const [raceResponse, audioResponse] = await Promise.all([
        fetch('/api/live-feed', { cache: 'no-store' }),
        fetch('/api/audio-mapping', { cache: 'no-store' }),
      ])

      if (raceResponse.ok) {
        const normalizedRace = normalizeLiveRace(await raceResponse.json())
        setLiveRace(normalizedRace)
        setLiveStatus(
          isLiveTimingActive(normalizedRace)
            ? 'Live NASCAR timing feed'
            : 'NASCAR timing is not live for this race yet.',
        )
      }

      if (audioResponse.ok) {
        const channels = normalizeAudioChannels(await audioResponse.json())
        setAudioChannels(channels)
        setScannerStatus(
          channels.length > 0
            ? `${channels.length} NASCAR scanner channels loaded`
            : 'Scanner channels are waiting for the next live NASCAR session.',
        )
      }
    } catch {
      setLiveStatus('Live timing is waiting for the next available NASCAR feed.')
    } finally {
      window.setTimeout(() => setIsRefreshingLive(false), 450)
    }
  }

  async function installApp() {
    const prompt = installPromptRef.current
    if (!prompt) {
      setShowInstallHelp(true)
      return
    }

    await prompt.prompt()
    await prompt.userChoice
    installPromptRef.current = null
    setCanInstall(false)
  }

  function handleInstallTap() {
    if (canInstall) {
      void installApp()
      return
    }

    setShowInstallHelp((current) => !current)
  }

  const pot = activeWeek.paidBy.length * 5
  const winnerPayout = Math.max(0, pot - 5)
  const participantCount = activeWeek.participantIds.length
  const drawComplete = participants.every((player) => (activeWeek.assignments[player.id] ?? []).length > 0)

  // Pot outcome for the active week. Once a winning car is recorded we know who
  // takes the money; a community car splits the payout equally among its team.
  const winnerNames = (activeWeek.winnerTeamIds ?? (activeWeek.winnerId ? [activeWeek.winnerId] : []))
    .map((id) => state.players.find((player) => player.id === id)?.name)
    .filter((name): name is string => Boolean(name))
  const winnerIsCommunity = (activeWeek.winnerTeamIds?.length ?? 0) > 1
  const winnerShare = winnerNames.length > 0 ? winnerPayout / winnerNames.length : winnerPayout
  const iWonShare = currentUser ? (activeWeek.winnerTeamIds ?? []).includes(currentUser.id) || activeWeek.winnerId === currentUser.id : false

  if (!isLoggedIn) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <div className="logo-stage">
            <img src="/shuyler-ridge-logo-header.png" alt="Shuyler Ridge Raceday" />
          </div>
          <div className="nascar-lockup">
            <span>Fantasy sports app</span>
            <img src="/nascar-logo.svg" alt="NASCAR" />
          </div>

          <form className="login-form" onSubmit={handleLogin}>
            <label>
              Neighbor
              <select value={loginPlayerId} onChange={(event) => setLoginPlayerId(event.target.value)}>
                {state.players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              League code
              <input
                value={loginCode}
                onChange={(event) => setLoginCode(event.target.value)}
                placeholder="raceday"
                type="password"
              />
            </label>
            {loginError && <p className="login-error">{loginError}</p>}
            <button type="submit">
              Enter garage
              <ChevronRight size={18} />
            </button>
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="logo-plate">
          <img className="sr-wordmark" src="/shuyler-ridge-logo-header.png" alt="Shuyler Ridge Raceday" />
        </div>
        <div className="app-status-bar">
          <div>
            <CircleDot size={10} />
            {activeLiveRace ? `${flagLabel(activeLiveRace.flagState)} flag` : 'Race standby'}
          </div>
          <div>{liveRace ? `Checked ${liveRace.updatedAt}` : 'PWA ready'}</div>
        </div>
      </header>

      <section className="race-hero" aria-label="Current race">
        <div className="hero-content">
          <p className="eyebrow">Week of {activeWeek.date}</p>
          <h1>{activeWeek.race}</h1>
          <span>{activeWeek.track}</span>
        </div>
        <div className="hero-metrics">
          <div>
            <span>Pot</span>
            <strong>{formatCurrency(pot)}</strong>
          </div>
          <div>
            <span>Lineup</span>
            <strong>
              {participantCount}/{state.players.length}
            </strong>
          </div>
          <div>
            <span>Flag</span>
            <strong>{activeLiveRace ? flagLabel(activeLiveRace.flagState) : 'Standby'}</strong>
          </div>
        </div>
        <div className="track-lighting" aria-hidden="true" />
      </section>


      {activeView === 'garage' && currentUser && (
        <section className="screen">
          <div className="garage-banner">
            <div className="avatar xl" style={{ background: currentUser.color }}>
              {currentUser.name.slice(0, 1)}
            </div>
            <div>
              <p className="eyebrow">Your garage</p>
              <h2>{currentUser.name}</h2>
              <span>{currentUser.handle}</span>
            </div>
            <div className="rank-badge">
              <Crown size={18} />
              #{standings.findIndex((player) => player.id === currentUser.id) + 1}
            </div>
          </div>

          <div className="cup-focus" aria-label="Active Cup race">
            <span>Sunday Cup</span>
            <strong>{activeWeek.race}</strong>
            <small>{activeWeek.track}</small>
          </div>

          <div className="premium-strip">
            <article>
              <span>Live leader</span>
              <strong>{liveLeader ? `#${liveLeader.vehicleNumber}` : '--'}</strong>
              <small>{liveLeader?.driverName ?? 'Waiting for feed'}</small>
            </article>
            <article>
              <span>Your edge</span>
              <strong>{myLiveCars?.length ? `P${Math.min(...myLiveCars.map((car) => car.position))}` : '--'}</strong>
              <small>{myDrivers.length ? `${myDrivers.length} cars drawn` : 'No draw yet'}</small>
            </article>
          </div>

          <div className="install-card">
            <div>
              <p className="eyebrow">Home Screen app</p>
              <h3>Install Shuyler Ridge Raceday</h3>
              <p>Open it full screen from your phone like a real app.</p>
            </div>
            <button type="button" onClick={handleInstallTap}>
              <Download size={18} />
              Add app
            </button>
          </div>

          {showInstallHelp && (
            <div className="install-help">
              <strong>iPhone:</strong> tap Share, then Add to Home Screen. <strong>Android:</strong> tap Add app or
              Install from Chrome.
            </div>
          )}

          {!activeWeek.participantIds.includes(currentUser.id) ? (
            <div className="empty-state">
              <UsersRound size={28} />
              <h3>Not in this week's lineup</h3>
              <p>Colton can add you from Admin before the draw.</p>
            </div>
          ) : myDrivers.length === 0 ? (
            <div className="empty-state">
              <RefreshCw size={28} />
              <h3>Waiting on the commissioner draw</h3>
              <p>Your cars will appear after Colton draws the weekly teams.</p>
            </div>
          ) : (
            <div className="driver-list">
              {myDrivers.map((driver) => {
                const liveCar = getLiveVehicle(activeLiveRace, driver)
                const channel = audioChannels.find((item) => item.driverNumber === driver.number)

                return (
                  <article className="driver-card" key={`${driver.number}-${driver.name}`}>
                    <DriverFace
                      driverId={driverIdByName[driverKey(driver.name)]}
                      seriesId={activeWeek.seriesId}
                      color={currentUser.color}
                      initial={driver.name.slice(0, 1)}
                    />
                    <div className="car-number">#{driver.number}</div>
                    <div>
                      <h3>{driver.name}</h3>
                      <p>
                        {driver.team ? `${driver.team} / ` : ''}
                        {startingPositionLabel(liveCar)}
                      </p>
                    </div>
                    <div className="driver-actions">
                      {liveCar && <strong>P{liveCar.position}</strong>}
                      <button
                        type="button"
                        onClick={() => channel && playScanner(channel)}
                        disabled={!channel}
                        aria-label={`Listen to ${driver.name}`}
                      >
                        <Headphones size={16} />
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          {myCommunityTeam && (
            <article className="community-card">
              <DriverFace
                driverId={driverIdByName[driverKey(myCommunityTeam.driver.name)]}
                seriesId={activeWeek.seriesId}
                color={currentUser.color}
                initial={myCommunityTeam.driver.name.slice(0, 1)}
              />
              <div className="car-number">#{myCommunityTeam.driver.number}</div>
              <div>
                <span className="community-tag">
                  <UsersRound size={12} /> Community car
                </span>
                <h3>{myCommunityTeam.driver.name}</h3>
                <p>
                  {(() => {
                    const mates = myCommunityTeam.memberIds
                      .filter((id) => id !== currentUser.id)
                      .map((id) => state.players.find((player) => player.id === id)?.name)
                      .filter((name): name is string => Boolean(name))
                    const each = formatSplit(winnerPayout / Math.max(1, myCommunityTeam.memberIds.length))
                    return mates.length
                      ? `Shared with ${mates.join(', ')} · splits to ${each} each if it wins`
                      : `Your shared car · ${each} if it wins`
                  })()}
                </p>
              </div>
              <div className="driver-actions">
                {(() => {
                  const liveCar = getLiveVehicle(activeLiveRace, myCommunityTeam.driver)
                  const channel = audioChannels.find((item) => item.driverNumber === myCommunityTeam.driver.number)
                  return (
                    <>
                      {liveCar && <strong>P{liveCar.position}</strong>}
                      <button
                        type="button"
                        onClick={() => channel && playScanner(channel)}
                        disabled={!channel}
                        aria-label={`Listen to ${myCommunityTeam.driver.name}`}
                      >
                        <Headphones size={16} />
                      </button>
                    </>
                  )
                })()}
              </div>
            </article>
          )}

          {activeWeek.winningDriverNumber && winnerNames.length > 0 && (
            <div className={`pot-result ${iWonShare ? 'won' : ''}`}>
              <Crown size={20} />
              <div>
                <strong>#{activeWeek.winningDriverNumber} won the race</strong>
                <p>
                  {winnerIsCommunity
                    ? `${winnerNames.join(' & ')} split ${formatCurrency(winnerPayout)} — ${formatSplit(winnerShare)} each`
                    : `${winnerNames[0]} takes ${formatCurrency(winnerPayout)}`}
                  {iWonShare ? ' · that includes you 🎉' : ''}
                </p>
              </div>
            </div>
          )}

          <div className="quick-grid">
            <div className="metric-tile">
              <span>Paid this week</span>
              <strong>{activeWeek.paidBy.includes(currentUser.id) ? 'Yes' : 'No'}</strong>
            </div>
            <div className="metric-tile">
              <span>Winner gets</span>
              <strong>{formatCurrency(winnerPayout)}</strong>
            </div>
            <div className="metric-tile">
              <span>2nd gets</span>
              <strong>$5 back</strong>
            </div>
            <div className="metric-tile">
              <span>Your live best</span>
              <strong>{myLiveCars?.length ? `P${Math.min(...myLiveCars.map((car) => car.position))}` : '--'}</strong>
            </div>
          </div>
        </section>
      )}

      {activeView === 'league' && (
        <section className="screen">
          <div className="section-head dark">
            <div>
              <p className="eyebrow">Season board</p>
              <h2>Ridge standings</h2>
            </div>
            <CalendarDays size={23} />
          </div>

          <div className="standings-list">
            {standings.map((player, index) => (
              <article className="standing-row" key={player.id}>
                <div className="rank">{index + 1}</div>
                <div>
                  <h3>{player.name}</h3>
                  <p>
                    {player.wins} wins, {player.seconds} seconds, {player.starts} starts
                  </p>
                </div>
                <strong>{formatCurrency(player.winnings + player.moneyBack)}</strong>
              </article>
            ))}
          </div>

          <div className="lineup-section">
            <div className="section-head dark compact-head">
              <div>
                <p className="eyebrow">This week's teams</p>
                <h2>Who has what racers</h2>
              </div>
              <UsersRound size={22} />
            </div>

            <div className="team-stack">
              {participants.map((player) => (
                <article className="team-card lineup-card" key={player.id}>
                  <div className="team-card-head">
                    <div className="avatar" style={{ background: player.color }}>
                      {player.name.slice(0, 1)}
                    </div>
                    <div>
                      <h3>{player.name}</h3>
                      <p>
                        {(activeWeek.assignments[player.id] ?? []).length || 0} racers /{' '}
                        {activeWeek.paidBy.includes(player.id) ? 'paid' : '$5 due'}
                      </p>
                    </div>
                    {activeWeek.paidBy.includes(player.id) && <Check className="paid-check" size={18} />}
                  </div>

                  {(activeWeek.assignments[player.id] ?? []).length > 0 ? (
                    <div className="lineup-driver-list" style={{ ['--team' as string]: player.color }}>
                      {(activeWeek.assignments[player.id] ?? []).map((driver) => {
                        const liveCar = getLiveVehicle(activeLiveRace, driver)
                        const driverId = driverIdByName[driverKey(driver.name)]

                        return (
                          <div className="lineup-driver" key={`${player.id}-${driver.number}`}>
                            <DriverFace
                              driverId={driverId}
                              seriesId={activeWeek.seriesId}
                              color={player.color}
                              initial={driver.name.slice(0, 1)}
                            />
                            <div className="driver-id">
                              <strong>{driver.name}</strong>
                              <em>{startingPositionLabel(liveCar)}</em>
                            </div>
                            {liveCar && <span className="driver-pos">P{liveCar.position}</span>}
                            <CarBadge number={driver.number} seriesId={activeWeek.seriesId} />
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="lineup-empty">Waiting on Colton to draw this race.</p>
                  )}

                  {(() => {
                    const team = activeWeek.communityTeams?.find((entry) => entry.memberIds.includes(player.id))
                    if (!team) {
                      return null
                    }
                    const liveCar = getLiveVehicle(activeLiveRace, team.driver)
                    const shareCount = team.memberIds.length
                    return (
                      <div className="lineup-community">
                        <UsersRound size={12} />
                        <span>
                          Shares #{team.driver.number} {team.driver.name} ({shareCount}-way)
                        </span>
                        {liveCar && <span className="driver-pos">P{liveCar.position}</span>}
                      </div>
                    )
                  })()}
                </article>
              ))}
            </div>
          </div>

          <div className="history-list">
            {state.weeks.map((week) => {
              const winnerIds = week.winnerTeamIds ?? (week.winnerId ? [week.winnerId] : [])
              const winnerLabel = winnerIds
                .map((id) => state.players.find((player) => player.id === id)?.name)
                .filter(Boolean)
                .join(' & ')
              const second = state.players.find((player) => player.id === week.secondId)
              const communityWin = (week.winnerTeamIds?.length ?? 0) > 1

              return (
                <article className="history-row" key={week.id}>
                  <div>
                    <h3>{week.race}</h3>
                    <p>
                      {week.participantIds.length} neighbors, {formatCurrency(week.paidBy.length * 5)} pot
                    </p>
                  </div>
                  <div>
                    <span>
                      {winnerLabel || 'Open'}
                      {week.winningDriverNumber ? ` · #${week.winningDriverNumber}` : ''}
                    </span>
                    <small>
                      {communityWin ? 'shared win, split pot' : second ? `${second.name} got $5 back` : 'Second TBD'}
                    </small>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      {activeView === 'live' && (
        <section className="screen">
          <div className="race-switcher">
            <label>
              Race week
              <select value={selectedLiveWeek.id} onChange={(event) => setSelectedLiveWeekId(event.target.value)}>
                {state.weeks.map((week, index) => (
                  <option key={week.id} value={week.id}>
                    {index + 1}. {week.date} - {week.race}
                  </option>
                ))}
              </select>
            </label>
            <div className="race-status-pill">{selectedLiveStatus}</div>
          </div>

          <div className="live-card race-broadcast-card">
            <div className="live-topline">
              <div>
                <p className="eyebrow">{selectedLiveWeek.date}</p>
                <h2>{selectedLiveWeek.race}</h2>
                <span>{selectedLiveWeek.track}</span>
              </div>
              <div className={`flag-chip flag-${selectedRaceLive?.flagState ?? 9}`}>
                <CircleDot size={14} />
                {selectedRaceLive ? flagLabel(selectedRaceLive.flagState) : selectedLiveStatus}
              </div>
            </div>
            {liveLeader && selectedRaceLive && (
              <div className="leader-feature">
                <span>Overall leader</span>
                <strong>
                  #{liveLeader.vehicleNumber} {liveLeader.driverName}
                </strong>
                <small>
                  Lap {liveLeader.lapsCompleted}
                  {liveLeader.lastLapSpeed ? ` / ${liveLeader.lastLapSpeed.toFixed(1)} mph` : ''}
                </small>
              </div>
            )}
            <p>
              {selectedLiveWeek.id === activeWeek.id
                ? liveStatus
                : selectedLiveWeekIndex < activeWeekIndex
                  ? 'Pool results for this race appear here after Colton records the winner and second place.'
                  : 'Upcoming race week. Colton can select participants and draw teams from Admin.'}
            </p>
            {selectedRaceLive && (
              <div className="lap-meter">
                <span style={{ width: `${liveProgress}%` }} />
              </div>
            )}
          </div>

          <div className="result-glass-grid">
            <article>
              <span>Pool winner</span>
              <strong>
                {state.players.find((player) => player.id === selectedLiveWeek.winnerId)?.name ?? 'Not recorded'}
              </strong>
            </article>
            <article>
              <span>$5 back</span>
              <strong>
                {state.players.find((player) => player.id === selectedLiveWeek.secondId)?.name ?? 'Not recorded'}
              </strong>
            </article>
            <article>
              <span>Pot</span>
              <strong>{formatCurrency(selectedLiveWeek.paidBy.length * 5)}</strong>
            </article>
          </div>

          <div className="section-head glass-head">
            <div>
              <p className="eyebrow">Pool board</p>
              <h2>Live projected standings</h2>
            </div>
            <Trophy size={23} />
          </div>

          {selectedLiveDrawn ? (
            <div className="standings-list live-pool-list">
              {projectedPoolStandings.map((entry, index) => (
                <article className="standing-row" key={entry.player.id}>
                  <div className="rank">{index + 1}</div>
                  <div>
                    <h3>{entry.player.name}</h3>
                    <p>
                      {entry.bestCar
                        ? `Best car #${entry.bestCar.vehicleNumber} running P${entry.bestCar.position}`
                        : `${entry.assignedCount} drivers assigned`}
                    </p>
                  </div>
                  <strong>{entry.bestPosition ? `P${entry.bestPosition}` : '--'}</strong>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state compact-empty">
              <Trophy size={26} />
              <h3>No draw for this race yet</h3>
              <p>Colton draws teams in Admin when this week is ready.</p>
            </div>
          )}

          <div className="scanner-card">
            <div className="live-topline">
              <div>
                <p className="eyebrow">Live driver radio</p>
                <h2>
                  {talkingChannels.length > 0
                    ? talkingChannels.map((channel) => `#${channel.driverNumber} ${channel.driverName}`).join(', ')
                    : activeScanners.length > 0
                      ? `Listening to ${activeScanners.length} driver${activeScanners.length > 1 ? 's' : ''}`
                      : 'Scanner ready'}
                </h2>
              </div>
              <div className={`flag-chip scanner-chip ${talkingChannels.length > 0 ? 'talking' : ''}`}>
                <Volume2 size={14} />
                {talkingChannels.length > 0 ? 'Talking' : isAudioPlaying ? 'Live' : 'Idle'}
              </div>
            </div>

            <p>{audioError || scannerStatus}</p>

            <div className="scanner-controls">
              {allScanChannel && (
                <button
                  type="button"
                  className={activeScanners.includes('All Scan') ? 'active' : ''}
                  onClick={() => playScanner(allScanChannel)}
                >
                  <RadioTower size={17} />
                  All Scan
                </button>
              )}
              {isAudioPlaying && (
                <button type="button" onClick={stopAllScanners}>
                  <Pause size={17} />
                  Stop all
                </button>
              )}
            </div>

            {talkingChannels.length > 0 && (
              <div className="now-talking" aria-live="polite">
                <Volume2 size={18} />
                <div>
                  <span>On the radio now</span>
                  <strong>
                    {talkingChannels.map((channel) => `#${channel.driverNumber} ${channel.driverName}`).join(', ')}
                  </strong>
                </div>
              </div>
            )}

            <p className="scanner-hint">
              Tap drivers below to build your own mix — listen to several at once and whoever's talking lights up teal and shows here.
              {allScanChannel ? ' “All Scan” is NASCAR’s single combined feed, so it can’t show who’s speaking.' : ''}
            </p>

            {myAudioChannels.length > 0 && (
              <>
                <div className="mini-title scanner-title">
                  <Headphones size={18} />
                  Your drivers
                </div>
                <div className="scanner-grid">
                  {myAudioChannels.map((channel) => (
                    <button
                      className={`${activeScanners.includes(channel.driverNumber) ? 'active' : ''} ${
                        speakingNumbers.includes(channel.driverNumber) ? 'speaking' : ''
                      }`}
                      type="button"
                      key={`my-${channel.driverNumber}`}
                      onClick={() => toggleScanner(channel)}
                    >
                      <span>{channel.driverNumber === 'All Scan' ? 'ALL' : `#${channel.driverNumber}`}</span>
                      <strong>{channel.driverName}</strong>
                    </button>
                  ))}
                </div>
              </>
            )}

            {liveAudioChannels.length > 0 && (
              <>
                <div className="mini-title scanner-title">
                  <RadioTower size={18} />
                  On track now
                </div>
                <div className="scanner-grid">
                  {liveAudioChannels.map((channel) => (
                    <button
                      className={`${activeScanners.includes(channel.driverNumber) ? 'active' : ''} ${
                        speakingNumbers.includes(channel.driverNumber) ? 'speaking' : ''
                      }`}
                      type="button"
                      key={`live-${channel.driverNumber}`}
                      onClick={() => toggleScanner(channel)}
                    >
                      <span>#{channel.driverNumber}</span>
                      <strong>{channel.driverName}</strong>
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="mini-title scanner-title">
              <Headphones size={18} />
              Build your mix — tap to add or remove
            </div>
            <div className="scanner-grid">
              {allDriverChannels.map((channel) => (
                <button
                  className={`${activeScanners.includes(channel.driverNumber) ? 'active' : ''} ${
                    speakingNumbers.includes(channel.driverNumber) ? 'speaking' : ''
                  }`}
                  type="button"
                  key={`all-${channel.driverNumber}`}
                  onClick={() => toggleScanner(channel)}
                >
                  <span>#{channel.driverNumber}</span>
                  <strong>{channel.driverName}</strong>
                </button>
              ))}
              {allDriverChannels.length === 0 && (
                <p className="scanner-empty">Driver channels load when NASCAR posts the scanner lineup for the next session.</p>
              )}
            </div>
          </div>

          <div className="section-head glass-head race-standing-head">
            <div>
              <p className="eyebrow">Race standings</p>
              <h2>
                {selectedRaceLive
                  ? `Lap ${selectedRaceLive.lapNumber} of ${selectedRaceLive.lapsInRace}`
                  : selectedLiveWeek.id === activeWeek.id
                    ? 'Race not live yet'
                    : selectedLiveStatus}
              </h2>
              <span>
                {liveVehicles.length
                  ? `${liveVehicles.length} cars on the board`
                  : selectedLiveWeek.id === activeWeek.id
                    ? 'NASCAR timing will unlock when cars are live on track'
                    : 'Select the active race week for live timing'}
              </span>
            </div>
            <button
              className={`refresh-live ${isRefreshingLive ? 'spinning' : ''}`}
              type="button"
              onClick={refreshLiveNow}
              aria-label="Refresh live race standings"
            >
              <RefreshCw size={18} />
            </button>
          </div>

          <div className="leaderboard-shell">
            <div className="leaderboard-header">
              <span>Pos</span>
              <span>Car</span>
              <span>Driver</span>
              <span>Move</span>
              <span>Radio</span>
            </div>
            <div className="leaderboard scroll-standings" aria-label="Scrollable live race standings">
              {liveVehicles.map((vehicle) => {
                const channel = audioChannels.find((item) => item.driverNumber === vehicle.vehicleNumber)
                const movement =
                  vehicle.startingPosition && vehicle.startingPosition !== vehicle.position
                    ? vehicle.startingPosition - vehicle.position
                    : 0

                return (
                  <article className="leader-row" key={`${vehicle.position}-${vehicle.vehicleNumber}`}>
                    <div className="rank">{vehicle.position}</div>
                    <CarBadge number={vehicle.vehicleNumber} seriesId={selectedLiveWeek.seriesId} />
                    <div className="leader-driver">
                      <DriverFace
                        driverId={driverIdByName[driverKey(vehicle.driverName)]}
                        seriesId={selectedLiveWeek.seriesId}
                        color="#1f2a44"
                        initial={vehicle.driverName.slice(0, 1)}
                      />
                      <div className="leader-driver-id">
                        <h3>{vehicle.driverName}</h3>
                        <p>
                          {vehicle.startingPosition ? `Started ${vehicle.startingPosition}, ` : ''}Lap{' '}
                          {vehicle.lapsCompleted}
                          {vehicle.lastLapSpeed ? `, ${vehicle.lastLapSpeed.toFixed(1)} mph` : ''}
                        </p>
                      </div>
                    </div>
                    <div className={`move-chip ${movement > 0 ? 'up' : movement < 0 ? 'down' : ''}`}>
                      {movement > 0 ? `+${movement}` : movement < 0 ? movement : '0'}
                    </div>
                    {channel && (
                      <button
                        className="listen-mini"
                        type="button"
                        onClick={() => playScanner(channel)}
                        aria-label={`Listen to ${vehicle.driverName}`}
                      >
                        <Headphones size={16} />
                      </button>
                    )}
                  </article>
                )
              })}
              {liveVehicles.length === 0 && (
                <div className="empty-state compact-empty">
                  <RadioTower size={26} />
                  <h3>No live standings yet</h3>
                  <p>NASCAR timing appears here when the current race is actually live.</p>
                </div>
              )}
            </div>
          </div>

          <div className="race-timeline-grid">
            <section>
              <div className="mini-title">
                <CalendarDays size={18} />
                Previous races
              </div>
              <div className="timeline-list">
                {pastWeeks.slice(0, 6).map((week) => {
                  const winner = state.players.find((player) => player.id === week.winnerId)

                  return (
                    <button type="button" key={week.id} onClick={() => setSelectedLiveWeekId(week.id)}>
                      <span>{week.date}</span>
                      <strong>{week.race}</strong>
                      <small>{winner ? `${winner.name} won pool` : 'Result not recorded'}</small>
                    </button>
                  )
                })}
              </div>
            </section>
            <section>
              <div className="mini-title">
                <CalendarDays size={18} />
                Upcoming races
              </div>
              <div className="timeline-list">
                {futureWeeks.slice(0, 6).map((week) => (
                  <button type="button" key={week.id} onClick={() => setSelectedLiveWeekId(week.id)}>
                    <span>{week.date}</span>
                    <strong>{week.race}</strong>
                    <small>{week.track}</small>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </section>
      )}

      {activeView === 'chat' && currentUser && (
        <section className="screen chat-screen">
          <div className="section-head dark">
            <div>
              <p className="eyebrow">Race day noise</p>
              <h2>Trash talk</h2>
            </div>
            <MessageCircle size={23} />
          </div>

          <div className="message-list">
            {state.messages.map((message) => {
              const player = state.players.find((item) => item.id === message.playerId) ?? currentUser
              const isMine = message.playerId === currentUser.id

              return (
                <article className={`message ${isMine ? 'mine' : ''}`} key={message.id}>
                  <span>{player.name}</span>
                  <p>{message.body}</p>
                  <small>{formatChatTime(message.sentAt)}</small>
                </article>
              )
            })}
            {state.messages.length === 0 && (
              <div className="empty-state compact-empty">
                <MessageCircle size={26} />
                <h3>No messages yet</h3>
                <p>First race-day chirp is still on the starting grid.</p>
              </div>
            )}
          </div>

          <form className="chat-form" onSubmit={handleChatSubmit}>
            <input
              value={chatText}
              onChange={(event) => setChatText(event.target.value)}
              placeholder="Type it..."
              aria-label="Chat message"
            />
            <button type="submit" aria-label="Send message">
              <Send size={19} />
            </button>
          </form>
        </section>
      )}

      {activeView === 'admin' && isAdmin && (
        <section className="screen">
          <div className="section-head dark">
            <div>
              <p className="eyebrow">Commissioner mode</p>
              <h2>Draw room</h2>
            </div>
            <Lock size={23} />
          </div>

          <div className="admin-panel">
            <label>
              Active race
              <select
                value={state.activeWeekId}
                onChange={(event) => updateState({ ...state, activeWeekId: event.target.value })}
              >
                {state.weeks.filter((week) => week.seriesId === 1).map((week) => (
                  <option key={week.id} value={week.id}>
                    {seriesMeta[week.seriesId].short} - {week.race}
                  </option>
                ))}
              </select>
            </label>

            <form className="admin-neighbor-form" onSubmit={addNeighbor}>
              <div>
                <p className="eyebrow">League roster</p>
                <h3>Add neighbor</h3>
                <span>New neighbors use the same league code and appear on the login screen.</span>
              </div>
              <div className="admin-neighbor-controls">
                <input
                  value={newNeighborName}
                  onChange={(event) => {
                    setNewNeighborName(event.target.value)
                    setNeighborError('')
                  }}
                  placeholder="Neighbor name"
                  aria-label="New neighbor name"
                />
                <button type="submit">
                  <Plus size={18} />
                  Add
                </button>
              </div>
              {neighborError && <p className="login-error">{neighborError}</p>}
            </form>

            <div className="admin-action">
              <div>
                <p className="eyebrow">Random draw</p>
                <h3>{drawComplete ? 'Teams are posted' : 'Ready to draw teams'}</h3>
                <span>
                  {(() => {
                    const { pool, source } = drawPoolForWeek(activeWeek, liveRace)
                    const n = activeWeek.participantIds.length
                    const each = n > 0 ? Math.floor(pool.length / n) : 0
                    const leftover = n > 0 ? pool.length - each * n : 0
                    return `${pool.length} cars (${source}) · ${n} players → ${each} each${
                      leftover > 0 ? ` + ${leftover} shared` : ''
                    }`
                  })()}
                </span>
              </div>
              <button type="button" onClick={drawWeek}>
                <RefreshCw size={18} />
                Draw
              </button>
            </div>

            {hasDraw(activeWeek) && (
              <button type="button" className="republish-btn" onClick={republishDraw}>
                <Upload size={16} />
                Publish this lineup to everyone
              </button>
            )}

            <div>
              <div className="mini-title">
                <UsersRound size={18} />
                Participating this week
              </div>
              <div className="participant-grid">
                {state.players.map((player) => (
                  <button
                    className={activeWeek.participantIds.includes(player.id) ? 'selected' : ''}
                    key={player.id}
                    type="button"
                    onClick={() => toggleParticipant(player.id)}
                  >
                    <span>{player.name}</span>
                    <strong>{activeWeek.participantIds.includes(player.id) ? 'In' : 'Out'}</strong>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mini-title">
                <Banknote size={18} />
                Paid $5
              </div>
              <div className="paid-grid">
                {participants.map((player) => (
                  <button
                    className={activeWeek.paidBy.includes(player.id) ? 'paid' : ''}
                    key={player.id}
                    type="button"
                    onClick={() => togglePaid(player.id)}
                  >
                    <span>{player.name}</span>
                    <strong>{activeWeek.paidBy.includes(player.id) ? 'Paid' : '$5 due'}</strong>
                  </button>
                ))}
              </div>
            </div>

            <div className="team-stack compact">
              {participants.map((player) => (
                <article className="team-card" key={player.id}>
                  <div className="team-card-head">
                    <div className="avatar" style={{ background: player.color }}>
                      {player.name.slice(0, 1)}
                    </div>
                    <div>
                      <h3>{player.name}</h3>
                      <p>{activeWeek.assignments[player.id]?.length ?? 0} drivers</p>
                    </div>
                    {activeWeek.paidBy.includes(player.id) && <Check className="paid-check" size={18} />}
                  </div>
                  {(activeWeek.assignments[player.id] ?? []).length > 0 ? (
                    <div className="lineup-driver-list">
                      {(activeWeek.assignments[player.id] ?? []).map((driver) => {
                        const liveCar = getLiveVehicle(activeLiveRace, driver)

                        return (
                          <div className="lineup-driver" key={`${player.id}-${driver.number}`}>
                            <span>#{driver.number}</span>
                            <strong>{driver.name}</strong>
                            <small>{startingPositionLabel(liveCar)}</small>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="lineup-empty">Not drawn yet.</p>
                  )}
                </article>
              ))}
            </div>

            <div className="result-grid">
              <label>
                Winner
                <select
                  value={activeWeek.winnerId ?? ''}
                  onChange={(event) =>
                    updateWeek(activeWeek.id, (week) => ({ ...week, winnerId: event.target.value || undefined }))
                  }
                >
                  <option value="">TBD</option>
                  {participants.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Second
                <select
                  value={activeWeek.secondId ?? ''}
                  onChange={(event) =>
                    updateWeek(activeWeek.id, (week) => ({ ...week, secondId: event.target.value || undefined }))
                  }
                >
                  <option value="">TBD</option>
                  {participants.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <form className="inline-form" onSubmit={addWeek}>
            <input
              value={newWeekName}
              onChange={(event) => setNewWeekName(event.target.value)}
              placeholder="Add race week"
              aria-label="Add race week"
            />
            <button type="submit" aria-label="Add race week">
              <Plus size={18} />
            </button>
          </form>
        </section>
      )}

      {activeView === 'account' && currentUser && (
        <section className="screen">
          <div className="account-card">
            <div className="avatar xl" style={{ background: currentUser.color }}>
              {currentUser.name.slice(0, 1)}
            </div>
            <h2>{currentUser.name}</h2>
            <p>{currentUser.handle}</p>
            <button className="install-button" type="button" onClick={handleInstallTap}>
              <Download size={18} />
              Install app
            </button>
            {showInstallHelp && (
              <p className="install-note">iPhone: Share, then Add to Home Screen. Android: tap Install/Add app.</p>
            )}
            <button type="button" onClick={logout}>
              <LogOut size={18} />
              Log out
            </button>
          </div>

          <div className="backup-card">
            <div className="mini-title">
              <Save size={18} />
              Save your draws
            </div>
            <p className="backup-copy">
              Your weekly draws live on this phone. Download a backup file before any update, then restore it here to
              bring every pick back — even on a new phone.
            </p>
            <div className="backup-actions">
              <button type="button" onClick={exportBackup}>
                <Download size={17} />
                Download backup
              </button>
              <button type="button" onClick={() => backupInputRef.current?.click()}>
                <Upload size={17} />
                Restore backup
              </button>
            </div>
            <input
              ref={backupInputRef}
              type="file"
              accept="application/json,.json"
              onChange={importBackup}
              hidden
            />
            {backupNote && <p className="backup-note">{backupNote}</p>}
          </div>

          <div className="fairness-band">
            <ShieldCheck size={20} />
            <p>Invite code for this prototype is {INVITE_CODE}. Real private accounts need a shared backend next.</p>
          </div>
        </section>
      )}

      <nav className="bottom-nav" aria-label="Primary">
        {navViews.map(({ id, label, Icon }) => (
          <button className={activeView === id ? 'active' : ''} key={id} type="button" onClick={() => setView(id)}>
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </main>
  )
}

export default App
