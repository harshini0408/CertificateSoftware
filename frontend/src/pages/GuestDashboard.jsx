import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axiosInstance from '../utils/axiosInstance'
import { useAuthStore } from '../store/authStore'
import GuestWizard from '../components/GuestWizard'

const DownloadIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="7 10 12 15 17 10"></polyline>
    <line x1="12" y1="15" x2="12" y2="3"></line>
  </svg>
)

const EyeIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>
)

export default function GuestDashboard() {
  const user = useAuthStore((s) => s.user)
  const [selectedClub, setSelectedClub] = useState('')
  const [selectedEvent, setSelectedEvent] = useState('')

  // 1. Fetch clubs
  const { data: clubs, isLoading: isLoadingClubs } = useQuery({
    queryKey: ['guestClubs'],
    queryFn: async () => {
      const res = await axiosInstance.get('/clubs')
      return res.data
    },
  })

  // 2. Fetch events for selected club
  const { data: events, isLoading: isLoadingEvents } = useQuery({
    queryKey: ['guestEvents', selectedClub],
    queryFn: async () => {
      const res = await axiosInstance.get(`/clubs/${selectedClub}/events`)
      return res.data
    },
    enabled: !!selectedClub,
  })

  // Handle club change — reset event
  const handleClubChange = (e) => {
    setSelectedClub(e.target.value)
    setSelectedEvent('')
  }

  // 3. Fetch previous certificates for this guest
  const { data: certificates, isLoading: isLoadingCerts } = useQuery({
    queryKey: ['guestCertificates', selectedClub, selectedEvent],
    queryFn: async () => {
      const res = await axiosInstance.get(`/clubs/${selectedClub}/events/${selectedEvent}/certificates`)
      return res.data
    },
    enabled: !!selectedClub && !!selectedEvent,
  })

  // Filter certificates down to only those matching the current logged in guest's email.
  // The guest user generated their own certificate in the system as a participant, or generated certificates for themselves.
  const myCertificates = (certificates || []).filter(
    (cert) => cert.participant_email?.toLowerCase() === user?.email?.toLowerCase() ||
              cert.snapshot?.email?.toLowerCase() === user?.email?.toLowerCase()
  )

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* ── Selection Area ─────────────────────────────────────────────────── */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
        <h2 className="text-xl font-semibold">Select Workspace</h2>
        <p className="text-sm text-gray-500 pb-2">
          Choose a club and event to manage or view your certificates.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Club
            </label>
            <select
              className="w-full form-input"
              value={selectedClub}
              onChange={handleClubChange}
              disabled={isLoadingClubs}
            >
              <option value="">Select a club...</option>
              {clubs?.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Event
            </label>
            <select
              className="w-full form-input"
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              disabled={!selectedClub || isLoadingEvents}
            >
              <option value="">Select an event...</option>
              {events?.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} ({new Date(ev.event_date).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedClub && selectedEvent && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* ── Left Column: Generate Certificate (GuestWizard) ───────────── */}
          <div className="lg:col-span-8 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <div className="mb-6 border-b border-gray-100 pb-4">
              <h2 className="text-xl font-semibold">Generate Certificate</h2>
              <p className="text-sm text-gray-500">
                Follow the steps below to upload templates and generate bulk certificates.
              </p>
            </div>
            
            {/* 
              Force remount on user, club, or event change so that local state
              (like step state in GuestWizard) gets completely wiped on change.
            */}
            <GuestWizard
              key={`${user?.email}-${selectedClub}-${selectedEvent}`}
              clubId={selectedClub}
              eventId={selectedEvent}
            />
          </div>

          {/* ── Right Column: Previous Certificates ───────────────────────── */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm relative">
              <h2 className="text-xl font-semibold mb-4">Previous Certificates</h2>
              <p className="text-sm text-gray-500 mb-6">
                Certificates already generated for {user?.name || user?.email}.
              </p>

              {isLoadingCerts ? (
                <div className="text-center py-8 text-gray-400">Loading...</div>
              ) : myCertificates.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-lg">
                  <span className="text-gray-400 text-sm">No certificates found.</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {myCertificates.map((cert) => (
                    <div
                      key={cert.id}
                      className="flex flex-col gap-2 p-4 border border-gray-100 rounded-lg bg-gray-50"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-mono text-xs font-semibold text-gray-800">
                            {cert.cert_number}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(cert.issued_at || cert.generated_at || Date.now()).toLocaleDateString()}
                          </p>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${
                            cert.status === 'emailed'
                              ? 'bg-green-100 text-green-700'
                              : cert.status === 'generated'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {cert.status}
                        </span>
                      </div>
                      
                      {cert.pdf_url && (
                        <div className="flex gap-2 mt-2">
                          <a
                            href={cert.pdf_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-xs px-3 py-1.5 bg-white border border-gray-200 rounded text-gray-700 hover:bg-gray-50 transition"
                          >
                            <EyeIcon className="w-3.5 h-3.5" /> View
                          </a>
                          <a
                            href={cert.pdf_url}
                            download={`${cert.cert_number}.png`}
                            className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-50 border border-blue-100 rounded text-blue-600 hover:bg-blue-100 transition"
                          >
                            <DownloadIcon className="w-3.5 h-3.5" /> Download
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
        </div>
      )}
    </div>
  )
}
