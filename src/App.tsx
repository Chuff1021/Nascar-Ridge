import {
  Banknote,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDot,
  Crown,
  Gauge,
  Lock,
  LogOut,
  MessageCircle,
  Plus,
  RadioTower,
  RefreshCw,
  Send,
  ShieldCheck,
  Trophy,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
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

const STORAGE_KEY = 'shuyler-ridge-raceday-v3-state'
const SESSION_KEY = 'shuyler-ridge-raceday-session'
const INVITE_CODE = 'raceday'

const players: Player[] = [
  { id: 'cody', name: 'Cody', handle: 'Commissioner', color: '#ef233c', passcode: 'raceday', isAdmin: true },
  { id: 'emily', name: 'Emily', handle: 'High Line', color: '#1d4ed8', passcode: 'raceday' },
  { id: 'cory', name: 'Cory', handle: 'Bumper Tag', color: '#facc15', passcode: 'raceday' },
  { id: 'sku', name: 'Sku', handle: 'Pit Wizard', color: '#7c3aed', passcode: 'raceday' },
  { id: 'tyler', name: 'Tyler', handle: 'Wide Open', color: '#0f8b5f', passcode: 'raceday' },
  { id: 'hillary', name: 'Hillary', handle: 'Draft Queen', color: '#ec4899', passcode: 'raceday' },
  { id: 'colton', name: 'Colton', handle: 'Final Lap', color: '#0891b2', passcode: 'raceday' },
  { id: 'shannon', name: 'Shannon', handle: 'Loose Lug', color: '#f97316', passcode: 'raceday' },
  { id: 'nate', name: 'Nate', handle: 'Short Track', color: '#334155', passcode: 'raceday' },
  { id: 'lundy', name: 'Lundy', handle: 'Wall Rider', color: '#84cc16', passcode: 'raceday' },
]

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

const starterState: AppState = {
  activeWeekId: 'w5',
  players,
  weeks: [
    createSeedWeek('w1', 'Daytona 500', 'Daytona International Speedway', 'Feb 15', 'cody', 'emily'),
    createSeedWeek('w2', 'Pennzoil 400', 'Las Vegas Motor Speedway', 'Mar 2', 'sku', 'nate'),
    createSeedWeek('w3', 'Food City 500', 'Bristol Motor Speedway', 'Apr 12', 'hillary', 'cory'),
    {
      id: 'w4',
      race: 'Coca-Cola 600',
      track: 'Charlotte Motor Speedway',
      date: 'May 24',
      participantIds: allPlayerIds,
      paidBy: allPlayerIds,
      assignments: dealDrivers(players, allPlayerIds, 'w4-ready'),
    },
    ...remainingCupSchedule.map((race) => createOpenWeek(race.id, race.race, race.track, race.date)),
  ],
  messages: [
    {
      id: 'm1',
      playerId: 'cody',
      body: 'Draw closes when the green flag drops.',
      sentAt: '8:03 PM',
    },
    {
      id: 'm2',
      playerId: 'hillary',
      body: 'I want all Hendrick cars this week.',
      sentAt: '8:05 PM',
    },
    {
      id: 'm3',
      playerId: 'lundy',
      body: 'That sounds like something last place would say.',
      sentAt: '8:07 PM',
    },
  ],
}

const trashTalk = [
  'Garage is loaded.',
  'Somebody check the draw machine.',
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

function createSeedWeek(
  id: string,
  race: string,
  track: string,
  date: string,
  winnerId: string,
  secondId: string,
): Week {
  return {
    id,
    race,
    track,
    date,
    participantIds: allPlayerIds,
    paidBy: allPlayerIds,
    assignments: dealDrivers(players, allPlayerIds, id),
    winnerId,
    secondId,
  }
}

function createOpenWeek(id: string, race: string, track: string, date: string): Week {
  return {
    id,
    race,
    track,
    date,
    participantIds: allPlayerIds,
    paidBy: [],
    assignments: Object.fromEntries(players.map((player) => [player.id, [] as Driver[]])),
  }
}

function loadState(): AppState {
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (!saved) {
    return starterState
  }

  try {
    return JSON.parse(saved) as AppState
  } catch {
    return starterState
  }
}

function loadSession() {
  return window.localStorage.getItem(SESSION_KEY) ?? undefined
}

function saveState(state: AppState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
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

function dealDrivers(roster: Player[], participantIds: string[], seed?: string) {
  const participants = roster.filter((player) => participantIds.includes(player.id))
  const assignments = Object.fromEntries(roster.map((player) => [player.id, [] as Driver[]]))

  if (participants.length === 0) {
    return assignments
  }

  const playerOrder = shuffle(participants, seed ? `${seed}-players` : undefined)
  const driverOrder = shuffle(drivers, seed ? `${seed}-drivers` : undefined)

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
    participantIds: roster.map((player) => player.id),
    paidBy: [],
    assignments: dealDrivers(roster, roster.map((player) => player.id)),
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

function getLiveVehicle(liveRace: LiveRace | undefined, driver: Driver) {
  return liveRace?.vehicles.find((vehicle) => vehicle.vehicleNumber === driver.number)
}

function startingPositionLabel(vehicle: LiveVehicle | undefined) {
  return vehicle?.startingPosition ? `Start ${vehicle.startingPosition}` : 'Start --'
}

function App() {
  const [state, setState] = useState<AppState>(() => {
    const loaded = loadState()
    return { ...loaded, currentUserId: loadSession() ?? loaded.currentUserId }
  })
  const [view, setView] = useState<View>('garage')
  const [loginPlayerId, setLoginPlayerId] = useState(players[0].id)
  const [loginCode, setLoginCode] = useState('')
  const [loginError, setLoginError] = useState('')
  const [chatText, setChatText] = useState('')
  const [newWeekName, setNewWeekName] = useState('')
  const [liveRace, setLiveRace] = useState<LiveRace>()
  const [liveStatus, setLiveStatus] = useState('Connecting to NASCAR timing...')

  const activeWeek = state.weeks.find((week) => week.id === state.activeWeekId) ?? state.weeks[0]
  const currentUser = state.players.find((player) => player.id === state.currentUserId)
  const isLoggedIn = Boolean(currentUser)
  const isAdmin = Boolean(currentUser?.isAdmin)
  const activeView = !isAdmin && view === 'admin' ? 'garage' : view
  const navViews = isAdmin
    ? [publicViews[0], publicViews[1], publicViews[2], publicViews[3], adminView]
    : publicViews
  const participants = state.players.filter((player) => activeWeek.participantIds.includes(player.id))
  const myDrivers = currentUser ? activeWeek.assignments[currentUser.id] ?? [] : []
  const myLiveCars = liveRace?.vehicles.filter((vehicle) =>
    myDrivers.some((driver) => driver.number === vehicle.vehicleNumber),
  )

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
          setLiveRace(normalizeLiveRace(data))
          setLiveStatus('Live NASCAR timing feed')
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
      assignments: dealDrivers(state.players, week.participantIds),
      winnerId: undefined,
      secondId: undefined,
    }))
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
            <strong>{liveRace ? flagLabel(liveRace.flagState) : 'Standby'}</strong>
          </div>
        </div>
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

          {!activeWeek.participantIds.includes(currentUser.id) ? (
            <div className="empty-state">
              <UsersRound size={28} />
              <h3>Not in this week's lineup</h3>
              <p>Cody can add you from Admin before the draw.</p>
            </div>
          ) : myDrivers.length === 0 ? (
            <div className="empty-state">
              <RefreshCw size={28} />
              <h3>Waiting on the commissioner draw</h3>
              <p>Your cars will appear after Cody draws the weekly teams.</p>
            </div>
          ) : (
            <div className="driver-list">
              {myDrivers.map((driver) => {
                const liveCar = getLiveVehicle(liveRace, driver)

                return (
                  <article className="driver-card" key={`${driver.number}-${driver.name}`}>
                    <div className="car-number">#{driver.number}</div>
                    <div>
                      <h3>{driver.name}</h3>
                      <p>
                        {driver.team} / {startingPositionLabel(liveCar)}
                      </p>
                    </div>
                    {liveCar && <strong>P{liveCar.position}</strong>}
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
                    <div className="lineup-driver-list">
                      {(activeWeek.assignments[player.id] ?? []).map((driver) => {
                        const liveCar = getLiveVehicle(liveRace, driver)

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
                    <p className="lineup-empty">Waiting on Cody to draw this race.</p>
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
          <div className="live-card">
            <div className="live-topline">
              <div>
                <p className="eyebrow">Race tracker</p>
                <h2>{liveRace ? `Lap ${liveRace.lapNumber} / ${liveRace.lapsInRace}` : 'Live timing'}</h2>
              </div>
              <div className={`flag-chip flag-${liveRace?.flagState ?? 9}`}>
                <CircleDot size={14} />
                {liveRace ? flagLabel(liveRace.flagState) : 'Standby'}
              </div>
            </div>
            <p>{liveStatus}</p>
            {liveRace && (
              <div className="lap-meter">
                <span style={{ width: `${Math.min(100, (liveRace.lapNumber / liveRace.lapsInRace) * 100)}%` }} />
              </div>
            )}
          </div>

          <div className="leaderboard">
            {(liveRace?.vehicles.slice(0, 12) ?? []).map((vehicle) => (
              <article className="leader-row" key={`${vehicle.position}-${vehicle.vehicleNumber}`}>
                <div className="rank">{vehicle.position}</div>
                <div className="car-number small">#{vehicle.vehicleNumber}</div>
                <div>
                  <h3>{vehicle.driverName}</h3>
                  <p>
                    {vehicle.startingPosition ? `Started ${vehicle.startingPosition}, ` : ''}Lap {vehicle.lapsCompleted}
                    {vehicle.lastLapSpeed ? `, ${vehicle.lastLapSpeed.toFixed(1)} mph` : ''}
                  </p>
                </div>
              </article>
            ))}
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
                    {week.race}
                  </option>
                ))}
              </select>
            </label>

            <div className="admin-action">
              <div>
                <p className="eyebrow">Random draw</p>
                <h3>{drawComplete ? 'Teams are posted' : 'Ready to draw teams'}</h3>
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
                        const liveCar = getLiveVehicle(liveRace, driver)

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
            <button type="button" onClick={logout}>
              <LogOut size={18} />
              Log out
            </button>
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
