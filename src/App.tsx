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
  Play,
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

type Week = {
  id: string
  race: string
  track: string
  date: string
  seriesId: SeriesId
  participantIds: string[]
  paidBy: string[]
  assignments: Record<string, Driver[]>
  winnerId?: string
  secondId?: string
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
  { number: '7', name: 'Daniel Suarez', team: 'Trackhouse Racing' },
  { number: '8', name: 'Kyle Busch', team: 'Richard Childress Racing' },
  { number: '9', name: 'Chase Elliott', team: 'Hendrick Motorsports' },
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
  { number: '88', name: 'Connor Zilisch', team: 'Trackhouse Racing' },
  { number: '97', name: 'Shane van Gisbergen', team: 'Trackhouse Racing' },
  { number: '99', name: 'Corey Heim', team: '23XI Racing' },
]

const allPlayerIds = players.map((player) => player.id)

const remainingCupSchedule = [
  { id: 'w5', race: 'Nashville', track: 'Nashville Superspeedway', date: 'May 31' },
  { id: 'w6', race: 'Michigan', track: 'Michigan International Speedway', date: 'Jun 7' },
  { id: 'w7', race: 'Pocono', track: 'Pocono Raceway', date: 'Jun 14' },
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

const seriesOrder: SeriesId[] = [3, 2, 1]

// This weekend's three races at Nashville (Trucks Fri / Xfinity Sat / Cup Sun).
// The Cup race reuses the existing 'w5' week so its history/results carry over.
const raceWeekend: Array<{ seriesId: SeriesId; id: string; race: string; track: string; date: string }> = [
  { seriesId: 3, id: 'truck-nashville-2026', race: 'Allegiance 200', track: 'Nashville Superspeedway', date: 'May 29' },
  { seriesId: 2, id: 'xfinity-nashville-2026', race: 'Sports Illustrated Resorts 250', track: 'Nashville Superspeedway', date: 'May 30' },
  { seriesId: 1, id: 'w5', race: 'Cracker Barrel 400', track: 'Nashville Superspeedway', date: 'May 31' },
]

const weekendBySeries = entriesToObject(raceWeekend.map((race) => [String(race.seriesId), race]))

const starterState: AppState = {
  activeWeekId: 'truck-nashville-2026',
  players,
  weeks: [
    createOpenWeek('w1', 'Daytona 500', 'Daytona International Speedway', 'Feb 15'),
    createOpenWeek('w2', 'Pennzoil 400', 'Las Vegas Motor Speedway', 'Mar 2'),
    createOpenWeek('w3', 'Food City 500', 'Bristol Motor Speedway', 'Apr 12'),
    createOpenWeek('w4', 'Coca-Cola 600', 'Charlotte Motor Speedway', 'May 24'),
    createOpenWeek('truck-nashville-2026', 'Allegiance 200', 'Nashville Superspeedway', 'May 29', 3),
    createOpenWeek('xfinity-nashville-2026', 'Sports Illustrated Resorts 250', 'Nashville Superspeedway', 'May 30', 2),
    ...remainingCupSchedule.map((race) =>
      race.id === 'w5'
        ? createOpenWeek('w5', 'Cracker Barrel 400', 'Nashville Superspeedway', 'May 31', 1)
        : createOpenWeek(race.id, race.race, race.track, race.date),
    ),
  ],
  messages: [],
}

const trashTalk = [
  'That is a championship lineup.',
  'Bring the $5 and the excuses.',
]

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

function loadState(): AppState {
  const saved = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(BACKUP_KEY)
  if (!saved) {
    return starterState
  }

  let parsed: AppState
  try {
    parsed = JSON.parse(saved) as AppState
  } catch {
    return starterState
  }

  try {
    return normalizeSavedState(parsed)
  } catch {
    // Migration failed — never discard the user's draws. Fall back to the raw
    // saved state so saveState can't overwrite real picks with starter data.
    return parsed
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

  if (addedWeekendRace) {
    activeWeekId = 'truck-nashville-2026'
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
  // Keep a second copy under a key that no migration touches, so draws survive
  // even if the primary key is ever wiped or a future migration misbehaves.
  if (hasAnyDraw(state)) {
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

function dealDrivers(roster: Player[], participantIds: string[], driverPool: Driver[], seed?: string) {
  const participants = roster.filter((player) => participantIds.includes(player.id))
  const assignments = entriesToObject(roster.map((player) => [player.id, [] as Driver[]]))

  if (participants.length === 0 || driverPool.length === 0) {
    return assignments
  }

  const playerOrder = shuffle(participants, seed ? `${seed}-players` : undefined)
  const driverOrder = shuffle(driverPool, seed ? `${seed}-drivers` : undefined)

  driverOrder.forEach((driver, index) => {
    const player = playerOrder[index % playerOrder.length]
    assignments[player.id].push(driver)
  })

  return assignments
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

function createChatMessage(playerId: string, body: string): ChatMessage {
  return {
    id: window.crypto?.randomUUID?.() ?? `message-${Math.random().toString(36).slice(2)}`,
    playerId,
    body,
    sentAt: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
  }
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

  return {
    lapNumber: feed.lap_number ?? 0,
    lapsInRace: feed.laps_in_race ?? 0,
    lapsToGo: feed.laps_to_go ?? 0,
    flagState: feed.flag_state ?? 9,
    raceId: feed.race_id,
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

function rosterFromMapping(data: unknown): Driver[] {
  const mapping = data as {
    audio_config?: Array<{ driver_number?: string; driver_name?: string }>
  }

  const seen = new Set<string>()
  const roster: Driver[] = []

  for (const channel of mapping.audio_config ?? []) {
    const number = (channel.driver_number ?? '').trim()
    const name = (channel.driver_name ?? '').replace(/\s*\(i\)\s*$/i, '').trim()

    if (!number || number === 'All Scan' || !name || seen.has(number)) {
      continue
    }

    seen.add(number)
    roster.push({ number, name, team: '' })
  }

  return roster
}

function getLiveVehicle(liveRace: LiveRace | undefined, driver: Driver) {
  return liveRace?.vehicles.find((vehicle) => vehicle.vehicleNumber === driver.number)
}

function startingPositionLabel(vehicle: LiveVehicle | undefined) {
  return vehicle?.startingPosition ? `Start ${vehicle.startingPosition}` : 'Start --'
}

function scannerLabel(channel: AudioChannel) {
  return channel.driverNumber === 'All Scan' ? 'All Scan' : `#${channel.driverNumber} ${channel.driverName}`
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
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const hlsRef = useRef<Hls | null>(null)
  const installPromptRef = useRef<BeforeInstallPromptEvent | null>(null)
  const backupInputRef = useRef<HTMLInputElement | null>(null)
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
  const [activeAudio, setActiveAudio] = useState<AudioChannel>()
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const [audioError, setAudioError] = useState('')
  const [canInstall, setCanInstall] = useState(false)
  const [isRefreshingLive, setIsRefreshingLive] = useState(false)
  const [showInstallHelp, setShowInstallHelp] = useState(false)
  const [rostersBySeries, setRostersBySeries] = useState<Record<number, Driver[]>>({ 1: drivers })
  const [driverIdByName, setDriverIdByName] = useState<Record<string, number>>({})

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

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) {
      return undefined
    }

    function handlePlay() {
      setIsAudioPlaying(true)
    }

    function handlePause() {
      setIsAudioPlaying(false)
    }

    function handleError() {
      setIsAudioPlaying(false)
      setAudioError('That scanner stream could not play. It may require NASCAR account access or an active race session.')
    }

    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handlePause)
    audio.addEventListener('error', handleError)

    return () => {
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handlePause)
      audio.removeEventListener('error', handleError)
    }
  }, [])

  useEffect(() => {
    return () => {
      hlsRef.current?.destroy()
    }
  }, [])

  useEffect(() => {
    let active = true

    async function loadRosters() {
      const results = await Promise.all(
        seriesOrder.map(async (seriesId) => {
          try {
            const response = await fetch(`/api/audio-mapping?series=${seriesId}`, { cache: 'no-store' })
            if (!response.ok) {
              return [seriesId, undefined] as const
            }

            const roster = rosterFromMapping(await response.json())
            return [seriesId, roster.length > 0 ? roster : undefined] as const
          } catch {
            return [seriesId, undefined] as const
          }
        }),
      )

      if (!active) {
        return
      }

      setRostersBySeries((current) => {
        const next = { ...current }
        for (const [seriesId, roster] of results) {
          if (roster) {
            next[seriesId] = roster
          }
        }
        return next
      })
    }

    loadRosters()

    return () => {
      active = false
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

  function updateState(next: AppState) {
    setState(next)
    saveState(next)
  }

  function updateWeek(weekId: string, updater: (week: Week) => Week) {
    updateState({
      ...state,
      weeks: state.weeks.map((week) => (week.id === weekId ? updater(week) : week)),
    })
  }

  function drawWeek() {
    updateWeek(activeWeek.id, (week) => ({
      ...week,
      assignments: dealDrivers(state.players, week.participantIds, rostersBySeries[week.seriesId] ?? drivers),
      winnerId: undefined,
      secondId: undefined,
    }))
  }

  function selectWeekendSeries(seriesId: SeriesId) {
    const race = weekendBySeries[String(seriesId)]
    if (!race) {
      return
    }

    updateState({ ...state, activeWeekId: race.id })
    setSelectedLiveWeekId(race.id)
  }

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

  function addMessage(body: string) {
    const clean = body.trim()
    if (!clean || !currentUser) {
      return
    }

    updateState({
      ...state,
      messages: [...state.messages, createChatMessage(currentUser.id, clean)],
    })
    setChatText('')
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

  async function playScanner(channel: AudioChannel) {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    setAudioError('')
    setActiveAudio(channel)
    hlsRef.current?.destroy()
    hlsRef.current = null
    audio.pause()
    audio.removeAttribute('src')
    audio.load()

    try {
      const { default: HlsPlayer } = await import('hls.js')

      if (HlsPlayer.isSupported()) {
        const hls = new HlsPlayer({
          enableWorker: true,
          liveSyncDurationCount: 2,
        })

        hls.on(HlsPlayer.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            setAudioError('Scanner stream failed. It may be offline, auth-gated, or between live sessions.')
            setIsAudioPlaying(false)
            hls.destroy()
            hlsRef.current = null
          }
        })

        hls.loadSource(channel.url)
        hls.attachMedia(audio)
        hlsRef.current = hls
        await audio.play()
        return
      }

      if (audio.canPlayType('application/vnd.apple.mpegurl')) {
        audio.src = channel.url
        await audio.play()
        return
      }

      setAudioError('This browser cannot play NASCAR HLS scanner streams.')
    } catch {
      setAudioError('Tap play again after the scanner loads, or try during a live NASCAR session.')
      setIsAudioPlaying(false)
    }
  }

  function stopScanner() {
    const audio = audioRef.current
    audio?.pause()
    hlsRef.current?.destroy()
    hlsRef.current = null
    setIsAudioPlaying(false)
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

      <audio ref={audioRef} className={`global-scanner-audio ${activeAudio ? 'visible' : ''}`} controls playsInline />

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

          <div className="series-switch" role="group" aria-label="Race weekend series">
            {seriesOrder.map((seriesId) => {
              const race = weekendBySeries[String(seriesId)]
              const meta = seriesMeta[seriesId]
              const isActive = activeWeek.id === race?.id

              return (
                <button
                  key={seriesId}
                  type="button"
                  className={isActive ? 'active' : ''}
                  onClick={() => selectWeekendSeries(seriesId)}
                >
                  <span>{meta.day}</span>
                  <strong>{meta.short}</strong>
                  <small>{race?.race}</small>
                </button>
              )
            })}
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
                </article>
              ))}
            </div>
          </div>

          <div className="history-list">
            {state.weeks.map((week) => {
              const winner = state.players.find((player) => player.id === week.winnerId)
              const second = state.players.find((player) => player.id === week.secondId)

              return (
                <article className="history-row" key={week.id}>
                  <div>
                    <h3>{week.race}</h3>
                    <p>
                      {week.participantIds.length} neighbors, {formatCurrency(week.paidBy.length * 5)} pot
                    </p>
                  </div>
                  <div>
                    <span>{winner?.name ?? 'Open'}</span>
                    <small>{second ? `${second.name} got $5 back` : 'Second TBD'}</small>
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
                <h2>{activeAudio ? scannerLabel(activeAudio) : 'Scanner ready'}</h2>
              </div>
              <div className="flag-chip scanner-chip">
                <Volume2 size={14} />
                {isAudioPlaying ? 'Live' : 'Idle'}
              </div>
            </div>

            <p>{audioError || scannerStatus}</p>

            <div className="scanner-controls">
              {activeAudio && (
                <button type="button" onClick={isAudioPlaying ? stopScanner : () => playScanner(activeAudio)}>
                  {isAudioPlaying ? <Pause size={17} /> : <Play size={17} />}
                  {isAudioPlaying ? 'Stop' : 'Resume'}
                </button>
              )}
              {allScanChannel && (
                <button type="button" onClick={() => playScanner(allScanChannel)}>
                  <RadioTower size={17} />
                  All Scan
                </button>
              )}
            </div>

            {myAudioChannels.length > 0 && (
              <>
                <div className="mini-title scanner-title">
                  <Headphones size={18} />
                  Your drivers
                </div>
                <div className="scanner-grid">
                  {myAudioChannels.map((channel) => (
                    <button
                      className={activeAudio?.driverNumber === channel.driverNumber ? 'active' : ''}
                      type="button"
                      key={`my-${channel.driverNumber}`}
                      onClick={() => playScanner(channel)}
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
                      className={activeAudio?.driverNumber === channel.driverNumber ? 'active' : ''}
                      type="button"
                      key={`live-${channel.driverNumber}`}
                      onClick={() => playScanner(channel)}
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
              Listen to any driver
            </div>
            <div className="scanner-grid">
              {allDriverChannels.map((channel) => (
                <button
                  className={activeAudio?.driverNumber === channel.driverNumber ? 'active' : ''}
                  type="button"
                  key={`all-${channel.driverNumber}`}
                  onClick={() => playScanner(channel)}
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
                    <div className="car-number small">#{vehicle.vehicleNumber}</div>
                    <div>
                      <h3>{vehicle.driverName}</h3>
                      <p>
                        {vehicle.startingPosition ? `Started ${vehicle.startingPosition}, ` : ''}Lap{' '}
                        {vehicle.lapsCompleted}
                        {vehicle.lastLapSpeed ? `, ${vehicle.lastLapSpeed.toFixed(1)} mph` : ''}
                      </p>
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
                  <small>{message.sentAt}</small>
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

          <div className="chip-row">
            {trashTalk.map((line) => (
              <button type="button" key={line} onClick={() => addMessage(line)}>
                {line}
              </button>
            ))}
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
                {state.weeks.map((week) => (
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
                  {(rostersBySeries[activeWeek.seriesId] ?? drivers).length} {seriesMeta[activeWeek.seriesId].short} drivers
                </span>
              </div>
              <button type="button" onClick={drawWeek}>
                <RefreshCw size={18} />
                Draw
              </button>
            </div>

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
