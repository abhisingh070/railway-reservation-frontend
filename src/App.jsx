import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './services/api'
import './App.css'

const today = () => new Date().toLocaleDateString('en-CA')
const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0)

function Icon({ name, size = 20 }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    train: <><rect x="5" y="2" width="14" height="16" rx="3"/><path d="M8 21l2-3m6 3-2-3M5 10h14M8 6h.01M16 6h.01M8 14h.01M16 14h.01"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    ticket: <><path d="M2 9a3 3 0 0 0 0 6v4h20v-4a3 3 0 0 1 0-6V5H2z"/><path d="M13 5v2m0 4v2m0 4v2"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    arrow: <><path d="M5 12h14m-7-7 7 7-7 7"/></>,
    swap: <><path d="m16 3 4 4-4 4M4 7h16M8 21l-4-4 4-4m12 4H4"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    plus: <path d="M12 5v14m-7-7h14"/>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    close: <path d="m18 6-12 12M6 6l12 12"/>,
    calendar: <><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function Button({ children, variant = 'primary', className = '', ...props }) {
  return <button className={`button button-${variant} ${className}`} {...props}>{children}</button>
}

function Field({ label, hint, ...props }) {
  return <label className="field"><span>{label}</span><input {...props} />{hint && <small>{hint}</small>}</label>
}

function SelectField({ label, children, ...props }) {
  return <label className="field"><span>{label}</span><select {...props}>{children}</select></label>
}

function Status({ value }) {
  return <span className={`status status-${String(value).toLowerCase()}`}><i />{value}</span>
}

function EmptyState({ title, detail }) {
  return <div className="empty-state"><div className="empty-icon"><Icon name="ticket" size={22}/></div><strong>{title}</strong><p>{detail}</p></div>
}

function Notice({ notice, onClose }) {
  if (!notice) return null
  return <div className={`notice notice-${notice.type}`} role="status"><span>{notice.message}</span><button aria-label="Dismiss message" onClick={onClose}><Icon name="close" size={16}/></button></div>
}

function App() {
  const [page, setPage] = useState('Overview')
  const [trains, setTrains] = useState([])
  const [passengers, setPassengers] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState(null)
  const [route, setRoute] = useState({ source: '', destination: '' })
  const [filteredTrains, setFilteredTrains] = useState(null)
  const [selectedTrain, setSelectedTrain] = useState(null)
  const [activeModal, setActiveModal] = useState('')
  const [journeyDate, setJourneyDate] = useState(today())
  const [reservationLookup, setReservationLookup] = useState('')
  const [lookupResult, setLookupResult] = useState(null)
  const [historyId, setHistoryId] = useState('')
  const [history, setHistory] = useState(null)
  const [availability, setAvailability] = useState(null)
  const [confirmed, setConfirmed] = useState(null)
  const [busy, setBusy] = useState(false)

  const refreshData = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [trainList, passengerList] = await Promise.all([api.listTrains(), api.listPassengers()])
      setTrains(trainList)
      setPassengers(passengerList)
      setFilteredTrains(null)
    } catch (error) {
      setLoadError(error.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refreshData() }, [refreshData])
  const shownTrains = filteredTrains ?? trains
  const stats = useMemo(() => ({ trains: trains.length, passengers: passengers.length }), [trains, passengers])

  const notify = (message, type = 'success') => {
    setNotice({ message, type })
    window.setTimeout(() => setNotice(null), 5500)
  }

  async function searchTrains(event) {
    event.preventDefault()
    if (!route.source.trim() || !route.destination.trim()) return notify('Enter both cities to search.', 'error')
    setBusy(true)
    try {
      const results = await api.searchTrains(route.source.trim(), route.destination.trim())
      setFilteredTrains(results)
      setPage('Trains')
      setSelectedTrain(null)
    } catch (error) { notify(error.message, 'error') } finally { setBusy(false) }
  }

  async function chooseTrain(train) {
    setSelectedTrain(train)
    setJourneyDate(today())
    setPage('Trains')
    setAvailability(null)
    try { setSelectedTrain(await api.getTrain(train.trainNumber)) } catch (error) { notify(error.message, 'error') }
  }

  async function checkAvailability() {
    if (!selectedTrain || !journeyDate) return
    setBusy(true)
    try {
      const [seats, people] = await Promise.all([
        api.availability(selectedTrain.trainNumber, journeyDate),
        api.confirmedPassengers(selectedTrain.trainNumber, journeyDate),
      ])
      setAvailability(seats)
      setConfirmed(people)
    } catch (error) { notify(error.message, 'error') } finally { setBusy(false) }
  }

  async function submitBooking(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const train = trains.find((item) => item.trainNumber === form.get('trainNumber'))
    if (!train) return notify('Choose a train from the current train list.', 'error')
    setBusy(true)
    try {
      const reservation = await api.createReservation({
        trainNumber: train.trainNumber,
        passengerId: Number(form.get('passengerId')),
        source: train.source,
        destination: train.destination,
        journeyDate: form.get('journeyDate'),
      })
      setLookupResult(reservation)
      setReservationLookup(String(reservation.reservationId))
      setActiveModal('')
      setPage('Reservations')
      notify(reservation.status === 'WAITLISTED' ? `Added to the waitlist · reservation #${reservation.reservationId}` : `Booking confirmed · seat ${reservation.seatNumber}`)
      if (selectedTrain) checkAvailability()
    } catch (error) { notify(error.message, 'error') } finally { setBusy(false) }
  }

  async function submitPassenger(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    try {
      const passenger = await api.createPassenger({ name: form.get('name').trim(), age: Number(form.get('age')), gender: form.get('gender') })
      setPassengers((current) => [...current, passenger])
      setActiveModal('')
      notify(`${passenger.name} added to passengers.`)
    } catch (error) { notify(error.message, 'error') } finally { setBusy(false) }
  }

  async function lookupReservation(event) {
    event.preventDefault()
    if (!reservationLookup.trim()) return
    setBusy(true)
    try { setLookupResult(await api.getReservation(reservationLookup.trim())) } catch (error) { setLookupResult(null); notify(error.message, 'error') } finally { setBusy(false) }
  }

  async function cancelReservation(id) {
    if (!window.confirm(`Cancel reservation #${id}?`)) return
    setBusy(true)
    try {
      const result = await api.cancelReservation(id)
      setLookupResult(result.cancelledReservation)
      notify(result.promotedReservation ? `Reservation cancelled. #${result.promotedReservation.reservationId} moved from waitlist to seat ${result.promotedReservation.seatNumber}.` : 'Reservation cancelled successfully.')
      if (historyId) loadHistory(historyId)
    } catch (error) { notify(error.message, 'error') } finally { setBusy(false) }
  }

  async function loadHistory(id = historyId) {
    if (!String(id).trim()) return
    setBusy(true)
    try {
      const [person, reservations] = await Promise.all([api.getPassenger(id), api.passengerReservations(id)])
      setHistory({ passenger: person, reservations })
      setHistoryId(String(id))
    } catch (error) { setHistory(null); notify(error.message, 'error') } finally { setBusy(false) }
  }

  async function createTrain(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    try {
      const train = await api.createTrain({ trainNumber: form.get('trainNumber').trim(), trainName: form.get('trainName').trim(), source: form.get('source').trim(), destination: form.get('destination').trim(), totalSeats: Number(form.get('totalSeats')), fare: Number(form.get('fare')) })
      setTrains((current) => [...current, train])
      setFilteredTrains(null)
      setActiveModal('')
      notify(`${train.trainName} added to the network.`)
    } catch (error) { notify(error.message, 'error') } finally { setBusy(false) }
  }

  const navItems = [ ['Overview', 'grid'], ['Trains', 'train'], ['Passengers', 'users'], ['Reservations', 'ticket'] ]
  const pageTitle = { Overview: 'Your journey, organized.', Trains: 'Find your next train.', Passengers: 'People on the move.', Reservations: 'Every ticket in one place.' }[page]

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#overview" onClick={() => setPage('Overview')}><span className="brand-mark"><Icon name="train" size={21}/></span><span>Railway<span className="brand-light">Desk</span></span></a>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="nav-list" aria-label="Main navigation">{navItems.map(([item, icon]) => <button key={item} className={`nav-item ${page === item ? 'active' : ''}`} onClick={() => setPage(item)}><Icon name={icon} size={18}/><span>{item}</span>{item === 'Reservations' && <span className="nav-dot"/>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><Icon name="check" size={17}/></div><strong>Travel made simple</strong><p>Your journeys and bookings, all together.</p></div><div className="connection"><span className={`connection-dot ${loadError ? 'offline' : ''}`}/><span>{loadError ? 'Backend unavailable' : 'Railway API connected'}</span></div></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="breadcrumb">Railway Desk <Icon name="chevron" size={14}/> <span>{page}</span></div><div className="top-actions"><span className="today-label"><Icon name="calendar" size={15}/>{new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date())}</span><button className="avatar" title="Workspace profile">RD</button></div></header>
      <div className="page-content">
        <Notice notice={notice} onClose={() => setNotice(null)}/>
        <section className="welcome-row"><div><div className="eyebrow"><span/> RAILWAY RESERVATION SYSTEM</div><h1>{pageTitle}</h1><p className="page-subtitle">Plan routes, manage passengers, and keep every reservation on track.</p></div><div className="welcome-actions"><Button variant="secondary" onClick={() => setActiveModal('passenger')}><Icon name="plus" size={17}/> Add passenger</Button><Button onClick={() => setActiveModal('booking')}><Icon name="plus" size={17}/> New booking</Button></div></section>

        {(page === 'Overview' || page === 'Trains') && <>
          <section className="search-panel"><div className="search-head"><div><span className="section-kicker">ROUTE PLANNER</span><h2>Where would you like to go?</h2></div><span className="search-caption">Search available routes</span></div>
            <form className="route-form" onSubmit={searchTrains}><label className="route-input"><span>FROM</span><div><Icon name="pin" size={18}/><input placeholder="Departure city" value={route.source} onChange={(e) => setRoute({ ...route, source: e.target.value })}/></div></label><button className="swap-button" type="button" aria-label="Swap route" onClick={() => setRoute({ source: route.destination, destination: route.source })}><Icon name="swap" size={18}/></button><label className="route-input"><span>TO</span><div><Icon name="pin" size={18}/><input placeholder="Destination city" value={route.destination} onChange={(e) => setRoute({ ...route, destination: e.target.value })}/></div></label><Button type="submit" disabled={busy}><Icon name="search" size={17}/>{busy ? 'Searching…' : 'Search trains'}</Button></form>
          </section>
          {page === 'Overview' && <section className="metrics-grid"><div className="metric-card"><span className="metric-icon train-tone"><Icon name="train"/></span><span className="metric-label">TRAINS IN NETWORK</span><strong>{loading ? '—' : stats.trains}</strong><small>Available routes</small></div><div className="metric-card"><span className="metric-icon people-tone"><Icon name="users"/></span><span className="metric-label">REGISTERED PASSENGERS</span><strong>{loading ? '—' : stats.passengers}</strong><small>Ready to travel</small></div><div className="metric-card feature-metric"><div className="feature-copy"><span className="metric-label">READY WHEN YOU ARE</span><strong>Make your next<br/>journey count.</strong><button onClick={() => setPage('Trains')}>Explore all trains <Icon name="arrow" size={15}/></button></div><div className="rail-art" aria-hidden="true"><div className="sun"/><div className="horizon"/><div className="rail-line rail-one"/><div className="rail-line rail-two"/><div className="train-art"><Icon name="train" size={30}/></div></div></div></section>}
          <div className="section-heading"><div><span className="section-kicker">{filteredTrains ? 'SEARCH RESULTS' : 'THE NETWORK'}</span><h2>{filteredTrains ? `Trains from ${route.source} to ${route.destination}` : 'Train services'}</h2></div><div className="heading-tools"><span className="result-count">{loading ? 'Loading…' : `${shownTrains.length} ${shownTrains.length === 1 ? 'service' : 'services'}`}</span><button className="text-action" onClick={() => setActiveModal('train')}><Icon name="plus" size={16}/> Add train</button><button className="icon-button" title="Refresh" onClick={refreshData}>↻</button></div></div>
          <TrainList trains={shownTrains} loading={loading} error={loadError} onRetry={refreshData} onSelect={chooseTrain} onBook={(train) => { setSelectedTrain(train); setActiveModal('booking') }} onReset={() => setFilteredTrains(null)}/>
          {selectedTrain && <TrainDetail train={selectedTrain} date={journeyDate} setDate={setJourneyDate} availability={availability} confirmed={confirmed} busy={busy} onCheck={checkAvailability} onBook={() => setActiveModal('booking')} onClose={() => { setSelectedTrain(null); setAvailability(null); setConfirmed(null) }}/>}
        </>}

        {page === 'Passengers' && <PassengersPage passengers={passengers} loading={loading} error={loadError} onRetry={refreshData} onAdd={() => setActiveModal('passenger')} onHistory={(person) => { setHistoryId(String(person.passengerId)); setPage('Reservations'); loadHistory(person.passengerId) }}/ >}
        {page === 'Reservations' && <ReservationsPage passengers={passengers} lookup={reservationLookup} setLookup={setReservationLookup} result={lookupResult} onLookup={lookupReservation} onCancel={cancelReservation} busy={busy} historyId={historyId} setHistoryId={setHistoryId} history={history} onHistory={() => loadHistory()}/ >}
      </div>
      <footer className="footer"><span>Railway Desk <span className="footer-sep">·</span> Reservation management</span><span>Connected to <code>localhost:8080</code></span></footer>
    </main>
    {activeModal && <Modal title={{ booking: 'Create a reservation', passenger: 'Add a passenger', train: 'Add a train' }[activeModal]} onClose={() => setActiveModal('')}>
      {activeModal === 'booking' && <form className="modal-form" onSubmit={submitBooking}><SelectField label="Train service" name="trainNumber" required defaultValue={selectedTrain?.trainNumber || ''}><option value="" disabled>Select a train</option>{trains.map((train) => <option key={train.trainNumber} value={train.trainNumber}>{train.trainNumber} · {train.trainName} · {train.source} to {train.destination}</option>)}</SelectField><SelectField label="Passenger" name="passengerId" required defaultValue=""><option value="" disabled>Select a passenger</option>{passengers.map((person) => <option key={person.passengerId} value={person.passengerId}>{person.name} · #{person.passengerId}</option>)}</SelectField><Field label="Journey date" name="journeyDate" type="date" min={today()} defaultValue={journeyDate || today()} required/><div className="modal-hint">The route is filled from the selected train. Seat confirmation or waitlist status is returned by the railway service.</div><div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setActiveModal('')}>Cancel</Button><Button disabled={busy}>{busy ? 'Booking…' : 'Confirm booking'} <Icon name="arrow" size={16}/></Button></div></form>}
      {activeModal === 'passenger' && <form className="modal-form" onSubmit={submitPassenger}><Field label="Full name" name="name" placeholder="e.g. Asha Kumar" maxLength="120" required/><Field label="Age" name="age" type="number" min="0" max="120" placeholder="Age" required/><SelectField label="Gender" name="gender" required defaultValue=""><option value="" disabled>Select an option</option><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="OTHER">Other</option><option value="PREFER_NOT_TO_SAY">Prefer not to say</option></SelectField><div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setActiveModal('')}>Cancel</Button><Button disabled={busy}>{busy ? 'Saving…' : 'Add passenger'}</Button></div></form>}
      {activeModal === 'train' && <form className="modal-form" onSubmit={createTrain}><Field label="Train number" name="trainNumber" placeholder="e.g. 12901" required/><Field label="Train name" name="trainName" placeholder="e.g. Deccan Express" required/><div className="form-row"><Field label="From" name="source" placeholder="City" required/><Field label="To" name="destination" placeholder="City" required/></div><div className="form-row"><Field label="Total seats" name="totalSeats" type="number" min="1" required/><Field label="Fare (₹)" name="fare" type="number" min="0.01" step="0.01" required/></div><div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setActiveModal('')}>Cancel</Button><Button disabled={busy}>{busy ? 'Saving…' : 'Add train'}</Button></div></form>}
    </Modal>}
  </div>
}

function TrainList({ trains, loading, error, onRetry, onSelect, onBook, onReset }) {
  if (loading) return <div className="panel loading-panel"><span className="spinner"/>Loading train services…</div>
  if (error) return <div className="panel error-panel"><strong>Couldn’t load trains</strong><p>{error}</p><Button variant="secondary" onClick={onRetry}>Try again</Button></div>
  if (!trains.length) return <div className="panel"><EmptyState title="No train services found" detail="Try another route or add a train service to your network."/>{onReset && <button className="text-action center-action" onClick={onReset}>Show all trains</button>}</div>
  return <div className="train-grid">{trains.map((train) => <article className="train-card" key={train.trainNumber}><div className="train-card-top"><span className="train-logo"><Icon name="train" size={18}/></span><span className="train-number">#{train.trainNumber}</span><button className="more-button" aria-label={`View ${train.trainName} details`} onClick={() => onSelect(train)}><Icon name="chevron" size={17}/></button></div><h3>{train.trainName}</h3><div className="route-line"><div><strong>{train.source}</strong><span>ORIGIN</span></div><div className="route-track"><i/><span/><i/></div><div className="route-dest"><strong>{train.destination}</strong><span>DESTINATION</span></div></div><div className="train-card-bottom"><div><span>FARE FROM</span><strong>{money(train.fare)}</strong></div><div><span>SEAT CAPACITY</span><strong>{train.totalSeats} seats</strong></div></div><div className="train-actions"><button onClick={() => onSelect(train)}>View details <Icon name="arrow" size={14}/></button><Button onClick={() => onBook(train)}>Book seat</Button></div></article>)}</div>
}

function TrainDetail({ train, date, setDate, availability, confirmed, busy, onCheck, onBook, onClose }) {
  return <section className="detail-panel"><div className="detail-header"><div><span className="section-kicker">SERVICE DETAILS</span><h2>{train.trainName} <span className="detail-number">#{train.trainNumber}</span></h2></div><button className="icon-button" aria-label="Close details" onClick={onClose}><Icon name="close" size={16}/></button></div><div className="detail-route"><div><span>FROM</span><strong>{train.source}</strong></div><div className="route-track"><i/><span/><i/></div><div><span>TO</span><strong>{train.destination}</strong></div><div className="detail-fare"><span>FARE</span><strong>{money(train.fare)}</strong></div></div><div className="availability-tools"><Field label="Journey date" type="date" min={today()} value={date} onChange={(e) => setDate(e.target.value)}/><Button variant="secondary" onClick={onCheck} disabled={busy}>{busy ? 'Checking…' : 'Check availability'}</Button><Button onClick={onBook}><Icon name="plus" size={16}/> Book this train</Button></div>{availability && <div className="availability-result"><div className="availability-count"><span className="availability-check"><Icon name="check" size={17}/></span><div><strong>{availability.availableSeatCount} seats available</strong><span>of {availability.totalSeats} total · {availability.journeyDate}</span></div></div><div className="seat-chips">{availability.availableSeatNumbers.length ? availability.availableSeatNumbers.map((seat) => <span key={seat}>Seat {seat}</span>) : <em>Currently full · new bookings may be waitlisted</em>}</div></div>}{confirmed && <div className="confirmed-box"><div className="confirmed-title"><strong>Confirmed passengers</strong><span>{confirmed.length} passengers</span></div>{confirmed.length ? <div className="confirmed-list">{confirmed.map((person) => <div key={person.reservationId}><span className="seat-tag">{person.seatNumber}</span><span>{person.passengerName}<small> · {person.source} to {person.destination}</small></span><span className="passenger-age">{person.age} yrs</span></div>)}</div> : <p className="muted-note">No confirmed passengers for this date yet.</p>}</div>}</section>
}

function PassengersPage({ passengers, loading, error, onRetry, onAdd, onHistory }) {
  return <><div className="section-heading page-section-heading"><div><span className="section-kicker">PASSENGER DIRECTORY</span><h2>Registered passengers</h2><p className="section-description">Manage traveler profiles and open their reservation history.</p></div><Button onClick={onAdd}><Icon name="plus" size={16}/> Add passenger</Button></div>{loading ? <div className="panel loading-panel"><span className="spinner"/>Loading passengers…</div> : error ? <div className="panel error-panel"><strong>Couldn’t load passengers</strong><p>{error}</p><Button variant="secondary" onClick={onRetry}>Try again</Button></div> : passengers.length ? <div className="panel passenger-table-wrap"><table><thead><tr><th>PASSENGER</th><th>PASSENGER ID</th><th>AGE</th><th>GENDER</th><th/></tr></thead><tbody>{passengers.map((person) => <tr key={person.passengerId}><td><div className="person-cell"><span className="person-avatar">{person.name.slice(0, 1).toUpperCase()}</span><strong>{person.name}</strong></div></td><td><span className="id-pill">#{person.passengerId}</span></td><td>{person.age}</td><td>{person.gender.replaceAll('_', ' ')}</td><td><button className="table-action" onClick={() => onHistory(person)}>View history <Icon name="arrow" size={14}/></button></td></tr>)}</tbody></table></div> : <div className="panel"><EmptyState title="No passengers yet" detail="Add a passenger profile before creating a reservation."/><div className="empty-button"><Button onClick={onAdd}><Icon name="plus" size={16}/> Add passenger</Button></div></div>}</>
}

function ReservationsPage({ passengers, lookup, setLookup, result, onLookup, onCancel, busy, historyId, setHistoryId, history, onHistory }) {
  return <><section className="reservation-tools"><div><span className="section-kicker">QUICK LOOKUP</span><h2>Find a reservation</h2><p className="section-description">Enter a reservation ID to view its current status or cancel it.</p></div><form className="lookup-form" onSubmit={onLookup}><input type="number" min="1" placeholder="Reservation ID" value={lookup} onChange={(e) => setLookup(e.target.value)}/><Button disabled={busy}><Icon name="search" size={16}/> Find ticket</Button></form></section>{result && <ReservationCard reservation={result} onCancel={onCancel} busy={busy}/>}<section className="reservation-tools history-tools"><div><span className="section-kicker">TRAVEL RECORD</span><h2>Passenger history</h2><p className="section-description">Review all reservations linked to a passenger.</p></div><form className="lookup-form" onSubmit={(e) => { e.preventDefault(); onHistory() }}><select value={historyId} onChange={(e) => setHistoryId(e.target.value)}><option value="">Select passenger</option>{passengers.map((person) => <option key={person.passengerId} value={person.passengerId}>{person.name} · #{person.passengerId}</option>)}</select><Button variant="secondary" disabled={busy}>View history</Button></form></section>{history && <div className="panel history-panel"><div className="history-header"><div className="person-cell"><span className="person-avatar">{history.passenger.name.slice(0,1).toUpperCase()}</span><div><strong>{history.passenger.name}</strong><small>Passenger #{history.passenger.passengerId} · {history.passenger.age} years · {history.passenger.gender.replaceAll('_', ' ')}</small></div></div><span className="result-count">{history.reservations.length} reservations</span></div>{history.reservations.length ? <div className="reservation-list">{history.reservations.map((reservation) => <ReservationRow key={reservation.reservationId} reservation={reservation} onCancel={onCancel} busy={busy}/>)}</div> : <EmptyState title="No reservations found" detail="This passenger does not have a travel history yet."/>}</div>}</>
}

function ReservationCard({ reservation, onCancel, busy }) {
  return <div className="panel reservation-card"><div className="reservation-card-top"><div className="ticket-id"><span className="ticket-icon"><Icon name="ticket" size={18}/></span><div><span>RESERVATION</span><strong>#{reservation.reservationId}</strong></div></div><Status value={reservation.status}/></div><div className="reservation-route"><div><span>{reservation.source}</span><Icon name="arrow" size={20}/><span>{reservation.destination}</span></div><small>Train #{reservation.trainNumber} · {reservation.journeyDate}</small></div><div className="reservation-bottom"><span>Passenger #{reservation.passengerId}</span><span>{reservation.seatNumber ? `Seat ${reservation.seatNumber}` : reservation.status === 'WAITLISTED' ? 'Waiting for a seat' : 'No seat assigned'}</span><strong>{money(reservation.fare)}</strong>{reservation.status !== 'CANCELLED' && <Button variant="danger" onClick={() => onCancel(reservation.reservationId)} disabled={busy}>Cancel ticket</Button>}</div></div>
}

function ReservationRow({ reservation, onCancel, busy }) {
  return <div className="reservation-row"><div className="row-route"><strong>{reservation.source} <Icon name="arrow" size={14}/> {reservation.destination}</strong><small>Train #{reservation.trainNumber} · {reservation.journeyDate} · Reservation #{reservation.reservationId}</small></div><div className="row-seat">{reservation.seatNumber ? `Seat ${reservation.seatNumber}` : '—'}</div><Status value={reservation.status}/><strong className="row-fare">{money(reservation.fare)}</strong>{reservation.status !== 'CANCELLED' && <button className="cancel-link" onClick={() => onCancel(reservation.reservationId)} disabled={busy}>Cancel</button>}</div>
}

function Modal({ title, onClose, children }) {
  useEffect(() => { const onKey = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey) }, [onClose])
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-header"><div><span className="section-kicker">RAILWAY DESK</span><h2 id="modal-title">{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><Icon name="close" size={18}/></button></div>{children}</section></div>
}

export default App
