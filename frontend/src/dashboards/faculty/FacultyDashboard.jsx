import React from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import Sidebar from '../../components/Sidebar'
import FacultyCertificateGenerator from './FacultyCertificateGenerator'
import { EventHistoryContent } from '../guest/GuestHistory'

export default function FacultyDashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()

  const isHistoryPath = location.pathname.endsWith('/history')
  const activeTab = isHistoryPath ? 'history' : (searchParams.get('tab') || 'generate')
  const forceNew = searchParams.get('new') === '1'

  const handleTabChange = (tab) => {
    if (tab === 'history') {
      navigate('/faculty/history')
    } else {
      navigate('/faculty')
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Top Navigation Tabs */}
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-6">
                <button
                  type="button"
                  onClick={() => handleTabChange('generate')}
                  className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'generate'
                      ? 'border-indigo-600 text-indigo-600 font-semibold'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  🎓 Generate Certificates
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange('history')}
                  className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'history'
                      ? 'border-indigo-600 text-indigo-600 font-semibold'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  📜 Certificate History
                </button>
              </nav>
            </div>

            {/* Tab content */}
            {activeTab === 'generate' ? (
              <FacultyCertificateGenerator forceNew={forceNew} />
            ) : (
              <EventHistoryContent
                title="Faculty Certificate History"
                description="View past certificate generation events, edit event names, download ZIP packages, or send emails."
                onNewSession={() => navigate('/faculty?tab=generate&new=1')}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
