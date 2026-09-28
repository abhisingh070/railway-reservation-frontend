const API_BASE = import.meta.env.DEV ? '' : 'http://localhost:8080'

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    })
  } catch {
    throw new Error('Could not connect to the railway server. Check that the backend is running at localhost:8080.')
  }

  if (!response.ok) {
    let detail = ''
    try {
      const body = await response.json()
      detail = body.message || body.error || ''
    } catch {
      detail = ''
    }
    throw new Error(detail || `Request failed (${response.status} ${response.statusText})`)
  }
  if (response.status === 204) return null
  return response.json()
}

const json = (method, body) => ({ method, body: JSON.stringify(body) })
const query = (values) => new URLSearchParams(values).toString()

export const api = {
  listTrains: () => request('/api/trains'),
  searchTrains: (source, destination) => request(`/api/trains/search?${query({ source, destination })}`),
  getTrain: (trainNumber) => request(`/api/trains/${encodeURIComponent(trainNumber)}`),
  createTrain: (data) => request('/api/trains', json('POST', data)),
  listPassengers: () => request('/api/passengers'),
  getPassenger: (id) => request(`/api/passengers/${id}`),
  createPassenger: (data) => request('/api/passengers', json('POST', data)),
  createReservation: (data) => request('/api/reservations', json('POST', data)),
  getReservation: (id) => request(`/api/reservations/${id}`),
  cancelReservation: (id) => request(`/api/reservations/${id}/cancel`, { method: 'POST' }),
  availability: (trainNumber, journeyDate) => request(`/api/reservations/availability?${query({ trainNumber, journeyDate })}`),
  confirmedPassengers: (trainNumber, journeyDate) => request(`/api/reservations/confirmed?${query({ trainNumber, journeyDate })}`),
  passengerReservations: (id) => request(`/api/reservations/by-passenger/${id}`),
}
