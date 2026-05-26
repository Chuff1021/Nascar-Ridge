import {
  Banknote,
  CalendarDays,
  Check,
  Crown,
  Flag,
  Gauge,
  Lock,
  MessageCircle,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Trophy,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type View = 'garage' | 'draw' | 'league' | 'chat' | 'admin'

type Player = {
  id: string
  name: string
  handle: string
  color: string
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
  currentUserId: string
  messages: ChatMessage[]
}

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

const starterState: AppState = {
  currentUserId: 'ace',
  activeWeekId: 'w4',
  players: [
    { id: 'ace', name: 'Austin', handle: 'Pole Sitter', color: '#d92525' },
    { id: 'bo', name: 'Bo', handle: 'Wall Rider', color: '#0f8b5f' },
    { id: 'chuck', name: 'Chuck', handle: 'Loose Lug', color: '#2563eb' },
    { id: 'drew', name: 'Drew', handle: 'Pit Boss', color: '#f59e0b' },
    { id: 'eli', name: 'Eli', handle: 'Draft King', color: '#7c3aed' },
    { id: 'finn', name: 'Finn', handle: 'Final Lap', color: '#0891b2' },
  ],
  weeks: [
    {
      id: 'w1',
      race: 'Daytona 500',
      track: 'Daytona',
      date: 'Feb 15',
      paidBy: ['ace', 'bo', 'chuck', 'drew', 'eli', 'finn'],
      assignments: {},
      winnerId: 'drew',
      secondId: 'ace',
    },
    {
      id: 'w2',
      race: 'Pennzoil 400',
      track: 'Las Vegas',
      date: 'Mar 2',
      paidBy: ['ace', 'bo', 'chuck', 'drew', 'finn'],
      assignments: {},
      winnerId: 'bo',
      secondId: 'finn',
    },
    {
      id: 'w3',
      race: 'Food City 500',
      track: 'Bristol',
      date: 'Apr 12',
      paidBy: ['ace', 'bo', 'chuck', 'drew', 'eli', 'finn'],
      assignments: {},
      winnerId: 'ace',
      secondId: 'chuck',
    },
    {
      id: 'w4',
      race: 'Coca-Cola 600',
      track: 'Charlotte',
      date: 'May 31',
      paidBy: ['ace', 'chuck', 'drew'],
      assignments: {},
    },
  ],
  messages: [
    {
      id: 'm1',
      playerId: 'drew',
      body: 'Whoever gets Larson is buying wings.',
      sentAt: '8:03 PM',
    },
    {
      id: 'm2',
      playerId: 'ace',
      body: 'Pay before green flag or your pick gets cursed.',
      sentAt: '8:05 PM',
    },
  ],
}

const trashTalk = [
  'My garage is stacked.',
  'Enjoy racing for second.',
  'That draw was criminal.',
  'Pay up before green flag.',
]

const views: Array<{ id: View; label: string; Icon: typeof Gauge }> = [
  { id: 'garage', label: 'Garage', Icon: Gauge },
  { id: 'draw', label: 'Draw', Icon: RefreshCw },
  { id: 'league', label: 'League', Icon: Trophy },
  { id: 'chat', label: 'Chat', Icon: MessageCircle },
  { id: 'admin', label: 'Admin', Icon: Lock },
]

function loadState(): AppState {
  const saved =
    window.localStorage.getItem('shuyler-ridge-raceday-state') ??
    window.localStorage.getItem('hat-lap-state')
  if (!saved) {
    return seedDraws(starterState)
  }

  try {
    return JSON.parse(saved) as AppState
  } catch {
    return seedDraws(starterState)
  }
}

function seedDraws(state: AppState): AppState {
  const weeks = state.weeks.map((week, index) => {
    if (Object.keys(week.assignments).length > 0) {
      return week
    }

    return {
      ...week,
      assignments: dealDrivers(state.players, `${week.id}-${index}`),
    }
  })

  return { ...state, weeks }
}

function saveState(state: AppState) {
  window.localStorage.setItem('shuyler-ridge-raceday-state', JSON.stringify(state))
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

function dealDrivers(players: Player[], seed?: string) {
  const playerOrder = shuffle(players, seed ? `${seed}-players` : undefined)
  const driverOrder = shuffle(drivers, seed ? `${seed}-drivers` : undefined)
  const assignments = Object.fromEntries(players.map((player) => [player.id, [] as Driver[]]))

  driverOrder.forEach((driver, index) => {
    const player = playerOrder[index % playerOrder.length]
    assignments[player.id].push(driver)
  })

  return assignments
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

function App() {
  const [state, setState] = useState<AppState>(() => loadState())
  const [view, setView] = useState<View>('garage')
  const [chatText, setChatText] = useState('')
  const [newPlayerName, setNewPlayerName] = useState('')
  const [newWeekName, setNewWeekName] = useState('')

  const activeWeek = state.weeks.find((week) => week.id === state.activeWeekId) ?? state.weeks[0]
  const currentUser = state.players.find((player) => player.id === state.currentUserId) ?? state.players[0]
  const myDrivers = activeWeek.assignments[currentUser.id] ?? []

  const standings = useMemo(() => {
    return state.players
      .map((player) => {
        const wins = state.weeks.filter((week) => week.winnerId === player.id).length
        const seconds = state.weeks.filter((week) => week.secondId === player.id).length
        const paid = state.weeks.filter((week) => week.paidBy.includes(player.id)).length
        const moneyBack = seconds * 5
        const winnings = state.weeks.reduce((total, week) => {
          if (week.winnerId !== player.id) {
            return total
          }

          return total + Math.max(0, week.paidBy.length * 5 - 5)
        }, 0)

        return { ...player, wins, seconds, paid, moneyBack, winnings, score: wins * 5 + seconds * 2 }
      })
      .sort((a, b) => b.score - a.score)
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

  function redrawWeek() {
    updateWeek(activeWeek.id, (week) => ({
      ...week,
      assignments: dealDrivers(state.players),
    }))
  }

  function togglePaid(playerId: string) {
    updateWeek(activeWeek.id, (week) => {
      const paidBy = week.paidBy.includes(playerId)
        ? week.paidBy.filter((id) => id !== playerId)
        : [...week.paidBy, playerId]

      return { ...week, paidBy }
    })
  }

  function addMessage(body: string) {
    const clean = body.trim()
    if (!clean) {
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

  function addPlayer(event: FormEvent) {
    event.preventDefault()
    const clean = newPlayerName.trim()
    if (!clean) {
      return
    }

    const player: Player = {
      id: clean.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: clean,
      handle: 'Rookie',
      color: ['#d92525', '#0f8b5f', '#2563eb', '#f59e0b', '#7c3aed', '#0891b2'][
        state.players.length % 6
      ],
    }

    updateState({
      ...state,
      players: [...state.players, player],
      weeks: state.weeks.map((week) => ({
        ...week,
        assignments: { ...week.assignments, [player.id]: [] },
      })),
    })
    setNewPlayerName('')
  }

  function addWeek(event: FormEvent) {
    event.preventDefault()
    const clean = newWeekName.trim()
    if (!clean) {
      return
    }

    const week: Week = {
      id: `w${Date.now()}`,
      race: clean,
      track: 'Next race',
      date: 'TBD',
      paidBy: [],
      assignments: dealDrivers(state.players),
    }

    updateState({
      ...state,
      activeWeekId: week.id,
      weeks: [...state.weeks, week],
    })
    setNewWeekName('')
  }

  const pot = activeWeek.paidBy.length * 5
  const winnerPayout = Math.max(0, pot - 5)

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="app-mark">
            <Flag size={22} />
          </div>
          <div>
            <p className="eyebrow">Ridge crew racing pool</p>
            <h1>Shuyler Ridge Raceday</h1>
          </div>
        </div>

        <label className="user-switch">
          <span>You</span>
          <select
            value={state.currentUserId}
            onChange={(event) => updateState({ ...state, currentUserId: event.target.value })}
          >
            {state.players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      <section className="race-strip" aria-label="Current race">
        <div className="track-art">
          <span />
        </div>
        <div>
          <p>{activeWeek.date}</p>
          <h2>{activeWeek.race}</h2>
          <span>{activeWeek.track}</span>
        </div>
        <div className="pot-pill">
          <Banknote size={17} />
          {formatCurrency(pot)}
        </div>
      </section>

      {view === 'garage' && (
        <section className="screen">
          <div className="hero-panel">
            <div>
              <p className="eyebrow">Your garage</p>
              <h2>{currentUser.name}'s draw</h2>
            </div>
            <div className="mini-stat">
              <Crown size={18} />
              {standings.findIndex((player) => player.id === currentUser.id) + 1}
            </div>
          </div>

          <div className="driver-list">
            {myDrivers.map((driver) => (
              <article className="driver-card" key={`${driver.number}-${driver.name}`}>
                <div className="car-number">#{driver.number}</div>
                <div>
                  <h3>{driver.name}</h3>
                  <p>{driver.team}</p>
                </div>
              </article>
            ))}
          </div>

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
              <span>Drivers each</span>
              <strong>{myDrivers.length}</strong>
            </div>
          </div>
        </section>
      )}

      {view === 'draw' && (
        <section className="screen">
          <div className="section-head">
            <div>
              <p className="eyebrow">Weekly hat draw</p>
              <h2>Everyone's teams</h2>
            </div>
            <button className="icon-button" type="button" onClick={redrawWeek} aria-label="Redraw drivers">
              <RefreshCw size={20} />
            </button>
          </div>

          <div className="fairness-band">
            <ShieldCheck size={20} />
            <p>Drivers and player order are shuffled separately. Extra drivers, when needed, land by random order.</p>
          </div>

          <div className="team-stack">
            {state.players.map((player) => (
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
                <div className="number-row">
                  {(activeWeek.assignments[player.id] ?? []).map((driver) => (
                    <span key={`${player.id}-${driver.number}`}>#{driver.number}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {view === 'league' && (
        <section className="screen">
          <div className="section-head">
            <div>
              <p className="eyebrow">Season board</p>
              <h2>Standings</h2>
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
                    {player.wins} wins, {player.seconds} seconds, paid {player.paid} weeks
                  </p>
                </div>
                <strong>{formatCurrency(player.winnings + player.moneyBack)}</strong>
              </article>
            ))}
          </div>

          <div className="history-list">
            {state.weeks.map((week) => {
              const winner = state.players.find((player) => player.id === week.winnerId)
              const second = state.players.find((player) => player.id === week.secondId)

              return (
                <article className="history-row" key={week.id}>
                  <div>
                    <h3>{week.race}</h3>
                    <p>{week.track}</p>
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

      {view === 'chat' && (
        <section className="screen chat-screen">
          <div className="section-head">
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

      {view === 'admin' && (
        <section className="screen">
          <div className="section-head">
            <div>
              <p className="eyebrow">Commissioner mode</p>
              <h2>Week controls</h2>
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

            <div className="paid-grid">
              {state.players.map((player) => (
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
                  {state.players.map((player) => (
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
                  {state.players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <form className="inline-form" onSubmit={addPlayer}>
            <input
              value={newPlayerName}
              onChange={(event) => setNewPlayerName(event.target.value)}
              placeholder="Add friend"
              aria-label="Add friend"
            />
            <button type="submit" aria-label="Add friend">
              <Plus size={18} />
            </button>
          </form>

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

      <nav className="bottom-nav" aria-label="Primary">
        {views.map(({ id, label, Icon }) => (
          <button className={view === id ? 'active' : ''} key={id} type="button" onClick={() => setView(id)}>
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </main>
  )
}

export default App
